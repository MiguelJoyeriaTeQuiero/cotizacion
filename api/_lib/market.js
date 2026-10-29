// Cotización de mercado: una sola puerta para todo el proyecto.
//
// La usan el endpoint público (que alimenta la web) y el de cierres. Es
// importante que sea la misma: el precio que se le reserva a un cliente tiene
// que salir de donde sale el que vio en la tabla, no de otro sitio parecido.

import { getMarketCache, setMarketCache, claimMarketFetch, releaseMarketFetch } from './store.js'
import { FALLBACK_FIXING } from './defaults.js'

const GOLD_URL = 'https://www.goldapi.io/api/XAU/EUR'
const SILVER_URL = 'https://www.goldapi.io/api/XAG/EUR'

// Tras un fallo del proveedor no se reintenta en cada petición: se espera la
// frecuencia elegida, y como mucho un minuto, para que con una frecuencia larga
// la cotización no se quede parada horas por un fallo puntual.
const RETRY_MAX_SECONDS = 60

// Margen para seguir dando por buena una cotización recién vencida mientras
// otra petición la renueva: lo que tarda, como mucho, una consulta.
const RENEWAL_GRACE_MS = 10_000

export async function fetchMarket() {
  const apiKey = process.env.GOLDAPI_KEY
  if (!apiKey) throw new Error('GOLDAPI_KEY no configurada')

  const headers = { 'x-access-token': apiKey, 'Content-Type': 'application/json' }
  const options = { headers, signal: AbortSignal.timeout(6000) }

  const [goldRes, silverRes] = await Promise.all([
    fetch(GOLD_URL, options),
    fetch(SILVER_URL, options),
  ])
  if (!goldRes.ok) throw new Error(`API oro ${goldRes.status}`)
  if (!silverRes.ok) throw new Error(`API plata ${silverRes.status}`)

  const gold = await goldRes.json()
  const silver = await silverRes.json()
  const goldFix = parseFloat(gold.price)
  const silverFix = parseFloat(silver.price)
  if (!Number.isFinite(goldFix) || !Number.isFinite(silverFix)) {
    throw new Error('Respuesta de mercado inesperada')
  }

  return {
    fixing: { gold: goldFix, silver: silverFix },
    change: {
      gold: parseFloat(gold.chp) || 0,
      silver: parseFloat(silver.chp) || 0,
    },
    fetchedAt: Date.now(),
  }
}

/**
 * Cotización vigente. Devuelve la caché si todavía está dentro de la frecuencia
 * elegida en el panel; si no, consulta el mercado. Consulta una sola petición a
 * la vez, y tras un fallo se espera antes de volver a intentarlo; mientras, se
 * sirve lo que hay. Si la consulta falla, se sigue con el último dato conocido
 * marcado como retrasado, y solo si no hay ninguno se recurre al fixing de
 * emergencia.
 */
export async function resolveMarket(refreshSeconds) {
  const cached = await getMarketCache()
  const age = cached?.fetchedAt ? Date.now() - cached.fetchedAt : Infinity
  if (age < refreshSeconds * 1000) return { ...cached, stale: false }

  // Otra petición está consultando, o el último intento falló hace poco.
  if (!(await claimMarketFetch(Math.min(refreshSeconds, RETRY_MAX_SECONDS)))) {
    return lastKnown(cached, age <= refreshSeconds * 1000 + RENEWAL_GRACE_MS)
  }
  try {
    const fresh = await fetchMarket()
    await setMarketCache(fresh)
    await releaseMarketFetch()
    return { ...fresh, stale: false }
  } catch (err) {
    console.warn('[market] mercado no disponible →', err.message)
    return lastKnown(cached, false)
  }
}

// El último dato conocido y, si no hay ninguno, el fixing de emergencia.
function lastKnown(cached, current) {
  if (cached?.fixing) return { ...cached, stale: !current }
  return {
    fixing: FALLBACK_FIXING,
    change: { gold: 0, silver: 0 },
    fetchedAt: null,
    stale: true,
  }
}
