import { useMemo } from 'react'

function Sparkline({ data }) {
  const { linePath, fillPath } = useMemo(() => {
    if (!data || data.length < 2) return { linePath: '', fillPath: '' }
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const W = 300, H = 44
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * W
      const y = H - ((v - min) / range) * (H - 6) - 3
      return `${x},${y}`
    })
    const line = `M${pts.join(' L')}`
    return { linePath: line, fillPath: `${line} L300,44 L0,44 Z` }
  }, [data])

  return (
    <svg className="sparkline-svg" viewBox="0 0 300 44" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C9A55A" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#C9A55A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {linePath && <>
        <path d={linePath} fill="none" stroke="#C9A55A" strokeWidth="2" />
        <path d={fillPath} fill="url(#sg)" />
      </>}
    </svg>
  )
}

function ChangeChip({ pct }) {
  const up = pct >= 0
  return (
    <span className={`price-change ${up ? 'up' : 'down'}`}>
      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path d={up ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7'} />
      </svg>
      {up ? '+' : ''}{pct.toFixed(2)}% hoy
    </span>
  )
}

export default function PriceCard({ metalData }) {
  const { gold, silver, change, lastFetch, sparklineGold } = metalData

  // La tarjeta destaca siempre el oro de 24k y la plata de 1000‰; si esas leyes
  // se hubieran quitado del panel, cae a la primera fila de la tabla.
  const topGold = gold?.find(g => g.key === 'au24') ?? gold?.[0] ?? null
  const topSilver = silver?.find(g => g.key === 'ag1000') ?? silver?.[0] ?? null
  const gold24k = topGold?.pricePerGram ?? null
  const silver1000 = topSilver?.pricePerGram ?? null
  const dailyChangeGold = change?.gold ?? 0
  const dailyChangeSilver = change?.silver ?? 0

  const fmtTime = (d) => {
    if (!d) return '—'
    const s = Math.floor((Date.now() - d.getTime()) / 1000)
    if (s < 5) return 'ahora mismo'
    if (s < 60) return `hace ${s}s`
    return `hace ${Math.floor(s / 60)}min`
  }

  return (
    <div className="price-card fade-up hero-eager">
      <div className="price-card-header">
        <div className="price-card-title">Cotización en vivo</div>
        <div className="live-badge"><div className="live-dot" /> En directo</div>
      </div>

      {/* Gold 24k */}
      <div style={{ marginBottom: 18 }}>
        <div className="price-metal-name">
          <span className="metal-badge">XAU</span>
          Oro · 24 quilates
        </div>
        <div className="price-value">
          <span className="price-currency">€</span>
          <span>{gold24k != null ? gold24k.toFixed(2) : '—'}</span>
          <span className="price-unit">/gramo</span>
        </div>
        {gold24k != null && <ChangeChip pct={dailyChangeGold} />}
      </div>

      {/* Sparkline */}
      <div className="sparkline-wrap">
        <div className="sparkline-label">Últimas actualizaciones</div>
        <Sparkline data={sparklineGold} />
      </div>

      <div className="price-divider" />

      {/* Silver 1000 */}
      <div className="price-secondary">
        <div>
          <div className="price-sec-label">
            <span className="metal-badge" style={{ fontSize: 9, padding: '1px 5px', marginRight: 4 }}>XAG</span>
            Plata 1000‰
          </div>
          <div className="price-sec-value">
            {silver1000 != null ? `€${silver1000.toFixed(3)}` : '—'}
          </div>
          {silver1000 != null && (
            <div className="price-sec-change" style={{ color: dailyChangeSilver >= 0 ? '#16A34A' : '#DC2626' }}>
              {dailyChangeSilver >= 0 ? '+' : ''}{dailyChangeSilver.toFixed(2)}% hoy
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="price-sec-label">Actualizado</div>
          <div className="price-sec-value" style={{ fontSize: 13, color: '#999' }}>{fmtTime(lastFetch)}</div>
        </div>
      </div>

      <div className="price-footnote">
        <div className="footnote-dot" />
        Fixing LBMA en EUR/oz. Precio final confirmado por teléfono.
      </div>
    </div>
  )
}
