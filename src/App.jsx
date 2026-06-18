import { useState, useEffect } from 'react'
import TopBar from './components/TopBar'
import NavBar from './components/NavBar'
import Hero from './components/Hero'
import Stats from './components/Stats'
import Services from './components/Services'
import HowItWorks from './components/HowItWorks'
import WhyUs from './components/WhyUs'
import PriceTable from './components/PriceTable'
import Contact from './components/Contact'
import Footer from './components/Footer'
import LegalPage from './components/LegalPage'
import CookieBanner from './components/CookieBanner'
import { useMetalPrices } from './hooks/useMetalPrices'

const LEGAL_SLUGS = [
  'aviso-legal',
  'politica-de-privacidad',
  'politica-de-cookies',
  'condiciones-de-venta',
]

function getLegalSlug() {
  const h = window.location.hash.replace(/^#\/?/, '')
  return LEGAL_SLUGS.includes(h) ? h : null
}

const HOME_META = {
  title: 'Compra de Oro y Plata al Mayor en Tenerife | Te Quiero Metales',
  description:
    'Compraventa de oro y plata al por mayor para joyerías y profesionales en las Islas Canarias. Cotizaciones en tiempo real, pago inmediato y recogida gratuita. Santa Cruz de Tenerife.',
}

const PAGE_META = {
  'aviso-legal': {
    title: 'Aviso Legal | Te Quiero Metales',
    description: 'Aviso legal y condiciones de uso de la web de Te Quiero Metales S.L.',
  },
  'politica-de-privacidad': {
    title: 'Política de Privacidad | Te Quiero Metales',
    description: 'Política de privacidad y tratamiento de datos personales de Te Quiero Metales S.L. conforme al RGPD.',
  },
  'politica-de-cookies': {
    title: 'Política de Cookies | Te Quiero Metales',
    description: 'Información sobre el uso de cookies en la web de Te Quiero Metales S.L. y cómo configurarlas.',
  },
  'condiciones-de-venta': {
    title: 'Condiciones de Venta | Te Quiero Metales',
    description: 'Condiciones de venta, precios, envíos, recogida y devoluciones de Te Quiero Metales S.L.',
  },
}

function applyMeta(slug) {
  const meta = slug ? PAGE_META[slug] : HOME_META
  if (!meta) return
  document.title = meta.title
  let desc = document.querySelector('meta[name="description"]')
  if (!desc) {
    desc = document.createElement('meta')
    desc.setAttribute('name', 'description')
    document.head.appendChild(desc)
  }
  desc.setAttribute('content', meta.description)
}

export default function App() {
  const [scrollPct, setScrollPct] = useState(0)
  const [navScrolled, setNavScrolled] = useState(false)
  const [legalSlug, setLegalSlug] = useState(getLegalSlug)
  const metalData = useMetalPrices()

  // Hash-based routing for legal pages
  useEffect(() => {
    const onHashChange = () => {
      const slug = getLegalSlug()
      setLegalSlug(slug)
      applyMeta(slug)
      if (slug) {
        window.scrollTo(0, 0)
      } else {
        // Returning to the home page — scroll to the targeted section (if any)
        const id = window.location.hash.replace(/^#/, '')
        requestAnimationFrame(() => {
          const el = id && id !== 'inicio' ? document.getElementById(id) : null
          if (el) el.scrollIntoView()
          else window.scrollTo(0, 0)
        })
      }
    }
    applyMeta(getLegalSlug()) // set correct metadata on initial load
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight
      setScrollPct(total > 0 ? (window.scrollY / total) * 100 : 0)
      setNavScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Global IntersectionObserver for .fade-up elements
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) }
      }),
      { threshold: 0.1 }
    )
    // Small delay so all components have mounted
    const t = setTimeout(() => {
      document.querySelectorAll('.fade-up:not(.hero-eager)').forEach(el => obs.observe(el))
    }, 150)
    return () => { clearTimeout(t); obs.disconnect() }
  }, [])

  if (legalSlug) {
    return (
      <>
        <div className="scroll-progress" style={{ width: `${scrollPct}%` }} />
        <TopBar />
        <NavBar scrolled />
        <LegalPage slug={legalSlug} />
        <Footer />
        <CookieBanner />
      </>
    )
  }

  return (
    <>
      <div className="scroll-progress" style={{ width: `${scrollPct}%` }} />
      <TopBar />
      <NavBar scrolled={navScrolled} />
      <Hero metalData={metalData} />
      <PriceTable metalData={metalData} />
      <Stats />
      <Services />
      <HowItWorks />
      <WhyUs />
      <Contact />
      <Footer />
      <CookieBanner />
    </>
  )
}
