// La media de un día: lo que se publicó de 7:00 a 17:00, hora de Canarias, que
// es el horario de los cierres. La pide el simulador del panel para responder
// a «¿a cuánto estaba el 3 de noviembre?».
//
// Las muestras por hora (`tqm:prices:series`) solo guardan unos 40 días, así
// que cada día se resume aparte en `tqm:prices:dia:AAAA-MM-DD`: suma, número,
// mínimo y máximo por ley, que ocupa poco y no caduca. Se guardan dos ventanas,
// la del horario de cierres y la del día entero, aunque hoy solo se lea la
// primera: si algún día se quiere la otra, los datos estarán.
//
// La hora sale siempre de horario.js: la misma regla de «de 7 a 17» que decide
// si se puede pedir un cierre.

import { redis, hasStorage, getSeries, SERIES_MAX } from './store.js'
import { ZONA, APERTURA, CIERRE, enCanarias, instante, diaMas, iso, getFestivos } from './horario.js'

const K = {
  dia: (fecha) => `tqm:prices:dia:${fecha}`,
  relleno: 'tqm:prices:dias:relleno',
}

const METALES = ['gold', 'silver']
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const LABORABLES = new Set([1, 2, 3, 4, 5])

const round4 = (n) => Math.round(n * 10000) / 10000
const hhmm = ({ h, m }) => `${h}:${String(m).padStart(2, '0')}`
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// ─── Fechas ──────────────────────────────────────────────────────────────────

/** El día de Canarias de un instante, como 'AAAA-MM-DD'. */
export const fechaDe = (t) => iso(enCanarias(new Date(t)))

/** Las dos ventanas de un día, en milisegundos: [desde, hasta). */
export function ventanasDe(fecha) {
  const [y, m, d] = fecha.split('-').map(Number)
  const sig = diaMas({ y, m, d }, 1)
  return {
    dia: { desde: instante(y, m, d, 0, 0).getTime(), hasta: instante(sig.y, sig.m, sig.d, 0, 0).getTime() },
    horario: {
      desde: instante(y, m, d, APERTURA.h, APERTURA.m).getTime(),
      hasta: instante(y, m, d, CIERRE.h, CIERRE.m).getTime(),
    },
  }
}

const dentro = (t, v) => t >= v.desde && t < v.hasta

/** Comprueba la fecha que pide el panel: un día real, de 2020 a hoy. */
export function validarFecha(input, { ahora = Date.now() } = {}) {
  const fecha = String(input ?? '').trim()
  const [y, m, d] = fecha.split('-').map(Number)
  const real = FECHA_RE.test(fecha) && iso(diaMas({ y, m, d }, 0)) === fecha
  if (!real || y < 2020) return { ok: false, error: 'La fecha debe ser un día real, como 2026-11-03' }
  if (fecha > fechaDe(ahora)) return { ok: false, error: 'La fecha no puede ser posterior a hoy' }
  return { ok: true, value: fecha }
}

// ─── Acumular ────────────────────────────────────────────────────────────────
//
// Se guardan sumas, no medias: así cada muestra nueva se añade sin tener que
// releer las anteriores, y la media sale exacta al final.

export const vacio = () => ({ n: 0, desde: null, hasta: null, fixing: {}, gold: {}, silver: {} })

function sumar(stat, v) {
  if (!stat) return { n: 1, s: v, min: v, max: v }
  return { n: stat.n + 1, s: stat.s + v, min: Math.min(stat.min, v), max: Math.max(stat.max, v) }
}

/** Devuelve el acumulado con la muestra añadida. No modifica el de entrada. */
export function acumular(acc, muestra) {
  const t = Number(muestra?.t)
  if (!Number.isFinite(t)) return acc
  const out = {
    n: acc.n + 1,
    desde: acc.desde == null ? t : Math.min(acc.desde, t),
    hasta: acc.hasta == null ? t : Math.max(acc.hasta, t),
    fixing: { ...acc.fixing },
    gold: { ...acc.gold },
    silver: { ...acc.silver },
  }
  for (const metal of METALES) {
    const fixing = numero(muestra.fixing?.[metal])
    if (fixing != null) out.fixing[metal] = sumar(out.fixing[metal], fixing)
    for (const [key, precio] of Object.entries(muestra[metal] || {})) {
      const v = numero(precio)
      if (v != null) out[metal][key] = sumar(out[metal][key], v)
    }
  }
  return out
}

const media = (stat) => ({ media: round4(stat.s / stat.n), min: stat.min, max: stat.max, n: stat.n })

/** De sumas a medias. Sin muestras, null. */
export function resumir(acc) {
  if (!acc || !(acc.n > 0)) return null
  const leyes = (grupo) => Object.fromEntries(Object.entries(grupo || {}).map(([k, s]) => [k, media(s)]))
  return {
    n: acc.n,
    desde: new Date(acc.desde).toISOString(),
    hasta: new Date(acc.hasta).toISOString(),
    fixing: leyes(acc.fixing),
    gold: leyes(acc.gold),
    silver: leyes(acc.silver),
  }
}

