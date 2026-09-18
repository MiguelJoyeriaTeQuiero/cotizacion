import { useState, useEffect, useCallback, useMemo } from 'react'

// Los precios y las leyes llegan ya calculados desde /api/prices, que es la
// fuente de verdad y lo que el panel de administración modifica.
//
// Si esa llamada no está disponible (sin backend, caída de red, `npm run dev`
// a secas), la tabla NO se queda vacía: se calcula en el navegador con los
// valores de respaldo de abajo, exactamente como funcionaba la web antes.

const TICK_MS = 4000
const SPARK_POINTS = 20

// El navegador vuelve a pedir /api/prices al ritmo que marque el panel, pero
// acotado: ni tan seguido que sobre, ni tan espaciado que una pestaña abierta
// se quede con precios de hace horas. Pedirlo no consume cuota de la API de
// mercado: entre consultas responde la caché del servidor.
const POLL_MIN_MS = 30_000
const POLL_MAX_MS = 600_000
const POLL_FALLBACK_MS = 60_000

function pollInterval(refreshSeconds) {
  const ms = Number(refreshSeconds) * 1000
  if (!Number.isFinite(ms) || ms <= 0) return POLL_FALLBACK_MS
  return Math.min(POLL_MAX_MS, Math.max(POLL_MIN_MS, ms))
}

// ─── Respaldo ────────────────────────────────────────────────────────────────
// Copia de los valores publicados. En cuanto /api/prices responde, estos datos
// se descartan y mandan los del servidor.

const FALLBACK_FIXING = { gold: 3082, silver: 29.92 }
const FALLBACK_DIVISOR = 31.1

const FALLBACK_GRADES = {
  gold: [
    { key: 'au24',  label: 'Oro 24k',   fineness: 999.9, f1: 0.993,  f2: 0.99,  f3: 0 },
    { key: 'au22',  label: 'Oro 22k',   fineness: 916.7, f1: 0.9825, f2: 0.99,  f3: 0 },
    { key: 'au216', label: 'Oro 21,6k', fineness: 900,   f1: 0.9875, f2: 0.99,  f3: 0 },
    { key: 'au18',  label: 'Oro 18k',   fineness: 750,   f1: 0.972,  f2: 0.98,  f3: 0 },
    { key: 'au14',  label: 'Oro 14k',   fineness: 585,   f1: 0.97,   f2: 0.972, f3: 0 },
    { key: 'au10',  label: 'Oro 10k',   fineness: 416.7, f1: 0.97,   f2: 0.978, f3: 0 },
    { key: 'au9',   label: 'Oro 9k',    fineness: 375,   f1: 0.97,   f2: 0.972, f3: 0 },
  ],
  silver: [
    { key: 'ag1000', label: 'Plata 1000', fineness: 1000, f1: 0.78, f2: 0.97, f3: 0 },
    { key: 'ag925',  label: 'Plata 925',  fineness: 925,  f1: 0.73, f2: 0.97, f3: 0 },
    { key: 'ag900',  label: 'Plata 900',  fineness: 900,  f1: 0.69, f2: 0.97, f3: 0 },
    { key: 'ag835',  label: 'Plata 835',  fineness: 835,  f1: 0.62, f2: 0.97, f3: 0 },
    { key: 'ag800',  label: 'Plata 800',  fineness: 800,  f1: 0.61, f2: 0.97, f3: 0 },
  ],
}

function buildFallback() {
  const price = (g, fixing) =>
    Math.max(0, (g.fineness / 1000) * fixing * g.f1 * g.f2 / FALLBACK_DIVISOR + (g.f3 || 0))
  const rows = (metal) =>
    FALLBACK_GRADES[metal].map(g => ({
      key: g.key,
      label: g.label,
      fineness: g.fineness,
      pricePerGram: price(g, FALLBACK_FIXING[metal]),
    }))
  return {
    fixing: FALLBACK_FIXING,
    change: { gold: 0, silver: 0 },
    gold: rows('gold'),
    silver: rows('silver'),
    fallback: true,
  }
}

