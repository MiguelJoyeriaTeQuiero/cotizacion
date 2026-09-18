import { json, methodNotAllowed, readJson, isSameOrigin, clientIp, parseCookies } from './_lib/http.js'
import { readSession } from './_lib/auth.js'
import { leerSesionCliente, getCliente } from './_lib/clientes.js'
import { hasStorage } from './_lib/store.js'
import {
  validarLineas, validarAjuste, valorar, crearCierre, getCierre, listarCierres,
  guardarCierre, ajustarCierre, revalorizar, haVencido,
} from './_lib/cierres.js'
import { pdfCierre, csvCierre } from './_lib/justificante.js'
import { COOKIE_CLIENTE } from './portal/cuenta.js'

// Cierres. Un mismo recurso con dos públicos:
//
//   · el cliente pide un cierre y ve los suyos;
//   · TQM ve la bandeja entera y confirma o rechaza.
//
// Están en la misma función porque son el mismo dato y así el permiso se decide
// en un solo sitio, que es donde conviene tenerlo a la vista. La sesión del
// panel se mira primero; si no la hay, se prueba la del portal. Un cliente
// nunca ve un cierre que no sea suyo, y no puede confirmar nada.

const MAX_PENDIENTES = 10

function vista(cierre, { paraCliente }) {
  const { ip, ...resto } = cierre

  // Al cliente le llega el lote ajustado y lo que él pidió, para que pueda
  // comparar los dos. Quién lo tocó y por qué es cosa de casa.
  if (paraCliente) {
    delete resto.ajustes
    delete resto.ajustadoPor
  }

  return {
    ...resto,
    vencido: haVencido(cierre),
    // Al cliente no le sirve de nada saber con qué versión de fórmulas se
    // calculó; a TQM sí, para cuadrarlo con el historial.
    formulasVersion: paraCliente ? undefined : resto.formulasVersion,
  }
}

