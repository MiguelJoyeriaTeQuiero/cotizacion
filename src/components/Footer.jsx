export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div>
          <span className="footer-logo-main">Metales</span>
          <span className="footer-logo-sub">Te Quiero Group</span>
          <p className="footer-desc">
            Especialistas en compraventa de metales preciosos al por mayor.
            Servicio profesional para joyerías y orfebres en las Islas Canarias.
          </p>
        </div>
        <div>
          <div className="footer-col-title">Servicios</div>
          <ul className="footer-links">
            <li><a href="#servicios">Oro al Mayor</a></li>
            <li><a href="https://www.platamayor.com" target="_blank" rel="noopener">Plata al Mayor</a></li>
            <li><a href="https://www.joyeriatequiero.com" target="_blank" rel="noopener">Joyería Te Quiero</a></li>
            <li><a href="mailto:herramientas@tequierometales.com">Herramientas de Joyería</a></li>
          </ul>
        </div>
        <div>
          <div className="footer-col-title">Empresa</div>
          <ul className="footer-links">
            <li><a href="#quienes-somos">Quiénes somos</a></li>
            <li><a href="#como-funciona">Cómo funciona</a></li>
            <li><a href="#precios">Precio del oro</a></li>
            <li><a href="#contacto">Contacto</a></li>
          </ul>
        </div>
        <div>
          <div className="footer-col-title">Contacto</div>
          <div className="footer-contact-row">
            <span className="footer-contact-icon">📞</span>
            <div>922 263 470<br />822 178 368</div>
          </div>
          <div className="footer-contact-row">
            <span className="footer-contact-icon">✉️</span>
            <div>info@tequierometales.com</div>
          </div>
          <div className="footer-contact-row">
            <span className="footer-contact-icon">📍</span>
            <div>Santa Cruz de Tenerife</div>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="footer-copy">
          © 2024 Te Quiero Metales S.L. · Todos los derechos reservados
        </div>
        <div className="footer-legal">
          <a href="#">Política de Privacidad</a>
          <a href="#">Aviso Legal</a>
          <a href="#">Cookies</a>
        </div>
      </div>
    </footer>
  )
}
