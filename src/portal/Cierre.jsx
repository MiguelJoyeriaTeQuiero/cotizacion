import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'

// La pantalla donde el cliente monta el lote y pide el cierre.
//
// El lote se monta ley a ley: se pone el peso en la casilla del quilate que
// toca y el importe se rellena solo. No hay nada que aprender ni nada que se
// pueda escribir mal. El precio que se ve aquí es el mismo que publica la web;
// el que vale es el que calcula el servidor al pedir el cierre, y queda
// reservado mientras TQM lo confirma.

const ESTADOS = {
  pendiente: { etiqueta: 'Pendiente de confirmar', tono: 'warn' },
  confirmado: { etiqueta: 'Confirmado', tono: 'ok' },
  rechazado: { etiqueta: 'Rechazado', tono: 'bad' },
  anulado: { etiqueta: 'Anulado', tono: 'info' },
}

// El oro se pesa en gramos y la plata en kilos: el botón de cada metal mueve
// lo que se movería a mano.
const METALES = [
  { id: 'gold', etiqueta: 'Oro', paso: 1, decimales: 2 },
  { id: 'silver', etiqueta: 'Plata', paso: 100, decimales: 3 },
]

// Más de 100 kg en una sola ley es un dedo torcido, no un lote.
const TOPE_GRAMOS = 100000

function fmt(v, dec = 2) {
  return Number.isFinite(v)
    ? v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : '—'
}

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

// Lo tecleado → gramos. Devuelve null si lo escrito no es un peso: la casilla
// se marca y el paso siguiente espera, en vez de tragarse el número a medias.
function pesar(valor) {
  const texto = String(valor ?? '').trim().replace(',', '.')
  if (!texto) return 0
  const n = Number(texto)
  if (!Number.isFinite(n) || n < 0 || n > TOPE_GRAMOS) return null
  return Math.round(n * 1000) / 1000
}

const escribir = (n) => (n ? String(n).replace('.', ',') : '')

function restante(expiraEn) {
  const ms = new Date(expiraEn).getTime() - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return null
  const min = Math.floor(ms / 60000)
  if (min >= 60) {
    const h = Math.floor(min / 60)
    return `${h} h ${min % 60} min`
  }
  if (min >= 1) return `${min} min`
  return 'menos de un minuto'
}

// ─── Una ley del lote ────────────────────────────────────────────────────────

function Ley({ ley, metal, valor, onCambio }) {
  const gramos = pesar(valor)
  const precio = Number(ley.pricePerGram)
  const importe = gramos && Number.isFinite(precio) ? gramos * precio : 0

  const ajustar = (signo) => {
    const base = gramos ?? 0
    onCambio(escribir(Math.max(0, Math.round((base + signo * metal.paso) * 1000) / 1000)))
  }

  // Las flechas del teclado hacen lo mismo que los botones: sumar y restar un
  // paso sin soltar el campo.
  const teclas = (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    ajustar(e.key === 'ArrowUp' ? 1 : -1)
  }

  return (
    <tr className={`ley${gramos ? ' is-on' : ''}${gramos === null ? ' is-bad' : ''}`}>
      <th scope="row">
        <label className="ley__nombre" htmlFor={`ley-${ley.key}`}>{ley.label}</label>
        {/* En pantalla estrecha no cabe la columna del precio, así que el precio
            baja aquí. Es el mismo dato, no uno nuevo. */}
        <small className="ley__precio-estrecho num">{fmt(precio, metal.decimales)} € / gr</small>
      </th>
      <td className="right num ley__precio">{fmt(precio, metal.decimales)} €</td>
      <td className="right">
        <div className="stepper">
          <button
            type="button"
            className="stepper__btn"
            onClick={() => ajustar(-1)}
            disabled={!gramos}
            aria-label={`Quitar ${metal.paso} gramos de ${ley.label}`}
          >
            −
          </button>
          <input
            id={`ley-${ley.key}`}
            className="stepper__campo num"
            inputMode="decimal"
            autoComplete="off"
            maxLength={9}
            value={valor ?? ''}
            placeholder="0"
            aria-label={`Gramos de ${ley.label}`}
            aria-invalid={gramos === null || undefined}
            onChange={(e) => onCambio(e.target.value)}
            onKeyDown={teclas}
            onFocus={(e) => e.target.select()}
          />
          <span className="stepper__u" aria-hidden="true">gr</span>
          <button
            type="button"
            className="stepper__btn"
            onClick={() => ajustar(1)}
            aria-label={`Añadir ${metal.paso} gramos de ${ley.label}`}
          >
            +
          </button>
        </div>
      </td>
      <td className="right num ley__importe">
        {gramos === null
          ? <span className="bad">peso no válido</span>
          : gramos ? `${fmt(importe)} €` : <span className="muted">—</span>}
      </td>
    </tr>
  )
}

