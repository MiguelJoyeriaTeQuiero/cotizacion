// Cotización de mercado: una sola puerta para todo el proyecto.
//
// La usan el endpoint público (que alimenta la web) y el de cierres. Es
// importante que sea la misma: el precio que se le reserva a un cliente tiene
// que salir de donde sale el que vio en la tabla, no de otro sitio parecido.

import { getMarketCache, setMarketCache } from './store.js'
import { FALLBACK_FIXING } from './defaults.js'

const GOLD_URL = 'https://www.goldapi.io/api/XAU/EUR'
const SILVER_URL = 'https://www.goldapi.io/api/XAG/EUR'

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
 * elegida en el panel; si no, consulta el mercado. Si la consulta falla, se
 * sigue con el último dato conocido marcado como retrasado, y solo si no hay
 * ninguno se recurre al fixing de emergencia.
 */
export async function resolveMarket(refreshSeconds) {
  const cached = await getMarketCache()
  if (cached?.fetchedAt && Date.now() - cached.fetchedAt < refreshSeconds * 1000) {
    return { ...cached, stale: false }
  }
  try {
    const fresh = await fetchMarket()
    await setMarketCache(fresh)
    return { ...fresh, stale: false }
  } catch (err) {
    console.warn('[market] mercado no disponible →', err.message)
    if (cached?.fixing) return { ...cached, stale: true }
    return {
      fixing: FALLBACK_FIXING,
      change: { gold: 0, silver: 0 },
      fetchedAt: null,
      stale: true,
    }
  }
}
