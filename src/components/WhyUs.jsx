const IconShield = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)
const IconChart = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M18 20V10M12 20V4M6 20v-6" />
  </svg>
)
const IconHandshake = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
)
const IconZap = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
)

const features = [
  { Icon: IconShield,    color: 'teal', title: 'Seguridad y legalidad total',       desc: 'Toda operación está documentada y cumple con la normativa vigente. Recibos y certificados en cada transacción.' },
  { Icon: IconChart,     color: 'gold', title: 'Precios de mercado transparentes',  desc: 'Cotizamos sobre el precio internacional del oro (LBMA). Sin comisiones ocultas ni sorpresas.' },
  { Icon: IconHandshake, color: 'teal', title: 'Trato cercano y personalizado',     desc: 'Un equipo de expertos te acompaña en cada operación. Asesoramiento profesional sin compromiso.' },
  { Icon: IconZap,       color: 'gold', title: 'Rapidez y flexibilidad',            desc: 'Cierres telefónicos y pago en 24 horas. Adaptados a tu ritmo de negocio.' },
]

export default function WhyUs() {
  return (
    <section className="why">
      <div className="why-inner">
        <div className="fade-up">
          <div className="section-tag">Por qué elegirnos</div>
          <h2 className="why-quote">
            La confianza que necesitas para{' '}
            <em>operar a gran escala</em>
          </h2>
          <p className="why-body">
            Formamos parte del Grupo Te Quiero, con más de 30 años en el sector de los
            metales preciosos en las Islas Canarias. Te Quiero Metales S.L. nació en 2014
            para ofrecer un servicio especializado, ágil y transparente a joyerías y
            profesionales del sector.
          </p>
          <div className="why-founding">
            <div className="why-year">2014</div>
            <div className="why-founding-text">
              <strong>Fundación de Te Quiero Metales S.L.</strong>
              Más de una década especializada en compraventa mayorista de metales preciosos
              en Canarias.
            </div>
          </div>
        </div>

        <div className="why-features">
          {features.map((f, i) => (
            <div key={i} className={`why-feature fade-up${i > 0 ? ` d${i}` : ''}`}>
              <div className={`why-feature-icon-box ${f.color}`}>
                <f.Icon />
              </div>
              <div>
                <div className="why-feature-title">{f.title}</div>
                <div className="why-feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
