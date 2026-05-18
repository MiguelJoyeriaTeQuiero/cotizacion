import { useEffect, useRef, useState } from 'react'
import PriceCard from './PriceCard'

export default function Hero({ metalData }) {
  const contentRef = useRef(null)

  useEffect(() => {
    const els = contentRef.current?.querySelectorAll('.fade-up')
    if (!els) return
    els.forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), 80 + i * 130)
    })
  }, [])

  return (
    <section className="hero" id="inicio">
      <div className="hero-bg-block" />
      <div className="hero-grid" />
      <div className="hero-inner" ref={contentRef}>
        <div>
          <div className="hero-label fade-up hero-eager">
            <span className="hero-label-line" />
            Compra al por mayor · Islas Canarias
          </div>
          <h1 className="hero-h1 fade-up hero-eager">
            Compramos<br />
            tu <em className="gold-text">oro</em><br />
            al mejor precio.
          </h1>
          <p className="hero-body fade-up hero-eager">
            Servicio profesional para joyerías, orfebres y gestores de stock
            de metales preciosos. Cotizaciones en tiempo real y pago inmediato
            por transferencia bancaria.
          </p>
          <div className="hero-ctas fade-up hero-eager">
            <a href="#precios" className="btn-primary">
              Ver cotización actual
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <a href="#contacto" className="btn-secondary">Consultar ahora</a>
          </div>
          <div className="hero-trust fade-up hero-eager">
            <div className="hero-trust-item">
              <span className="trust-icon">✓</span> +30 años de experiencia
            </div>
            <div className="hero-trust-sep" />
            <div className="hero-trust-item">
              <span className="trust-icon">✓</span> Recogida gratuita
            </div>
            <div className="hero-trust-sep" />
            <div className="hero-trust-item">
              <span className="trust-icon">✓</span> Pago por transferencia
            </div>
          </div>
        </div>
        <PriceCard metalData={metalData} />
      </div>
    </section>
  )
}
