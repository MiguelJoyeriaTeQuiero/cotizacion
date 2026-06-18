import { useEffect, useState } from 'react'
import { readConsent, saveConsent, OPEN_SETTINGS_EVENT } from '../cookieConsent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [advertising, setAdvertising] = useState(true)

  useEffect(() => {
    // Show the banner only if the user has not decided yet.
    if (!readConsent()) setVisible(true)

    const onOpen = () => {
      const c = readConsent()
      setAnalytics(c?.analytics ?? true)
      setAdvertising(c?.advertising ?? true)
      setShowSettings(true)
      setVisible(true)
    }
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen)
  }, [])

  if (!visible) return null

  const close = () => {
    setVisible(false)
    setShowSettings(false)
  }
  const acceptAll = () => {
    saveConsent({ analytics: true, advertising: true })
    close()
  }
  const rejectAll = () => {
    saveConsent({ analytics: false, advertising: false })
    close()
  }
  const savePrefs = () => {
    saveConsent({ analytics, advertising })
    close()
  }

  return (
    <div className="cookie-overlay" role="dialog" aria-label="Aviso de cookies" aria-modal="true">
      <div className="cookie-banner">
        {!showSettings ? (
          <>
            <div className="cookie-text">
              <div className="cookie-title">Tu privacidad nos importa 🍪</div>
              <p>
                Utilizamos cookies técnicas (necesarias) y, con tu permiso, cookies de análisis y
                publicidad de terceros —como el gráfico de cotizaciones— para mejorar tu experiencia.
                Puedes aceptarlas, rechazarlas o configurarlas. Más información en nuestra{' '}
                <a href="#/politica-de-cookies">Política de Cookies</a>.
              </p>
            </div>
            <div className="cookie-actions">
              <button className="cookie-btn ghost" onClick={() => setShowSettings(true)}>Configurar</button>
              <button className="cookie-btn ghost" onClick={rejectAll}>Rechazar</button>
              <button className="cookie-btn solid" onClick={acceptAll}>Aceptar todas</button>
            </div>
          </>
        ) : (
          <>
            <div className="cookie-text">
              <div className="cookie-title">Configuración de cookies</div>
              <div className="cookie-pref">
                <div>
                  <strong>Técnicas</strong>
                  <span>Necesarias para el funcionamiento de la web. Siempre activas.</span>
                </div>
                <label className="cookie-switch disabled">
                  <input type="checkbox" checked readOnly disabled />
                  <span className="cookie-slider" />
                </label>
              </div>
              <div className="cookie-pref">
                <div>
                  <strong>Análisis</strong>
                  <span>Nos ayudan a entender el uso de la web (incluye el gráfico de TradingView).</span>
                </div>
                <label className="cookie-switch">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={e => setAnalytics(e.target.checked)}
                  />
                  <span className="cookie-slider" />
                </label>
              </div>
              <div className="cookie-pref">
                <div>
                  <strong>Publicidad</strong>
                  <span>Permiten mostrar publicidad relevante de terceros.</span>
                </div>
                <label className="cookie-switch">
                  <input
                    type="checkbox"
                    checked={advertising}
                    onChange={e => setAdvertising(e.target.checked)}
                  />
                  <span className="cookie-slider" />
                </label>
              </div>
            </div>
            <div className="cookie-actions">
              <button className="cookie-btn ghost" onClick={rejectAll}>Rechazar todas</button>
              <button className="cookie-btn ghost" onClick={savePrefs}>Guardar selección</button>
              <button className="cookie-btn solid" onClick={acceptAll}>Aceptar todas</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
