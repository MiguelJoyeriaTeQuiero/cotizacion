export default function TopBar() {
  return (
    <div className="topbar">
      <div className="topbar-live">
        <div className="pulse-dot" />
        <span className="topbar-label">Precios actualizados en tiempo real · </span>
        <span>Cotización cada minuto</span>
      </div>
      <div className="topbar-contacts">
        <a href="tel:922263470">📞 922 263 470</a>
        <span className="topbar-sep">|</span>
        <a href="tel:822178368">822 178 368</a>
        <span className="topbar-sep topbar-sep-email">|</span>
        <a href="mailto:info@tequierometales.com" className="topbar-email">
          info@tequierometales.com
        </a>
      </div>
    </div>
  )
}
