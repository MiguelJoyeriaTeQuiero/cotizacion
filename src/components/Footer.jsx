import { openCookieSettings } from '../cookieConsent'
import { ADDRESS, EMAILS, PHONES } from '../contactInfo'

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
            <div>
              {PHONES.map((p, i) => (
                <span key={p.tel}>
                  {i > 0 && <br />}
                  <a href={`tel:${p.tel}`}>{p.label}</a>
                </span>
              ))}
            </div>
          </div>
          <div className="footer-contact-row">
            <span className="footer-contact-icon">✉️</span>
            <div>
              {EMAILS.map((email, i) => (
                <span key={email}>
                  {i > 0 && <br />}
                  <a href={`mailto:${email}`}>{email}</a>
                </span>
              ))}
            </div>
          </div>
          <div className="footer-contact-row">
            <span className="footer-contact-icon">📍</span>
            <div>{ADDRESS.street}<br />{ADDRESS.city}</div>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="footer-copy">
          © 2024 Te Quiero Metales S.L. · Todos los derechos reservados
        </div>
        <div className="footer-legal">
          <a href="#/aviso-legal">Aviso Legal</a>
          <a href="#/politica-de-privacidad">Política de Privacidad</a>
          <a href="#/politica-de-cookies">Cookies</a>
          <a href="#/condiciones-de-venta">Condiciones de Venta</a>
          <button type="button" className="footer-legal-btn" onClick={openCookieSettings}>
            Configurar cookies
          </button>
        </div>
      </div>
    </footer>
  )
}
