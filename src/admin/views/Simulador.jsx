import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { METALS, fmtDec, fmtSigned, parseNum, priceOf, metalValue, marginPct, breakEvenFixing } from '../lib/formulas'
import { leerCifra } from '../../shared/cifras'

// «¿Y si el oro se mueve un 5 %?», hoy o cualquier día pasado.
//
// Con las fórmulas actuales el precio sigue al mercado en proporción, así que
// lo interesante no es el precio simulado en sí, sino el margen: es lo único
// que se mueve de verdad, y solo se mueve donde hay factor 3.
//
// Con un día pasado, la base deja de ser la cotización en directo y pasa a ser
// la media de lo que se publicó ese día de 7:00 a 17:00 (hora de Canarias), el
// horario de los cierres. El porcentaje se aplica sobre esa media.
//
// En vez del porcentaje se puede escribir un fixing (€/oz): «¿y si el oro
// estuviera a 3.950?». Manda sobre el porcentaje hasta que se toca el
// deslizador o se quita; cada metal guarda el suyo.

const QUICK = [-10, -5, -2, 0, 2, 5, 10]
const ZONA = 'Atlantic/Canary'
// El mismo tope que una línea de cierre.
const MAX_GRAMOS = 100000
// Un fixing por encima de esto es un error al teclear, no una cotización.
const MAX_FIXING = 100000

