import { useEffect, useRef } from 'react'
import { useConsent, saveConsent } from '../cookieConsent'

const CONFIGS = {
  gold: {
    symbols: [['OANDA:XAUEUR|1M']],
    lineColor: '#C9A55A',
    topColor: 'rgba(201,165,90,0.18)',
    bottomColor: 'rgba(201,165,90,0)',
  },
  silver: {
    symbols: [['OANDA:XAGEUR|1M']],
    lineColor: '#7A9BAD',
    topColor: 'rgba(122,155,173,0.18)',
    bottomColor: 'rgba(122,155,173,0)',
  },
}

export default function TradingViewChart({ metal = 'gold' }) {
  const containerRef = useRef(null)
  const cfg = CONFIGS[metal]
  const consent = useConsent()
  const allowed = !!consent?.analytics

  useEffect(() => {
    if (!allowed) return
    const el = containerRef.current
    if (!el) return
    el.innerHTML = ''

    const inner = document.createElement('div')
    inner.className = 'tradingview-widget-container__widget'
    el.appendChild(inner)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js'
    script.async = true
    script.textContent = JSON.stringify({
      symbols: cfg.symbols,
      chartOnly: false,
      width: '100%',
      locale: 'es',
      colorTheme: 'light',
      autosize: true,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: true,
      hideSymbolLogo: false,
      scalePosition: 'right',
      scaleMode: 'Normal',
      fontSize: '10',
      noTimeScale: false,
      valuesTracking: '1',
      changeMode: 'price-and-percent',
      chartType: 'area',
      lineWidth: 2,
      lineType: 0,
      lineColor: cfg.lineColor,
      topColor: cfg.topColor,
      bottomColor: cfg.bottomColor,
      dateRanges: ['1d|1', '1m|30', '3m|60', '12m|1D', '60m|1W', 'all|1M'],
    })
    el.appendChild(script)

    return () => { el.innerHTML = '' }
  }, [allowed, metal, cfg.symbols, cfg.lineColor, cfg.topColor, cfg.bottomColor])

  return (
    <div className="tv-chart-outer">
      <div className="tv-chart-label">
        <span className={`pt-tab-badge${metal === 'silver' ? ' silver' : ''}`}>
          {metal === 'gold' ? 'XAU' : 'XAG'}
        </span>
        Gráfico {metal === 'gold' ? 'oro' : 'plata'} · EUR/oz · TradingView
      </div>
      {allowed ? (
        <div
          className="tradingview-widget-container tv-chart-embed"
          ref={containerRef}
        />
      ) : (
        <div className="tv-chart-blocked">
          <p>
            El gráfico de cotizaciones usa cookies de terceros (TradingView). Acepta las cookies de
            análisis para visualizarlo.
          </p>
          <button
            className="btn-primary"
            onClick={() => saveConsent({ analytics: true, advertising: true })}
          >
            Aceptar y ver el gráfico
          </button>
        </div>
      )}
    </div>
  )
}
