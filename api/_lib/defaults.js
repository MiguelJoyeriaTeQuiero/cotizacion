// Valores de partida de las fórmulas de la tabla de precios.
//
// Son solo la semilla: en cuanto el panel guarda por primera vez, la fuente de
// verdad pasa a ser Redis y este archivo únicamente actúa como red de seguridad
// si el almacenamiento no responde.
//
// Fórmula aplicada a cada ley:
//   € / gramo = (ley / 1000) × fixing_EUR_oz × f1 × f2 / divisor + f3
//
// f1 y f2 son los factores comerciales que multiplican (margen, merma,
// descuento por quilataje). f3 es un ajuste fijo en euros por gramo que se
// suma al final: con signo negativo resta, que es su uso habitual.
//
// Ninguno de los tres se envía al navegador de un visitante: el endpoint
// público solo devuelve el precio final ya calculado.

// Cada cuánto se le pide la cotización a la API de mercado, en segundos. Lo
// decide el panel: entre las dos peticiones el precio sale de la caché, así que
// este número es lo que marca el consumo de cuota de goldapi.io.
export const REFRESH_LIMITS = { min: 30, max: 86400 }
export const DEFAULT_REFRESH_SECONDS = 60

export const DEFAULT_FORMULAS = {
  version: 1,
  updatedAt: null,
  updatedBy: null,
  divisor: 31.1, // gramos por onza troy usados en el cálculo
  refreshSeconds: DEFAULT_REFRESH_SECONDS,
  gold: [
    { key: 'au24',  label: 'Oro 24k',   fineness: 999.9, f1: 0.993,  f2: 0.99,  f3: 0 },
    { key: 'au22',  label: 'Oro 22k',   fineness: 916.7, f1: 0.9825, f2: 0.99,  f3: 0 },
    { key: 'au216', label: 'Oro 21,6k', fineness: 900,   f1: 0.9875, f2: 0.99,  f3: 0 },
    { key: 'au18',  label: 'Oro 18k',   fineness: 750,   f1: 0.972,  f2: 0.98,  f3: 0 },
    { key: 'au14',  label: 'Oro 14k',   fineness: 585,   f1: 0.97,   f2: 0.972, f3: 0 },
    { key: 'au10',  label: 'Oro 10k',   fineness: 416.7, f1: 0.97,   f2: 0.978, f3: 0 },
    { key: 'au9',   label: 'Oro 9k',    fineness: 375,   f1: 0.97,   f2: 0.972, f3: 0 },
  ],
  silver: [
    { key: 'ag1000', label: 'Plata 1000', fineness: 1000, f1: 0.78, f2: 0.97, f3: 0 },
    { key: 'ag925',  label: 'Plata 925',  fineness: 925,  f1: 0.73, f2: 0.97, f3: 0 },
    { key: 'ag900',  label: 'Plata 900',  fineness: 900,  f1: 0.69, f2: 0.97, f3: 0 },
    { key: 'ag835',  label: 'Plata 835',  fineness: 835,  f1: 0.62, f2: 0.97, f3: 0 },
    { key: 'ag800',  label: 'Plata 800',  fineness: 800,  f1: 0.61, f2: 0.97, f3: 0 },
  ],
}

// Fixing de emergencia en EUR/oz si la API de mercado no responde y no hay
// ningún valor cacheado.
export const FALLBACK_FIXING = { gold: 3082, silver: 29.92 }

/**
 * Precio final por gramo de una ley.
 *
 * f3 es un ajuste fijo en euros que se suma al resultado; en negativo (lo
 * normal) descuenta. Las filas guardadas antes de que existiera no lo traen y
 * se tratan como 0, así que la fórmula sigue dando lo mismo que antes.
 *
 * El resultado nunca baja de 0: un ajuste desproporcionado deja el precio en
 * cero en lugar de publicar un número negativo en la web.
 */
export function gradePrice(fixingEurOz, grade, divisor) {
  const base = (grade.fineness / 1000) * fixingEurOz * grade.f1 * grade.f2 / divisor
  const adjust = Number(grade.f3)
  return Math.max(0, base + (Number.isFinite(adjust) ? adjust : 0))
}

/**
 * Devuelve la frecuencia de consulta guardada, acotada al rango permitido.
 * Los documentos guardados antes de que existiera este ajuste no la traen, y
 * en ese caso se usa el valor por defecto en lugar de fallar.
 */
export function refreshSecondsOf(doc) {
  const value = Number(doc?.refreshSeconds)
  if (!Number.isFinite(value)) return DEFAULT_REFRESH_SECONDS
  return Math.min(REFRESH_LIMITS.max, Math.max(REFRESH_LIMITS.min, Math.round(value)))
}
