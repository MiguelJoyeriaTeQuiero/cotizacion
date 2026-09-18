import { useState } from 'react'
import {
  METALS, fmtDec, fmtSigned, newKey, priceOf, marginPct, rowErrors,
} from '../lib/formulas'

// Editor de fórmulas: el libro de leyes. Es la sección donde se trabaja, así
// que la tabla manda y todo lo demás (explicaciones, ajustes) vive fuera.

function GradeRow({ row, index, total, metal, divisor, fixing, published, showMargin, onChange, onMove, onRemove }) {
  const errors = rowErrors(row)
  const price = priceOf(row, divisor, fixing)
  const margin = marginPct(row, divisor, fixing)
  const current = published?.get(row.key)?.pricePerGram ?? null
  const delta = price != null && current != null ? price - current : null
  const decimals = METALS[metal].decimals
  // Solo se compara cuando la diferencia se nota al redondear a los decimales
  // que se publican: si no, la línea de abajo sería ruido.
  const moved = delta != null && Math.abs(delta) > 10 ** -(decimals + 1)

  const update = (field) => (e) => onChange(index, field, e.target.value)
  const name = row.label.trim() || `fila ${index + 1}`

  const numeric = [
    { field: 'fineness', label: 'Ley (‰)' },
    { field: 'f1', label: 'Factor 1' },
    { field: 'f2', label: 'Factor 2' },
    { field: 'f3', label: 'Factor 3 (€/g)' },
  ]

  return (
    <div className={`row${errors.length ? ' invalid' : ''}`}>
      <div className="row__order">
        <button type="button" aria-label={`Subir ${name}`} onClick={() => onMove(index, -1)} disabled={index === 0}>▲</button>
        <span className="n">{index + 1}</span>
        <button type="button" aria-label={`Bajar ${name}`} onClick={() => onMove(index, 1)} disabled={index === total - 1}>▼</button>
      </div>

      <label className="cell wide">
        <span className="sr-only">Nombre</span>
        <input
          className="input"
          type="text"
          value={row.label}
          onChange={update('label')}
          maxLength={48}
          placeholder="Oro 18 quilates"
        />
      </label>

      {numeric.map(({ field, label }) => (
        <label className="cell" key={field}>
          <span className="sr-only">{label}</span>
          <input
            className="input n"
            type="text"
            inputMode={field === 'f3' ? 'text' : 'decimal'}
            value={row[field]}
            onChange={update(field)}
            placeholder={field === 'f3' ? '0' : undefined}
            title={field === 'f3'
              ? 'Ajuste fijo en euros por gramo. En negativo resta: −0,05 descuenta 5 céntimos.'
              : undefined}
          />
        </label>
      ))}

      {showMargin && (
        <div className="margin">
          <span className="sr-only">Margen</span>
          {margin != null ? (
            <b className={margin < 0 ? 'bad' : margin < 3 ? 'warn' : ''}>{fmtDec(margin, 1)} %</b>
          ) : '—'}
        </div>
      )}

      <div className="price">
        <div className={`price__value${price == null ? ' empty' : ''}`}>
          {price != null ? `${fmtDec(price, decimals)} €` : '—'}
        </div>
        {/* Comparación con lo que está publicado ahora mismo, para ver de un
            vistazo hacia dónde mueve el retoque. */}
        {moved && (
          <>
            <span className={`price__delta ${delta > 0 ? 'up' : 'down'}`}>
              {delta > 0 ? '▲' : '▼'} {fmtSigned(delta, decimals)}
            </span>
            <span className="price__now">Publicado: {fmtDec(current, decimals)} €</span>
          </>
        )}
      </div>

      <button
        type="button"
        className="btn icon danger"
        aria-label={`Eliminar ${name}`}
        title="Eliminar fila"
        onClick={() => onRemove(index)}
      >×</button>

      {errors.length > 0 && <div className="row__errors">{errors.join(' · ')}</div>}
    </div>
  )
}

