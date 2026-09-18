import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, AuthError } from './api'
import { loadPrefs, savePrefs } from './lib/prefs'
import {
  METALS, fmtDec, greeting,
  toDraft, draftToSnapshot, draftErrors, countChanges,
} from './lib/formulas'
import { Resumen } from './views/Resumen'
import { Clientes } from './views/Clientes'
import { Cierres } from './views/Cierres'
import { Formulas } from './views/Formulas'
import { Simulador } from './views/Simulador'
import { Escenarios } from './views/Escenarios'
import { Historial } from './views/Historial'
import { Evolucion } from './views/Evolucion'
import { Opciones } from './views/Opciones'

// ─── Secciones ───────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'resumen',    label: 'Resumen',    title: 'Resumen',                    view: Resumen },
  { id: 'cierres',    label: 'Cierres',    title: 'Cierres pendientes',         view: Cierres },
  { id: 'clientes',   label: 'Clientes',   title: 'Altas de clientes',          view: Clientes },
  { id: 'formulas',   label: 'Fórmulas',   title: 'Fórmulas de precio',         view: Formulas },
  { id: 'simulador',  label: 'Simulador',  title: 'Simulador de mercado',       view: Simulador },
  { id: 'escenarios', label: 'Escenarios', title: 'Escenarios guardados',       view: Escenarios },
  { id: 'historial',  label: 'Historial',  title: 'Historial de publicaciones', view: Historial },
  { id: 'evolucion',  label: 'Evolución',  title: 'Evolución de precios',       view: Evolucion },
  { id: 'opciones',   label: 'Opciones',   title: 'Opciones',                   view: Opciones },
]

// Iconos dibujados aquí mismo: dos docenas de líneas frente a una dependencia
// entera, y así no hay ningún recurso externo que la CSP tenga que permitir.
const PATHS = {
  resumen: 'M3 13h4l2.5-6 3.5 12 2.5-6H21',
  cierres: 'M12 3.2 4.5 7v10L12 20.8 19.5 17V7zM4.5 7 12 10.8 19.5 7M12 10.8v10',
  clientes: 'M3.5 20v-1.4c0-2.2 2.8-3.6 6-3.6s6 1.4 6 3.6V20M9.5 4.4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M16.8 11.2a2.6 2.6 0 1 0 0-5.2M20.5 20v-1.3c0-1.1-.5-2-1.3-2.6',
  formulas: 'M4 6h16M4 12h16M4 18h16M9.5 4v16',
  simulador: 'M4 7h7M15 7h5M4 17h3M11 17h9M13 4.5v5M9 14.5v5',
  escenarios: 'M8 4h12v12M4 8h12v12H4z',
  historial: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v3.5h3.5M12 8v4.5l3 1.8',
  evolucion: 'M4 4v16h16M7.5 14.5l3.5-4 3 2.5 4.5-6',
  opciones: 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8',
}

function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

// ─── Cotización del momento ──────────────────────────────────────────────────

function Ticker({ market }) {
  const stale = !market || market.stale

  return (
    <div className="ticker">
      {Object.entries(METALS).map(([metal, cfg]) => {
        const fixing = market?.fixing?.[metal] ?? null
        const change = market?.change?.[metal] ?? null
        return (
          <div key={metal} className={`quote${metal === 'gold' ? ' gold' : ''}`}>
            <span className="quote__tag">{cfg.badge}</span>
            <span className="quote__value num">{fixing != null ? `${fmtDec(fixing, 2)} €` : '—'}</span>
            <span className="quote__unit">/ oz</span>
            {change != null && Math.abs(change) >= 0.01 && (
              <span className={`price__delta ${change > 0 ? 'up' : 'down'}`}>
                {change > 0 ? '▲' : '▼'} {fmtDec(Math.abs(change), 2)} %
              </span>
            )}
          </div>
        )
      })}
      <div className="ticker__state">
        <span className={`dot${stale ? ' stale' : ' live'}`} aria-hidden="true" />
        {stale ? 'Dato retrasado' : 'En vivo'}
      </div>
    </div>
  )
}

// ─── Menú de la cuenta ───────────────────────────────────────────────────────

