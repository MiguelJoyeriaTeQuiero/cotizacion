import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { fmtDate, sinceText } from '../lib/formulas'

// Altas de clientes: la cola de revisión y el expediente.
//
// Aquí se decide quién puede vender a TQM, así que la pantalla enseña primero
// lo que hace falta para decidir —quién es y qué ha aportado— y deja la
// decisión abajo, con su motivo.

const ESTADOS = {
  pendiente: { etiqueta: 'Pendiente', tono: 'warn' },
  documentacion: { etiqueta: 'Falta documentación', tono: 'warn' },
  aprobado: { etiqueta: 'Aprobado', tono: 'ok' },
  rechazado: { etiqueta: 'Rechazado', tono: 'bad' },
}

// Cómo se lee cada paso en el historial del expediente.
const PASOS = {
  alta: 'Solicitud creada',
  pendiente: 'Enviada a revisión',
  documentacion: 'Documentación pedida',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
}

const FILTROS = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'documentacion', etiqueta: 'Con documentación pedida' },
  { valor: 'aprobado', etiqueta: 'Aprobados' },
  { valor: 'rechazado', etiqueta: 'Rechazados' },
]

function Estado({ estado, enviadoEn }) {
  const cfg = ESTADOS[estado] || ESTADOS.pendiente
  if (estado === 'pendiente' && !enviadoEn) {
    return <span className="marca is-info">Sin enviar</span>
  }
  return <span className={`marca is-${cfg.tono}`}>{cfg.etiqueta}</span>
}

// ─── Volver a entrar ─────────────────────────────────────────────────────────
//
// La tienda llama porque no puede entrar. Aquí se genera un código de un solo
// uso y se le dicta por teléfono, después de comprobar con quién se habla.
//
// Es el mismo mecanismo que el enlace que manda el portal por correo, así que
// esto no abre ninguna puerta que no existiera. El código se enseña una vez: no
// se guarda en claro en ningún sitio, y si se pierde se genera otro.

function CodigoDeAcceso({ cliente, handleError }) {
  const [codigo, setCodigo] = useState(null)
  const [estado, setEstado] = useState({ pidiendo: false, error: null, copiado: false })

  const pedir = async () => {
    if (!window.confirm(
      `¿Generar un código para ${cliente.empresa.razonSocial}?\n\n` +
      'Solo debes dárselo a alguien de la tienda de quien te hayas asegurado: ' +
      'con ese código se elige contraseña nueva y se entra en la cuenta.'
    )) return

    setEstado({ pidiendo: true, error: null, copiado: false })
    try {
      const data = await api.codigoClave(cliente.id)
      setCodigo(data)
      setEstado({ pidiendo: false, error: null, copiado: false })
    } catch (err) {
      if (handleError(err)) return
      setEstado({ pidiendo: false, error: err.message, copiado: false })
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo.codigo)
      setEstado(s => ({ ...s, copiado: true }))
      setTimeout(() => setEstado(s => ({ ...s, copiado: false })), 2500)
    } catch {
      setEstado(s => ({ ...s, error: 'El navegador no ha dejado copiar. Léelo tal cual.' }))
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="panel__title">Acceso al portal</h3>
        {cliente.claveSolicitadaEn && (
          <span className="pending">Lo ha pedido el cliente</span>
        )}
      </div>

      {codigo ? (
        <>
          <p className="codigo ref">{codigo.codigo}</p>
          <div className="panel__botones">
            <button className="btn small" onClick={copiar}>
              {estado.copiado ? 'Copiado' : 'Copiar'}
            </button>
            <button className="btn small" onClick={pedir} disabled={estado.pidiendo}>
              Generar otro
            </button>
          </div>
          <p className="note tight">
            Vale {codigo.minutos} minutos y una sola vez. Dícteselo tal cual: lo escribe en
            el portal, en «He olvidado la contraseña → Ya tengo un código». No vuelve a
            aparecer aquí.
          </p>
        </>
      ) : (
        <>
          <p className="note tight">
            Si no puede entrar, genera un código y dáselo por teléfono. Si tenéis el correo
            configurado, el propio portal se lo manda sin que hagáis nada.
          </p>
          <div className="panel__botones" style={{ marginTop: 12 }}>
            <button className="btn small" onClick={pedir} disabled={estado.pidiendo}>
              {estado.pidiendo ? 'Generando…' : 'Generar código de acceso'}
            </button>
          </div>
        </>
      )}

      {estado.error && <div className="alert error" role="alert">{estado.error}</div>}
    </section>
  )
}

