import { Fragment } from 'react'
import { EMAIL_GENERAL, PHONES } from '../contactInfo'

export default function TopBar() {
  return (
    <>
      {/* Aviso de la venta de joyas al mayor: lleva a la banda de debajo de la portada. */}
      <a href="#joyas" className="aviso-joyas">
        <span>
          <strong className="aviso-joyas-marca">¿Lo sabías? </strong>
          También vendemos <strong>joyas de oro al por mayor</strong>
          <span className="aviso-joyas-extra"> para tu escaparate</span>
        </span>
        <span className="aviso-joyas-cta">
          <span className="aviso-joyas-extra">Descubrir</span>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </a>

      <div className="topbar">
        <div className="topbar-live">
          <div className="pulse-dot" />
          <span className="topbar-label">Precios actualizados en tiempo real · </span>
          <span>Cotización cada minuto</span>
        </div>
        <div className="topbar-contacts">
          {PHONES.map((p, i) => (
            <Fragment key={p.tel}>
              {i > 0 && <span className="topbar-sep">|</span>}
              <a href={`tel:${p.tel}`}>{i === 0 ? `📞 ${p.label}` : p.label}</a>
            </Fragment>
          ))}
          <span className="topbar-sep topbar-sep-email">|</span>
          <a href={`mailto:${EMAIL_GENERAL}`} className="topbar-email">
            {EMAIL_GENERAL}
          </a>
        </div>
      </div>
    </>
  )
}
