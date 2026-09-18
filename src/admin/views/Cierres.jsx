import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { fmtDec, fmtDate, sinceText, METALS } from '../lib/formulas'

// Bandeja de cierres: lo que los clientes piden desde el portal y aquí se
// confirma o se rechaza.
//
// Cada solicitud lleva el precio congelado y un reloj. Si el reloj vence, no se
// confirma a ciegas: el servidor vuelve a valorar y hay que aceptar el número
// nuevo, que es el que se le va a pagar.
//
// Antes de confirmar, el lote se puede ajustar: los gramos que diga la báscula
// y, si se ha pactado otra cosa, el precio. Lo que pidió el cliente se guarda
// aparte y cada ajuste queda firmado con quién lo hizo.

const ESTADOS = {
  pendiente: { etiqueta: 'Pendiente', tono: 'warn' },
  confirmado: { etiqueta: 'Confirmado', tono: 'ok' },
  rechazado: { etiqueta: 'Rechazado', tono: 'bad' },
  anulado: { etiqueta: 'Anulado por el cliente', tono: 'info' },
}

const FILTROS = [
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: '', etiqueta: 'Todos' },
  { valor: 'confirmado', etiqueta: 'Confirmados' },
  { valor: 'rechazado', etiqueta: 'Rechazados' },
]