function UserMenu({ user, onGo, onSignOut }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initials = user.name.trim().slice(0, 1).toUpperCase() || '·'

  return (
    <div className="usermenu" ref={box}>
      <button
        className="usermenu__button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="avatar" aria-hidden="true">{initials}</span>
        <span className="usermenu__name">{user.name}</span>
        <span className="usermenu__caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="menu" role="menu">
          <span className="menu__head">{greeting()}, {user.name}</span>
          <button role="menuitem" onClick={() => { setOpen(false); onGo('opciones') }}>Opciones</button>
          <a role="menuitem" href="/" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            Ver la web publicada
          </a>
          <hr />
          <button role="menuitem" className="danger" onClick={() => { setOpen(false); onSignOut() }}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Pantalla de acceso ──────────────────────────────────────────────────────

function Login({ onSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [status, setStatus] = useState({ busy: false, error: null })
  const [market, setMarket] = useState(null)
  const userRef = useRef(null)

  useEffect(() => { userRef.current?.focus() }, [])

  // La cotización es pública (es la que ve cualquier visitante de la web), así
  // que se puede dar la bienvenida con el mercado del momento.
  useEffect(() => { api.prices().then(setMarket).catch(() => {}) }, [])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (status.busy) return
    setStatus({ busy: true, error: null })
    try {
      const data = await api.login({ username: form.username, password: form.password })
      onSuccess(data.user)
    } catch (err) {
      const retry = err.payload?.retryAfter
      const suffix = retry ? ` Vuelve a intentarlo en ${Math.ceil(retry / 60)} min.` : ''
      setStatus({ busy: false, error: (err.message || 'No se ha podido iniciar sesión') + suffix })
      setForm(f => ({ ...f, password: '' }))
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit} autoComplete="off">
        <div className="login__mark">
          <span className="login__wordmark">Te Quiero Metales</span>
          <span className="login__rule" aria-hidden="true" />
        </div>

        <h1>Panel de fórmulas</h1>
        <p className="login__sub">Acceso restringido. Desde aquí se editan los precios que ve la web.</p>

        <div className="field">
          <label className="label" htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            className="input"
            ref={userRef}
            type="text"
            value={form.username}
            onChange={set('username')}
            autoComplete="username"
            spellCheck="false"
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="clave">Contraseña</label>
          <input
            id="clave"
            className="input"
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="current-password"
            required
          />
        </div>

        {status.error && <div className="alert error" role="alert">{status.error}</div>}

        <div className="login__actions">
          <button className="btn primary block" type="submit" disabled={status.busy}>
            {status.busy ? 'Comprobando…' : 'Entrar'}
          </button>
        </div>

        {market?.fixing && (
          <p className="login__foot">
            <span className={`dot${market.stale ? ' stale' : ' live'}`} aria-hidden="true" />
            El mercado ahora: oro <b className="num">{fmtDec(market.fixing.gold, 2)} €</b>,
            plata <b className="num">{fmtDec(market.fixing.silver, 2)} €</b> la onza.
          </p>
        )}
      </form>
    </div>
  )
}

// ─── Panel ───────────────────────────────────────────────────────────────────

function sectionFromHash() {
  const id = String(window.location.hash || '').replace(/^#\/?/, '')
  return SECTIONS.some(s => s.id === id) ? id : null
}

function Panel({ user, onSignedOut }) {
  const [prefs, setPrefs] = useState(loadPrefs)
  const [section, setSection] = useState(() => sectionFromHash() || prefs.inicio)
  const [draft, setDraft] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [docMeta, setDocMeta] = useState({ version: null, updatedAt: null, updatedBy: null, fixingAtPublish: null })
  const [market, setMarket] = useState(null)
  const [series, setSeries] = useState({ days: 30, samples: [], total: 0, loading: false })
  const [clientes, setClientes] = useState({ lista: [], pendientes: 0, cargando: true })
  const [clienteAbierto, setClienteAbierto] = useState(null)
  const [cierres, setCierres] = useState({ lista: [], pendientes: 0, cargando: true })
  const [cierreAbierto, setCierreAbierto] = useState(null)
  const [state, setState] = useState({ loading: true, saving: false, error: null, notice: null })

  useEffect(() => { savePrefs(prefs) }, [prefs])

  const handleError = useCallback((err) => {
    if (err instanceof AuthError) {
      onSignedOut()
      return true
    }
    return false
  }, [onSignedOut])

  // ── Navegación por el hash: recargar mantiene la sección abierta ──────────
  const goTo = useCallback((id) => {
    window.location.hash = `#/${id}`
    setSection(id)
    if (id !== 'clientes') setClienteAbierto(null)
    if (id !== 'cierres') setCierreAbierto(null)
  }, [])

  useEffect(() => {
    if (!sectionFromHash()) window.location.replace(`#/${section}`)
    const onHash = () => {
      const id = sectionFromHash()
      if (id) setSection(id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [section])

  // ── Carga ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const [doc, prices] = await Promise.all([api.getFormulas(), api.prices().catch(() => null)])
      const next = toDraft(doc)
      setDraft(next)
      setBaseline(JSON.stringify(next))
      setDocMeta({
        version: doc.version,
        updatedAt: doc.updatedAt,
        updatedBy: doc.updatedBy,
        fixingAtPublish: doc.fixingAtPublish ?? null,
      })
      setMarket(prices)
      setState({ loading: false, saving: false, error: null, notice: null })
    } catch (err) {
      if (handleError(err)) return
      setState({ loading: false, saving: false, error: err.message, notice: null })
    }
  }, [handleError])

  useEffect(() => { load() }, [load])

  const loadSeries = useCallback(async (days) => {
    setSeries(s => ({ ...s, loading: true }))
    try {
      const data = await api.series(days)
      setSeries({ days, samples: data.samples || [], total: data.total || 0, loading: false })
    } catch (err) {
      if (handleError(err)) return
      setSeries(s => ({ ...s, loading: false }))
    }
  }, [handleError])

  // Las altas se consultan al entrar: el aviso del menú tiene que estar desde el
  // primer momento, sin pasar por la sección.
  const cargarClientes = useCallback(async () => {
    setClientes(c => ({ ...c, cargando: true }))
    try {
      const data = await api.clientes()
      setClientes({ lista: data.clientes || [], pendientes: data.pendientes || 0, cargando: false })
    } catch (err) {
      if (handleError(err)) return
      setClientes(c => ({ ...c, cargando: false }))
    }
  }, [handleError])

  useEffect(() => { cargarClientes() }, [cargarClientes])

  const cargarCierres = useCallback(async () => {
    setCierres(c => ({ ...c, cargando: true }))
    try {
      const data = await api.cierres()
      setCierres({ lista: data.cierres || [], pendientes: data.pendientes || 0, cargando: false })
    } catch (err) {
      if (handleError(err)) return
      setCierres(c => ({ ...c, cargando: false }))
    }
  }, [handleError])

  useEffect(() => { cargarCierres() }, [cargarCierres])

  // ── Estado derivado ───────────────────────────────────────────────────────
  const published = useMemo(() => {
    const map = { gold: new Map(), silver: new Map() }
    for (const metal of ['gold', 'silver']) {
      for (const g of market?.[metal] || []) map[metal].set(g.key, g)
    }
    return map
  }, [market])

  const dirty = draft != null && JSON.stringify(draft) !== baseline

  const baselineDraft = useMemo(() => {
    try { return baseline ? JSON.parse(baseline) : null } catch { return null }
  }, [baseline])

  const changes = useMemo(() => countChanges(baselineDraft, draft), [baselineDraft, draft])
  const allErrors = useMemo(() => draftErrors(draft), [draft])

  // Aviso del navegador si se intenta cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const notify = useCallback((notice) => setState(s => ({ ...s, notice })), [])

  // El aviso se retira solo: no hace falta cerrarlo a mano.
  useEffect(() => {
    if (!state.notice) return
    const timer = setTimeout(() => setState(s => (s.notice ? { ...s, notice: null } : s)), 6000)
    return () => clearTimeout(timer)
  }, [state.notice])

  const save = async () => {
    if (!draft || allErrors.length || state.saving || !dirty) return
    setState(s => ({ ...s, saving: true, error: null, notice: null }))
    try {
      const saved = await api.saveFormulas({
        ...draftToSnapshot(draft),
        expectedVersion: docMeta.version ?? 0,
      })
      const next = toDraft(saved)
      setDraft(next)
      setBaseline(JSON.stringify(next))
      setDocMeta({
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: saved.updatedBy,
        fixingAtPublish: saved.fixingAtPublish ?? null,
      })
      setState({ loading: false, saving: false, error: null, notice: 'Cambios publicados en la web.' })
      api.prices().then(setMarket).catch(() => {})
    } catch (err) {
      if (handleError(err)) return
      const details = err.payload?.details
      setState(s => ({
        ...s,
        saving: false,
        error: details?.length ? `${err.message}: ${details.join(' · ')}` : err.message,
      }))
    }
  }

  // Ctrl/Cmd + S publica, como en cualquier editor.
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const signOut = async () => {
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Salir igualmente?')) return
    try { await api.logout() } catch { /* la sesión se cierra igual */ }
    onSignedOut()
  }

  if (state.loading) return <PanelSkeleton />

  if (!draft) {
    return (
      <div className="splash">
        <span className="splash__mark">Te Quiero Metales</span>
        <p>{state.error || 'No se han podido cargar las fórmulas.'}</p>
        <button className="btn" onClick={load}>Reintentar</button>
      </div>
    )
  }

  const current = SECTIONS.find(s => s.id === section) || SECTIONS[0]
  const View = current.view

  // Todo lo que comparten las secciones viaja en un solo objeto: son vistas de
  // un mismo borrador, no pantallas independientes.
  const panel = {
    user, prefs, setPrefs,
    draft, setDraft, baselineDraft, dirty, changes, allErrors,
    docMeta, market, published, series,
    clientes, cargarClientes, clienteAbierto, abrirCliente: setClienteAbierto,
    cierres, cargarCierres, cierreAbierto, abrirCierre: setCierreAbierto,
    loadSeries, notify, goTo, handleError, signOut, save, reload: load,
    saving: state.saving,
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="side__brand">
          <span className="side__wordmark">Te Quiero Metales</span>
          <span className="side__product">Panel</span>
        </div>

        <nav className="side__nav" aria-label="Secciones">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`navlink${s.id === section ? ' active' : ''}`}
              aria-current={s.id === section ? 'page' : undefined}
              onClick={() => goTo(s.id)}
            >
              <Icon name={s.id} />
              {s.label}
              {s.id === 'formulas' && dirty && <span className="navlink__dot" aria-label="con cambios sin publicar" />}
              {s.id === 'cierres' && cierres.pendientes > 0 && (
                <span className="navlink__num" aria-label={`${cierres.pendientes} cierres por confirmar`}>
                  {cierres.pendientes}
                </span>
              )}
              {s.id === 'clientes' && clientes.pendientes > 0 && (
                <span className="navlink__num" aria-label={`${clientes.pendientes} solicitudes por revisar`}>
                  {clientes.pendientes}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="side__foot">
          <span>Versión publicada</span>
          <b className="num">{docMeta.version ?? '—'}</b>
        </div>
      </aside>

      <div className="app__main">
        <header className="topbar">
          <h1 className="topbar__title">{current.title}</h1>
          <Ticker market={market} />
          <UserMenu user={user} onGo={goTo} onSignOut={signOut} />
        </header>

        <main className="content">
          {state.error && section !== 'formulas' && (
            <div className="alert error" role="alert">{state.error}</div>
          )}
          <View p={panel} />
        </main>
      </div>

      <footer className={`actionbar${dirty ? ' dirty' : ''}`}>
        <span className="actionbar__state" aria-live="polite">
          <span className="dot" aria-hidden="true" />
          {dirty
            ? `${changes} ${changes === 1 ? 'cambio' : 'cambios'} sin publicar`
            : 'Todo publicado'}
        </span>
        {allErrors.length > 0 && (
          <button className="linky warn" onClick={() => goTo('formulas')}>
            {allErrors.length} {allErrors.length === 1 ? 'error' : 'errores'} que corregir
          </button>
        )}
        <button className="btn ghost" onClick={load} disabled={!dirty || state.saving}>
          Descartar
        </button>
        <button
          className={`btn primary${dirty && !allErrors.length ? ' armed' : ''}`}
          onClick={save}
          disabled={!dirty || state.saving || allErrors.length > 0}
        >
          {state.saving ? 'Publicando…' : 'Guardar y publicar'}
          <span className="kbd" aria-hidden="true">Ctrl S</span>
        </button>
      </footer>

      {state.notice && (
        <div className="toast" role="status">
          <span className="dot" aria-hidden="true" />
          {state.notice}
        </div>
      )}
    </div>
  )
}

// Esqueleto de carga: mantiene la forma de la pantalla en vez de dejar un
// mensaje suelto en mitad de la nada.
function PanelSkeleton() {
  return (
    <div className="app">
      <aside className="side">
        <div className="side__brand">
          <span className="side__wordmark">Te Quiero Metales</span>
          <span className="side__product">Panel</span>
        </div>
        <nav className="side__nav">
          {SECTIONS.map(s => (
            <span className="navlink" key={s.id}><Icon name={s.id} />{s.label}</span>
          ))}
        </nav>
      </aside>
      <div className="app__main">
        <header className="topbar"><h1 className="topbar__title">Cargando…</h1></header>
        <main className="content" aria-busy="true">
          <div className="ledger">
            {[0, 1, 2, 3, 4].map(i => (
              <div className="skeleton-row" key={i}>
                {Array.from({ length: 7 }, (_, j) => <div className="skeleton" key={j} />)}
                <div />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Raíz ────────────────────────────────────────────────────────────────────

export default function AdminApp() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    api.session()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return (
      <div className="splash">
        <span className="splash__mark">Te Quiero Metales</span>
        <p>Comprobando la sesión…</p>
      </div>
    )
  }
  if (!user) return <Login onSuccess={setUser} />
  return <Panel user={user} onSignedOut={() => setUser(null)} />
}
