import { useMemo, useState } from 'react'
import { METALS, fmtDec, fmtSigned, priceOf, marginPct, breakEvenFixing } from '../lib/formulas'

// «¿Y si el oro se mueve un 5 %?»
//
// Con las fórmulas actuales el precio sigue al mercado en proporción, así que
// lo interesante no es el precio simulado en sí, sino el margen: es lo único
// que se mueve de verdad, y solo se mueve donde hay factor 3.

const QUICK = [-10, -5, -2, 0, 2, 5, 10]

export function Simulador({ p }) {
  const { draft, market } = p
  const [metal, setMetal] = useState('gold')
  const [pct, setPct] = useState(5)

  const cfg = METALS[metal]
  const fixing = market?.fixing?.[metal] ?? null
  const simulated = fixing != null ? fixing * (1 + pct / 100) : null

  const rows = useMemo(() => draft[metal].map(row => {
    const now = priceOf(row, draft.divisor, fixing)
    const then = priceOf(row, draft.divisor, simulated)
    const marginNow = marginPct(row, draft.divisor, fixing)
    const marginThen = marginPct(row, draft.divisor, simulated)
    return {
      key: row.key,
      label: row.label || row.key,
      now,
      then,
      delta: now != null && then != null ? then - now : null,
      marginNow,
      marginThen,
      breakEven: breakEvenFixing(row, draft.divisor),
    }
  }), [draft, metal, fixing, simulated])

  const marginMoves = rows.some(r =>
    r.marginNow != null && r.marginThen != null && Math.abs(r.marginThen - r.marginNow) > 0.05)

  return (
    <div className="view">
      <section className="panel">
        <div className="sim__head">
          <div className="segmented" role="tablist" aria-label="Metal">
            {Object.entries(METALS).map(([key, m]) => (
              <button
                key={key}
                role="tab"
                aria-selected={metal === key}
                onClick={() => setMetal(key)}
              >
                <span className={`bead${key === 'silver' ? ' silver' : ''}`} aria-hidden="true" />
                {m.label}
              </button>
            ))}
          </div>

          <div className="sim__reading">
            <span className="sim__from">{fixing != null ? `${fmtDec(fixing, 2)} €/oz` : '—'}</span>
            <span className="sim__arrow" aria-hidden="true">→</span>
            <b className={`sim__to${pct > 0 ? ' up' : pct < 0 ? ' down' : ''}`}>
              {simulated != null ? `${fmtDec(simulated, 2)} €/oz` : '—'}
            </b>
          </div>
        </div>

        <div className="sim__control">
          <input
            className="slider"
            type="range"
            min={-10}
            max={10}
            step={0.5}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            aria-label={`Variación del ${cfg.label.toLowerCase()} en porcentaje`}
          />
          <output className={`sim__pct${pct > 0 ? ' up' : pct < 0 ? ' down' : ''}`}>
            {fmtSigned(pct, 1)} %
          </output>
        </div>

        <div className="sim__quick">
          {QUICK.map(v => (
            <button
              key={v}
              className={`chip${pct === v ? ' on' : ''}`}
              onClick={() => setPct(v)}
            >
              {v === 0 ? 'Sin cambio' : `${fmtSigned(v, 0)} %`}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__title">Cómo quedaría la tabla de {cfg.label.toLowerCase()}</h3>
        <div className="table-scroll">
          <table className="mini wide">
            <thead>
              <tr>
                <th>Ley</th>
                <th className="right">Ahora</th>
                <th className="right">Simulado</th>
                <th className="right">Diferencia</th>
                <th className="right">Margen</th>
                <th className="right">Margen cero en</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const marginShift = r.marginNow != null && r.marginThen != null
                  ? r.marginThen - r.marginNow
                  : null
                return (
                  <tr key={r.key} className={r.then === 0 ? 'is-bad' : ''}>
                    <td>{r.label}</td>
                    <td className="right num">{fmtDec(r.now, cfg.decimals)} €</td>
                    <td className="right num"><b>{fmtDec(r.then, cfg.decimals)} €</b></td>
                    <td className="right num">
                      {r.delta != null && Math.abs(r.delta) > 10 ** -(cfg.decimals + 1) ? (
                        <span className={`price__delta ${r.delta > 0 ? 'up' : 'down'}`}>
                          {r.delta > 0 ? '▲' : '▼'} {fmtSigned(r.delta, cfg.decimals)}
                        </span>
                      ) : <span className="muted">igual</span>}
                    </td>
                    <td className="right num">
                      {fmtDec(r.marginNow, 1)} %
                      {marginShift != null && Math.abs(marginShift) > 0.05 && (
                        <em className={marginShift > 0 ? 'up' : 'down'}>
                          {' '}→ {fmtDec(r.marginThen, 1)} %
                        </em>
                      )}
                    </td>
                    <td className="right num">
                      {r.breakEven != null
                        ? <span title="Cotización a la que esta ley dejaría de dar margen">{fmtDec(r.breakEven, 0)} €/oz</span>
                        : <span className="muted">no aplica</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="note">
          {marginMoves ? (
            <>
              El margen se mueve porque alguna ley lleva <strong>factor 3</strong>: como es una
              cantidad fija en euros, pesa menos cuanto más alto cotiza el metal.
            </>
          ) : (
            <>
              El margen apenas se mueve, y es lo normal: es <strong>1 − f1 × f2</strong>, que no
              depende de cómo cotice el metal. Lo único que lo altera es el <strong>factor 3</strong>,
              y con los valores de esta tabla ese efecto no llega ni a una décima.
            </>
          )}
          {' '}La última columna es la cotización a la que el margen de esa ley llegaría a cero.
          Solo aparece con un factor 3 positivo: en negativo el descuento fijo pesa cada vez
          menos según sube el metal, así que el margen crece en lugar de estrecharse.
        </p>
      </section>
    </div>
  )
}
