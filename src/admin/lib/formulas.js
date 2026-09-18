// Cálculo, formato y validación compartidos por todas las secciones del panel.
//
// La fórmula es la misma que aplica el servidor en api/_lib/defaults.js:
//   € / gramo = (ley ÷ 1000) × fixing €/oz × f1 × f2 ÷ divisor + f3

export const METALS = {
  gold: { label: 'Oro', badge: 'XAU', decimals: 2, prefix: 'au' },
  silver: { label: 'Plata', badge: 'XAG', decimals: 3, prefix: 'ag' },
}

export const LIMITS = {
  fineness: { min: 1, max: 1000 },
  factor: { min: 0.01, max: 2 },
  divisor: { min: 1, max: 1000 },
  // Factor 3: ajuste fijo en € por gramo, con signo. En negativo descuenta.
  adjust: { min: -100, max: 100 },
}

export const DEFAULT_REFRESH = 60

export const REFRESH_OPTIONS = [
  { value: 30,    label: 'Cada 30 segundos' },
  { value: 60,    label: 'Cada minuto' },
  { value: 120,   label: 'Cada 2 minutos' },
  { value: 300,   label: 'Cada 5 minutos' },
  { value: 900,   label: 'Cada 15 minutos' },
  { value: 1800,  label: 'Cada 30 minutos' },
  { value: 3600,  label: 'Cada hora' },
  { value: 10800, label: 'Cada 3 horas' },
  { value: 21600, label: 'Cada 6 horas' },
  { value: 43200, label: 'Cada 12 horas' },
  { value: 86400, label: 'Una vez al día' },
]

// Techo de consumo: dos llamadas por consulta (oro y plata) durante un mes de
// 30 días. Es el máximo, no lo previsto: sin visitas no se consulta nada.
export function monthlyCalls(seconds) {
  return Math.round((30 * 24 * 3600) / seconds) * 2
}

