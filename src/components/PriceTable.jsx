import { useState } from 'react'
import { GOLD_GRADES, SILVER_GRADES, goldGradePrice, silverGradePrice } from '../hooks/useMetalPrices'
import TradingViewChart from './TradingViewChart'

function ChangeChip({ pct }) {
  const up = pct >= 0
  return (
    <span className={`pt-change ${up ? 'up' : 'down'}`}>
      <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path d={up ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7'} />
      </svg>
      {up ? '+' : ''}{Math.abs(pct).toFixed(2)}%
    </span>
  )
}

function GoldTable({ fixingEurOz, dailyChange }) {
  return (
    <div className="pt-wrap">
      <table className="pt-table">
        <thead>
          <tr>
            <th>Metal</th>
            <th>Título</th>
            <th>€ / gramo</th>
            <th>Var. día</th>
          </tr>
        </thead>
        <tbody>
          {GOLD_GRADES.map(g => {
            const price = goldGradePrice(fixingEurOz, g)
            return (
              <tr key={g.key}>
                <td>
                  <div className="pt-metal-cell">
                    <span className="pt-karat">{g.label}</span>
                  </div>
                </td>
                <td>
                  <span className="pt-fineness">{g.fineness}‰</span>
                </td>
                <td>
                  <span className="pt-price">€ {price.toFixed(2)}</span>
                </td>
                <td>
                  <ChangeChip pct={dailyChange} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SilverTable({ fixingEurOz, dailyChange }) {
  return (
    <div className="pt-wrap">
      <table className="pt-table">
        <thead>
          <tr>
            <th>Metal</th>
            <th>Título</th>
            <th>€ / gramo</th>
            <th>Var. día</th>
          </tr>
        </thead>
        <tbody>
          {SILVER_GRADES.map(g => {
            const price = silverGradePrice(fixingEurOz, g)
            return (
              <tr key={g.key}>
                <td>
                  <div className="pt-metal-cell">
                    <span className="pt-karat">{g.label}</span>
                  </div>
                </td>
                <td>
                  <span className="pt-fineness">{g.fineness}‰</span>
                </td>
                <td>
                  <span className="pt-price">€ {price.toFixed(3)}</span>
                </td>
                <td>
                  <ChangeChip pct={dailyChange} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function PriceTable({ metalData }) {
  const [tab, setTab] = useState('gold')
  const { fixing, lastFetch, loading, dailyChangeGold, dailyChangeSilver } = metalData

  const fmtTime = (d) => d
    ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  const fmtPrice = (n) =>
    n != null ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

  return (
    <section className="pt-section" id="precios">
      <div className="section-inner">

        {/* Section header */}
        <div className="pt-header fade-up">
          <div>
            <div className="section-tag">Cotización en vivo</div>
            <h2 className="section-title">
              Precios de compra<br /><em>por quilate y ley</em>
            </h2>
          </div>
          {/* Fixing status */}
          <div className="pt-fixing-bar">
            <div className="pt-fixing-item">
              <span className="pt-fixing-label">Fixing XAU/EUR</span>
              <span className="pt-fixing-value">€ {fmtPrice(fixing?.gold)} / oz</span>
            </div>
            <div className="pt-fixing-divider" />
            <div className="pt-fixing-item">
              <span className="pt-fixing-label">Fixing XAG/EUR</span>
              <span className="pt-fixing-value">€ {fmtPrice(fixing?.silver)} / oz</span>
            </div>
            <div className="pt-fixing-divider" />
            <div className="pt-fixing-item">
              <div className="pt-fixing-live">
                <span className="live-dot" style={{ width: 6, height: 6 }} />
                <span className="pt-fixing-label">Actualizado {fmtTime(lastFetch)}</span>
              </div>
              <span className="pt-fixing-source">Fuente: LBMA · goldapi.io</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="pt-tabs fade-up d1">
          <button
            className={`pt-tab${tab === 'gold' ? ' active' : ''}`}
            onClick={() => setTab('gold')}
          >
            <span className="pt-tab-badge">XAU</span>
            Oro
          </button>
          <button
            className={`pt-tab${tab === 'silver' ? ' active' : ''}`}
            onClick={() => setTab('silver')}
          >
            <span className="pt-tab-badge silver">XAG</span>
            Plata
          </button>
        </div>

        {/* Table + Chart */}
        <div className="pt-body fade-up d2">
          <div className="pt-table-col">
            {loading || !fixing ? (
              <div className="pt-loading">
                <span className="live-dot" style={{ width: 8, height: 8 }} />
                Conectando con mercado…
              </div>
            ) : tab === 'gold' ? (
              <GoldTable fixingEurOz={fixing.gold} dailyChange={dailyChangeGold} />
            ) : (
              <SilverTable fixingEurOz={fixing.silver} dailyChange={dailyChangeSilver} />
            )}
          </div>
          <div className="pt-chart-col">
            <TradingViewChart metal={tab} />
          </div>
        </div>

        {/* Disclaimer */}
        <p className="pt-disclaimer fade-up d3">
          Precios orientativos calculados sobre el fixing LBMA aplicando los factores comerciales propios de Te Quiero Metales S.L.
          El precio final de compra se cierra telefónicamente en el momento de la operación y puede variar según volumen, calidad y presentación del material.
        </p>

      </div>
    </section>
  )
}
