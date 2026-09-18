import { useEffect, useRef, useState } from 'react'
import {
  ADDRESS,
  EMAILS,
  EMAIL_GENERAL,
  OPEN_CONTACT_FORM_EVENT,
  PHONES,
} from '../contactInfo'

const IconPin = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
)
const IconPhone = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" />
  </svg>
)
const IconMail = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <path d="M22 6l-10 7L2 6" />
  </svg>
)
const IconClock = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
)

export default function Contact() {
  const [sent, setSent] = useState(false)
  const [destino, setDestino] = useState(EMAIL_GENERAL)
  const primerCampo = useRef(null)

  // Otra sección puede abrir el formulario apuntando a un correo concreto
  // (por ejemplo, la tarjeta de herramientas).
  useEffect(() => {
    const handler = e => {
      setDestino(e.detail?.destino || EMAIL_GENERAL)
      setSent(false)
      // En el fotograma siguiente, cuando el formulario ya está pintado.
      requestAnimationFrame(() => primerCampo.current?.focus({ preventScroll: true }))
    }
    window.addEventListener(OPEN_CONTACT_FORM_EVENT, handler)
    return () => window.removeEventListener(OPEN_CONTACT_FORM_EVENT, handler)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    setSent(true)
  }

  return (
    <section className="contact" id="contacto">
      <div className="contact-inner">
        {/* Info */}
        <div>
          <div className="section-tag fade-up">Contacto</div>
          <h2 className="section-title fade-up" style={{ marginBottom: 36 }}>
            Hablemos de<br /><em>tu operación</em>
          </h2>

          <div className="contact-info-item fade-up">
            <div className="contact-icon"><IconPin /></div>
            <div>
              <div className="contact-info-label">Dirección</div>
              <div className="contact-info-value">
                {ADDRESS.street}<br />
                {ADDRESS.city}
              </div>
            </div>
          </div>

          <div className="contact-info-item fade-up d1">
            <div className="contact-icon"><IconPhone /></div>
            <div>
              <div className="contact-info-label">Teléfono</div>
              <div className="contact-info-value">
                {PHONES.map((p, i) => (
                  <span key={p.tel}>
                    {i > 0 && <br />}
                    <a href={`tel:${p.tel}`}>{p.label}</a>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="contact-info-item fade-up d2">
            <div className="contact-icon"><IconMail /></div>
            <div>
              <div className="contact-info-label">Email</div>
              <div className="contact-info-value">
                {EMAILS.map((email, i) => (
                  <span key={email}>
                    {i > 0 && <br />}
                    <a href={`mailto:${email}`}>{email}</a>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="contact-info-item fade-up d3">
            <div className="contact-icon"><IconClock /></div>
            <div>
              <div className="contact-info-label">Horario de atención</div>
              <div>
                <div className="hours-row"><span>Lunes – Jueves</span><strong>08:00 – 15:00</strong></div>
                <div className="hours-row"><span>Viernes</span><strong>08:00 – 14:00</strong></div>
                <div className="hours-row" style={{ color: '#DC2626', fontSize: 13 }}>
                  <span>Sábado – Domingo</span><span>Cerrado</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="fade-up d1">
          <h3 className="form-title">Envíanos un mensaje</h3>
          <p className="form-sub">
            Tu mensaje va dirigido a <a href={`mailto:${destino}`}>{destino}</a>.
          </p>

          {sent ? (
            <div style={{
              padding: 32, background: '#F0FDF4', borderRadius: 10,
              border: '1px solid #BBF7D0', textAlign: 'center'
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#15803D', marginBottom: 6 }}>
                Mensaje enviado correctamente
              </div>
              <div style={{ fontSize: 14, color: '#166534' }}>
                Nos pondremos en contacto contigo lo antes posible.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input type="hidden" name="destino" value={destino} />
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nombre *</label>
                  <input ref={primerCampo} type="text" className="form-input" placeholder="Tu nombre" required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Empresa</label>
                  <input type="text" className="form-input" placeholder="Nombre del negocio" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Teléfono *</label>
                  <input type="tel" className="form-input" placeholder="Ej. 922 000 000" required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-input" placeholder="tu@empresa.com" required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mensaje</label>
                <textarea
                  className="form-textarea"
                  placeholder="Describe brevemente el material, cantidad aproximada y cualquier detalle relevante..."
                />
              </div>
              <button type="submit" className="form-submit">
                Enviar mensaje
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
              <p className="form-privacy">
                Al enviar aceptas nuestra <a href="#/politica-de-privacidad">política de privacidad</a>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
