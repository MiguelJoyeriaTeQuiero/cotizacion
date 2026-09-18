import { Fragment } from 'react'
import { EMAIL_GENERAL, PHONES } from '../contactInfo'

export default function TopBar() {
  return (
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
  )
}
