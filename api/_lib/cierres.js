// Cierres: la operación que hasta ahora se cerraba por teléfono.
//
// Un cierre es un compromiso de precio, así que aquí no se cree nada de lo que
// llegue del navegador: el cliente dice qué ley y cuántos gramos, y el precio
// lo pone el servidor con las fórmulas publicadas y la cotización del momento.
//
// En esta fase toda solicitud la confirma una persona de TQM. Mientras espera,
// el precio queda reservado el tiempo que diga la ficha del cliente.

import { redis, hasStorage, getFormulas } from './store.js'
import { gradePrice, refreshSecondsOf } from './defaults.js'
import { resolveMarket } from './market.js'

const K = {
  cierre: (ref) => `tqm:cierre:${ref}`,
  indice: 'tqm:cierres:indice',
  contador: (dia) => `tqm:cierres:seq:${dia}`,
}

// Los cierres antiguos siguen guardados uno a uno; lo que se recorta es la
// lista que se pinta en pantalla.
const INDICE_MAX = 300

const MAX_LINEAS = 24
const MAX_GRAMOS = 100000

// Tope del precio por gramo que puede poner una persona a mano. No es una
// política de márgenes: es la red que separa «se ha pactado otro precio» de «se
// ha colado un cero».
const MAX_PRECIO = { gold: 1000, silver: 100 }

const DECIMALES = { gold: 2, silver: 3 }

const redondear = (n, d) => Math.round(n * 10 ** d) / 10 ** d

/** Referencia legible y ordenada: TQM-2608-0007. */
async function nuevaReferencia() {
  const ahora = new Date()
  const dia = `${String(ahora.getDate()).padStart(2, '0')}${String(ahora.getMonth() + 1).padStart(2, '0')}`
  let numero = 1
  try {
    numero = await redis().incr(K.contador(dia))
    // El contador del día se guarda un mes: para entonces ya no hace falta.
    if (numero === 1) await redis().expire(K.contador(dia), 31 * 24 * 3600)
  } catch {
    numero = Math.floor(Math.random() * 8999) + 1000
  }
  return `TQM-${dia}-${String(numero).padStart(4, '0')}`
}

function leerLineas(input, { conPrecio }) {
  const errores = []
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, errores: ['El lote está vacío'] }
  }
  if (input.length > MAX_LINEAS) {
    return { ok: false, errores: [`Un cierre no puede tener más de ${MAX_LINEAS} líneas`] }
  }

  const out = []
  input.forEach((linea, i) => {
    const pos = `Línea ${i + 1}`
    if (!linea || typeof linea !== 'object' || Array.isArray(linea)) {
      errores.push(`${pos}: formato no válido`)
      return
    }
    const metal = String(linea.metal ?? '')
    if (metal !== 'gold' && metal !== 'silver') {
      errores.push(`${pos}: metal no válido`)
      return
    }
    const key = String(linea.key ?? '').trim().toLowerCase()
    if (!/^[a-z][a-z0-9_]{1,23}$/.test(key)) {
      errores.push(`${pos}: identificador de ley no válido`)
      return
    }
    const gramos = Number(String(linea.gramos ?? '').toString().replace(',', '.'))
    if (!Number.isFinite(gramos) || gramos <= 0) {
      errores.push(`${pos}: los gramos deben ser un número mayor que cero`)
      return
    }
    if (gramos > MAX_GRAMOS) {
      errores.push(`${pos}: ${gramos} gramos parece un error`)
      return
    }

    const salida = { metal, key, gramos: redondear(gramos, 3) }

    // El precio solo se lee cuando lo manda TQM. Vacío significa «el de la
    // tarifa», que es lo que hay que poder decir para deshacer un ajuste.
    if (conPrecio && linea.precioGramo != null && String(linea.precioGramo).trim() !== '') {
      const precio = Number(String(linea.precioGramo).replace(',', '.'))
      if (!Number.isFinite(precio) || precio <= 0) {
        errores.push(`${pos}: el precio por gramo debe ser un número mayor que cero`)
        return
      }
      if (precio > MAX_PRECIO[metal]) {
        errores.push(`${pos}: ${precio} € por gramo parece un error`)
        return
      }
      salida.precioGramo = redondear(precio, DECIMALES[metal])
    }

    out.push(salida)
  })

  if (errores.length) return { ok: false, errores }
  return { ok: true, value: out }
}

/**
 * Lo que llega del cliente: qué ley y cuántos gramos. Nada más.
 * El precio no se acepta ni se mira: se calcula aquí.
 */
