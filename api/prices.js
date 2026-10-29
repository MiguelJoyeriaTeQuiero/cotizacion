import { json, methodNotAllowed } from './_lib/http.js'
import { getFormulas, recordSample } from './_lib/store.js'
import { resolveMarket } from './_lib/market.js'
import { gradePrice, refreshSecondsOf } from './_lib/defaults.js'

// Endpoint público que alimenta la tabla de la web.
//
// Devuelve el fixing y el precio final por gramo de cada ley, YA calculado.
// Los factores comerciales (f1, f2) no salen nunca de aquí: el visitante ve el
// precio, no la política de márgenes.
//
// Además la clave de goldapi.io vive solo en el servidor, así que ni se expone
// en el bundle ni se puede agotar la cuota desde fuera. La consulta en sí está
// en _lib/market.js, que es la misma que usan los cierres.

// Tope de la caché de la CDN, en segundos. Se mantiene corto a propósito y con
// independencia de cada cuánto se consulte el mercado: es lo que hace que un
// cambio de fórmulas se vea en la web enseguida. Revalidar aquí no cuesta
// llamadas a la API, porque entre medias responde la caché de Redis.
const CDN_MAX_AGE = 30

// Con el dato retrasado, la CDN lo guarda poco: en cuanto el mercado vuelva a
// responder, la tabla tiene que dejar de enseñar el viejo.
const CDN_STALE_MAX_AGE = 5

/**
 * Cuánto puede guardar la CDN esta respuesta: lo que le queda de vida a la
 * cotización, con el tope de arriba. Así nunca sirve una cotización que Redis
 * ya ha renovado, y la pestaña que pregunta justo después de la renovación
 * recibe la nueva. No lleva stale-while-revalidate: servir la respuesta
 * caducada mientras se renueva era lo que dejaba la tabla una vuelta por detrás.
 */
function cdnMaxAge(market, refreshSeconds) {
  const { fetchedAt, stale } = market
  if (stale || !fetchedAt) return CDN_STALE_MAX_AGE
  const left = Math.ceil((fetchedAt + refreshSeconds * 1000 - Date.now()) / 1000)
  return Math.min(CDN_MAX_AGE, Math.max(1, left))
}

// Las muestras guardadas no necesitan más precisión que la que se publica.
const round4 = (n) => Math.round(n * 10000) / 10000

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, ['GET'])

  try {
    // Las fórmulas primero: son las que dicen cada cuánto hay que consultar el
    // mercado, así que no se puede pedir todo a la vez.
    const formulas = await getFormulas()
    const refreshSeconds = refreshSecondsOf(formulas)
    const market = await resolveMarket(refreshSeconds)
    const divisor = Number(formulas.divisor) || 31.1

    const build = (grades, fixing) =>
      (Array.isArray(grades) ? grades : []).map(g => ({
        key: g.key,
        label: g.label,
        fineness: g.fineness,
        pricePerGram: gradePrice(fixing, g, divisor),
      }))

    const gold = build(formulas.gold, market.fixing.gold)
    const silver = build(formulas.silver, market.fixing.silver)

    // Foto para la gráfica de evolución del panel. Se escribe como mucho una vez
    // por hora y nunca hace fallar la respuesta: si el registro no sale, la web
    // sigue sirviendo precios igual.
    if (!market.stale) {
      await recordSample({
        t: Date.now(),
        fixing: market.fixing,
        version: formulas.version ?? null,
        gold: Object.fromEntries(gold.map(g => [g.key, round4(g.pricePerGram)])),
        silver: Object.fromEntries(silver.map(g => [g.key, round4(g.pricePerGram)])),
      })
    }

    json(
      res,
      200,
      {
        fixing: market.fixing,
        change: market.change,
        fetchedAt: market.fetchedAt,
        stale: market.stale,
        refreshSeconds,
        formulasVersion: formulas.version ?? null,
        gold,
        silver,
      },
      {
        // La CDN de Vercel sirve la misma respuesta durante unos segundos: una
        // subida de tráfico no se traduce en llamadas extra a la API de mercado.
        'Cache-Control': `public, s-maxage=${cdnMaxAge(market, refreshSeconds)}`,
      }
    )
  } catch (err) {
    console.error('[prices] error →', err.message)
    json(res, 503, { error: 'Cotización no disponible temporalmente' })
  }
}
