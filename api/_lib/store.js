import { Redis } from '@upstash/redis'
import { DEFAULT_FORMULAS } from './defaults.js'

// ─── Cliente Redis (Upstash vía Vercel Marketplace) ──────────────────────────
//
// La integración inyecta las variables con prefijo UPSTASH_ o KV_ según cómo se
// haya provisionado; aceptamos ambas. La inicialización es perezosa para que el
// build no falle si todavía no hay almacenamiento configurado.

let client = null

function credentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  return url && token ? { url, token } : null
}

// Solo cierto al ejecutar en el propio ordenador. En Vercel, VERCEL siempre
// vale "1", así que este camino no puede activarse en producción.
const isLocalDev = !process.env.VERCEL && process.env.NODE_ENV !== 'production'

/** Cierto solo al ejecutar en el propio ordenador. En Vercel, nunca. */
export const esDesarrolloLocal = () => isLocalDev

export function hasStorage() {
  return credentials() !== null || isLocalDev
}

export function redis() {
  if (client) return client
  const creds = credentials()
  if (creds) {
    client = new Redis(creds)
    return client
  }
  if (isLocalDev) {
    client = memoryStore()
    return client
  }
  const err = new Error('Almacenamiento no configurado')
  err.code = 'STORAGE_NOT_CONFIGURED'
  throw err
}

/**
 * Almacén en memoria para desarrollo local, con las mismas operaciones que se
 * usan de Redis. Evita tener que provisionar nada para probar el panel en el
 * portátil. Los datos se pierden al reiniciar y NUNCA se usa en producción.
 *
 * El estado cuelga de globalThis porque el servidor de desarrollo recarga los
 * módulos en cada petición: si viviera en una variable del módulo, la sesión
 * se perdería entre una llamada y la siguiente.
 */
function memoryStore() {
  const g = globalThis
  if (!g.__tqmMemoryStore) {
    console.warn(
      '[store] Sin Upstash configurado: usando almacén EN MEMORIA (solo desarrollo local).\n' +
      '        Los cambios se pierden al reiniciar el servidor.'
    )
    g.__tqmMemoryStore = { data: new Map(), expiry: new Map() }
  }
  const { data, expiry } = g.__tqmMemoryStore

  const alive = (key) => {
    const at = expiry.get(key)
    if (at != null && Date.now() > at) { data.delete(key); expiry.delete(key); return false }
    return data.has(key)
  }
  const list = (key) => (alive(key) ? data.get(key) : [])

  return {
    async get(key) { return alive(key) ? data.get(key) : null },
    async set(key, value, opts = {}) {
      if (opts.nx && alive(key)) return null
      data.set(key, value)
      if (opts.ex) expiry.set(key, Date.now() + opts.ex * 1000)
      else expiry.delete(key)
      return 'OK'
    },
    async del(key) { const had = alive(key); data.delete(key); expiry.delete(key); return had ? 1 : 0 },
    async incr(key) { const n = (alive(key) ? Number(data.get(key)) : 0) + 1; data.set(key, n); return n },
    async expire(key, seconds) { if (!alive(key)) return 0; expiry.set(key, Date.now() + seconds * 1000); return 1 },
    async ttl(key) {
      if (!alive(key)) return -2
      const at = expiry.get(key)
      return at == null ? -1 : Math.ceil((at - Date.now()) / 1000)
    },
    async lpush(key, ...values) { const l = list(key); l.unshift(...values); data.set(key, l); return l.length },
    async ltrim(key, start, stop) {
      const l = list(key)
      data.set(key, l.slice(start, stop === -1 ? undefined : stop + 1))
      return 'OK'
    },
    async lrange(key, start, stop) {
      return list(key).slice(start, stop === -1 ? undefined : stop + 1)
    },
  }
}

const K = {
  formulas: 'tqm:formulas',
  history: 'tqm:formulas:history',
  prices: 'tqm:prices:cache',
  series: 'tqm:prices:series',
  scenarios: 'tqm:formulas:scenarios',
  session: (hash) => `tqm:session:${hash}`,
  rate: (bucket) => `tqm:rl:${bucket}`,
}

const HISTORY_MAX = 50