/** Los resúmenes de todos los días que aparecen en una lista de muestras. */
export function resumenesDe(muestras) {
  const docs = new Map()
  for (const muestra of muestras) {
    const t = Number(muestra?.t)
    if (!Number.isFinite(t)) continue
    const fecha = fechaDe(t)
    const doc = docs.get(fecha) || { fecha, dia: vacio(), horario: vacio() }
    doc.dia = acumular(doc.dia, muestra)
    if (dentro(t, ventanasDe(fecha).horario)) doc.horario = acumular(doc.horario, muestra)
    docs.set(fecha, doc)
  }
  return docs
}

const esAcumulado = (x) => x && typeof x === 'object' && Number.isFinite(x.n)

// ─── Guardar ─────────────────────────────────────────────────────────────────

/**
 * Suma una muestra recién apuntada al resumen de su día. Nunca lanza: como el
 * registro de muestras, no puede tumbar la respuesta de precios de la web.
 */
export async function apuntarEnDia(muestra) {
  if (!hasStorage()) return false
  try {
    const t = Number(muestra?.t)
    if (!Number.isFinite(t)) return false
    const fecha = fechaDe(t)
    const guardado = await redis().get(K.dia(fecha))
    const doc = {
      fecha,
      dia: esAcumulado(guardado?.dia) ? guardado.dia : vacio(),
      horario: esAcumulado(guardado?.horario) ? guardado.horario : vacio(),
    }
    doc.dia = acumular(doc.dia, muestra)
    if (dentro(t, ventanasDe(fecha).horario)) doc.horario = acumular(doc.horario, muestra)
    await redis().set(K.dia(fecha), doc)
    return true
  } catch (err) {
    console.warn('[precios-dia] apuntarEnDia →', err.message)
    return false
  }
}

/**
 * Una sola vez: resume los días que ya estaban en las muestras por hora antes
 * de que existieran los resúmenes. Sin esto, los días anteriores a la puesta en
 * marcha se perderían en cuanto las muestras se recortaran.
 *
 * Solo escribe los días que las muestras tienen enteros. Sobrescribir uno que
 * ya estaba es inofensivo: las muestras son la fuente y dan el mismo resultado.
 */
export async function rellenarDias(muestras) {
  if (!hasStorage() || !Array.isArray(muestras) || muestras.length === 0) return false
  try {
    if (await redis().get(K.relleno)) return false
    const recortada = muestras.length >= SERIES_MAX
    const primera = Math.min(...muestras.map(s => Number(s?.t)).filter(Number.isFinite))
    const enteros = [...resumenesDe(muestras)]
      .filter(([fecha]) => !recortada || primera < ventanasDe(fecha).dia.desde)
    await Promise.all(enteros.map(([fecha, doc]) => redis().set(K.dia(fecha), doc)))
    await redis().set(K.relleno, Date.now())
    return true
  } catch (err) {
    console.warn('[precios-dia] rellenarDias →', err.message)
    return false
  }
}

// ─── Leer ────────────────────────────────────────────────────────────────────

/**
 * La media de lo publicado ese día de 7:00 a 17:00.
 *
 * Mientras las muestras por hora tengan el día entero, se calcula con ellas;
 * cuando ya no, con el resumen guardado. Las dos dan lo mismo: el resumen se
 * construye con esas mismas muestras.
 */
export async function mediaDelDia(fecha, { ahora = Date.now() } = {}) {
  const v = ventanasDe(fecha)
  const muestras = await getSeries()
  await rellenarDias(muestras)

  const tiempos = muestras.map(s => Number(s?.t)).filter(Number.isFinite)
  const primera = tiempos.length ? Math.min(...tiempos) : Infinity
  const enteras = muestras.length < SERIES_MAX || primera < v.horario.desde

  let acc = null
  let fuente = null
  if (enteras) {
    acc = muestras
      .filter(s => dentro(Number(s?.t), v.horario))
      .reduce(acumular, vacio())
    if (acc.n > 0) fuente = 'muestras'
  }
  if (!fuente && hasStorage()) {
    try {
      const doc = await redis().get(K.dia(fecha))
      if (esAcumulado(doc?.horario) && doc.horario.n > 0) {
        acc = doc.horario
        fuente = 'resumen'
      }
    } catch (err) {
      console.error('[precios-dia] mediaDelDia →', err.message)
    }
  }

  const [y, m, d] = fecha.split('-').map(Number)
  const festivo = (await getFestivos()).find(f => f?.fecha === fecha)

  return {
    fecha,
    zona: ZONA,
    apertura: hhmm(APERTURA),
    cierre: hhmm(CIERRE),
    ventana: { desde: new Date(v.horario.desde).toISOString(), hasta: new Date(v.horario.hasta).toISOString() },
    laborable: LABORABLES.has(diaMas({ y, m, d }, 0).dow) && !festivo,
    festivo: festivo ? (festivo.nombre || 'Festivo') : null,
    enCurso: ahora >= v.dia.desde && ahora < v.horario.hasta,
    fuente,
    media: fuente ? resumir(acc) : null,
  }
}
