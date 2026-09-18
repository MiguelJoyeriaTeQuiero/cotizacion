// Validación del documento de fórmulas.
//
// Regla de oro: nunca se copia nada del cuerpo de la petición. Se construye un
// objeto nuevo campo a campo, así que claves inesperadas (incluida __proto__)
// se descartan solas y no hay forma de contaminar el prototipo.

import { REFRESH_LIMITS, DEFAULT_REFRESH_SECONDS } from './defaults.js'

const MAX_GRADES = 24
const KEY_RE = /^[a-z][a-z0-9_]{1,23}$/

const LIMITS = {
  divisor: { min: 1, max: 1000 },
  fineness: { min: 1, max: 1000 },
  factor: { min: 0.01, max: 2 },
  // Ajuste fijo en € por gramo. Admite negativos: es su uso habitual.
  adjust: { min: -100, max: 100 },
  label: 48,
}

function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function round(value, decimals) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function validateGrades(input, metal, errors) {
  if (!Array.isArray(input)) {
    errors.push(`"${metal}" debe ser una lista de leyes`)
    return []
  }
  if (input.length === 0) {
    errors.push(`La tabla de ${metal} no puede quedarse vacía`)
    return []
  }
  if (input.length > MAX_GRADES) {
    errors.push(`La tabla de ${metal} admite como máximo ${MAX_GRADES} filas`)
    return []
  }

  const seen = new Set()
  const out = []

  input.forEach((row, i) => {
    const pos = `${metal}, fila ${i + 1}`
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`${pos}: formato no válido`)
      return
    }

    const key = String(row.key ?? '').trim().toLowerCase()
    if (!KEY_RE.test(key)) {
      errors.push(`${pos}: identificador no válido (letras minúsculas, números y "_", de 2 a 24 caracteres)`)
      return
    }
    if (seen.has(key)) {
      errors.push(`${pos}: el identificador "${key}" está repetido`)
      return
    }
    seen.add(key)

    const label = String(row.label ?? '').trim()
    if (!label) {
      errors.push(`${pos}: el nombre no puede estar vacío`)
      return
    }
    if (label.length > LIMITS.label) {
      errors.push(`${pos}: el nombre no puede pasar de ${LIMITS.label} caracteres`)
      return
    }

    const fineness = num(row.fineness)
    if (fineness === null || fineness < LIMITS.fineness.min || fineness > LIMITS.fineness.max) {
      errors.push(`${pos}: la ley debe estar entre ${LIMITS.fineness.min} y ${LIMITS.fineness.max} milésimas`)
      return
    }

    const f1 = num(row.f1)
    const f2 = num(row.f2)
    for (const [name, value] of [['factor 1', f1], ['factor 2', f2]]) {
      if (value === null || value < LIMITS.factor.min || value > LIMITS.factor.max) {
        errors.push(`${pos}: el ${name} debe estar entre ${LIMITS.factor.min} y ${LIMITS.factor.max}`)
      }
    }
    if (f1 === null || f2 === null) return

    // Opcional: las filas guardadas antes de que existiera este campo no lo
    // traen y valen 0, que es no aplicar ningún ajuste.
    let f3 = 0
    if (row.f3 != null && row.f3 !== '') {
      const parsed = num(row.f3)
      if (parsed === null || parsed < LIMITS.adjust.min || parsed > LIMITS.adjust.max) {
        errors.push(`${pos}: el factor 3 debe estar entre ${LIMITS.adjust.min} y ${LIMITS.adjust.max} € por gramo`)
        return
      }
      f3 = parsed
    }

    out.push({
      key,
      label,
      fineness: round(fineness, 2),
      f1: round(f1, 6),
      f2: round(f2, 6),
      f3: round(f3, 6),
    })
  })

  return out
}

export function validateFormulas(input) {
  const errors = []

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['El cuerpo de la petición no es un objeto válido'] }
  }

  const divisor = num(input.divisor)
  if (divisor === null || divisor < LIMITS.divisor.min || divisor > LIMITS.divisor.max) {
    errors.push(`El divisor debe estar entre ${LIMITS.divisor.min} y ${LIMITS.divisor.max}`)
  }

  // Ajuste opcional: los documentos guardados antes de que existiera se quedan
  // con el valor por defecto en lugar de dar error.
  let refreshSeconds = DEFAULT_REFRESH_SECONDS
  if (input.refreshSeconds != null && input.refreshSeconds !== '') {
    const parsed = num(input.refreshSeconds)
    if (parsed === null || parsed < REFRESH_LIMITS.min || parsed > REFRESH_LIMITS.max) {
      errors.push(
        `La frecuencia de consulta de precios debe estar entre ${REFRESH_LIMITS.min} y ${REFRESH_LIMITS.max} segundos`
      )
    } else {
      refreshSeconds = Math.round(parsed)
    }
  }

  const gold = validateGrades(input.gold, 'oro', errors)
  const silver = validateGrades(input.silver, 'plata', errors)

  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    value: {
      divisor: round(divisor, 6),
      refreshSeconds,
      gold,
      silver,
    },
  }
}