function Ficha({ id, onVolver, onCambio, handleError }) {
  const [cliente, setCliente] = useState(null)
  const [nota, setNota] = useState('')
  const [limites, setLimites] = useState({ porCierre: '', reservaMinutos: '' })
  const [estado, setEstado] = useState({ cargando: true, guardando: false, error: null })

  const cargar = useCallback(async () => {
    setEstado(s => ({ ...s, cargando: true, error: null }))
    try {
      const data = await api.cliente(id)
      setCliente(data.cliente)
      setLimites({
        porCierre: String(data.cliente.limites?.porCierre ?? ''),
        reservaMinutos: String(data.cliente.limites?.reservaMinutos ?? ''),
      })
      setEstado({ cargando: false, guardando: false, error: null })
    } catch (err) {
      if (handleError(err)) return
      setEstado({ cargando: false, guardando: false, error: err.message })
    }
  }, [id, handleError])

  useEffect(() => { cargar() }, [cargar])

  const decidir = async (accion) => {
    if (accion !== 'aprobar' && !nota.trim()) {
      setEstado(s => ({ ...s, error: 'Escribe el motivo: el cliente lo va a leer tal cual.' }))
      return
    }
    const textos = {
      aprobar: '¿Aprobar este cliente? Podrá operar con nosotros.',
      documentacion: '¿Pedirle esta documentación al cliente?',
      rechazar: '¿Rechazar esta solicitud?',
    }
    if (!window.confirm(textos[accion])) return

    setEstado(s => ({ ...s, guardando: true, error: null }))
    try {
      const data = await api.decidirCliente({
        id,
        accion,
        nota,
        limites: accion === 'aprobar'
          ? { porCierre: Number(limites.porCierre), reservaMinutos: Number(limites.reservaMinutos) }
          : undefined,
      })
      setCliente(data.cliente)
      setNota('')
      setEstado({ cargando: false, guardando: false, error: null })
      onCambio()
    } catch (err) {
      if (handleError(err)) return
      setEstado(s => ({ ...s, guardando: false, error: err.message }))
    }
  }

  const guardarLimites = async () => {
    setEstado(s => ({ ...s, guardando: true, error: null }))
    try {
      const data = await api.decidirCliente({
        id,
        accion: 'limites',
        limites: { porCierre: Number(limites.porCierre), reservaMinutos: Number(limites.reservaMinutos) },
      })
      setCliente(data.cliente)
      setEstado({ cargando: false, guardando: false, error: null })
      onCambio()
    } catch (err) {
      if (handleError(err)) return
      setEstado(s => ({ ...s, guardando: false, error: err.message }))
    }
  }

  if (estado.cargando) return <div className="skeleton" style={{ height: 320 }} />
  if (!cliente) {
    return (
      <section className="panel">
        <p className="note">{estado.error || 'No se ha encontrado el cliente.'}</p>
        <button className="btn" onClick={onVolver}>Volver a la lista</button>
      </section>
    )
  }

  const { empresa, contacto, titular, cobro, documentos = [], historial = [] } = cliente

  return (
    <div className="view">
      <div className="ficha__top">
        <button className="linky" onClick={onVolver}>← Todas las solicitudes</button>
        <Estado estado={cliente.estado} enviadoEn={cliente.enviadoEn} />
      </div>

      <section className="panel">
        <h3 className="panel__title">{empresa.razonSocial}</h3>
        <dl className="datos">
          <div><dt>CIF</dt><dd className="num">{empresa.cif}</dd></div>
          {empresa.nombreComercial && <div><dt>Nombre comercial</dt><dd>{empresa.nombreComercial}</dd></div>}
          <div><dt>Dirección</dt><dd>{empresa.direccion}, {empresa.cp} {empresa.poblacion} ({empresa.provincia})</dd></div>
          {empresa.iae && <div><dt>Epígrafe de IAE</dt><dd>{empresa.iae}</dd></div>}
          <div><dt>Contacto</dt><dd>{contacto.persona} · <a href={`tel:${contacto.telefono}`}>{contacto.telefono}</a>{contacto.telefonoTienda ? ` · tienda ${contacto.telefonoTienda}` : ''}</dd></div>
          <div><dt>Correo</dt><dd><a href={`mailto:${contacto.email}`}>{contacto.email}</a></dd></div>
          <div><dt>Administrador</dt><dd>{titular.nombre} · {titular.dni}</dd></div>
          <div><dt>IBAN</dt><dd className="num">{cobro.iban}</dd></div>
          <div><dt>Solicitud creada</dt><dd>{fmtDate(cliente.creadoEn)}</dd></div>
          <div>
            <dt>Enviada a revisión</dt>
            <dd>{cliente.enviadoEn ? `${fmtDate(cliente.enviadoEn)} · ${sinceText(cliente.enviadoEn)}` : 'Todavía no'}</dd>
          </div>
          <div>
            <dt>Condiciones aceptadas</dt>
            <dd>Versión {cliente.condiciones?.version} · {fmtDate(cliente.condiciones?.aceptadoEn)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h3 className="panel__title">Documentación ({documentos.length})</h3>
        {documentos.length === 0 ? (
          <p className="note">No ha subido ningún documento.</p>
        ) : (
          <ul className="docs">
            {documentos.map(doc => (
              <li className="doc" key={doc.id}>
                <span className={`doc__tipo${doc.tipo === 'application/pdf' ? ' pdf' : ''}`} aria-hidden="true">
                  {doc.tipo === 'application/pdf' ? 'PDF' : 'IMG'}
                </span>
                <span className="doc__nombre">{doc.etiqueta}</span>
                <span className="doc__meta">{Math.round(doc.tamano / 1024)} KB · {fmtDate(doc.subidoEn)}</span>
                <a
                  className="btn small"
                  href={api.urlDocumento(cliente.id, doc.id)}
                  target="_blank"
                  rel="noreferrer"
                >Abrir</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h3 className="panel__title">Decisión</h3>
        {cliente.nota && (
          <p className="note tight">
            <strong>Última nota enviada al cliente:</strong> {cliente.nota}
          </p>
        )}

        <label className="label" htmlFor="nota">Motivo o documentación que falta</label>
        <textarea
          id="nota"
          className="input"
          rows={3}
          maxLength={400}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Lo que escribas aquí es exactamente lo que verá el cliente en su pantalla."
        />

        <div className="rejilla-limites">
          <label className="field-inline">
            <span>Límite por cierre (€)</span>
            <input
              className="input num"
              inputMode="numeric"
              value={limites.porCierre}
              onChange={(e) => setLimites(l => ({ ...l, porCierre: e.target.value }))}
            />
          </label>
          <label className="field-inline">
            <span>Reserva de precio (min)</span>
            <input
              className="input num"
              inputMode="numeric"
              value={limites.reservaMinutos}
              onChange={(e) => setLimites(l => ({ ...l, reservaMinutos: e.target.value }))}
            />
          </label>
          <button className="btn small" onClick={guardarLimites} disabled={estado.guardando}>
            Guardar límites
          </button>
        </div>
        <p className="note tight">
          Cuánto aguanta el precio que se le reserva a este cliente al pedir un cierre, y a
          partir de qué importe la operación se mira con más calma.
        </p>

        {estado.error && <div className="alert error" role="alert">{estado.error}</div>}

        <div className="ficha__acciones">
          <button className="btn" onClick={() => decidir('documentacion')} disabled={estado.guardando}>
            Pedir documentación
          </button>
          <button className="btn small danger" onClick={() => decidir('rechazar')} disabled={estado.guardando}>
            Rechazar
          </button>
          <button className="btn primary" onClick={() => decidir('aprobar')} disabled={estado.guardando}>
            {estado.guardando ? 'Guardando…' : 'Aprobar cliente'}
          </button>
        </div>
      </section>

      {cliente.estado === 'aprobado' && (
        <CodigoDeAcceso cliente={cliente} handleError={handleError} />
      )}

      <section className="panel">
        <h3 className="panel__title">Historial</h3>
        <ul className="timeline">
          {historial.map((h, i) => (
            <li key={i}>
              <div className="timeline__top">
                <span className="timeline__version">{PASOS[h.accion] || h.accion}</span>
              </div>
              <div className="timeline__meta">
                {fmtDate(h.at)} · {h.por}
                {h.nota ? ` · «${h.nota}»` : ''}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function Clientes({ p }) {
  const { handleError, clientes, cargarClientes, abrirCliente, clienteAbierto } = p
  const [filtro, setFiltro] = useState('')

  useEffect(() => { cargarClientes() }, [cargarClientes])

  const lista = useMemo(
    () => (filtro ? clientes.lista.filter(c => c.estado === filtro) : clientes.lista),
    [clientes.lista, filtro]
  )

  if (clienteAbierto) {
    return (
      <Ficha
        id={clienteAbierto}
        onVolver={() => abrirCliente(null)}
        onCambio={cargarClientes}
        handleError={handleError}
      />
    )
  }

  return (
    <div className="view">
      <section className="panel">
        <div className="filtros">
          {FILTROS.map(f => (
            <button
              key={f.valor}
              className={`chip${filtro === f.valor ? ' on' : ''}`}
              onClick={() => setFiltro(f.valor)}
            >
              {f.etiqueta}
              {f.valor === 'pendiente' && clientes.pendientes > 0 && ` · ${clientes.pendientes}`}
            </button>
          ))}
        </div>

        {clientes.cargando ? (
          <div className="skeleton" style={{ height: 160, marginTop: 16 }} />
        ) : lista.length === 0 ? (
          <div className="empty-block">
            <h4>No hay solicitudes {filtro ? 'en este estado' : 'todavía'}</h4>
            <p>
              Las altas llegan desde el portal de clientes. Cuando una tienda se registre y
              envíe su documentación, aparecerá aquí para revisarla.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="mini wide">
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th>CIF</th>
                  <th>Población</th>
                  <th className="right">Docs</th>
                  <th>Enviada</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map(c => (
                  <tr key={c.id}>
                    <td>
                      <button className="linky" onClick={() => abrirCliente(c.id)}>{c.razonSocial}</button>
                      {c.nombreComercial && <span className="muted"> · {c.nombreComercial}</span>}
                    </td>
                    <td className="ref">{c.cif}</td>
                    <td>{c.poblacion}</td>
                    <td className="right num">{c.documentos}</td>
                    <td>{c.enviadoEn ? sinceText(c.enviadoEn) : <span className="muted">sin enviar</span>}</td>
                    <td><Estado estado={c.estado} enviadoEn={c.enviadoEn} /></td>
                    <td className="right">
                      <button className="btn small" onClick={() => abrirCliente(c.id)}>Abrir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
