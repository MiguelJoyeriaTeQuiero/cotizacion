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
import { useMetalPrices } from './hooks/useMetalPrices'

export default function App() {
  const [scrollPct, setScrollPct] = useState(0)
  const [navScrolled, setNavScrolled] = useState(false)
  const metalData = useMetalPrices()

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
    </>
  )
}