// Muestras de la evolución de precios. Una por hora como mucho: 1000 muestras
// son unos 40 días de historia, que es de sobra para ver una tendencia sin que
// la lectura se vuelva pesada.
const SERIES_MAX = 1000
const SERIES_MIN_GAP_MS = 60 * 60 * 1000

// Borradores con nombre. Un tope bajo a propósito: son escenarios de trabajo,
// no un archivo.
const SCENARIOS_MAX = 12

// ─── Fórmulas ────────────────────────────────────────────────────────────────

export async function getFormulas() {
  if (!hasStorage()) return { ...DEFAULT_FORMULAS, source: 'defaults' }
  try {
    const doc = await redis().get(K.formulas)
    if (!doc || typeof doc !== 'object') return { ...DEFAULT_FORMULAS, source: 'defaults' }
    return { ...doc, source: 'store' }
  } catch (err) {
    console.error('[store] getFormulas →', err.message)
    return { ...DEFAULT_FORMULAS, source: 'fallback' }
  }
}

export async function saveFormulas(doc, { username, ip }) {
  const previous = await getFormulas()

  // Se congela la cotización del momento de publicar. Sin esto no hay forma de
  // saber después cuánto se ha movido el mercado desde el último cambio, que es
  // justo lo que el panel enseña al entrar.
  const market = await getMarketCache()
  const fixingAtPublish = Number.isFinite(market?.fixing?.gold) && Number.isFinite(market?.fixing?.silver)
    ? { gold: market.fixing.gold, silver: market.fixing.silver, at: market.fetchedAt ?? null }
    : (previous.fixingAtPublish ?? null)

  const next = {
    ...doc,
    fixingAtPublish,
    version: (Number(previous.version) || 0) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: username,
  }
  const r = redis()
  await r.set(K.formulas, next)
  await r.lpush(K.history, {
    version: next.version,
    at: next.updatedAt,
    by: username,
    ip,
    fixing: fixingAtPublish,
    snapshot: {
      divisor: next.divisor,
      refreshSeconds: next.refreshSeconds,
      gold: next.gold,
      silver: next.silver,
    },
  })
  await r.ltrim(K.history, 0, HISTORY_MAX - 1)
  return next
}

export async function getHistory() {
  if (!hasStorage()) return []
  try {
    const rows = await redis().lrange(K.history, 0, HISTORY_MAX - 1)
    return Array.isArray(rows) ? rows : []
  } catch (err) {
    console.error('[store] getHistory →', err.message)
    return []
  }
}

// ─── Caché de cotización de mercado ──────────────────────────────────────────
//
// Se guarda sin caducidad y con marca de tiempo: así, si la API de mercado deja
// de responder, seguimos teniendo el último fixing conocido en lugar de quedarnos
// sin datos. La frescura se decide leyendo `fetchedAt`, no con un TTL.

