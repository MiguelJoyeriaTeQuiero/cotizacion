import { useEffect, useRef } from 'react'

const items = [
  { value: '+30', label: 'Años de experiencia', sub: 'Grupo Te Quiero desde los 90' },
  { value: 'Gratuita', label: 'Recogida en tu establecimiento', sub: 'Sin coste adicional', small: true },
  { value: '24h', label: 'Plazo de pago', sub: 'Transferencia bancaria' },
  { value: 'Al min.', label: 'Actualización de precios', sub: 'Cotización en tiempo real' },
]

export default function Stats() {
  return (
    <section className="stats" id="quienes-somos">
      <div className="stats-inner">
        {items.map((item, i) => (
          <div key={i} className={`stat-item fade-up${i > 0 ? ` d${i}` : ''}`}>
            <div
              className="stat-number"
              style={item.small ? { fontSize: 'clamp(22px, 3vw, 34px)', paddingTop: 10, lineHeight: 1.3 } : undefined}
            >
              {item.value}
            </div>
            <div className="stat-label">{item.label}</div>
            <div className="stat-sub">{item.sub}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
