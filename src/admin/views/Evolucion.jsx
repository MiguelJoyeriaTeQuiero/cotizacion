import { useEffect, useMemo, useState } from 'react'
import { Chart } from '../components/Chart'
import { METALS, fmtDec, fmtSigned } from '../lib/formulas'

// La memoria del sistema: qué has estado pagando y cómo cotizaba el metal en
// ese momento. Las muestras las escribe el endpoint público conforme refresca
// el mercado, como mucho una por hora.

const RANGOS = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
]

export function Evolucion({ p }) {
  const { draft, series, loadSeries, prefs, setPrefs } = p
  const [metal, setMetal] = useState('gold')
  const [key, setKey] = useState(null)
  const days = prefs.rangoEvolucion

  useEffect(() => { loadSeries(days) }, [loadSeries, days])

  const leyes = draft[metal]
  const activeKey = key && leyes.some(l => l.key === key) ? key : leyes[0]?.key
  const ley = leyes.find(l => l.key === activeKey)
  const cfg = METALS[metal]

  const points = useMemo(() => {
    if (!activeKey) return []
    return series.samples
      .map(s => ({
        t: Number(s.t),
        price: Number(s?.[metal]?.[activeKey]),
        fixing: Number(s?.fixing?.[metal]),
      }))
      .filter(pt => Number.isFinite(pt.t) && Number.isFinite(pt.price))
  }, [series.samples, metal, activeKey])

  const stats = useMemo(() => {
    if (points.length < 2) return null
    const values = points.map(pt => pt.price)
    const first = values[0]
    const last = values[values.length - 1]
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      first,
      last,
      change: first > 0 ? ((last - first) / first) * 100 : null,
    }
  }, [points])

  return (
    <div className="view">
      <section className="panel">
        <div className="evo__controls">
          <div className="segmented" role="tablist" aria-label="Metal">
            {Object.entries(METALS).map(([m, c]) => (
              <button
                key={m}
                role="tab"
                aria-selected={metal === m}
                onClick={() => { setMetal(m); setKey(null) }}
              >
                <span className={`bead${m === 'silver' ? ' silver' : ''}`} aria-hidden="true" />
                {c.label}
              </button>
            ))}
          </div>

          <label className="field-inline">
            <span>Ley</span>
            <select
              className="select"
              value={activeKey ?? ''}
              onChange={(e) => setKey(e.target.value)}
            >
              {leyes.map(l => (
                <option key={l.key} value={l.key}>{l.label || l.key}</option>
              ))}
            </select>
          </label>

          <div className="segmented small" role="group" aria-label="Ventana de tiempo">
            {RANGOS.map(r => (
              <button
                key={r.value}
                aria-selected={days === r.value}
                onClick={() => setPrefs(x => ({ ...x, rangoEvolucion: r.value }))}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {series.loading && !points.length ? (
          <div className="skeleton" style={{ height: 280 }} />
        ) : points.length < 2 ? (
          <div className="empty-block">
            <h4>Aún no hay suficientes muestras</h4>
            <p>
              La gráfica se llena sola: cada vez que la web refresca la cotización se guarda
              una foto del fixing y del precio publicado, como mucho una por hora. En cuanto
              haya dos o tres, esto empieza a tener forma.
              {series.total > 0 && ` De momento hay ${series.total} en total.`}
            </p>
          </div>
        ) : (
          <>
            <Chart
              points={points}
              series={[
                {
                  key: 'price',
                  label: `${ley?.label || activeKey} · lo que pagas`,
                  decimals: cfg.decimals,
                  unit: '€/g',
                },
                { key: 'fixing', label: `Fixing ${cfg.badge}`, decimals: 2, unit: '€/oz' },
              ]}
            />

            {stats && (
              <dl className="stats inline">
                <div className="stat">
                  <dt>Ahora</dt>
                  <dd className="num">{fmtDec(stats.last, cfg.decimals)} €/g</dd>
                </div>
                <div className="stat">
                  <dt>En la ventana</dt>
                  <dd className={`num ${stats.change >= 0 ? 'up' : 'down'}`}>
                    {fmtSigned(stats.change, 1)} %
                  </dd>
                </div>
                <div className="stat">
                  <dt>Mínimo</dt>
                  <dd className="num">{fmtDec(stats.min, cfg.decimals)} €/g</dd>
                </div>
                <div className="stat">
                  <dt>Máximo</dt>
                  <dd className="num">{fmtDec(stats.max, cfg.decimals)} €/g</dd>
                </div>
                <div className="stat">
                  <dt>Muestras</dt>
                  <dd className="num">{points.length}</dd>
                </div>
              </dl>
            )}

            <p className="note">
              La línea gruesa es el precio por gramo que estaba publicado; la fina, la
              cotización del metal, en su propia escala a la derecha. Mientras no toques las
              fórmulas, las dos dibujan la misma forma: el precio se limita a seguir al
              mercado. Un escalón en la gruesa que la fina no acompaña es un cambio tuyo.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
