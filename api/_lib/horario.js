// Cuándo se puede pedir un cierre: de lunes a viernes, de 7:00 a 17:00, en hora
// de Canarias, y nunca en un festivo de la lista que lleva el panel.
//
// La hora se calcula siempre aquí, en el servidor. El portal la enseña para que
// nadie monte un lote a las 17:05 para nada, pero el que decide es este archivo:
// un botón escondido no es un horario.
//
// Toda la aritmética de fechas pasa por la zona `Atlantic/Canary`, que es la que
// sabe cuándo se cambia la hora. Nada de sumar o restar una hora a mano.

import { redis, hasStorage, esDesarrolloLocal } from './store.js'

export const ZONA = 'Atlantic/Canary'
export const APERTURA = { h: 7, m: 0 }
export const CIERRE = { h: 17, m: 0 }

// Lunes a viernes, con el domingo como 0 (lo que da `getUTCDay`).
const LABORABLES = new Set([1, 2, 3, 4, 5])

const K = { festivos: 'tqm:cierres:festivos' }

const MAX_FESTIVOS = 80
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

const dos = (n) => String(n).padStart(2, '0')
// Como se dice: «7:00», no «07:00».
const hhmm = ({ h, m }) => `${h}:${dos(m)}`

const partesZona = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
})

/** La hora de pared en Canarias de un instante: { y, m, d, h, min, s }. */
export function enCanarias(fecha) {
  const p = Object.fromEntries(partesZona.formatToParts(fecha).map(x => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second }
}

/**
 * El instante en que en Canarias son las `h:min` del día `y-m-d`.
 *
 * Se parte de esa hora leída como UTC y se corrige por la diferencia que
 * tenga la zona en ese momento (0 en invierno, una hora en verano). Se mira
 * dos veces porque la diferencia puede cambiar justo entre medias.
 */
export function instante(y, m, d, h, min) {
  const comoUtc = Date.UTC(y, m - 1, d, h, min)
  let t = comoUtc
  for (let i = 0; i < 2; i++) {
    const p = enCanarias(new Date(t))
    const desfase = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - t
    t = comoUtc - desfase
  }
  return new Date(t)
}

/** Día del calendario desplazado `n` días, sin pasar por ninguna zona. */
export function diaMas({ y, m, d }, n) {
  const f = new Date(Date.UTC(y, m - 1, d + n))
  return { y: f.getUTCFullYear(), m: f.getUTCMonth() + 1, d: f.getUTCDate(), dow: f.getUTCDay() }
}

export const iso = ({ y, m, d }) => `${y}-${dos(m)}-${dos(d)}`

/**
 * Si se puede pedir un cierre ahora y, si no, cuándo se abre.
 *
 * @param {object}   [opciones]
 * @param {Date}     [opciones.ahora]     El reloj, para poder probarlo.
 * @param {string[]} [opciones.festivos]  Días cerrados, como 'AAAA-MM-DD'.
 * @param {string}   [opciones.forzado]   'abierto' o 'cerrado'. Solo lo pasa
 *                                         `horarioActual` en desarrollo local.
 */
export function estadoHorario({ ahora = new Date(), festivos = [], forzado = null } = {}) {
  const cerrados = new Set(festivos)
  const local = enCanarias(ahora)
  const hoy = diaMas(local, 0)
  const minutos = local.h * 60 + local.min
  const desde = APERTURA.h * 60 + APERTURA.m
  const hasta = CIERRE.h * 60 + CIERRE.m

  const laborable = (dia) => LABORABLES.has(dia.dow) && !cerrados.has(iso(dia))

  let motivo = null
  if (!LABORABLES.has(hoy.dow)) motivo = 'fin-de-semana'
  else if (cerrados.has(iso(hoy))) motivo = 'festivo'
  else if (minutos < desde) motivo = 'antes-de-hora'
  else if (minutos >= hasta) motivo = 'despues-de-hora'

  // La próxima apertura: hoy mismo si aún no son las 7 de un día laborable, y
  // si no, el siguiente día laborable. Con un mes de margen sobra para
  // cualquier puente que se apunte en la lista.
  let abreEn = null
  for (let n = 0; n <= 31 && !abreEn; n++) {
    const dia = diaMas(local, n)
    if (!laborable(dia)) continue
    if (n === 0 && minutos >= desde) continue
    abreEn = instante(dia.y, dia.m, dia.d, APERTURA.h, APERTURA.m)
  }

  let abierto = motivo === null
  if (forzado === 'abierto') { abierto = true; motivo = null }
  if (forzado === 'cerrado') { abierto = false; motivo = 'forzado' }

  return {
    abierto,
    motivo,
    zona: ZONA,
    apertura: hhmm(APERTURA),
    cierre: hhmm(CIERRE),
    hoy: iso(hoy),
    cierraEn: abierto ? instante(hoy.y, hoy.m, hoy.d, CIERRE.h, CIERRE.m).toISOString() : null,
    abreEn: abreEn ? abreEn.toISOString() : null,
    ...(forzado ? { forzado } : {}),
  }
}

/**
 * El texto que se le enseña a una tienda que intenta cerrar fuera de hora. El
 * día de la próxima apertura se nombra («el lunes»), que es como se diría.
 */
export function textoCerrado(horario) {
  const base = `Los cierres se piden de lunes a viernes, de ${horario.apertura} a ${horario.cierre} (hora de Canarias).`
  if (!horario.abreEn) return base
  const abre = new Date(horario.abreEn)
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long' }).format(abre)
  const fecha = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, day: 'numeric', month: 'long' }).format(abre)
  const esHoy = iso(diaMas(enCanarias(abre), 0)) === horario.hoy
  return `${base} ${esHoy ? 'Hoy abrimos' : `Abrimos el ${dia} ${fecha}`} a las ${horario.apertura}.`
}

