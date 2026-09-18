import { EMAIL_HERRAMIENTAS, openContactForm } from '../contactInfo'

const IconGold = () => (
  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)
const IconTool = () => (
  <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
)

const highlights = [
  'Recogida gratuita en tu establecimiento',
  'Cierre de precio por teléfono',
  'Pago por transferencia bancaria',
  'Análisis y pesaje en tu presencia',
  'Documentación y certificados incluidos',
]

const stats = [
  { value: '+30', label: 'años en el sector' },
  { value: '24h', label: 'plazo de pago' },
  { value: '100%', label: 'trazabilidad' },
]

export default function Services() {
  return (
    <section className="services" id="servicios">
      <div className="section-inner">
        <div className="section-header fade-up">
          <div className="section-tag">Servicios</div>
          <h2 className="section-title">
            Todo lo que necesitas<br /><em>en un solo proveedor</em>
          </h2>
          <p className="section-subtitle">
            Desde la compra mayorista de metales preciosos hasta herramientas de joyería.
            Soluciones integrales para profesionales del sector.
          </p>
        </div>

        {/* Featured horizontal card */}
        <div className="svc-featured fade-up">
          <div className="svc-featured-left">
            <div className="svc-featured-icon"><IconGold /></div>
            <div className="svc-badge">Servicio principal</div>
            <h3 className="svc-featured-title">Compra de Oro<br />al Mayor</h3>
            <p className="svc-featured-desc">
              Compramos tu stock de oro de joyería, chatarra y fragmentos.
              El servicio más completo del mercado para profesionales del sector joyero.
            </p>
            <ul className="svc-list">
              {highlights.map(h => (
                <li key={h}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {h}
                </li>
              ))}
            </ul>
            <a href="#contacto" className="svc-cta">
              Consultar condiciones
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          <div className="svc-featured-right">
            <div className="svc-stats-grid">
              {stats.map(s => (
                <div key={s.value} className="svc-stat">
                  <span className="svc-stat-value">{s.value}</span>
                  <span className="svc-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="svc-gold-bar">
              <span className="svc-gold-bar-label">XAU · Oro · Islas Canarias</span>
              <span className="svc-gold-bar-sub">Cotización LBMA en tiempo real</span>
            </div>
          </div>
        </div>

        {/* Two secondary cards */}
        <div className="svc-secondary-grid">
          <div className="svc-card fade-up d1">
            <div className="svc-card-top">
              <div className="svc-card-icon gold"><IconTool /></div>
              <div className="svc-badge dark">Suministros</div>
            </div>
            <h3 className="svc-card-title">Herramientas de Joyería</h3>
            <p className="svc-card-desc">
              Herramientas especializadas, fornituras y máquinas de microfusión
              para talleres profesionales. Catálogo bajo solicitud.
            </p>
            <button
              type="button"
              className="svc-link"
              onClick={() => openContactForm(EMAIL_HERRAMIENTAS)}
            >
              Contactar
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </section>
  )
}