/** Hoy en Canarias como 'AAAA-MM-DD' (en-CA escribe las fechas así). */
function hoyEnCanarias() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function fechaComo(fecha, opciones) {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', ...opciones }).format(new Date(Date.UTC(y, m - 1, d)))
}
const fechaLarga = (fecha) => fechaComo(fecha, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fechaCorta = (fecha) => fechaComo(fecha, { day: 'numeric', month: 'short' }).replace('.', '')

const redondear = (n, d) => Math.round(n * 10 ** d) / 10 ** d

/** Como en un cierre: el €/g a los decimales de la tarifa y luego por los gramos, a céntimos. */
function importe(gramos, precio, decimales) {
  if (gramos == null || precio == null) return null
  return redondear(gramos * redondear(precio, decimales), 2)
}

/** Margen de un precio ya publicado sobre el valor del metal, en porcentaje. */
function margenDe(precio, valor) {
  if (precio == null || valor == null || valor <= 0) return null
  return (1 - precio / valor) * 100
}

/** Una cifra en euros, o una raya sola si no la hay: «— €» parece un precio. */
const euros = (value, decimals) => (value == null || !Number.isFinite(value) ? '—' : `${fmtDec(value, decimals)} €`)

function Delta({ value, decimals }) {
  if (value == null) return <span className="muted">—</span>
  if (Math.abs(value) <= 10 ** -(decimals + 1)) return <span className="muted">igual</span>
  return (
    <span className={`price__delta ${value > 0 ? 'up' : 'down'}`}>
      {value > 0 ? '▲' : '▼'} {fmtSigned(value, decimals)}
    </span>
  )
}

export function Simulador({ p }) {
  const { draft, market, handleError } = p
  const [metal, setMetal] = useState('gold')
  const [pct, setPct] = useState(5)
  const [gramosTxt, setGramosTxt] = useState('')
  const [fixingTxt, setFixingTxt] = useState({ gold: '', silver: '' })
  const hoy = hoyEnCanarias()
  const [fecha, setFecha] = useState(hoy)
  const [dia, setDia] = useState({ fecha: null, datos: null, error: null })

  // Un campo vacío o una fecha futura se leen como hoy.
  const fechaEf = fecha && fecha <= hoy ? fecha : hoy
  const esHoy = fechaEf === hoy

  useEffect(() => {
    let vigente = true
    api.mediaDia(fechaEf)
      .then(datos => { if (vigente) setDia({ fecha: fechaEf, datos, error: null }) })
      .catch(err => {
        if (!vigente || handleError(err)) return
        setDia({ fecha: fechaEf, datos: null, error: err.message })
      })
    return () => { vigente = false }
  }, [fechaEf, handleError])

  const cargando = dia.fecha !== fechaEf
  const datosDia = cargando ? null : dia.datos
  const media = datosDia?.media ?? null

  const cfg = METALS[metal]
  const gramos = parseNum(gramosTxt)
  const gramosOk = gramos != null && gramos > 0 && gramos <= MAX_GRAMOS
  const gramosMal = gramosTxt.trim() !== '' && !gramosOk

  const fixingTexto = fixingTxt[metal]
  const fixingManual = leerCifra(fixingTexto)
  const fixingOk = fixingManual != null && fixingManual > 0 && fixingManual <= MAX_FIXING
  const fixingMal = fixingTexto.trim() !== '' && !fixingOk
  const ponerFixing = (texto) => setFixingTxt(f => ({ ...f, [metal]: texto }))

  const base = esHoy
    ? (market?.fixing?.[metal] ?? null)
    : (media?.fixing?.[metal]?.media ?? null)
  const simulated = fixingOk ? fixingManual : base != null ? base * (1 + pct / 100) : null
  // Con un fixing escrito, la variación que supone sobre la base, para verla igual.
  const pctVista = fixingOk ? (base ? (fixingManual / base - 1) * 100 : null) : pct
  const tono = pctVista > 0 ? ' up' : pctVista < 0 ? ' down' : ''
  // Tocar el porcentaje es volver a él: se quita el fixing de este metal.
  const cambiarPct = (valor) => { setPct(valor); ponerFixing('') }

  const rows = useMemo(() => draft[metal].map(row => {
    let now, then, marginNow, marginThen
    let rango = null
    if (esHoy) {
      now = priceOf(row, draft.divisor, base)
      then = priceOf(row, draft.divisor, simulated)
      marginNow = marginPct(row, draft.divisor, base)
      marginThen = marginPct(row, draft.divisor, simulated)
    } else {
      // Lo publicado de verdad ese día, y encima lo que movería la variación
      // con las fórmulas del borrador: con «Sin cambio» sale el precio del día.
      const real = media?.[metal]?.[row.key] ?? null
      const antes = priceOf(row, draft.divisor, base)
      const despues = priceOf(row, draft.divisor, simulated)
      now = real?.media ?? null
      then = now != null && antes != null && despues != null ? Math.max(0, now + despues - antes) : null
      marginNow = margenDe(now, metalValue(row, draft.divisor, base))
      marginThen = margenDe(then, metalValue(row, draft.divisor, simulated))
      if (real && real.max - real.min > 10 ** -(cfg.decimals + 1)) rango = { min: real.min, max: real.max }
    }
    const totalNow = gramosOk ? importe(gramos, now, cfg.decimals) : null
    const totalThen = gramosOk ? importe(gramos, then, cfg.decimals) : null
    return {
      key: row.key,
      label: row.label || row.key,
      now,
      then,
      delta: now != null && then != null ? then - now : null,
      rango,
      totalNow,
      totalThen,
      totalDelta: totalNow != null && totalThen != null ? totalThen - totalNow : null,
      marginNow,
      marginThen,
      breakEven: breakEvenFixing(row, draft.divisor),
    }
  }), [draft, metal, base, simulated, esHoy, media, gramos, gramosOk, cfg.decimals])

  const marginMoves = rows.some(r =>
    r.marginNow != null && r.marginThen != null && Math.abs(r.marginThen - r.marginNow) > 0.05)

  const fixingDia = media?.fixing?.[metal] ?? null
  // «12,5 g», no «12,500 g»; los enteros, sin decimales.
  const gramosTexto = !gramosOk ? ''
    : Number.isInteger(gramos) ? fmtDec(gramos, 0)
    : fmtDec(gramos, 3).replace(/0+$/, '').replace(/,$/, '')
  const sinDia = !esHoy && !cargando && !dia.error && !media
  const aviso = !esHoy && datosDia && !datosDia.laborable
    ? (datosDia.festivo ? `Ese día era festivo (${datosDia.festivo}): no había cierres.` : 'Ese día era fin de semana: no había cierres.')
    : null

  return (
    <div className="view">
      <section className="panel">
        <div className="sim__head">
          <div className="segmented" role="tablist" aria-label="Metal">
            {Object.entries(METALS).map(([key, m]) => (
              <button
                key={key}
                role="tab"
                aria-selected={metal === key}
                onClick={() => setMetal(key)}
              >
                <span className={`bead${key === 'silver' ? ' silver' : ''}`} aria-hidden="true" />
                {m.label}
              </button>
            ))}
          </div>

          <div className="sim__reading">
            {base != null ? (
              <>
                <span className="sim__from">{fmtDec(base, 2)} €/oz</span>
                <span className="sim__arrow" aria-hidden="true">→</span>
                <b className={`sim__to${tono}`}>
                  {fmtDec(simulated, 2)} €/oz
                </b>
              </>
            ) : fixingOk ? (
              <b className="sim__to">{fmtDec(simulated, 2)} €/oz</b>
            ) : (
              <span className="sim__from">{cargando ? 'Cargando…' : 'Sin cotización'}</span>
            )}
          </div>
        </div>

        <div className="sim__inputs">
          <label className="field-inline">
            <span>Día</span>
            <input
              className="input sim__fecha"
              type="date"
              min="2020-01-01"
              max={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          {!esHoy && (
            <button className="btn small ghost" onClick={() => setFecha(hoy)}>Volver a hoy</button>
          )}
          <label className="field-inline">
            <span>Gramos</span>
            <input
              className="input num sim__gramos"
              inputMode="decimal"
              placeholder="Opcional"
              value={gramosTxt}
              aria-invalid={gramosMal || undefined}
              onChange={(e) => setGramosTxt(e.target.value)}
            />
          </label>
          <label className="field-inline">
            <span>Fixing</span>
            <input
              className="input num sim__fixing"
              inputMode="decimal"
              placeholder="€/oz · opcional"
              value={fixingTexto}
              aria-invalid={fixingMal || undefined}
              aria-label={`Fixing del ${cfg.label.toLowerCase()} en euros por onza`}
              onChange={(e) => ponerFixing(e.target.value)}
            />
          </label>
          {fixingTexto && (
            <button className="btn small ghost" onClick={() => ponerFixing('')}>Quitar fixing</button>
          )}
        </div>

        <p className="sim__context">
          {esHoy ? (
            <>
              Hoy, sobre la cotización en directo.
              {media && fixingDia
                ? <> La media de hoy de {datosDia.apertura} a {datosDia.cierre} va por <b className="num">{fmtDec(fixingDia.media, 2)} €/oz</b> ({media.n} {media.n === 1 ? 'registro' : 'registros'}).</>
                : !cargando && !dia.error && <> Todavía no hay registros de hoy entre las 7:00 y las 17:00.</>}
            </>
          ) : cargando ? (
            <>Buscando la media del {fechaLarga(fechaEf)}…</>
          ) : media && fixingDia ? (
            <>
              Media de lo publicado el <b>{fechaLarga(fechaEf)}</b> de {datosDia.apertura} a {datosDia.cierre} (hora de
              Canarias): {media.n} {media.n === 1 ? 'registro' : 'registros'}, con la cotización entre{' '}
              <span className="num">{fmtDec(fixingDia.min, 2)}</span> y <span className="num">{fmtDec(fixingDia.max, 2)} €/oz</span>.
              {datosDia.enCurso && ' El día aún no ha terminado.'}
            </>
          ) : null}
          {fixingOk && (
            <>
              {' '}Simulado con tu fixing de <b className="num">{fmtDec(fixingManual, 2)} €/oz</b>
              {pctVista != null && <> ({fmtSigned(pctVista, 2)} % sobre {esHoy ? 'la cotización' : 'la media del día'})</>}.
              {' '}Mueve el porcentaje o quita el fixing para volver a la variación.
            </>
          )}
          {fixingMal && <span className="sim__error"> El fixing tiene que ser un número mayor que 0, en €/oz (por ejemplo, 3.950 o 3950,50).</span>}
          {gramosMal && <span className="sim__error"> Los gramos tienen que ser un número mayor que 0 y hasta {fmtDec(MAX_GRAMOS, 0)}.</span>}
        </p>

        {dia.error && !cargando && (
          <div className="alert error">No se ha podido leer la media del día: {dia.error}</div>
        )}
        {sinDia && (
          <div className="alert warn">
            No hay registros del {fechaLarga(fechaEf)} entre las 7:00 y las 17:00. Solo se apunta un precio
            cuando alguien visita la web, y antes de que empezara el registro no hay datos.
          </div>
        )}
        {aviso && <div className="alert warn">{aviso}</div>}

        <div className="sim__control">
          <input
            className="slider"
            type="range"
            min={-10}
            max={10}
            step={0.5}
            value={fixingOk ? Math.max(-10, Math.min(10, pctVista ?? 0)) : pct}
            onChange={(e) => cambiarPct(Number(e.target.value))}
            aria-label={`Variación del ${cfg.label.toLowerCase()} en porcentaje`}
          />
          <output className={`sim__pct${tono}`}>
            {pctVista == null ? '—' : `${fmtSigned(pctVista, fixingOk ? 2 : 1)} %`}
          </output>
        </div>

        <div className="sim__quick">
          {QUICK.map(v => (
            <button
              key={v}
              className={`chip${!fixingOk && pct === v ? ' on' : ''}`}
              onClick={() => cambiarPct(v)}
            >
              {v === 0 ? 'Sin cambio' : `${fmtSigned(v, 0)} %`}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__title">
          {esHoy
            ? `Cómo quedaría la tabla de ${cfg.label.toLowerCase()}`
            : `Cómo habría quedado la tabla de ${cfg.label.toLowerCase()} el ${fechaLarga(fechaEf)}`}
        </h3>
        <div className="table-scroll">
          <table className="mini wide sim__tabla">
            <thead>
              <tr>
                <th>Ley</th>
                <th className="right">{esHoy ? 'Ahora' : `Media ${fechaCorta(fechaEf)}`}</th>
                <th className="right">{fixingOk ? 'Con tu fixing' : 'Simulado'}</th>
                <th className="right">Diferencia</th>
                {gramosOk && <th className="right">{gramosTexto} <span className="unidad">g</span></th>}
                {gramosOk && <th className="right">{gramosTexto} <span className="unidad">g</span> {fixingOk ? 'con tu fixing' : 'simulado'}</th>}
                <th className="right">Margen</th>
                <th className="right">Margen cero en</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const marginShift = r.marginNow != null && r.marginThen != null
                  ? r.marginThen - r.marginNow
                  : null
                const sinDato = !esHoy && !cargando && r.now == null
                return (
                  <tr key={r.key} className={r.then === 0 ? 'is-bad' : ''}>
                    <td>{r.label}</td>
                    <td className="right num">
                      {sinDato ? <span className="muted">sin dato</span> : euros(r.now, cfg.decimals)}
                      {r.rango && (
                        <small title="Mínimo y máximo publicados entre las 7:00 y las 17:00">
                          {fmtDec(r.rango.min, cfg.decimals)} – {fmtDec(r.rango.max, cfg.decimals)}
                        </small>
                      )}
                    </td>
                    <td className="right num"><b>{euros(r.then, cfg.decimals)}</b></td>
                    <td className="right num"><Delta value={r.delta} decimals={cfg.decimals} /></td>
                    {gramosOk && <td className="right num">{euros(r.totalNow, 2)}</td>}
                    {gramosOk && (
                      <td className="right num">
                        <b>{euros(r.totalThen, 2)}</b>
                        {r.totalDelta != null && Math.abs(r.totalDelta) >= 0.005 && (
                          <small className={r.totalDelta > 0 ? 'up' : 'down'}>{fmtSigned(r.totalDelta, 2)} €</small>
                        )}
                      </td>
                    )}
                    <td className="right num">
                      {r.marginNow == null ? '—' : `${fmtDec(r.marginNow, 1)} %`}
                      {marginShift != null && Math.abs(marginShift) > 0.05 && (
                        <em className={marginShift > 0 ? 'up' : 'down'}>
                          {' '}→ {fmtDec(r.marginThen, 1)} %
                        </em>
                      )}
                    </td>
                    <td className="right num">
                      {r.breakEven != null
                        ? <span title="Cotización a la que esta ley dejaría de dar margen">{fmtDec(r.breakEven, 0)} €/oz</span>
                        : <span className="muted">no aplica</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="note">
          {marginMoves ? (
            <>
              El margen se mueve porque alguna ley lleva <strong>factor 3</strong>: como es una
              cantidad fija en euros, pesa menos cuanto más alto cotiza el metal.
            </>
          ) : (
            <>
              El margen apenas se mueve, y es lo normal: es <strong>1 − f1 × f2</strong>, que no
              depende de cómo cotice el metal. Lo único que lo altera es el <strong>factor 3</strong>,
              y con los valores de esta tabla ese efecto no llega ni a una décima.
            </>
          )}
          {' '}La última columna es la cotización a la que el margen de esa ley llegaría a cero.
          Solo aparece con un factor 3 positivo: en negativo el descuento fijo pesa cada vez
          menos según sube el metal, así que el margen crece en lugar de estrecharse.
        </p>
        {!esHoy && (
          <p className="note">
            Con un día pasado, la primera columna es la <strong>media de lo que se publicó</strong> ese
            día de 7:00 a 17:00, con el mínimo y el máximo debajo si se movió. El simulado le suma lo
            que movería esa variación (o pasar de la media al fixing que escribas) con las fórmulas
            del borrador, así que con «Sin cambio» es exactamente el precio de ese día.
          </p>
        )}
        {gramosOk && (
          <p className="note">
            Los importes se calculan como en un cierre: el €/g redondeado a {METALS.gold.decimals} decimales
            en oro y {METALS.silver.decimals} en plata, y después por los gramos, a céntimos.
          </p>
        )}
      </section>
    </div>
  )
}
