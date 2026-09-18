import { useMemo, useState } from 'react'
import { METALS, diffDrafts, fmtDec, fmtSigned, REFRESH_OPTIONS } from '../lib/formulas'

// Comparación entre dos juegos de fórmulas. Lo que importa no es qué número
// cambió, sino cuánto mueve eso el precio por gramo, así que esa es la columna
// que manda a la derecha.

const STATE_LABEL = {
  added: 'Nueva',
  removed: 'Eliminada',
  changed: 'Cambiada',
}

function refreshLabel(seconds) {
  return REFRESH_OPTIONS.find(o => o.value === Number(seconds))?.label ?? `${seconds} s`
}

export function Diff({ before, after, fixing, nameBefore = 'Antes', nameAfter = 'Después' }) {
  const [showAll, setShowAll] = useState(false)
  const diff = useMemo(() => diffDrafts(before, after, fixing), [before, after, fixing])

  const { changed, added, removed } = diff.totals
  const nothing = !changed && !added && !removed && !diff.divisor && !diff.refreshSeconds

  if (nothing) {
    return (
      <div className="diff">
        <p className="diff__none">
          No hay ninguna diferencia: <strong>{nameBefore}</strong> y <strong>{nameAfter}</strong> publican
          exactamente los mismos precios.
        </p>
      </div>
    )
  }

  const parts = []
  if (changed) parts.push(`${changed} ${changed === 1 ? 'ley cambiada' : 'leyes cambiadas'}`)
  if (added) parts.push(`${added} ${added === 1 ? 'añadida' : 'añadidas'}`)
  if (removed) parts.push(`${removed} ${removed === 1 ? 'eliminada' : 'eliminadas'}`)

  return (
    <div className="diff">
      <div className="diff__head">
        <p className="diff__summary">
          {parts.join(' · ') || 'Solo cambian los ajustes generales'}
          <span className="diff__names"> · {nameBefore} → {nameAfter}</span>
        </p>
        <label className="switch">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          <span>Ver también las que no cambian</span>
        </label>
      </div>

      {(diff.divisor || diff.refreshSeconds) && (
        <ul className="diff__general">
          {diff.divisor && (
            <li>
              <span>Divisor</span>
              <b>{diff.divisor.before} → {diff.divisor.after}</b>
            </li>
          )}
          {diff.refreshSeconds && (
            <li>
              <span>Consulta de mercado</span>
              <b>{refreshLabel(diff.refreshSeconds.before)} → {refreshLabel(diff.refreshSeconds.after)}</b>
            </li>
          )}
        </ul>
      )}

      {Object.entries(METALS).map(([metal, cfg]) => {
        const rows = (diff.metals[metal] || []).filter(r => showAll || r.state !== 'same')
        if (!rows.length) return null
        return (
          <section className="diff__metal" key={metal}>
            <h4>{cfg.label}</h4>
            <ul className="diff__rows">
              {rows.map((row) => {
                const delta =
                  row.priceBefore != null && row.priceAfter != null
                    ? row.priceAfter - row.priceBefore
                    : null
                const moved = delta != null && Math.abs(delta) > 10 ** -(cfg.decimals + 1)
                return (
                  <li key={row.key} className={`diff__row is-${row.state}`}>
                    <div className="diff__what">
                      <span className="diff__label">
                        {row.label || row.key}
                        {row.state !== 'changed' && row.state !== 'same' && (
                          <em className="tag">{STATE_LABEL[row.state]}</em>
                        )}
                      </span>
                      {row.fields.length > 0 && (
                        <span className="diff__fields">
                          {row.fields.map(f => (
                            <span className="diff__field" key={f.field}>
                              {f.name} <s>{String(f.before) || '—'}</s> → {String(f.after) || '—'}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="diff__price">
                      <span className="diff__prices">
                        {row.priceBefore != null ? `${fmtDec(row.priceBefore, cfg.decimals)} €` : '—'}
                        {' → '}
                        <b>{row.priceAfter != null ? `${fmtDec(row.priceAfter, cfg.decimals)} €` : '—'}</b>
                      </span>
                      {moved && (
                        <span className={`price__delta ${delta > 0 ? 'up' : 'down'}`}>
                          {delta > 0 ? '▲' : '▼'} {fmtSigned(delta, cfg.decimals)}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
