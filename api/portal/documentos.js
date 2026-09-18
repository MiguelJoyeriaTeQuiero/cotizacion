import { handleUpload } from '@vercel/blob/client'
import { json, methodNotAllowed, readJson, isSameOrigin, parseCookies } from '../_lib/http.js'
import { randomToken } from '../_lib/crypto.js'
import { leerSesionCliente, guardarCliente, vistaCliente, MAX_DOCUMENTOS } from '../_lib/clientes.js'
import { validarDocumento, TIPOS_ADMITIDOS, TAMANO_MAXIMO } from '../_lib/validate-cliente.js'
import { hayBlob, modoAlmacen, verificarBlob, guardarLocal, borrarDocumento, TAMANO_MAXIMO_LOCAL } from '../_lib/documentos.js'
import { COOKIE_CLIENTE } from './cuenta.js'

// Documentos del expediente del cliente.
//
// Tres caminos por la misma puerta:
//   1. El SDK de Blob pide un token de subida (lo reconoce su propio `type`).
//   2. El navegador confirma que el archivo ya está subido.
//   3. En local sin Blob, el archivo llega aquí en base64.
//
// El cuerpo puede traer un archivo entero en el tercer caso, así que el límite
// de lectura sube; en los otros dos son cuatro campos.
const LIMITE_CUERPO = 5 * 1024 * 1024

// Un expediente ya aprobado no se toca: es la documentación que respalda la
// decisión.
const editable = (cliente) => cliente.estado !== 'aprobado'

