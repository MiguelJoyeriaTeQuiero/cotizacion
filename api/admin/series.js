import { json, methodNotAllowed } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'
import { getSeries } from '../_lib/store.js'
import { validarFecha, mediaDelDia, rellenarDias } from '../_lib/precios-dia.js'

// Evolución de precios: la cotización y el €/gramo que estaba publicado en cada
// momento. Las muestras las escribe el endpoint público conforme se refresca el
// mercado; aquí solo se leen, se recortan a la ventana pedida y se aligeran.
//
// Con ?fecha=AAAA-MM-DD responde otra cosa: la media de lo publicado ese día de
// 7:00 a 17:00, hora de Canarias, que es lo que usa el simulador.

const WINDOWS = { 7: 7, 30: 30, 90: 90 }
const MAX_POINTS = 240

/**
 * Reduce la serie a un número manejable de puntos conservando el primero y el
 * último. Es un muestreo por salto: no promedia, así que lo que se dibuja son
 * valores que existieron de verdad.
 */
function thin(samples, max) {
  if (samples.length <= max) return samples
  const step = (samples.length - 1) / (max - 1)
  const out = []
  for (let i = 0; i < max; i += 1) out.push(samples[Math.round(i * step)])
  return out
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const session = await requireSession(req, res)
  if (!session) return

  const url = new URL(req.url, 'http://localhost')

  if (url.searchParams.has('fecha')) {
    const fecha = validarFecha(url.searchParams.get('fecha'))
    if (!fecha.ok) return json(res, 400, { error: fecha.error })
    return json(res, 200, await mediaDelDia(fecha.value))
  }

  const days = WINDOWS[Number(url.searchParams.get('days'))] || 30
  const since = Date.now() - days * 24 * 3600 * 1000

  const all = await getSeries()
  // La primera vez, los días que ya había en las muestras pasan a su resumen.
  await rellenarDias(all)
  // Llegan de la más reciente a la más antigua: para dibujar interesa al revés.
  const inWindow = all
    .filter(s => Number(s?.t) >= since)
    .sort((a, b) => Number(a.t) - Number(b.t))

  return json(res, 200, {
    days,
    total: all.length,
    samples: thin(inWindow, MAX_POINTS),
  })
}