// El portal se identifica en cada petición. Hace falta porque un mismo
// navegador puede llevar las dos sesiones a la vez —alguien de TQM que además
// entra al portal para probarlo— y las dos cookies viajan a esta misma URL: sin
// esto contestaría el panel, y el portal se quedaría sin poder pedir un cierre.
const CABECERA_PORTAL = 'x-tqm-portal'

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  // La cabecera no viaja en una descarga —un enlace no lleva cabeceras—, así
  // que para eso vale también el parámetro. Solo sirve para pedir menos
  // permisos de los que se tienen, nunca más.
  const desdeElPortal = String(req.headers[CABECERA_PORTAL] || '') === '1' ||
    url.searchParams.get('portal') === '1'
  const admin = desdeElPortal ? null : await readSession(req)
  const portal = admin ? null : await leerSesionCliente(parseCookies(req)[COOKIE_CLIENTE])

  if (!admin && !portal) return json(res, 401, { error: 'Sin sesión' })
  const cliente = portal?.cliente ?? null

  // ─── Consulta ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const ref = url.searchParams.get('ref')
    const formato = url.searchParams.get('formato')

    // ── El justificante ──────────────────────────────────────────────────────
    //
    // El PDF lo puede descargar el cliente del cierre y cualquiera de TQM; el
    // bloque para el ERP es solo de casa.
    if (ref && formato) {
      const cierre = await getCierre(ref)
      if (!cierre || (cliente && cierre.clienteId !== cliente.id)) {
        return json(res, 404, { error: 'No existe ese cierre' })
      }

      if (formato === 'pdf') {
        // La dirección fiscal no se guarda en el cierre, se lee de la ficha: en
        // un papel que se archiva, el cliente va entero.
        const ficha = await getCliente(cierre.clienteId)
        const pdf = pdfCierre(cierre, ficha)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="${cierre.ref}.pdf"`)
        res.setHeader('Content-Length', pdf.length)
        res.setHeader('Cache-Control', 'private, no-store')
        return res.end(pdf)
      }

      if (formato === 'csv') {
        if (!admin) return json(res, 403, { error: 'El bloque para el ERP es del panel' })
        // El BOM es lo que hace que Excel en español abra el archivo con los
        // acentos bien sin preguntar nada.
        const csv = `﻿${csvCierre(cierre)}`
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${cierre.ref}.csv"`)
        res.setHeader('Cache-Control', 'private, no-store')
        return res.end(csv)
      }

      return json(res, 400, { error: 'Formato no reconocido' })
    }

    if (ref) {
      const cierre = await getCierre(ref)
      if (!cierre) return json(res, 404, { error: 'No existe ese cierre' })
      if (cliente && cierre.clienteId !== cliente.id) {
        // Mismo mensaje que si no existiera: desde fuera no se puede tantear
        // qué referencias hay.
        return json(res, 404, { error: 'No existe ese cierre' })
      }
      return json(res, 200, { cierre: vista(cierre, { paraCliente: Boolean(cliente) }) })
    }

    const lista = await listarCierres()
    const mios = cliente ? lista.filter(c => c.clienteId === cliente.id) : lista
    const estado = url.searchParams.get('estado')
    const filtrada = estado ? mios.filter(c => c.estado === estado) : mios

    return json(res, 200, {
      cierres: filtrada,
      pendientes: mios.filter(c => c.estado === 'pendiente').length,
    })
  }

  if (!isSameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' })
  if (!hasStorage()) return json(res, 503, { error: 'El servicio no está disponible ahora mismo' })

  let body
  try {
    body = await readJson(req)
  } catch {
    return json(res, 400, { error: 'Petición no válida' })
  }

  // ─── Pedir un cierre (solo clientes) ───────────────────────────────────────
  if (req.method === 'POST') {
    if (!cliente) return json(res, 403, { error: 'Los cierres los piden los clientes desde el portal' })
    if (cliente.estado !== 'aprobado') {
      return json(res, 403, { error: 'Tu cuenta todavía no está aprobada' })
    }

    const lista = await listarCierres()
    const pendientes = lista.filter(c => c.clienteId === cliente.id && c.estado === 'pendiente').length
    if (pendientes >= MAX_PENDIENTES) {
      return json(res, 429, { error: 'Tienes demasiadas solicitudes pendientes de confirmar. Llámanos y las resolvemos.' })
    }

    const validadas = validarLineas(body.lineas)
    if (!validadas.ok) return json(res, 422, { error: 'El lote no es válido', details: validadas.errores })

    const valoracion = await valorar(validadas.value)
    if (!valoracion.ok) return json(res, 422, { error: valoracion.error })

    // Un compromiso de precio no se firma con una cotización dudosa.
    if (valoracion.stale) {
      return json(res, 503, {
        error: 'Ahora mismo no tenemos cotización fiable del mercado. Inténtalo en unos minutos o llámanos.',
      })
    }

    const cierre = await crearCierre({
      cliente,
      valoracion,
      reservaMinutos: Number(cliente.limites?.reservaMinutos) || 60,
      ip: clientIp(req),
    })
    return json(res, 201, { cierre: vista(cierre, { paraCliente: true }) })
  }

  // ─── Anular una solicitud propia (solo clientes) ───────────────────────────
  if (req.method === 'DELETE') {
    if (!cliente) return json(res, 403, { error: 'Acción no permitida' })
    const cierre = await getCierre(String(body.ref || ''))
    if (!cierre || cierre.clienteId !== cliente.id) return json(res, 404, { error: 'No existe ese cierre' })
    if (cierre.estado !== 'pendiente') return json(res, 409, { error: 'Ese cierre ya no está pendiente' })

    const siguiente = await guardarCierre({
      ...cierre,
      estado: 'anulado',
      decididoEn: new Date().toISOString(),
      decididoPor: 'cliente',
    })
    return json(res, 200, { cierre: vista(siguiente, { paraCliente: true }) })
  }

  // ─── Confirmar o rechazar (solo TQM) ───────────────────────────────────────
  if (req.method !== 'PUT') return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE'])
  if (!admin) return json(res, 403, { error: 'Solo el personal de TQM confirma cierres' })

  const cierre = await getCierre(String(body.ref || ''))
  if (!cierre) return json(res, 404, { error: 'No existe ese cierre' })
  if (cierre.estado !== 'pendiente') {
    return json(res, 409, { error: `Ese cierre ya está ${cierre.estado}`, cierre: vista(cierre, { paraCliente: false }) })
  }

  const accion = String(body.accion || '')
  const nota = String(body.nota || '').trim().slice(0, 400)

  // ─── Ajustar el lote ───────────────────────────────────────────────────────
  //
  // Lo que dice el cliente por teléfono y lo que dice la báscula no siempre es
  // lo mismo, y a veces se pacta otro precio. Quien revisa el cierre corrige
  // los gramos y el precio de cada línea antes de confirmar; el ajuste queda
  // firmado y el cliente ve el número final.
  if (accion === 'ajustar') {
    const validadas = validarAjuste(body.lineas)
    if (!validadas.ok) return json(res, 422, { error: 'El lote no es válido', details: validadas.errores })

    const ajustado = await ajustarCierre(cierre, validadas.value, {
      por: admin.username,
      motivo: String(body.motivo || '').trim().slice(0, 200),
    })
    if (!ajustado.ok) return json(res, 422, { error: ajustado.error })

    return json(res, 200, { cierre: vista(ajustado.cierre, { paraCliente: false }) })
  }

  if (accion === 'rechazar') {
    if (!nota) return json(res, 422, { error: 'Hace falta un motivo: el cliente lo va a leer' })
    const siguiente = await guardarCierre({
      ...cierre,
      estado: 'rechazado',
      nota,
      decididoEn: new Date().toISOString(),
      decididoPor: admin.username,
    })
    return json(res, 200, { cierre: vista(siguiente, { paraCliente: false }) })
  }

  if (accion !== 'confirmar') return json(res, 400, { error: 'Acción no reconocida' })

  // Si se ha pasado la reserva, se vuelve a valorar y hay que confirmar otra
  // vez: nadie firma un número que ya no está en pantalla.
  if (haVencido(cierre)) {
    const nuevo = await revalorizar(cierre)
    if (!nuevo.ok) return json(res, 422, { error: nuevo.error })
    return json(res, 409, {
      error: 'La reserva de precio había vencido. Este es el precio de ahora: revísalo y confirma otra vez.',
      revalorizado: true,
      cierre: vista(nuevo.cierre, { paraCliente: false }),
    })
  }

  // Guarda contra confirmar un total distinto del que se está viendo.
  if (body.totalVisto != null && Math.abs(Number(body.totalVisto) - cierre.total) > 0.005) {
    return json(res, 409, {
      error: 'El total ha cambiado desde que abriste la solicitud. Revísalo y confirma otra vez.',
      cierre: vista(cierre, { paraCliente: false }),
    })
  }

  const siguiente = await guardarCierre({
    ...cierre,
    estado: 'confirmado',
    nota: nota || null,
    decididoEn: new Date().toISOString(),
    decididoPor: admin.username,
  })
  return json(res, 200, { cierre: vista(siguiente, { paraCliente: false }) })
}
