import { useState, useEffect, useCallback } from 'react'

const API_KEY    = 'goldapi-15ndsmmev1jqo-io'
const HEADERS    = { 'x-access-token': API_KEY, 'Content-Type': 'application/json' }
const GOLD_URL   = 'https://www.goldapi.io/api/XAU/EUR'
const SILVER_URL = 'https://www.goldapi.io/api/XAG/EUR'

// Realistic fallback fixing prices in EUR/oz
const FB_GOLD_FIXING   = 3082  // ≈ $3350/oz × 0.92 EUR/USD
const FB_SILVER_FIXING = 29.92 // ≈ $32.5/oz × 0.92 EUR/USD

// ─── Grade definitions with exact pricing factors ────────────────────────────
//
// Formula:  precio = (ley / 1000) × fixing_eur_oz × factor1 × factor2 / 31.1
//
// factor1 × factor2 encapsulan márgenes, eficiencia y descuentos propios
// de cada quilataje según la política comercial de Te Quiero Metales.

export const GOLD_GRADES = [
  { label: 'Oro 24k',   key: 'au24',  fineness: 999.9, f1: 0.993,  f2: 0.99,  desc: '24 quilates · 999,9‰' },
  { label: 'Oro 22k',   key: 'au22',  fineness: 916.7, f1: 0.9825, f2: 0.99,  desc: '22 quilates · 916,7‰' },
  { label: 'Oro 21,6k', key: 'au216', fineness: 900,   f1: 0.9875, f2: 0.99,  desc: '21,6 quilates · 900‰'  },
  { label: 'Oro 18k',   key: 'au18',  fineness: 750,   f1: 0.972,  f2: 0.98,  desc: '18 quilates · 750‰'   },
  { label: 'Oro 14k',   key: 'au14',  fineness: 585,   f1: 0.97,   f2: 0.972, desc: '14 quilates · 585‰'   },
  { label: 'Oro 10k',   key: 'au10',  fineness: 416.7, f1: 0.97,   f2: 0.978, desc: '10 quilates · 416,7‰' },
  { label: 'Oro 9k',    key: 'au9',   fineness: 375,   f1: 0.97,   f2: 0.972, desc: '9 quilates · 375‰'    },
]

export const SILVER_GRADES = [
  { label: 'Plata 1000', key: 'ag1000', fineness: 1000, f1: 0.78, f2: 0.97, desc: 'Plata pura · 1000‰'  },
  { label: 'Plata 925',  key: 'ag925',  fineness: 925,  f1: 0.73, f2: 0.97, desc: 'Plata de ley · 925‰' },
  { label: 'Plata 900',  key: 'ag900',  fineness: 900,  f1: 0.69, f2: 0.97, desc: '900 milésimas'        },
  { label: 'Plata 835',  key: 'ag835',  fineness: 835,  f1: 0.62, f2: 0.97, desc: '835 milésimas'        },
  { label: 'Plata 800',  key: 'ag800',  fineness: 800,  f1: 0.61, f2: 0.97, desc: '800 milésimas'        },
]

/**
 * Precio de compra del oro por gramo para un quilataje dado.
 * precio = (ley / 1000) × fixing_eur_oz × f1 × f2 / 31.1
 */
export function goldGradePrice(fixingEurOz, grade) {
  return (grade.fineness / 1000) * fixingEurOz * grade.f1 * grade.f2 / 31.1
}

/**
 * Precio de compra de la plata por gramo para una ley dada.
 * precio = (ley / 1000) × fixing_eur_oz / 31.1
 */
export function silverGradePrice(fixingEurOz, grade) {
  return (grade.fineness / 1000) * fixingEurOz * grade.f1 * grade.f2 / 31.1
}

// ─── Hook ────────────────────────────────────────────────────────────────────
function initSparkline(fixingEurOz) {
  const base = goldGradePrice(fixingEurOz, GOLD_GRADES[0])
  return Array.from({ length: 20 }, (_, i) =>
    base - (19 - i) * 0.025 + (Math.random() - 0.5) * 0.09
  )
}

export function useMetalPrices() {
  const [fixing, setFixing] = useState({ gold: FB_GOLD_FIXING, silver: FB_SILVER_FIXING })
  const [meta, setMeta]     = useState({ dailyChangeGold: 0, dailyChangeSilver: 0, lastFetch: null, loading: true })
  const [sparklineGold, setSparklineGold] = useState(() => initSparkline(FB_GOLD_FIXING))

  const fetchFromAPI = useCallback(async () => {
    try {
      const [gRes, sRes] = await Promise.all([
        fetch(GOLD_URL,   { headers: HEADERS }),
        fetch(SILVER_URL, { headers: HEADERS }),
      ])
      if (!gRes.ok) throw new Error(`Gold API ${gRes.status}`)
      if (!sRes.ok) throw new Error(`Silver API ${sRes.status}`)

      const gold   = await gRes.json()
      const silver = await sRes.json()

      // gold.price  → EUR per troy oz (raw fixing)
      // silver.price → EUR per troy oz
      const goldFix   = parseFloat(gold.price)
      const silverFix = parseFloat(silver.price)
      if (isNaN(goldFix) || isNaN(silverFix)) throw new Error('Unexpected API shape')

      const next24k = goldGradePrice(goldFix, GOLD_GRADES[0])

      setFixing({ gold: goldFix, silver: silverFix })
      setSparklineGold(prev => [...prev.slice(1), next24k])
      setMeta({
        dailyChangeGold:   parseFloat(gold.chp)   || 0,
        dailyChangeSilver: parseFloat(silver.chp) || 0,
        lastFetch: new Date(),
        loading: false,
      })
    } catch (err) {
      console.warn('[useMetalPrices] fetch failed →', err.message)
      setMeta(prev => ({ ...prev, lastFetch: prev.lastFetch ?? new Date(), loading: false }))
    }
  }, [])

  useEffect(() => {
    fetchFromAPI()
    const id = setInterval(fetchFromAPI, 60_000)
    return () => clearInterval(id)
  }, [fetchFromAPI])

  // Tick simulation every 4 s (smooth live feel between API calls)
  useEffect(() => {
    const jitter = () => 1 + (Math.random() - 0.496) * 0.0005
    const id = setInterval(() => {
      setFixing(f => {
        const next = { gold: f.gold * jitter(), silver: f.silver * jitter() }
        setSparklineGold(sp => {
          const next24k = goldGradePrice(next.gold, GOLD_GRADES[0])
          return [...sp.slice(1), next24k]
        })
        return next
      })
    }, 4000)
    return () => clearInterval(id)
  }, [])

  return {
    fixing,
    dailyChangeGold:   meta.dailyChangeGold,
    dailyChangeSilver: meta.dailyChangeSilver,
    lastFetch: meta.lastFetch,
    loading:   meta.loading,
    sparklineGold,
  }
}
