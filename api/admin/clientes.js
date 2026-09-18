import { Readable } from 'node:stream'
import { json, methodNotAllowed, readJson, isSameOrigin } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'
import {
  getCliente, listarClientes, decidirCliente, guardarCliente, crearCodigoClave, ESTADOS,
} from '../_lib/clientes.js'
import { leerDocumento } from '../_lib/documentos.js'

// Clientes, desde el lado de TQM: la cola de altas por revisar, el expediente
// completo, sus documentos y la decisión.
//
// Todo esto exige sesión del panel. Un cliente del portal no llega aquí ni por
// equivocación: son cookies y almacenes distintos.

const ACCIONES = {
  aprobar: 'aprobado',
  documentacion: 'documentacion',
  rechazar: 'rechazado',
}

// El nombre viaja en una cabecera: fuera comillas, saltos y todo lo que no sea
// ASCII imprimible.
function nombreSeguro(nombre) {
  const limpio = String(nombre || '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 80)
  return limpio || 'documento'
}

function sinSecretos(cliente) {
  const { password, ...resto } = cliente
  return resto
}

function limitesValidos(input) {
  if (!input || typeof input !== 'object') return null
  const porCierre = Number(input.porCierre)
  const reservaMinutos = Number(input.reservaMinutos)
  const out = {}
  if (Number.isFinite(porCierre) && porCierre >= 0 && porCierre <= 1000000) {
    out.porCierre = Math.round(porCierre)
  }
  if (Number.isFinite(reservaMinutos) && reservaMinutos >= 5 && reservaMinutos <= 1440) {
    out.reservaMinutos = Math.round(reservaMinutos)
  }
  return Object.keys(out).length ? out : null
}

export default async function handler(req, res) {
  const session = await requireSession(req, res)
  if (!session) return

  // ─── Consulta ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost')
    const id = url.searchParams.get('id')
    const docId = url.searchParams.get('doc')

    if (id && docId) {
      const cliente = await getCliente(id)
      const doc = (cliente?.documentos || []).find(d => d.id === docId)
      if (!doc) return json(res, 404, { error: 'Documento no encontrado' })

      const contenido = await leerDocumento(doc)
      if (!contenido) return json(res, 404, { error: 'El archivo ya no está disponible' })

      res.statusCode = 200
      res.setHeader('Content-Type', contenido.tipo || 'application/octet-stream')
      res.setHeader('Content-Disposition', `inline; filename="${nombreSeguro(doc.nombre)}"`)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
      res.setHeader('Cache-Control', 'no-store')

      if (contenido.buffer) return res.end(contenido.buffer)
      return Readable.fromWeb(contenido.stream).pipe(res)
    }

    if (id) {
      const cliente = await getCliente(id)
      if (!cliente) return json(res, 404, { error: 'Cliente no encontrado' })
      return json(res, 200, { cliente: sinSecretos(cliente) })
    }

    const estado = url.searchParams.get('estado')
    const lista = await listarClientes()
    const filtrada = ESTADOS.includes(estado) ? lista.filter(c => c.estado === estado) : lista
    return json(res, 200, {
      clientes: filtrada,
      pendientes: lista.filter(c => c.estado === 'pendiente').length,
    })
  }

  // ─── Decisión ──────────────────────────────────────────────────────────────
  if (req.method !== 'PUT') return methodNotAllowed(res, ['GET', 'PUT'])
  if (!isSameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' })

  let body
  try {
    body = await readJson(req)
  } catch {
    return json(res, 400, { error: 'Petición no válida' })
  }

  const cliente = await getCliente(String(body.id || ''))
  if (!cliente) return json(res, 404, { error: 'Cliente no encontrado' })

  const accion = String(body.accion || '')
  const nota = String(body.nota || '').trim().slice(0, 400)
  const limites = limitesValidos(body.limites)

  // ─── Código para volver a entrar ───────────────────────────────────────────
  //
  // La vía de siempre: la tienda llama, se comprueba con quién se habla y se le
  // dicta un código. Es el mismo mecanismo que el del enlace por correo —de un
  // solo uso y con caducidad—, así que no hay una puerta de atrás distinta.
  //
  // El código se enseña una vez y no se guarda en claro en ningún sitio: si se
  // pierde, se genera otro.
  if (accion === 'clave') {
    const { token, minutos } = await crearCodigoClave(cliente, { por: session.username })
    return json(res, 200, { codigo: token, minutos })
  }

  // Cambiar solo los límites de la ficha, sin tocar el estado.
  if (accion === 'limites') {
    if (!limites) return json(res, 422, { error: 'Los límites no son válidos' })
    const siguiente = await guardarCliente({ ...cliente, limites: { ...cliente.limites, ...limites } })
    return json(res, 200, { cliente: sinSecretos(siguiente) })
  }

  const estado = ACCIONES[accion]
  if (!estado) return json(res, 400, { error: 'Acción no reconocida' })

  // Pedir documentación o rechazar sin decir por qué deja al cliente mirando
  // una pantalla que no le explica nada.
  if ((estado === 'documentacion' || estado === 'rechazado') && !nota) {
    return json(res, 422, { error: 'Hace falta explicar el motivo: el cliente lo va a leer tal cual' })
  }

  const siguiente = await decidirCliente(cliente, {
    estado,
    nota: estado === 'aprobado' ? '' : nota,
    por: session.username,
    limites,
  })
  return json(res, 200, { cliente: sinSecretos(siguiente) })
}