export function validarLineas(input) {
  return leerLineas(input, { conPrecio: false })
}

/**
 * Lo que manda TQM al ajustar: lo mismo, y además el precio por gramo. Aquí sí
 * se acepta un precio de fuera porque lo pone una persona identificada, queda
 * firmado con su nombre y el cliente ve el número final antes de cobrar.
 */
export function validarAjuste(input) {
  return leerLineas(input, { conPrecio: true })
}

/**
 * Pone precio a las líneas con las fórmulas publicadas y la cotización de este
 * momento. Devuelve también el fixing usado, que es lo que queda congelado.
 */
export async function valorar(lineas) {
  const formulas = await getFormulas()
  const market = await resolveMarket(refreshSecondsOf(formulas))
  const divisor = Number(formulas.divisor) || 31.1

  const valoradas = []
  for (const linea of lineas) {
    const ley = (formulas[linea.metal] || []).find(g => g.key === linea.key)
    if (!ley) {
      return { ok: false, error: 'Alguna ley del lote ya no está en la tabla. Vuelve a montarlo.' }
    }
    const decimales = DECIMALES[linea.metal]
    const precioGramo = redondear(gradePrice(market.fixing[linea.metal], ley, divisor), decimales)
    valoradas.push({
      metal: linea.metal,
      key: ley.key,
      label: ley.label,
      fineness: ley.fineness,
      gramos: linea.gramos,
      precioGramo,
      importe: redondear(linea.gramos * precioGramo, 2),
    })
  }

  return {
    ok: true,
    lineas: valoradas,
    total: redondear(valoradas.reduce((s, l) => s + l.importe, 0), 2),
    gramos: redondear(valoradas.reduce((s, l) => s + l.gramos, 0), 3),
    fixing: market.fixing,
    stale: market.stale,
    formulasVersion: formulas.version ?? null,
  }
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function getCierre(ref) {
  if (!ref || !hasStorage()) return null
  try {
    const doc = await redis().get(K.cierre(ref))
    return doc && typeof doc === 'object' ? doc : null
  } catch (err) {
    console.error('[cierres] getCierre →', err.message)
    return null
  }
}

export async function listarCierres() {
  if (!hasStorage()) return []
  try {
    const lista = await redis().get(K.indice)
    return Array.isArray(lista) ? lista : []
  } catch (err) {
    console.error('[cierres] listarCierres →', err.message)
    return []
  }
}

function resumen(cierre) {
  return {
    ref: cierre.ref,
    clienteId: cierre.clienteId,
    razonSocial: cierre.cliente.razonSocial,
    total: cierre.total,
    gramos: cierre.gramos,
    numLineas: cierre.lineas.length,
    estado: cierre.estado,
    creadoEn: cierre.creadoEn,
    expiraEn: cierre.expiraEn,
  }
}

async function reindexar(cierre) {
  const lista = await listarCierres()
  const resto = lista.filter(x => x?.ref !== cierre.ref)
  const siguiente = [resumen(cierre), ...resto]
    .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())
    .slice(0, INDICE_MAX)
  await redis().set(K.indice, siguiente)
  return siguiente
}

// ─── Escritura ───────────────────────────────────────────────────────────────

export async function crearCierre({ cliente, valoracion, reservaMinutos, ip }) {
  const ahora = new Date()
  const cierre = {
    ref: await nuevaReferencia(),
    clienteId: cliente.id,
    cliente: {
      razonSocial: cliente.empresa.razonSocial,
      cif: cliente.empresa.cif,
      telefono: cliente.contacto.telefono,
      persona: cliente.contacto.persona,
    },
    lineas: valoracion.lineas,
    total: valoracion.total,
    gramos: valoracion.gramos,
    fixing: valoracion.fixing,
    formulasVersion: valoracion.formulasVersion,
    estado: 'pendiente',
    reservaMinutos,
    creadoEn: ahora.toISOString(),
    expiraEn: new Date(ahora.getTime() + reservaMinutos * 60000).toISOString(),
    revalorizadoEn: null,
    decididoEn: null,
    decididoPor: null,
    nota: null,
    ip,
  }
  await redis().set(K.cierre(cierre.ref), cierre)
  await reindexar(cierre)
  return cierre
}

export async function guardarCierre(cierre) {
  await redis().set(K.cierre(cierre.ref), cierre)
  await reindexar(cierre)
  return cierre
}