export function parseNum(value) {
  const n = Number(String(value ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function fmtNum(value) {
  return value == null ? '' : String(value)
}

// Cifras a la española: coma decimal y punto de millar.
export function fmtDec(value, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function fmtSigned(value, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${fmtDec(Math.abs(value), decimals)}`
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

// «hace 3 días», «hace 20 minutos». Devuelve null si no hay fecha válida.
export function sinceText(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  const days = Math.round(hours / 24)
  if (days < 31) return `hace ${days} ${days === 1 ? 'día' : 'días'}`
  const months = Math.round(days / 30)
  return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`
}

export function newKey(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

export function toDraft(doc) {
  const rows = (list) =>
    (list || []).map(g => ({
      key: g.key,
      label: g.label,
      fineness: fmtNum(g.fineness),
      f1: fmtNum(g.f1),
      f2: fmtNum(g.f2),
      // Las filas anteriores al factor 3 no lo traen: se muestran como 0.
      f3: fmtNum(Number.isFinite(Number(g.f3)) ? Number(g.f3) : 0),
    }))
  const refresh = Number(doc?.refreshSeconds)
  return {
    divisor: fmtNum(doc?.divisor),
    // Las versiones guardadas antes de que existiera este ajuste no lo traen.
    refreshSeconds: Number.isFinite(refresh) ? refresh : DEFAULT_REFRESH,
    gold: rows(doc?.gold),
    silver: rows(doc?.silver),
  }
}

// El borrador para enviar al servidor: números ya resueltos, sin texto.
export function draftToSnapshot(draft) {
  const rows = (list) =>
    list.map(r => ({
      key: r.key,
      label: r.label.trim(),
      fineness: parseNum(r.fineness),
      f1: parseNum(r.f1),
      f2: parseNum(r.f2),
      f3: r.f3 === '' ? 0 : parseNum(r.f3),
    }))
  return {
    divisor: parseNum(draft.divisor),
    refreshSeconds: draft.refreshSeconds,
    gold: rows(draft.gold),
    silver: rows(draft.silver),
  }
}

export function priceOf(row, divisorRaw, fixing) {
  const fineness = parseNum(row.fineness)
  const f1 = parseNum(row.f1)
  const f2 = parseNum(row.f2)
  const f3 = row.f3 === '' || row.f3 == null ? 0 : parseNum(row.f3)
  const divisor = parseNum(divisorRaw)
  if (fineness == null || f1 == null || f2 == null || f3 == null || !divisor || !fixing) return null
  return Math.max(0, (fineness / 1000) * fixing * f1 * f2 / divisor + f3)
}

/**
 * Lo que vale el metal puro que lleva un gramo de esa ley, al fixing dado.
 * Es la referencia contra la que se mide el margen: sin esto, los factores son
 * números sueltos que no dicen cuánto se gana.
 */
export function metalValue(row, divisorRaw, fixing) {
  const fineness = parseNum(row.fineness)
  const divisor = parseNum(divisorRaw)
  if (fineness == null || !divisor || !fixing) return null
  return (fineness / 1000) * fixing / divisor
}

/** Margen sobre el valor del metal, en porcentaje. */
export function marginPct(row, divisorRaw, fixing) {
  const price = priceOf(row, divisorRaw, fixing)
  const value = metalValue(row, divisorRaw, fixing)
  if (price == null || value == null || value <= 0) return null
  return (1 - price / value) * 100
}

/**
 * Cotización a la que el margen de esa ley se quedaría en cero.
 *
 * Solo existe cuando hay factor 3: sin él el margen es (1 − f1·f2), el mismo
 * suba o baje el mercado. Con un f3 negativo, en cambio, el descuento fijo pesa
 * cada vez menos según sube el metal, y hay un punto en el que se da la vuelta.
 */
export function breakEvenFixing(row, divisorRaw) {
  const fineness = parseNum(row.fineness)
  const f1 = parseNum(row.f1)
  const f2 = parseNum(row.f2)
  const f3 = row.f3 === '' || row.f3 == null ? 0 : parseNum(row.f3)
  const divisor = parseNum(divisorRaw)
  if (fineness == null || f1 == null || f2 == null || f3 == null || !divisor) return null
  if (f3 === 0) return null
  const slope = (fineness / 1000) * (f1 * f2 - 1) / divisor
  if (slope === 0) return null
  const fixing = -f3 / slope
  return fixing > 0 ? fixing : null
}

export function rowErrors(row) {
  const errors = []
  if (!row.label.trim()) errors.push('Falta el nombre')
  const fineness = parseNum(row.fineness)
  if (fineness == null || fineness < LIMITS.fineness.min || fineness > LIMITS.fineness.max) {
    errors.push(`Ley fuera de rango (${LIMITS.fineness.min}–${LIMITS.fineness.max})`)
  }
  for (const [name, raw] of [['Factor 1', row.f1], ['Factor 2', row.f2]]) {
    const value = parseNum(raw)
    if (value == null || value < LIMITS.factor.min || value > LIMITS.factor.max) {
      errors.push(`${name} fuera de rango (${LIMITS.factor.min}–${LIMITS.factor.max})`)
    }
  }
  const f3 = row.f3 === '' ? 0 : parseNum(row.f3)
  if (f3 == null || f3 < LIMITS.adjust.min || f3 > LIMITS.adjust.max) {
    errors.push(`Factor 3 fuera de rango (${LIMITS.adjust.min}–${LIMITS.adjust.max} € por gramo)`)
  }
  return errors
}

export function draftErrors(draft) {
  if (!draft) return []
  const out = []
  const divisor = parseNum(draft.divisor)
  if (divisor == null || divisor < LIMITS.divisor.min || divisor > LIMITS.divisor.max) {
    out.push(`El divisor debe estar entre ${LIMITS.divisor.min} y ${LIMITS.divisor.max}`)
  }
  for (const metal of ['gold', 'silver']) {
    if (!draft[metal].length) out.push(`La tabla de ${METALS[metal].label.toLowerCase()} no puede quedarse vacía`)
    draft[metal].forEach((row, i) => {
      rowErrors(row).forEach(e => out.push(`${METALS[metal].label}, fila ${i + 1}: ${e}`))
    })
  }
  return out
}

// Cuántos retoques sueltos hay sin publicar. Sirve para que la barra de abajo
// diga algo concreto («3 cambios») en vez de un genérico «hay cambios».
export function countChanges(before, after) {
  if (!before || !after) return 0
  let n = 0
  if (String(before.divisor) !== String(after.divisor)) n += 1
  if (before.refreshSeconds !== after.refreshSeconds) n += 1

  for (const metal of ['gold', 'silver']) {
    const prev = before[metal] || []
    const next = after[metal] || []
    const byKey = new Map(prev.map((row, i) => [row.key, { row, i }]))

    next.forEach((row, i) => {
      const old = byKey.get(row.key)
      if (!old) { n += 1; return }                                  // fila nueva
      for (const field of ['label', 'fineness', 'f1', 'f2', 'f3']) {
        if (String(old.row[field]) !== String(row[field])) n += 1
      }
      if (old.i !== i) n += 1                                       // ha cambiado de sitio
    })

    n += prev.filter(row => !next.some(r => r.key === row.key)).length  // eliminadas
  }
  return n
}

const FIELD_LABELS = {
  label: 'Nombre',
  fineness: 'Ley',
  f1: 'Factor 1',
  f2: 'Factor 2',
  f3: 'Factor 3',
}

/**
 * Compara dos juegos de fórmulas y devuelve qué cambió y cuánto mueve el precio
 * de cada ley con la cotización actual. Es lo que convierte «versión 41 → 42»
 * en «el 18k sube 1,05 € por gramo».
 */
export function diffDrafts(before, after, fixing) {
  const out = { divisor: null, refreshSeconds: null, metals: {}, totals: { changed: 0, added: 0, removed: 0 } }
  if (!before || !after) return out

  if (String(before.divisor) !== String(after.divisor)) {
    out.divisor = { before: before.divisor, after: after.divisor }
  }
  if (before.refreshSeconds !== after.refreshSeconds) {
    out.refreshSeconds = { before: before.refreshSeconds, after: after.refreshSeconds }
  }

  for (const metal of ['gold', 'silver']) {
    const prev = before[metal] || []
    const next = after[metal] || []
    const prevByKey = new Map(prev.map(r => [r.key, r]))
    const nextByKey = new Map(next.map(r => [r.key, r]))
    const fix = fixing?.[metal] ?? null
    const rows = []

    for (const row of next) {
      const old = prevByKey.get(row.key)
      const priceAfter = priceOf(row, after.divisor, fix)
      if (!old) {
        rows.push({ key: row.key, label: row.label, state: 'added', fields: [], priceBefore: null, priceAfter })
        out.totals.added += 1
        continue
      }
      const fields = []
      for (const field of ['label', 'fineness', 'f1', 'f2', 'f3']) {
        if (String(old[field]) !== String(row[field])) {
          fields.push({ field, name: FIELD_LABELS[field], before: old[field], after: row[field] })
        }
      }
      const priceBefore = priceOf(old, before.divisor, fix)
      const moved = priceBefore != null && priceAfter != null && Math.abs(priceAfter - priceBefore) > 1e-9
      if (fields.length || moved) {
        rows.push({ key: row.key, label: row.label, state: 'changed', fields, priceBefore, priceAfter })
        out.totals.changed += 1
      } else {
        rows.push({ key: row.key, label: row.label, state: 'same', fields, priceBefore, priceAfter })
      }
    }

    for (const row of prev) {
      if (nextByKey.has(row.key)) continue
      rows.push({
        key: row.key,
        label: row.label,
        state: 'removed',
        fields: [],
        priceBefore: priceOf(row, before.divisor, fix),
        priceAfter: null,
      })
      out.totals.removed += 1
    }

    out.metals[metal] = rows
  }

  return out
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 13) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}