// AbortSignal.timeout no existe en Safari 15 y anteriores; sin esta guarda la
// petición reventaría y la tabla se quedaría vacía en esos navegadores.
function timeoutSignal(ms) {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined
}

export function useMetalPrices() {
  // Se arranca con el respaldo, así la tabla nunca aparece vacía ni parpadea.
  const [data, setData] = useState(buildFallback)
  const [drift, setDrift] = useState({ gold: 1, silver: 1 })
  const [meta, setMeta] = useState({ lastFetch: null, loading: false, error: null })
  const [sparklineGold, setSparklineGold] = useState([])

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/prices', {
        headers: { Accept: 'application/json' },
        signal: timeoutSignal(8000),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const payload = await res.json()
      if (!payload?.fixing || typeof payload.fixing.gold !== 'number') {
        throw new Error('Respuesta inesperada')
      }

      setData(payload)
      setDrift({ gold: 1, silver: 1 }) // el dato real sustituye a la simulación
      setMeta({ lastFetch: new Date(), loading: false, error: null })
    } catch (err) {
      // Se mantiene lo último bueno (o el respaldo inicial): la tabla sigue
      // mostrando precios en lugar de quedarse en blanco.
      console.warn('[useMetalPrices] no se ha podido actualizar →', err.message)
      setMeta(prev => ({ ...prev, lastFetch: prev.lastFetch ?? new Date(), loading: false }))
    }
  }, [])

  // El intervalo se reajusta solo cuando el panel cambia la frecuencia: la
  // primera respuesta ya trae el valor vigente.
  const pollMs = pollInterval(data?.refreshSeconds)

  useEffect(() => { fetchPrices() }, [fetchPrices])

  // El temporizador se rearma solo si cambia la cadencia, para no disparar una
  // petición de más al recibir la primera respuesta.
  useEffect(() => {
    const id = setInterval(fetchPrices, pollMs)
    return () => clearInterval(id)
  }, [fetchPrices, pollMs])

  // Micro-oscilación entre llamadas para que la cotización se vea viva.
  // Solo mueve un multiplicador; el precio base siempre es el del servidor.
  useEffect(() => {
    if (!data) return
    const jitter = () => 1 + (Math.random() - 0.496) * 0.0005
    const id = setInterval(() => {
      setDrift(d => ({
        gold: clampDrift(d.gold * jitter()),
        silver: clampDrift(d.silver * jitter()),
      }))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [data])

  // El sparkline sigue al oro: se siembra con la primera respuesta y a partir
  // de ahí avanza un punto en cada actualización o micro-oscilación.
  useEffect(() => {
    const base = data?.gold?.[0]?.pricePerGram
    if (typeof base !== 'number') return
    setSparklineGold(prev => {
      if (prev.length < SPARK_POINTS) {
        return Array.from({ length: SPARK_POINTS }, (_, i) =>
          base * (1 + (i - SPARK_POINTS + 1) * 0.00015)
        )
      }
      return [...prev.slice(1), base * drift.gold]
    })
  }, [data, drift.gold])

  const value = useMemo(() => {
    const scale = (grades, factor) =>
      (grades || []).map(g => ({ ...g, pricePerGram: g.pricePerGram * factor }))

    return {
      fixing: { gold: data.fixing.gold * drift.gold, silver: data.fixing.silver * drift.silver },
      change: data.change || { gold: 0, silver: 0 },
      gold: scale(data.gold, drift.gold),
      silver: scale(data.silver, drift.silver),
      lastFetch: meta.lastFetch,
      loading: meta.loading,
      sparklineGold,
    }
  }, [data, drift, meta, sparklineGold])

  return value
}

// Impide que la simulación se aleje del precio real más de un 0,5 %.
function clampDrift(value) {
  return Math.min(1.005, Math.max(0.995, value))
}
