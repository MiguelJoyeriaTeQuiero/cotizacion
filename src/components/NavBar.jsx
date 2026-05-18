import { useState } from 'react'

const links = [
  { href: '#servicios', label: 'Servicios' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#precios', label: 'Precio del oro' },
  { href: '#quienes-somos', label: 'Quiénes somos' },
  { href: '#contacto', label: 'Contacto' },
]

export default function NavBar({ scrolled }) {
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  return (
    <>
      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-inner">
          <a href="#inicio" className="nav-logo" onClick={close}>
            <img src="/logo.png" alt="Metales · Te Quiero Group" className="nav-logo-img" />
          </a>

          {/* Desktop links */}
          <div className="nav-links">
            {links.map(l => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
            <a href="#contacto" className="nav-cta">Consultar</a>
          </div>

          {/* Hamburger */}
          <button
            className={`nav-hamburger${open ? ' open' : ''}`}
            onClick={() => setOpen(o => !o)}
            aria-label="Abrir menú"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div className={`nav-mobile${open ? ' open' : ''}`}>
        {links.map(l => (
          <a key={l.href} href={l.href} onClick={close}>{l.label}</a>
        ))}
        <a href="#contacto" className="mobile-cta" onClick={close}>Consultar ahora</a>
      </div>
    </>
  )
}