export async function getMarketCache() {
  if (!hasStorage()) return null
  try {
    const data = await redis().get(K.prices)
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}

export async function setMarketCache(payload) {
  if (!hasStorage()) return
  try {
    await redis().set(K.prices, payload)
  } catch (err) {
    console.error('[store] setMarketCache →', err.message)
  }
}

// ─── Evolución de precios ───────────────────────────────────────────────────
//
// Una foto periódica de la cotización y del precio por gramo que estaba
// publicado en ese instante. Es la única memoria que tiene el sistema de lo que
// ha ido pagando, así que se escribe desde el endpoint público: se alimenta del
// tráfico normal de la web, sin tareas programadas.

export async function lastSampleTime() {
  if (!hasStorage()) return 0
  try {
    const rows = await redis().lrange(K.series, 0, 0)
    const last = Array.isArray(rows) ? rows[0] : null
    const t = last && typeof last === 'object' ? Number(last.t) : 0
    return Number.isFinite(t) ? t : 0
  } catch {
    return 0
  }
}

/**
 * Añade una muestra si ha pasado el hueco mínimo desde la anterior. Devuelve
 * true solo si se ha escrito, y nunca lanza: que falle el registro histórico no
 * puede tumbar la respuesta de precios de la web.
 */
export async function recordSample(sample) {
  if (!hasStorage()) return false
  try {
    const previous = await lastSampleTime()
    if (previous && Date.now() - previous < SERIES_MIN_GAP_MS) return false
    const r = redis()
    await r.lpush(K.series, sample)
    await r.ltrim(K.series, 0, SERIES_MAX - 1)
    return true
  } catch (err) {
    console.warn('[store] recordSample →', err.message)
    return false
  }
}

export async function getSeries(limit = SERIES_MAX) {
  if (!hasStorage()) return []
  try {
    const rows = await redis().lrange(K.series, 0, Math.max(0, limit - 1))
    return Array.isArray(rows) ? rows.filter(x => x && typeof x === 'object') : []
  } catch (err) {
    console.error('[store] getSeries →', err.message)
    return []
  }
}

// ─── Escenarios (borradores con nombre) ─────────────────────────────────────

export async function getScenarios() {
  if (!hasStorage()) return []
  try {
    const rows = await redis().get(K.scenarios)
    return Array.isArray(rows) ? rows : []
  } catch (err) {
    console.error('[store] getScenarios →', err.message)
    return []
  }
}

export async function putScenario({ name, snapshot, username }) {
  const list = await getScenarios()
  const entry = {
    name,
    snapshot,
    savedAt: new Date().toISOString(),
    savedBy: username,
  }
  // Guardar con un nombre que ya existe lo reemplaza: es lo que espera
  // cualquiera que pulse «guardar» dos veces sobre el mismo escenario.
  const rest = list.filter(x => x?.name !== name)
  const next = [entry, ...rest].slice(0, SCENARIOS_MAX)
  await redis().set(K.scenarios, next)
  return next
}

export async function deleteScenario(name) {
  const list = await getScenarios()
  const next = list.filter(x => x?.name !== name)
  await redis().set(K.scenarios, next)
  return next
}

export { SCENARIOS_MAX }

// ─── Sesiones ────────────────────────────────────────────────────────────────

export async function putSession(tokenHash, data, ttlSeconds) {
  await redis().set(K.session(tokenHash), data, { ex: ttlSeconds })
}

export async function readSessionRecord(tokenHash) {
  try {
    return await redis().get(K.session(tokenHash))
  } catch (err) {
    console.error('[store] readSessionRecord →', err.message)
    return null
  }
}

export async function touchSession(tokenHash, ttlSeconds) {
  try {
    await redis().expire(K.session(tokenHash), ttlSeconds)
  } catch {
    /* renovar el TTL no es crítico */
  }
}

export async function deleteSession(tokenHash) {
  try {
    await redis().del(K.session(tokenHash))
  } catch {
    /* la cookie se borra igualmente */
  }
}

// ─── Limitación de intentos ──────────────────────────────────────────────────

/**
 * Lee el contador del bucket sin tocarlo. Se usa para decidir si hay que
 * bloquear ANTES de gastar un intento, de modo que solo los fallos reales de
 * credenciales consuman cupo.
 */
export async function readRate(bucket) {
  try {
    const r = redis()
    const key = K.rate(bucket)
    const count = Number(await r.get(key)) || 0
    const ttl = count > 0 ? await r.ttl(key) : 0
    return { count, ttl: ttl > 0 ? ttl : 0 }
  } catch (err) {
    console.error('[store] readRate →', err.message)
    return { count: 0, ttl: 0 }
  }
}

/**
 * Incrementa el contador del bucket y devuelve {count, ttl}.
 * Si Redis falla se devuelve count=0 para no dejar fuera al usuario legítimo
 * por una incidencia del almacenamiento (el resto de defensas siguen activas).
 */
export async function bumpRate(bucket, windowSeconds) {
  try {
    const r = redis()
    const key = K.rate(bucket)
    const count = await r.incr(key)
    if (count === 1) await r.expire(key, windowSeconds)
    const ttl = await r.ttl(key)
    return { count, ttl: ttl > 0 ? ttl : windowSeconds }
  } catch (err) {
    console.error('[store] bumpRate →', err.message)
    return { count: 0, ttl: windowSeconds }
  }
}

export async function clearRate(bucket) {
  try {
    await redis().del(K.rate(bucket))
  } catch {
    /* sin efecto */
  }
}