// ─── Festivos ────────────────────────────────────────────────────────────────

/** Comprueba la lista que manda el panel. Devuelve la lista limpia y ordenada. */
export function validarFestivos(input) {
  if (!Array.isArray(input)) return { ok: false, errores: ['La lista de festivos no es válida'] }
  if (input.length > MAX_FESTIVOS) {
    return { ok: false, errores: [`Como mucho ${MAX_FESTIVOS} festivos`] }
  }

  const errores = []
  const vistos = new Map()
  input.forEach((item, i) => {
    const pos = `Festivo ${i + 1}`
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errores.push(`${pos}: formato no válido`)
      return
    }
    const fecha = String(item.fecha ?? '').trim()
    const [y, m, d] = fecha.split('-').map(Number)
    const real = FECHA_RE.test(fecha) && iso(diaMas({ y, m, d }, 0)) === fecha
    if (!real || y < 2020 || y > 2100) {
      errores.push(`${pos}: la fecha debe ser un día real, como 2026-12-25`)
      return
    }
    const nombre = String(item.nombre ?? '').trim().slice(0, 60)
    vistos.set(fecha, { fecha, nombre })
  })

  if (errores.length) return { ok: false, errores }
  const lista = [...vistos.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
  return { ok: true, value: lista }
}

export async function getFestivos() {
  if (!hasStorage()) return []
  try {
    const lista = await redis().get(K.festivos)
    return Array.isArray(lista) ? lista : []
  } catch (err) {
    console.error('[horario] getFestivos →', err.message)
    return []
  }
}

export async function guardarFestivos(lista) {
  await redis().set(K.festivos, lista)
  return lista
}

/**
 * El horario de este momento, con los festivos guardados.
 *
 * En el propio ordenador, `CIERRES_HORARIO_FORZADO=abierto|cerrado` permite
 * probar el portal a cualquier hora. En Vercel esa variable se ignora: allí
 * `esDesarrolloLocal()` es siempre falso.
 */
export async function horarioActual({ ahora = new Date() } = {}) {
  const festivos = (await getFestivos()).map(f => f.fecha)
  const pedido = String(process.env.CIERRES_HORARIO_FORZADO || '').trim().toLowerCase()
  const forzado = esDesarrolloLocal() && (pedido === 'abierto' || pedido === 'cerrado') ? pedido : null
  return estadoHorario({ ahora, festivos, forzado })
}
