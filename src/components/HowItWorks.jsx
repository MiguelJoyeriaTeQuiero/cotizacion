const IconPhone = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" />
  </svg>
)
const IconTruck = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
)
const IconScale = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
)
const IconBank = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M7 8h12M7 8l3-3M7 8l3 3" />
    <path d="M17 16H5M17 16l-3-3M17 16l-3 3" />
  </svg>
)

const steps = [
  { n: 1, Icon: IconPhone,  title: 'Nos contactas',      desc: 'Llámanos o escríbenos. Acordamos la operación y cerramos el precio del día por teléfono.' },
  { n: 2, Icon: IconTruck,  title: 'Recogida gratuita',  desc: 'Nos desplazamos a tu establecimiento sin coste. Tú no necesitas moverte en ningún momento.' },
  { n: 3, Icon: IconScale,  title: 'Análisis y valoración', desc: 'Pesaje y análisis de quilates en tu presencia. Transparencia total en cada operación.' },
  { n: 4, Icon: IconBank,   title: 'Pago inmediato',     desc: 'Transferencia bancaria el mismo día o al siguiente. Seguro, rápido y documentado.' },
]

export default function HowItWorks() {
  return (
    <section className="how" id="como-funciona">
      <div className="section-inner">
        <div className="section-header fade-up" style={{ textAlign: 'center' }}>
          <div className="section-tag" style={{ justifyContent: 'center' }}>Proceso</div>
          <h2 className="section-title">Así de <em>sencillo</em></h2>
          <p className="section-subtitle" style={{ margin: '14px auto 0' }}>
            Cuatro pasos para convertir tu metal en liquidez. Sin complicaciones, sin esperas.
          </p>
        </div>
        <div className="steps">
          {steps.map((s, i) => (
            <div key={s.n} className={`step fade-up${i > 0 ? ` d${i}` : ''}`}>
              <div className="step-circle">
                <span className="step-n">{s.n}</span>
                <div className="step-icon-box">
                  <s.Icon />
                </div>
              </div>
              <div className="step-title">{s.title}</div>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