// ─── Un cierre en la lista ───────────────────────────────────────────────────

function Cierre({ cierre, onAnular, onError }) {
  const [abierto, setAbierto] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const estado = ESTADOS[cierre.estado] || ESTADOS.pendiente
  const queda = cierre.estado === 'pendiente' ? restante(cierre.expiraEn) : null

  // El desglose solo se pide cuando se abre: la lista se mantiene ligera.
  const alternar = async () => {
    const siguiente = !abierto
    setAbierto(siguiente)
    if (siguiente && !detalle) {
      try {
        const data = await api.cierre(cierre.ref)
        setDetalle(data.cierre)
      } catch (err) {
        onError(err.message)
        setAbierto(false)
      }
    }
  }

  return (
    <li className="cierre">
      <div className="cierre__cabeza">
        <button className="cierre__ref" onClick={alternar} aria-expanded={abierto}>
          {cierre.ref}
        </button>
        <span className="cierre__lineas">{cierre.numLineas} {cierre.numLineas === 1 ? 'línea' : 'líneas'}</span>
        <span className={`marca is-${estado.tono}`}>{estado.etiqueta}</span>
        <span className="cierre__fecha">{fmtFecha(cierre.creadoEn)}</span>
        <b className="cierre__total">{fmt(cierre.total)} €</b>
      </div>

      {cierre.estado === 'pendiente' && (
        <p className="cierre__aviso">
          {queda
            ? `Precio reservado. Quedan ${queda} para que lo confirmemos; si se pasa, se vuelve a valorar al precio del momento.`
            : 'La reserva de precio ha vencido: al confirmarlo lo valoraremos al precio de ese momento.'}
          {onAnular && (
            <> <button className="linky" onClick={() => onAnular(cierre)}>Anular</button></>
          )}
        </p>
      )}

      {detalle?.nota && <p className="cierre__nota">{detalle.nota}</p>}

      {abierto && !detalle && <div className="skeleton" style={{ height: 60, marginTop: 10 }} />}

      {abierto && detalle && (
        <>
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
              {detalle.lineas.map((l, i) => (
                <tr key={i}>
                  <td>{l.label}</td>
                  <td className="right num">{fmt(l.gramos, 2)}</td>
                  <td className="right num">{fmt(l.precioGramo, l.metal === 'silver' ? 3 : 2)} €</td>
                  <td className="right num">{fmt(l.importe)} €</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Si lo hemos tocado, se dice y se enseña lo que se pidió: el número
              de arriba es el que se paga, y tiene que poder compararse. */}
          {detalle.pedido && (
            <p className="cierre__nota">
              Hemos ajustado el lote al revisarlo. Tú pediste{' '}
              <b>{fmt(detalle.pedido.gramos, 2)} gramos</b> por <b>{fmt(detalle.pedido.total)} €</b>;
              lo de arriba es lo que se paga. Si no cuadra, llámanos.
            </p>
          )}

          {/* El papel del cierre. Se descarga en cualquier estado: el propio
              documento dice si está confirmado o solo pedido. */}
          <p className="cierre__papel">
            <a
              className="linky"
              href={`/api/cierres?ref=${encodeURIComponent(cierre.ref)}&formato=pdf&portal=1`}
            >
              Descargar el justificante (PDF)
            </a>
          </p>
        </>
      )}
    </li>
  )
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

export function Cierres({ onError }) {
  const [precios, setPrecios] = useState(null)
  const [cantidades, setCantidades] = useState({})
  const [metalId, setMetalId] = useState('gold')
  const [etapa, setEtapa] = useState(1)
  const [cierres, setCierres] = useState([])
  const [ultimo, setUltimo] = useState(null)
  const [estado, setEstado] = useState({ cargando: true, enviando: false })
  const [, tic] = useState(0)

  // Las cuentas atrás se refrescan solas sin recargar nada.
  useEffect(() => {
    const t = setInterval(() => tic(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const cargar = useCallback(async () => {
    try {
      const [tarifa, mios] = await Promise.all([api.precios(), api.cierres()])
      setPrecios(tarifa)
      setCierres(mios.cierres || [])
    } catch (err) {
      onError(err.message)
    } finally {
      setEstado(s => ({ ...s, cargando: false }))
    }
  }, [onError])

  useEffect(() => { cargar() }, [cargar])

  const tablas = useMemo(
    () => ({ gold: precios?.gold || [], silver: precios?.silver || [] }),
    [precios]
  )

  // El lote se rearma entero en cada tecla: son una docena de leyes, y así lo
  // que se ve debajo nunca puede ir por detrás de lo que hay escrito arriba.
  const lote = useMemo(() => {
    const lineas = []
    let malEscrito = 0

    for (const metal of METALES) {
      for (const ley of tablas[metal.id]) {
        const gramos = pesar(cantidades[ley.key])
        if (gramos === null) { malEscrito++; continue }
        if (!gramos) continue
        const precioGramo = Number(ley.pricePerGram)
        const valido = Number.isFinite(precioGramo)
        lineas.push({
          metal: metal.id,
          key: ley.key,
          label: ley.label,
          gramos,
          precioGramo: valido ? precioGramo : null,
          importe: valido ? gramos * precioGramo : 0,
          decimales: metal.decimales,
        })
      }
    }

    return {
      lineas,
      malEscrito,
      total: lineas.reduce((suma, l) => suma + l.importe, 0),
      gramos: lineas.reduce((suma, l) => suma + l.gramos, 0),
    }
  }, [cantidades, tablas])

  const metal = METALES.find(m => m.id === metalId) || METALES[0]
  const hayLote = lote.lineas.length > 0
  const listo = hayLote && !lote.malEscrito

  const contar = (id) => lote.lineas.filter(l => l.metal === id).length

  const ponerGramos = (key, valor) => {
    setCantidades(prev => ({ ...prev, [key]: valor }))
    setUltimo(null)
  }

  const vaciar = () => {
    setCantidades({})
    setEtapa(1)
  }

  const pedir = async () => {
    if (!listo || estado.enviando) return
    setEstado(s => ({ ...s, enviando: true }))
    onError(null)
    try {
      const data = await api.pedirCierre(
        lote.lineas.map(l => ({ metal: l.metal, key: l.key, gramos: l.gramos }))
      )
      setUltimo(data.cierre)
      setCantidades({})
      setEtapa(1)
      await cargar()
    } catch (err) {
      onError(err.message)
    } finally {
      setEstado(s => ({ ...s, enviando: false }))
    }
  }

  const anular = async (cierre) => {
    if (!window.confirm(`¿Anular el cierre ${cierre.ref}?`)) return
    try {
      await api.anularCierre(cierre.ref)
      await cargar()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <>
      <section className="panel">
        <h2 className="panel__title">Nuevo cierre</h2>

        <ol className="pasos" aria-label="Pasos del cierre">
          <li className={`pasos__p${etapa === 1 ? ' on' : ' hecho'}`}>
            <span className="pasos__n" aria-hidden="true">1</span>Quilataje
          </li>
          <li className={`pasos__p${etapa === 2 ? ' on' : ''}`}>
            <span className="pasos__n" aria-hidden="true">2</span>Resumen
          </li>
        </ol>

        {estado.cargando && !precios ? (
          <div className="skeleton" style={{ height: 220 }} />
        ) : etapa === 1 ? (
          <>
            <p className="note tight">
              Pon los gramos en la ley que toque: el importe se rellena solo, con el precio
              de este momento.
            </p>

            <div className="metales" role="tablist" aria-label="Metal">
              {METALES.map(m => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={m.id === metalId}
                  className={`chip${m.id === metalId ? ' on' : ''}`}
                  onClick={() => setMetalId(m.id)}
                >
                  {m.etiqueta}
                  {contar(m.id) > 0 && ` · ${contar(m.id)}`}
                </button>
              ))}
            </div>

            <table className="mini leyes">
              <thead>
                <tr>
                  <th>Ley</th>
                  <th className="right">€ / gramo</th>
                  <th className="right">Gramos</th>
                  <th className="right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {tablas[metal.id].map(ley => (
                  <Ley
                    key={ley.key}
                    ley={ley}
                    metal={metal}
                    valor={cantidades[ley.key]}
                    onCambio={(v) => ponerGramos(ley.key, v)}
                  />
                ))}
              </tbody>
            </table>

            {hayLote ? (
              <div className="total">
                <span>Subtotal por {fmt(lote.gramos, 2)} gramos</span>
                <b>{fmt(lote.total)} €</b>
              </div>
            ) : (
              <p className="note tight">
                Pon el peso donde toque y aquí abajo verás el total.
              </p>
            )}

            {lote.malEscrito > 0 && (
              <p className="note tight bad">
                Hay {lote.malEscrito === 1 ? 'un peso que no se entiende' : `${lote.malEscrito} pesos que no se entienden`}:
                revisa lo marcado en rojo.
              </p>
            )}

            <div className="pacciones">
              <button className="btn primary" onClick={() => setEtapa(2)} disabled={!listo}>
                Siguiente
              </button>
              {hayLote && <button className="btn ghost" onClick={vaciar}>Vaciar</button>}
            </div>
          </>
        ) : (
          <>
            <p className="note tight">
              Esto es lo que nos vas a cerrar. Si algo no cuadra, vuelve atrás y cámbialo.
            </p>

            <table className="mini lote__tabla">
              <thead>
                <tr>
                  <th>Ley</th>
                  <th className="right">Gramos</th>
                  <th className="right">€ / gramo</th>
                  <th className="right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {lote.lineas.map(l => (
                  <tr key={l.key}>
                    <td>{l.label}</td>
                    <td className="right num">{fmt(l.gramos, 2)}</td>
                    <td className="right num">{fmt(l.precioGramo, l.decimales)} €</td>
                    <td className="right num">{fmt(l.importe)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="total">
              <span>Total por {fmt(lote.gramos, 2)} gramos</span>
              <b>{fmt(lote.total)} €</b>
            </div>

            <div className="pacciones">
              <button className="btn" onClick={() => setEtapa(1)} disabled={estado.enviando}>
                ← Atrás
              </button>
              <button className="btn primary" onClick={pedir} disabled={!listo || estado.enviando}>
                {estado.enviando ? 'Pidiendo…' : 'Solicitar cierre'}
              </button>
            </div>

            <p className="note">
              Al solicitarlo te reservamos el precio y lo confirmamos nosotros. Mientras tanto
              no hay nada cerrado: lo verás abajo como pendiente.
            </p>
          </>
        )}
      </section>

      {ultimo && (
        <section className="estado is-info">
          <div className="estado__cabeza">
            <span className="dot" aria-hidden="true" />
            <h2>Solicitud {ultimo.ref} enviada</h2>
          </div>
          <p>
            Te hemos reservado <b>{fmt(ultimo.total)} €</b> por {fmt(ultimo.gramos, 2)} gramos
            {restante(ultimo.expiraEn) ? ` durante ${restante(ultimo.expiraEn)}` : ''}. En cuanto
            la confirmemos lo verás aquí; si hay cualquier duda, te llamamos.
          </p>
        </section>
      )}

      <section className="panel">
        <h2 className="panel__title">Tus cierres</h2>
        {estado.cargando ? (
          <div className="skeleton" style={{ height: 90 }} />
        ) : cierres.length === 0 ? (
          <p className="note">Todavía no has pedido ninguno.</p>
        ) : (
          <ul className="cierres">
            {cierres.map(c => (
              <Cierre
                key={c.ref}
                cierre={c}
                onError={onError}
                onAnular={c.estado === 'pendiente' ? anular : null}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