export default async function handler(req, res) {
  const sesion = await leerSesionCliente(parseCookies(req)[COOKIE_CLIENTE])
  if (!sesion) return json(res, 401, { error: 'Sin sesión' })
  if (!isSameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' })

  const { cliente } = sesion

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return methodNotAllowed(res, ['POST', 'DELETE'])
  }

  let body
  try {
    body = await readJson(req, LIMITE_CUERPO)
  } catch (err) {
    const msg = err.code === 'BODY_TOO_LARGE' ? 'El archivo es demasiado grande' : 'Petición no válida'
    return json(res, 400, { error: msg })
  }

  // ─── Quitar un documento ───────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!editable(cliente)) return json(res, 409, { error: 'La solicitud ya está aprobada' })
    const doc = (cliente.documentos || []).find(d => d.id === String(body.id || ''))
    if (!doc) return json(res, 404, { error: 'Ese documento no está en tu solicitud' })

    await borrarDocumento(doc)
    const siguiente = await guardarCliente({
      ...cliente,
      documentos: cliente.documentos.filter(d => d.id !== doc.id),
    })
    return json(res, 200, { cliente: vistaCliente(siguiente) })
  }

  // ─── Token de subida (lo pide el SDK de Blob) ──────────────────────────────
  if (typeof body.type === 'string' && body.type.startsWith('blob.')) {
    if (!hayBlob()) return json(res, 501, { error: 'BLOB_NO_CONFIGURADO' })
    if (!editable(cliente)) return json(res, 409, { error: 'La solicitud ya está aprobada' })
    if ((cliente.documentos || []).length >= MAX_DOCUMENTOS) {
      return json(res, 409, { error: `No se pueden subir más de ${MAX_DOCUMENTOS} documentos` })
    }

    try {
      const resultado = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          // El destino lo impone el servidor: un cliente no puede escribir
          // dentro de la carpeta de otro por mucho que cambie la petición.
          if (!String(pathname).startsWith(`clientes/${cliente.id}/`)) {
            throw new Error('Destino no permitido')
          }
          return {
            allowedContentTypes: TIPOS_ADMITIDOS,
            maximumSizeInBytes: TAMANO_MAXIMO,
            addRandomSuffix: true,
            validUntil: Date.now() + 10 * 60 * 1000,
            tokenPayload: cliente.id,
          }
        },
      })
      return json(res, 200, resultado)
    } catch (err) {
      console.error('[documentos] token →', err.message)
      return json(res, 400, { error: 'No se ha podido preparar la subida' })
    }
  }

  const accion = String(body.accion || '')

  // ─── Confirmar un archivo ya subido a Blob ─────────────────────────────────
  if (accion === 'confirmar') {
    if (!editable(cliente)) return json(res, 409, { error: 'La solicitud ya está aprobada' })
    if ((cliente.documentos || []).length >= MAX_DOCUMENTOS) {
      return json(res, 409, { error: `No se pueden subir más de ${MAX_DOCUMENTOS} documentos` })
    }

    const url = String(body.url || '')
    const pathname = String(body.pathname || '')
    if (!pathname.startsWith(`clientes/${cliente.id}/`)) {
      return json(res, 403, { error: 'Ese archivo no es de esta solicitud' })
    }

    // No basta con que el navegador diga que subió algo: se comprueba contra el
    // almacén que existe, cuánto pesa y qué es por dentro.
    const real = await verificarBlob(url)
    if (!real) return json(res, 422, { error: 'El archivo no se ha podido comprobar. Vuelve a subirlo.' })

    const validado = validarDocumento({
      etiqueta: body.etiqueta,
      nombre: body.nombre,
      tipo: real.tipo,
      tamano: real.tamano,
    })
    if (!validado.ok) return json(res, 422, { error: validado.errores.join(' · ') })

    const doc = {
      id: `doc_${randomToken(5).slice(0, 8)}`,
      ...validado.value,
      almacen: 'blob',
      pathname,
      url,
      subidoEn: new Date().toISOString(),
    }
    const siguiente = await guardarCliente({ ...cliente, documentos: [...(cliente.documentos || []), doc] })
    return json(res, 200, { cliente: vistaCliente(siguiente) })
  }

  // ─── Renombrar la etiqueta de un documento ─────────────────────────────────
  if (accion === 'etiqueta') {
    if (!editable(cliente)) return json(res, 409, { error: 'La solicitud ya está aprobada' })
    const doc = (cliente.documentos || []).find(d => d.id === String(body.id || ''))
    if (!doc) return json(res, 404, { error: 'Ese documento no está en tu solicitud' })

    const validado = validarDocumento({ ...doc, etiqueta: body.etiqueta })
    if (!validado.ok) return json(res, 422, { error: validado.errores.join(' · ') })

    const siguiente = await guardarCliente({
      ...cliente,
      documentos: cliente.documentos.map(d => (d.id === doc.id ? { ...d, etiqueta: validado.value.etiqueta } : d)),
    })
    return json(res, 200, { cliente: vistaCliente(siguiente) })
  }

  // ─── Subida local, solo en desarrollo ──────────────────────────────────────
  if (accion === 'local') {
    if (modoAlmacen() !== 'memoria') {
      return json(res, 501, { error: 'No hay almacén de documentos configurado' })
    }
    if (!editable(cliente)) return json(res, 409, { error: 'La solicitud ya está aprobada' })
    if ((cliente.documentos || []).length >= MAX_DOCUMENTOS) {
      return json(res, 409, { error: `No se pueden subir más de ${MAX_DOCUMENTOS} documentos` })
    }

    const id = `doc_${randomToken(5).slice(0, 8)}`
    const guardado = await guardarLocal(id, body.base64, String(body.tipo || ''))
    if (!guardado) {
      return json(res, 422, {
        error: `El archivo no vale: en local no puede pasar de ${Math.round(TAMANO_MAXIMO_LOCAL / 1024 / 1024)} MB y debe ser PDF, JPG, PNG o WEBP`,
      })
    }

    const validado = validarDocumento({
      etiqueta: body.etiqueta,
      nombre: body.nombre,
      tipo: guardado.tipo,
      tamano: guardado.tamano,
    })
    if (!validado.ok) return json(res, 422, { error: validado.errores.join(' · ') })

    const doc = {
      id,
      ...validado.value,
      almacen: 'memoria',
      pathname: `clientes/${cliente.id}/${id}`,
      url: null,
      subidoEn: new Date().toISOString(),
    }
    const siguiente = await guardarCliente({ ...cliente, documentos: [...(cliente.documentos || []), doc] })
    return json(res, 200, { cliente: vistaCliente(siguiente) })
  }

  return json(res, 400, { error: 'Acción no reconocida' })
}
