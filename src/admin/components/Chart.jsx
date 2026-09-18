import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fmtDec } from '../lib/formulas'

// Gráficas en SVG a mano. Sin librerías: el panel se sirve con una CSP estricta
// y no merece la pena arrastrar 80 KB de dependencia para dos líneas.

const PAD = { left: 62, right: 62, top: 16, bottom: 28 }
const HEIGHT = 280

function extent(values) {
  const clean = values.filter(v => Number.isFinite(v))
  if (!clean.length) return null
  let min = Math.min(...clean)
  let max = Math.max(...clean)
  if (min === max) { min -= min * 0.01 || 1; max += max * 0.01 || 1 }
  // Un poco de aire arriba y abajo para que la línea no roce el marco.
  const margin = (max - min) * 0.12
  return [min - margin, max + margin]
}

function useWidth(ref, fallback = 760) {
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth || fallback)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, fallback])
  return width
}

const fmtDay = (t) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
const fmtStamp = (t) => new Date(t).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

export function Chart({ points, series }) {
  const box = useRef(null)
  const width = useWidth(box)
  const [hover, setHover] = useState(null)

  useEffect(() => { setHover(null) }, [points])

  if (!points || points.length < 2) return null

  const [primary, secondary] = series
  const innerW = Math.max(120, width - PAD.left - PAD.right)
  const innerH = HEIGHT - PAD.top - PAD.bottom

  const times = points.map(p => p.t)
  const t0 = times[0]
  const t1 = times[times.length - 1]
  const spanT = t1 - t0 || 1

  const scaleX = (t) => PAD.left + ((t - t0) / spanT) * innerW
  const makeY = (values) => {
    const range = extent(values)
    if (!range) return null
    const [min, max] = range
    return {
      min,
      max,
      to: (v) => PAD.top + innerH - ((v - min) / (max - min)) * innerH,
    }
  }

  const yA = makeY(points.map(p => p[primary.key]))
  const yB = secondary ? makeY(points.map(p => p[secondary.key])) : null
  if (!yA) return null

  const path = (key, y) => {
    let d = ''
    let open = false
    points.forEach((p) => {
      const v = p[key]
      if (!Number.isFinite(v)) { open = false; return }
      d += `${open ? 'L' : 'M'}${scaleX(p.t).toFixed(1)},${y.to(v).toFixed(1)} `
      open = true
    })
    return d.trim()
  }

  const areaPath = (() => {
    const line = path(primary.key, yA)
    if (!line) return ''
    const first = scaleX(points[0].t).toFixed(1)
    const last = scaleX(points[points.length - 1].t).toFixed(1)
    const base = (PAD.top + innerH).toFixed(1)
    return `${line} L${last},${base} L${first},${base} Z`
  })()

  const ticks = 4
  const gridY = Array.from({ length: ticks + 1 }, (_, i) => PAD.top + (innerH / ticks) * i)
  const valueAt = (y, scale) => scale.max - ((y - PAD.top) / innerH) * (scale.max - scale.min)

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.min(1, Math.max(0, (x - PAD.left) / innerW))
    const target = t0 + ratio * spanT
    let best = 0
    for (let i = 1; i < points.length; i += 1) {
      if (Math.abs(points[i].t - target) < Math.abs(points[best].t - target)) best = i
    }
    setHover(best)
  }

  const point = hover != null ? points[hover] : null
  const hoverX = point ? scaleX(point.t) : 0

  return (
    <div className="chart" ref={box}>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Evolución de ${primary.label}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {gridY.map((y, i) => (
          <g key={i}>
            <line className="chart__grid" x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} />
            <text className="chart__tick" x={PAD.left - 8} y={y + 4} textAnchor="end">
              {fmtDec(valueAt(y, yA), primary.decimals)}
            </text>
            {yB && (
              <text className="chart__tick alt" x={PAD.left + innerW + 8} y={y + 4}>
                {fmtDec(valueAt(y, yB), secondary.decimals)}
              </text>
            )}
          </g>
        ))}

        {[0, 0.5, 1].map((r) => (
          <text
            key={r}
            className="chart__tick"
            x={PAD.left + innerW * r}
            y={HEIGHT - 8}
            textAnchor={r === 0 ? 'start' : r === 1 ? 'end' : 'middle'}
          >
            {fmtDay(t0 + spanT * r)}
          </text>
        ))}

        <path className="chart__area" d={areaPath} />
        <path className="chart__line" d={path(primary.key, yA)} />
        {/* Encima y punteada: cuando las dos series dibujan la misma forma —que
            es lo normal mientras no se toquen las fórmulas— si fuera al revés
            desaparecería debajo. */}
        {yB && <path className="chart__line alt" d={path(secondary.key, yB)} />}

        {point && (
          <g>
            <line className="chart__cursor" x1={hoverX} x2={hoverX} y1={PAD.top} y2={PAD.top + innerH} />
            {Number.isFinite(point[primary.key]) && (
              <circle className="chart__dot" cx={hoverX} cy={yA.to(point[primary.key])} r="4" />
            )}
            {yB && Number.isFinite(point[secondary.key]) && (
              <circle className="chart__dot alt" cx={hoverX} cy={yB.to(point[secondary.key])} r="3.5" />
            )}
          </g>
        )}
      </svg>

      {point && (
        <div
          className="chart__tip"
          style={{
            left: `${Math.min(Math.max(hoverX, 90), width - 90)}px`,
          }}
        >
          <span className="chart__tip-when">{fmtStamp(point.t)}</span>
          <span>
            <i className="swatch" /> {primary.label}:{' '}
            <b>{fmtDec(point[primary.key], primary.decimals)} {primary.unit}</b>
          </span>
          {secondary && (
            <span>
              <i className="swatch alt" /> {secondary.label}:{' '}
              <b>{fmtDec(point[secondary.key], secondary.decimals)} {secondary.unit}</b>
            </span>
          )}
        </div>
      )}

      <div className="chart__legend">
        <span><i className="swatch" /> {primary.label}</span>
        {secondary && <span><i className="swatch alt" /> {secondary.label}</span>}
      </div>
    </div>
  )
}

/** Línea diminuta sin ejes, para meter una tendencia dentro de una frase. */
export function Sparkline({ values, width = 132, height = 34 }) {
  const clean = (values || []).filter(v => Number.isFinite(v))
  if (clean.length < 2) return null

  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const span = max - min || 1
  const step = width / (clean.length - 1)
  const d = clean
    .map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)}`)
    .join(' ')
  const rising = clean[clean.length - 1] >= clean[0]

  return (
    <svg className={`sparkline${rising ? ' up' : ' down'}`} width={width} height={height} aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
