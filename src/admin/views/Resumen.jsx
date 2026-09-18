import { useEffect, useMemo } from 'react'
import { Sparkline } from '../components/Chart'
import {
  METALS, fmtDec, fmtDate, sinceText, priceOf, marginPct, greeting,
} from '../lib/formulas'

// Pantalla de entrada. Responde a la única pregunta que se hace uno al abrir el
// panel: ¿tengo que tocar algo hoy?

function drift(then, now) {
  if (!Number.isFinite(then) || !Number.isFinite(now) || then <= 0) return null
  return ((now - then) / then) * 100
}

export function Resumen({ p }) {
  const { user, draft, market, docMeta, dirty, changes, series, loadSeries, goTo } = p

  useEffect(() => { loadSeries(30) }, [loadSeries])

  const publishedAt = docMeta.updatedAt
  const since = sinceText(publishedAt)
  const then = docMeta.fixingAtPublish
  const now = market?.fixing

  const drifts = useMemo(() => ({
    gold: drift(then?.gold, now?.gold),
    silver: drift(then?.silver, now?.silver),
  }), [then, now])

  // Todas las leyes con su precio y su margen al fixing de ahora mismo.
  const leyes = useMemo(() => {
    const out = []
    for (const metal of ['gold', 'silver']) {
      const fixing = now?.[metal] ?? null
      for (const row of draft[metal]) {
        out.push({
          metal,
          key: row.key,
          label: row.label || row.key,
          price: priceOf(row, draft.divisor, fixing),
          margin: marginPct(row, draft.divisor, fixing),
          decimals: METALS[metal].decimals,
        })
      }
    }
    return out
  }, [draft, now])

  const watchlist = useMemo(
    () => [...leyes]
      .filter(l => l.margin != null)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 6),
    [leyes]
  )

  const avisos = useMemo(() => {
    const list = []
    if (market?.stale) {
      list.push({
        tone: 'warn',
        text: 'La cotización no se ha podido refrescar: se está publicando con el último dato conocido.',
      })
    }
    if (dirty) {
      list.push({
        tone: 'warn',
        text: `Tienes ${changes} ${changes === 1 ? 'cambio' : 'cambios'} sin publicar.`,
        action: { label: 'Ir a fórmulas', to: 'formulas' },
      })
    }
    for (const ley of leyes) {
      if (ley.margin != null && ley.margin < 0) {
        list.push({
          tone: 'bad',
          text: `${ley.label}: estás pagando ${fmtDec(-ley.margin, 1)} % por encima de lo que vale el metal.`,
          action: { label: 'Revisar', to: 'formulas' },
        })
      } else if (ley.price === 0) {
        list.push({ tone: 'bad', text: `${ley.label} publicaría 0 € por gramo.`, action: { label: 'Revisar', to: 'formulas' } })
      }
    }
    const days = publishedAt ? Math.round((Date.now() - new Date(publishedAt).getTime()) / 86400000) : null
    if (days != null && days >= 45) {
      list.push({
        tone: 'info',
        text: `Hace ${days} días que no se tocan las fórmulas. No es un problema: los precios siguen al mercado solos.`,
      })
    }
    return list.slice(0, 5)
  }, [market, dirty, changes, leyes, publishedAt])

  // Tendencia de la primera ley de oro, que es la que sale en la portada.
  const spark = useMemo(() => {
    const first = draft.gold[0]
    if (!first || !series.samples.length) return null
    const values = series.samples.map(s => Number(s?.gold?.[first.key])).filter(Number.isFinite)
    if (values.length < 3) return null
    return {
      label: first.label || first.key,
      values,
      change: drift(values[0], values[values.length - 1]),
    }
  }, [draft.gold, series.samples])

  const headline = (() => {
    const d = drifts.gold
    if (d == null) {
      return since
        ? `La última publicación fue ${since}.`
        : 'Todavía no hay ninguna publicación registrada.'
    }
    if (Math.abs(d) < 0.35) {
      return `El oro está prácticamente igual que cuando publicaste${since ? `, ${since}` : ''}.`
    }
    return `El oro ha ${d > 0 ? 'subido' : 'bajado'} un ${fmtDec(Math.abs(d), 1)} % desde tu última publicación${since ? `, ${since}` : ''}.`
  })()

  return (
    <div className="view">
      <section className="brief">
        <p className="brief__greet">{greeting()}, {user.name}.</p>
        <h2 className="brief__headline">{headline}</h2>
        <p className="brief__note">
          Los precios de la web se recalculan solos con cada cotización, así que lo que
          pagas por gramo se ha movido con el mercado sin tocar nada. Las fórmulas deciden
          el margen, no el precio.
        </p>

        <div className="brief__drifts">
          {Object.entries(METALS).map(([metal, cfg]) => {
            const d = drifts[metal]
            return (
              <div className="drift" key={metal}>
                <span className="drift__tag">{cfg.label}</span>
                <span className="drift__now">
                  {now?.[metal] != null ? `${fmtDec(now[metal], 2)} €/oz` : '—'}
                </span>
                {d != null ? (
                  <span className={`price__delta ${d >= 0 ? 'up' : 'down'}`}>
                    {d >= 0 ? '▲' : '▼'} {fmtDec(Math.abs(d), 2)} %
                  </span>
                ) : <span className="muted">sin referencia</span>}
                {then?.[metal] != null && (
                  <span className="drift__then">al publicar: {fmtDec(then[metal], 2)} €/oz</span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {avisos.length > 0 && (
        <section className="panel">
          <h3 className="panel__title">Atención</h3>
          <ul className="notices">
            {avisos.map((a, i) => (
              <li className={`notice is-${a.tone}`} key={i}>
                <span className="dot" aria-hidden="true" />
                <span>{a.text}</span>
                {a.action && (
                  <button className="btn small" onClick={() => goTo(a.action.to)}>{a.action.label}</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid-2">
        <section className="panel">
          <h3 className="panel__title">Lo que pagas ahora, por margen</h3>
          <table className="mini">
            <thead>
              <tr>
                <th>Ley</th>
                <th className="right">€ / gramo</th>
                <th className="right">Margen</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map(l => (
                <tr key={`${l.metal}-${l.key}`}>
                  <td>
                    <span className={`bead${l.metal === 'silver' ? ' silver' : ''}`} aria-hidden="true" />
                    {l.label}
                  </td>
                  <td className="right num">{fmtDec(l.price, l.decimals)} €</td>
                  <td className="right num">
                    <b className={l.margin < 0 ? 'bad' : l.margin < 3 ? 'warn' : ''}>
                      {fmtDec(l.margin, 1)} %
                    </b>
                  </td>
                </tr>
              ))}
              {!watchlist.length && (
                <tr><td colSpan={3} className="muted">Sin cotización no se puede calcular el margen.</td></tr>
              )}
            </tbody>
          </table>
          <p className="note">
            El margen compara lo que pagas con lo que vale el metal puro de ese gramo al
            fixing actual. <button className="linky" onClick={() => goTo('simulador')}>Simular una subida o bajada</button>
          </p>
        </section>

        <section className="panel">
          <h3 className="panel__title">Últimos 30 días</h3>
          {spark ? (
            <>
              <div className="trend">
                <Sparkline values={spark.values} />
                <div>
                  <b className="trend__value">
                    {fmtDec(spark.values[spark.values.length - 1], METALS.gold.decimals)} €/g
                  </b>
                  <span className="trend__label">{spark.label}</span>
                </div>
                <span className={`price__delta ${spark.change >= 0 ? 'up' : 'down'}`}>
                  {spark.change >= 0 ? '▲' : '▼'} {fmtDec(Math.abs(spark.change), 1)} %
                </span>
              </div>
              <p className="note">
                {series.samples.length} muestras registradas en la ventana.{' '}
                <button className="linky" onClick={() => goTo('evolucion')}>Ver la evolución completa</button>
              </p>
            </>
          ) : (
            <p className="note">
              Todavía no hay suficientes muestras. Se registra una como mucho cada hora,
              conforme la web recibe visitas, así que la gráfica se va llenando sola.
            </p>
          )}

          <dl className="stats">
            <div className="stat">
              <dt>Versión publicada</dt>
              <dd className="num">{docMeta.version ?? '—'}</dd>
            </div>
            <div className="stat">
              <dt>Último cambio</dt>
              <dd>
                {fmtDate(publishedAt)}
                {docMeta.updatedBy && <small>por {docMeta.updatedBy}</small>}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}