export function Formulas({ p }) {
  const [tab, setTab] = useState('gold')
  const { draft, setDraft, market, published, prefs } = p

  const fixing = market?.fixing?.[tab] ?? null
  const rows = draft[tab]
  const showMargin = prefs.mostrarMargen

  const updateRow = (index, field, value) => {
    setDraft(d => ({
      ...d,
      [tab]: d[tab].map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }))
  }

  const moveRow = (index, direction) => {
    setDraft(d => {
      const list = [...d[tab]]
      const target = index + direction
      if (target < 0 || target >= list.length) return d
      ;[list[index], list[target]] = [list[target], list[index]]
      return { ...d, [tab]: list }
    })
  }

  const removeRow = (index) => {
    const row = draft[tab][index]
    if (prefs.confirmarBorrado &&
        !window.confirm(`¿Eliminar la fila «${row.label || 'sin nombre'}» de la tabla pública?`)) return
    setDraft(d => ({ ...d, [tab]: d[tab].filter((_, i) => i !== index) }))
  }

  const addRow = () => {
    setDraft(d => ({
      ...d,
      [tab]: [...d[tab], { key: newKey(METALS[tab].prefix), label: '', fineness: '', f1: '1', f2: '1', f3: '0' }],
    }))
  }

  return (
    <>
      <div className="board__head">
        <div className="segmented" role="tablist" aria-label="Metal">
          {Object.entries(METALS).map(([metal, cfg]) => (
            <button
              key={metal}
              id={`tab-${metal}`}
              role="tab"
              aria-selected={tab === metal}
              aria-controls="tabla-leyes"
              onClick={() => setTab(metal)}
            >
              <span className={`bead${metal === 'silver' ? ' silver' : ''}`} aria-hidden="true" />
              {cfg.label}
              <span className="count">{draft[metal].length}</span>
            </button>
          ))}
        </div>

        <label className="divisor">
          <span>Divisor (g/oz)</span>
          <input
            className="input num"
            type="text"
            inputMode="decimal"
            value={draft.divisor}
            onChange={(e) => setDraft(d => ({ ...d, divisor: e.target.value }))}
          />
        </label>
      </div>

      <div
        className={`ledger${showMargin ? ' with-margin' : ''}${prefs.densidad === 'compacta' ? ' compact' : ''}`}
        id="tabla-leyes"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        <div className="ledger__head" aria-hidden="true">
          <span>#</span>
          <span>Nombre en la web</span>
          <span className="right">Ley ‰</span>
          <span className="right">Factor 1</span>
          <span className="right">Factor 2</span>
          <span className="right">Factor 3 €/g</span>
          {showMargin && <span className="right">Margen</span>}
          <span className="right">€ / gramo</span>
          <span />
        </div>

        {rows.length === 0 ? (
          <div className="ledger__empty">
            <h3>Todavía no hay ninguna ley de {METALS[tab].label.toLowerCase()}</h3>
            <p>
              Mientras esté vacía, la web no puede publicar esta tabla. Añade la ley que
              más compras: la primera de la lista es la que sale en la tarjeta de la portada.
            </p>
          </div>
        ) : (
          rows.map((row, i) => (
            <GradeRow
              key={row.key}
              row={row}
              index={i}
              total={rows.length}
              metal={tab}
              divisor={draft.divisor}
              fixing={fixing}
              published={published[tab]}
              showMargin={showMargin}
              onChange={updateRow}
              onMove={moveRow}
              onRemove={removeRow}
            />
          ))
        )}

        <div className="ledger__foot">
          <button className="btn add" onClick={addRow}>
            + Añadir ley de {METALS[tab].label.toLowerCase()}
          </button>
        </div>
      </div>

      <div className="board__note">
        <code className="formula">
          € / gramo = (<b>ley</b> ÷ 1000) × <b>fixing</b> €/oz × <b>f1</b> × <b>f2</b> ÷ <b>divisor</b> + <b>f3</b>
        </code>
        <p className="note">
          <strong>Factor 1</strong> es el margen comercial y <strong>factor 2</strong> la merma
          y el descuento por quilataje: los dos multiplican, así que lo que descuentan sube y
          baja con el mercado. El <strong>factor 3</strong> es una cantidad fija en euros por
          gramo que se suma al final; en negativo descuenta (<code>-0,05</code> deja el gramo 5
          céntimos por debajo) y es el único que hace que el margen cambie según cotice el metal.
          {showMargin && ' La columna de margen compara el precio que pagas con lo que vale el metal puro que lleva ese gramo.'}
        </p>
      </div>
    </>
  )
}