/**
 * Ajuste de TQM sobre una solicitud pendiente: los gramos de verdad —los de la
 * báscula, no los que se dijeron— y, si se ha pactado otra cosa, el precio que
 * se va a pagar.
 *
 * Se valora contra el fixing congelado del propio cierre, no contra el mercado
 * de este momento: la reserva es la que es, y corregir un peso no la reabre.
 * Lo que pidió el cliente se guarda aparte para que se pueda comparar, y cada
 * ajuste queda firmado con quién lo hizo.
 */
export async function ajustarCierre(cierre, lineas, { por, motivo }) {
  const formulas = await getFormulas()
  const divisor = Number(formulas.divisor) || 31.1

  const salida = []
  for (const linea of lineas) {
    const ley = (formulas[linea.metal] || []).find(g => g.key === linea.key)
    if (!ley) {
      return { ok: false, error: 'Alguna ley del lote ya no está en la tabla. Revísala antes de ajustar.' }
    }
    const decimales = DECIMALES[linea.metal]
    const tarifa = redondear(gradePrice(cierre.fixing?.[linea.metal], ley, divisor), decimales)
    if (!Number.isFinite(tarifa)) {
      return { ok: false, error: 'Este cierre no tiene cotización congelada: no se puede ajustar.' }
    }

    // Un precio igual al de la tarifa no se marca como puesto a mano: así,
    // borrarlo o volver a escribir el de siempre deshace el ajuste del todo.
    const pedido = linea.precioGramo
    const manual = pedido != null && Math.abs(pedido - tarifa) >= 10 ** -decimales
    const precioGramo = manual ? pedido : tarifa

    salida.push({
      metal: linea.metal,
      key: ley.key,
      label: ley.label,
      fineness: ley.fineness,
      gramos: linea.gramos,
      precioGramo,
      importe: redondear(linea.gramos * precioGramo, 2),
      // El precio que tocaría por tarifa se guarda siempre: es contra lo que se
      // compara un precio puesto a mano.
      precioTarifa: tarifa,
      precioManual: manual || undefined,
    })
  }

  const ahora = new Date().toISOString()
  const siguiente = await guardarCierre({
    ...cierre,
    // Lo que pidió el cliente se congela la primera vez que se toca; los
    // ajustes siguientes ya no lo pisan.
    pedido: cierre.pedido || { lineas: cierre.lineas, total: cierre.total, gramos: cierre.gramos },
    lineas: salida,
    total: redondear(salida.reduce((s, l) => s + l.importe, 0), 2),
    gramos: redondear(salida.reduce((s, l) => s + l.gramos, 0), 3),
    ajustadoEn: ahora,
    ajustadoPor: por,
    ajustes: [...(cierre.ajustes || []), { at: ahora, por, motivo: motivo || null }],
  })
  return { ok: true, cierre: siguiente }
}

/**
 * Vuelve a poner precio a un cierre cuya reserva ha vencido y reabre la
 * ventana. Nadie confirma un número que ya no es el que se ofreció.
 */
export async function revalorizar(cierre) {
  const valoracion = await valorar(cierre.lineas.map(l => ({ metal: l.metal, key: l.key, gramos: l.gramos })))
  if (!valoracion.ok) return { ok: false, error: valoracion.error }

  // Un precio puesto a mano por una persona no lo pisa el mercado: se mantiene
  // hasta que otra persona lo cambie. Lo que sí se actualiza es la tarifa que
  // se enseña al lado, para que se vea de cuánto es la diferencia ahora.
  const lineas = valoracion.lineas.map((l, i) => {
    const previa = cierre.lineas[i]
    if (!previa?.precioManual) return l
    return {
      ...l,
      precioGramo: previa.precioGramo,
      importe: redondear(l.gramos * previa.precioGramo, 2),
      precioTarifa: l.precioGramo,
      precioManual: true,
    }
  })

  const ahora = new Date()
  const siguiente = await guardarCierre({
    ...cierre,
    lineas,
    total: redondear(lineas.reduce((s, l) => s + l.importe, 0), 2),
    gramos: valoracion.gramos,
    fixing: valoracion.fixing,
    formulasVersion: valoracion.formulasVersion,
    revalorizadoEn: ahora.toISOString(),
    expiraEn: new Date(ahora.getTime() + cierre.reservaMinutos * 60000).toISOString(),
  })
  return { ok: true, cierre: siguiente }
}

/** Una solicitud pendiente cuya reserva ha vencido ya no vale tal cual. */
export function haVencido(cierre) {
  return cierre.estado === 'pendiente' && new Date(cierre.expiraEn).getTime() < Date.now()
}