function restante(expiraEn) {
  const ms = new Date(expiraEn).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  if (ms <= 0) return { vencido: true, texto: 'reserva vencida' }
  const min = Math.round(ms / 60000)
  return { vencido: false, texto: min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min` }
}

// Lo tecleado en una casilla del ajuste → número. null es «no es un número».
function num(valor) {
  const texto = String(valor ?? '').trim().replace(',', '.')
  if (!texto) return null
  const n = Number(texto)
  return Number.isFinite(n) ? n : null
}

// Al revés: el número tal y como se escribe aquí, sin separador de miles, que
// si no no se puede volver a leer.
const campo = (n) => (n == null ? '' : String(n).replace('.', ','))

// ─── El lote en modo edición ─────────────────────────────────────────────────
//
// Los gramos y el precio de cada línea, más quitar y añadir leyes. El importe
// se recalcula según se escribe, pero el que vale es el que rehace el servidor
// al guardar: aquí solo se está viendo lo que va a salir.

function Ajuste({
  ajuste, market, guardando, error,
  onTocar, onQuitar, onAnadir, onMotivo, onGuardar, onCancelar,
}) {
  const [nueva, setNueva] = useState('')

  const importe = (l) => {
    const g = num(l.gramos)
    const p = num(l.precioGramo)
    return g != null && p != null ? g * p : null
  }

  const gramos = ajuste.lineas.reduce((s, l) => s + (num(l.gramos) || 0), 0)
  const total = ajuste.lineas.reduce((s, l) => s + (importe(l) || 0), 0)
  const aTarifa = ajuste.lineas.filter(l => String(l.precioGramo).trim() === '').length

  const leyes = ['gold', 'silver'].flatMap(metal =>
    (market?.[metal] || []).map(g => ({ metal, key: g.key, label: g.label }))
  )

  return (
    <div className="ajuste">
      {error && <div className="alert error" role="alert">{error}</div>}

      <div className="table-scroll">
        <table className="mini">
          <thead>
            <tr>
              <th>Ley</th>
              <th className="right">Gramos</th>
              <th className="right">€ / gramo</th>
              <th className="right">Importe</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ajuste.lineas.map((l, i) => (
              <tr key={`${l.key}-${i}`}>
                <td>
                  <span className={`bead${l.metal === 'silver' ? ' silver' : ''}`} aria-hidden="true" />
                  {l.label}
                </td>
                <td className="right">
                  <input
                    className="input num"
                    type="text"
                    inputMode="decimal"
                    value={l.gramos}
                    aria-label={`Gramos de ${l.label}`}
                    onChange={(e) => onTocar(i, { gramos: e.target.value })}
                  />
                </td>
                <td className="right">
                  <input
                    className="input num"
                    type="text"
                    inputMode="decimal"
                    value={l.precioGramo}
                    placeholder="tarifa"
                    aria-label={`Euros por gramo de ${l.label}`}
                    title="Vacío = el precio de tarifa con la cotización congelada de este cierre"
                    onChange={(e) => onTocar(i, { precioGramo: e.target.value })}
                  />
                </td>
                <td className="right num">
                  {importe(l) == null ? <span className="muted">tarifa</span> : `${fmtDec(importe(l))} €`}
                </td>
                <td className="right">
                  <button
                    className="btn icon danger"
                    onClick={() => onQuitar(i)}
                    aria-label={`Quitar ${l.label}`}
                    title="Quitar esta línea"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="total">
        <span>
          {fmtDec(gramos, 2)} gramos en total
          {aTarifa > 0 && ` · ${aTarifa} ${aTarifa === 1 ? 'línea va' : 'líneas van'} a tarifa`}
        </span>
        <b>{fmtDec(total)} €</b>
      </div>

      <div className="ajuste__pie">
        <label className="cell">
          <span className="sr-only">Añadir una ley</span>
          <select
            className="select"
            value={nueva}
            onChange={(e) => {
              const [metal, key] = e.target.value.split(':')
              if (key) onAnadir(metal, key)
              setNueva('')
            }}
          >
            <option value="">Añadir una ley…</option>
            {leyes.map(l => (
              <option key={`${l.metal}:${l.key}`} value={`${l.metal}:${l.key}`}>{l.label}</option>
            ))}
          </select>
        </label>

        <label className="cell ajuste__motivo">
          <span className="sr-only">Motivo del ajuste</span>
          <input
            className="input"
            type="text"
            maxLength={200}
            value={ajuste.motivo}
            placeholder="Motivo (queda en el historial, el cliente no lo ve)"
            onChange={(e) => onMotivo(e.target.value)}
          />
        </label>
      </div>

      <p className="note tight">
        Los gramos son los que diga la báscula. El precio vacío es el de tarifa con la
        cotización congelada de este cierre; si escribes otro, queda marcado como puesto a
        mano y no lo pisa ninguna revalorización.
      </p>

      <div className="ficha__acciones">
        <button className="btn" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button className="btn primary" onClick={onGuardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar ajuste'}
        </button>
      </div>
    </div>
  )
}

// ─── El bloque para el ERP ───────────────────────────────────────────────────
//
// Una fila por línea del lote, con la referencia y el cliente repetidos, para
// que cada fila valga por sí sola al pegarla. Lo prepara el servidor: si el
// papel del cliente y lo que entra en contabilidad salieran de sitios
// distintos, algún día no cuadrarían.

function ParaElERP({ refCierre, handleError }) {
  const [csv, setCsv] = useState(null)
  const [estado, setEstado] = useState({ error: null, copiado: false })

  useEffect(() => {
    let vivo = true
    api.csvCierre(refCierre)
      .then(texto => { if (vivo) setCsv(texto) })
      .catch(err => {
        if (handleError(err)) return
        if (vivo) setEstado(s => ({ ...s, error: err.message }))
      })
    return () => { vivo = false }
  }, [refCierre, handleError])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(csv)
      setEstado(s => ({ ...s, copiado: true, error: null }))
      setTimeout(() => setEstado(s => ({ ...s, copiado: false })), 2500)
    } catch {
      // Algunos navegadores solo dejan copiar sobre HTTPS. El texto está a la
      // vista, así que siempre queda seleccionarlo a mano.
      setEstado(s => ({ ...s, error: 'El navegador no ha dejado copiar. Selecciona el bloque y cópialo a mano.' }))
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="panel__title">Para el ERP</h3>
        <div className="panel__botones">
          <button className="btn small" onClick={copiar} disabled={!csv}>
            {estado.copiado ? 'Copiado' : 'Copiar'}
          </button>
          <a className="btn small" href={api.urlCsvCierre(refCierre)}>Descargar CSV</a>
        </div>
      </div>

      {estado.error && <div className="alert error" role="alert">{estado.error}</div>}

      {csv
        ? <pre className="erp">{csv}</pre>
        : <div className="skeleton" style={{ height: 68 }} />}

      <p className="note tight">
        Punto y coma como separador y coma decimal, sin separador de miles: un Excel en
        español lo abre tal cual y una importación no se come ningún cero.
      </p>
    </section>
  )
}

function Detalle({ refCierre, onCerrar, onCambio, handleError, market }) {
  const [cierre, setCierre] = useState(null)
  const [nota, setNota] = useState('')
  // null mientras no se está ajustando: el lote se enseña, no se edita.
  const [ajuste, setAjuste] = useState(null)
  const [estado, setEstado] = useState({ cargando: true, guardando: false, error: null, aviso: null })

  const cargar = useCallback(async () => {
    setEstado(s => ({ ...s, cargando: true, error: null }))
    try {
      const data = await api.cierre(refCierre)
      setCierre(data.cierre)
      setEstado({ cargando: false, guardando: false, error: null, aviso: null })
    } catch (err) {
      if (handleError(err)) return
      setEstado({ cargando: false, guardando: false, error: err.message, aviso: null })
    }
  }, [refCierre, handleError])

  useEffect(() => { cargar() }, [cargar])

  const decidir = async (accion) => {
    if (accion === 'rechazar' && !nota.trim()) {
      setEstado(s => ({ ...s, error: 'Escribe el motivo: el cliente lo va a leer.' }))
      return
    }
    if (accion === 'confirmar' &&
        !window.confirm(`¿Confirmar ${cierre.ref} por ${fmtDec(cierre.total)} €? A partir de ahí, ese es el precio.`)) return

    setEstado(s => ({ ...s, guardando: true, error: null, aviso: null }))
    try {
      const data = await api.decidirCierre({
        ref: cierre.ref,
        accion,
        nota,
        // Se envía el total que se está viendo: si por lo que sea ya no es ese,
        // el servidor lo para en vez de confirmar otra cosa.
        totalVisto: accion === 'confirmar' ? cierre.total : undefined,
      })
      setCierre(data.cierre)
      setNota('')
      setEstado({ cargando: false, guardando: false, error: null, aviso: null })
      onCambio()
    } catch (err) {
      if (handleError(err)) return
      // 409 con el cierre revalorizado: se enseña el precio nuevo y se vuelve a
      // pedir la confirmación.
      if (err.payload?.cierre) {
        setCierre(err.payload.cierre)
        setEstado({ cargando: false, guardando: false, error: null, aviso: err.message })
        onCambio()
        return
      }
      setEstado(s => ({ ...s, guardando: false, error: err.message }))
    }
  }

  // ── Ajuste del lote ───────────────────────────────────────────────────────

  const abrirAjuste = () => {
    setEstado(s => ({ ...s, error: null, aviso: null }))
    setAjuste({
      motivo: '',
      lineas: cierre.lineas.map(l => ({
        metal: l.metal,
        key: l.key,
        label: l.label,
        gramos: campo(l.gramos),
        // El precio se enseña para poder cambiarlo; vaciarlo devuelve la línea
        // a la tarifa.
        precioGramo: campo(l.precioGramo),
      })),
    })
  }

  const tocarLinea = (i, cambio) => setAjuste(a => ({
    ...a,
    lineas: a.lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)),
  }))

  const quitarLinea = (i) => setAjuste(a => ({ ...a, lineas: a.lineas.filter((_, j) => j !== i) }))

  const anadirLinea = (metal, key) => {
    const ley = (market?.[metal] || []).find(g => g.key === key)
    if (!ley) return
    setAjuste(a => ({
      ...a,
      // Sin precio: lo pone el servidor con la tarifa del fixing congelado de
      // este cierre, que no es el de ahora mismo.
      lineas: [...a.lineas, { metal, key: ley.key, label: ley.label, gramos: '', precioGramo: '' }],
    }))
  }

  const guardarAjuste = async () => {
    const lineas = ajuste.lineas.map(l => ({
      metal: l.metal,
      key: l.key,
      gramos: num(l.gramos),
      precioGramo: String(l.precioGramo).trim() === '' ? null : num(l.precioGramo),
    }))

    if (!lineas.length) {
      setEstado(s => ({ ...s, error: 'Un cierre no puede quedarse sin líneas. Si no vale, recházalo.' }))
      return
    }
    if (lineas.some(l => l.gramos == null || l.gramos <= 0)) {
      setEstado(s => ({ ...s, error: 'Hay gramos sin poner o mal escritos.' }))
      return
    }
    if (lineas.some(l => l.precioGramo !== null && (l.precioGramo == null || l.precioGramo <= 0))) {
      setEstado(s => ({ ...s, error: 'Hay algún precio mal escrito. Déjalo vacío para usar la tarifa.' }))
      return
    }

    setEstado(s => ({ ...s, guardando: true, error: null, aviso: null }))
    try {
      const data = await api.ajustarCierre({ ref: cierre.ref, motivo: ajuste.motivo, lineas })
      setCierre(data.cierre)
      setAjuste(null)
      setEstado({ cargando: false, guardando: false, error: null, aviso: null })
      onCambio()
    } catch (err) {
      if (handleError(err)) return
      const details = err.payload?.details
      setEstado(s => ({
        ...s,
        guardando: false,
        error: details?.length ? `${err.message}: ${details.join(' · ')}` : err.message,
      }))
    }
  }

  if (estado.cargando) return <div className="skeleton" style={{ height: 260 }} />
  if (!cierre) {
    return (
      <section className="panel">
        <p className="note">{estado.error || 'No se ha encontrado el cierre.'}</p>
        <button className="btn" onClick={onCerrar}>Volver a la bandeja</button>
      </section>
    )
  }

  const cfg = ESTADOS[cierre.estado] || ESTADOS.pendiente
  const reloj = cierre.estado === 'pendiente' ? restante(cierre.expiraEn) : null

  return (
    <div className="view">
      <div className="ficha__top">
        <button className="linky" onClick={onCerrar}>← Todos los cierres</button>
        <span className={`marca is-${cfg.tono}`}>{cfg.etiqueta}</span>
      </div>

      <section className="panel">
        <h3 className="panel__title ref">{cierre.ref}</h3>
        <dl className="datos">
          <div><dt>Cliente</dt><dd>{cierre.cliente.razonSocial} · <span className="ref">{cierre.cliente.cif}</span></dd></div>
          <div>
            <dt>Contacto</dt>
            <dd>{cierre.cliente.persona} · <a href={`tel:${cierre.cliente.telefono}`}>{cierre.cliente.telefono}</a></dd>
          </div>
          <div><dt>Pedido</dt><dd>{fmtDate(cierre.creadoEn)} · {sinceText(cierre.creadoEn)}</dd></div>
          <div>
            <dt>Reserva de precio</dt>
            <dd>
              {cierre.estado === 'pendiente'
                ? (reloj?.vencido
                    ? <span className="marca is-bad">Vencida</span>
                    : <span className="pending">Quedan {reloj?.texto}</span>)
                : `${cierre.reservaMinutos} min`}
              {cierre.revalorizadoEn && <small>Revalorizado el {fmtDate(cierre.revalorizadoEn)}</small>}
            </dd>
          </div>
          <div>
            <dt>Cotización congelada</dt>
            <dd className="num">
              Oro {fmtDec(cierre.fixing?.gold)} € · Plata {fmtDec(cierre.fixing?.silver)} € la onza
              {cierre.formulasVersion != null && <small>Fórmulas versión {cierre.formulasVersion}</small>}
            </dd>
          </div>
          {cierre.decididoEn && (
            <div>
              <dt>Decidido</dt>
              <dd>{fmtDate(cierre.decididoEn)} · {cierre.decididoPor}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h3 className="panel__title">El lote</h3>
          <div className="panel__botones">
            {cierre.estado === 'pendiente' && !ajuste && (
              <button className="btn small" onClick={abrirAjuste}>Ajustar el lote</button>
            )}
            <a className="btn small" href={api.urlJustificante(cierre.ref)}>Justificante PDF</a>
          </div>
        </div>

        {ajuste ? (
          <Ajuste
            ajuste={ajuste}
            market={market}
            guardando={estado.guardando}
            onTocar={tocarLinea}
            onQuitar={quitarLinea}
            onAnadir={anadirLinea}
            onMotivo={(motivo) => setAjuste(a => ({ ...a, motivo }))}
            onGuardar={guardarAjuste}
            onCancelar={() => setAjuste(null)}
            error={estado.error}
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="mini">
                <thead>
                  <tr>
                    <th>Ley</th>
                    <th className="right">Gramos</th>
                    <th className="right">€ / gramo</th>
                    <th className="right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {cierre.lineas.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <span className={`bead${l.metal === 'silver' ? ' silver' : ''}`} aria-hidden="true" />
                        {l.label}
                      </td>
                      <td className="right num">{fmtDec(l.gramos, 2)}</td>
                      <td className="right num">
                        {fmtDec(l.precioGramo, METALS[l.metal].decimals)} €
                        {l.precioManual && (
                          <small className="warn">
                            a mano · tarifa {fmtDec(l.precioTarifa, METALS[l.metal].decimals)} €
                          </small>
                        )}
                      </td>
                      <td className="right num">{fmtDec(l.importe)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="total">
              <span>{fmtDec(cierre.gramos, 2)} gramos en total</span>
              <b>{fmtDec(cierre.total)} €</b>
            </div>

            {cierre.pedido && (
              <p className="note tight">
                El cliente pidió <b>{fmtDec(cierre.pedido.gramos, 2)} gramos</b> por{' '}
                <b>{fmtDec(cierre.pedido.total)} €</b>
                {cierre.ajustadoPor && <> · ajustado por {cierre.ajustadoPor} el {fmtDate(cierre.ajustadoEn)}</>}
                {cierre.ajustes?.at(-1)?.motivo && <> · {cierre.ajustes.at(-1).motivo}</>}
              </p>
            )}
          </>
        )}
      </section>

      <ParaElERP refCierre={cierre.ref} handleError={handleError} />

      {cierre.estado === 'pendiente' && (
        <section className="panel">
          <h3 className="panel__title">Decisión</h3>

          {estado.aviso && <div className="alert warn" role="alert">{estado.aviso}</div>}
          {estado.error && <div className="alert error" role="alert">{estado.error}</div>}

          <label className="label" htmlFor="nota-cierre">Nota para el cliente</label>
          <textarea
            id="nota-cierre"
            className="input"
            rows={2}
            maxLength={400}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Obligatoria si lo rechazas. El cliente la lee tal cual."
          />

          <div className="ficha__acciones">
            <button className="btn small danger" onClick={() => decidir('rechazar')} disabled={estado.guardando}>
              Rechazar
            </button>
            <button className="btn primary" onClick={() => decidir('confirmar')} disabled={estado.guardando}>
              {estado.guardando ? 'Guardando…' : `Confirmar ${fmtDec(cierre.total)} €`}
            </button>
          </div>
        </section>
      )}

      {cierre.nota && cierre.estado !== 'pendiente' && (
        <section className="panel">
          <h3 className="panel__title">Nota</h3>
          <p className="note tight">{cierre.nota}</p>
        </section>
      )}
    </div>
  )
}

export function Cierres({ p }) {
  const { handleError, cierres, cargarCierres, abrirCierre, cierreAbierto } = p
  const [filtro, setFiltro] = useState('pendiente')

  useEffect(() => { cargarCierres() }, [cargarCierres])

  if (cierreAbierto) {
    return (
      <Detalle
        refCierre={cierreAbierto}
        onCerrar={() => abrirCierre(null)}
        onCambio={cargarCierres}
        handleError={handleError}
        market={p.market}
      />
    )
  }

  const lista = filtro ? cierres.lista.filter(c => c.estado === filtro) : cierres.lista

  return (
    <div className="view">
      <section className="panel">
        <div className="filtros">
          {FILTROS.map(f => (
            <button
              key={f.valor || 'todos'}
              className={`chip${filtro === f.valor ? ' on' : ''}`}
              onClick={() => setFiltro(f.valor)}
            >
              {f.etiqueta}
              {f.valor === 'pendiente' && cierres.pendientes > 0 && ` · ${cierres.pendientes}`}
            </button>
          ))}
        </div>

        {cierres.cargando ? (
          <div className="skeleton" style={{ height: 160, marginTop: 16 }} />
        ) : lista.length === 0 ? (
          <div className="empty-block">
            <h4>No hay cierres {filtro ? 'en este estado' : 'todavía'}</h4>
            <p>
              Los piden los clientes aprobados desde el portal. Cuando llegue uno, aparecerá
              aquí con su precio reservado y el tiempo que queda para confirmarlo.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="mini wide">
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Cliente</th>
                  <th className="right">Gramos</th>
                  <th className="right">Total</th>
                  <th>Pedido</th>
                  <th>Reserva</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map(c => {
                  const reloj = c.estado === 'pendiente' ? restante(c.expiraEn) : null
                  return (
                    <tr key={c.ref} className={reloj?.vencido ? 'is-bad' : ''}>
                      <td>
                        <button className="linky ref" onClick={() => abrirCierre(c.ref)}>{c.ref}</button>
                      </td>
                      <td>{c.razonSocial}</td>
                      <td className="right num">{fmtDec(c.gramos, 2)}</td>
                      <td className="right num"><b>{fmtDec(c.total)} €</b></td>
                      <td>{sinceText(c.creadoEn)}</td>
                      <td>
                        {reloj
                          ? (reloj.vencido ? <span className="bad">vencida</span> : reloj.texto)
                          : <span className="muted">—</span>}
                      </td>
                      <td><span className={`marca is-${(ESTADOS[c.estado] || ESTADOS.pendiente).tono}`}>
                        {(ESTADOS[c.estado] || ESTADOS.pendiente).etiqueta}
                      </span></td>
                      <td className="right">
                        <button className="btn small" onClick={() => abrirCierre(c.ref)}>Abrir</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
