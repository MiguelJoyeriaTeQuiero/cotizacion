import { DEFAULT_PREFS } from '../lib/prefs'
import { REFRESH_OPTIONS, monthlyCalls, fmtDate, LIMITS } from '../lib/formulas'

// Dos naturalezas distintas en la misma pantalla, y conviene que se note:
// arriba lo que cambia la web y hay que publicar; abajo lo que solo afecta a
// cómo se ve el panel en este navegador y tiene efecto al instante.

const SECCIONES = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'formulas', label: 'Fórmulas' },
  { value: 'simulador', label: 'Simulador' },
  { value: 'evolucion', label: 'Evolución' },
]

export function Opciones({ p }) {
  const { draft, setDraft, baselineDraft, prefs, setPrefs, user, market, series, signOut } = p

  const refreshPending = baselineDraft && draft.refreshSeconds !== baselineDraft.refreshSeconds
  const divisorPending = baselineDraft && String(draft.divisor) !== String(baselineDraft.divisor)

  const set = (key) => (value) => setPrefs(x => ({ ...x, [key]: value }))

  return (
    <div className="view">
      <section className="panel">
        <h3 className="panel__title">Ajustes de la web</h3>
        <p className="note tight">
          Se publican con el resto de los cambios, con el botón <strong>Guardar y publicar</strong>.
        </p>

        <div className="option">
          <div className="option__text">
            <label className="label" htmlFor="frecuencia">Consultar el precio de mercado</label>
            <p className="note tight">
              Cada cuánto se le pide la cotización a la API. Entre consulta y consulta el precio
              sale de la caché, así que esto no retrasa tus cambios de fórmula: solo gobierna la
              cuota. Como mucho{' '}
              <strong>{monthlyCalls(draft.refreshSeconds).toLocaleString('es-ES')} llamadas al mes</strong>.
            </p>
          </div>
          <div className="option__control">
            <select
              id="frecuencia"
              className="select"
              value={draft.refreshSeconds}
              onChange={(e) => setDraft(d => ({ ...d, refreshSeconds: Number(e.target.value) }))}
            >
              {REFRESH_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {refreshPending && <span className="pending"><span className="dot stale" aria-hidden="true" /> Sin publicar</span>}
          </div>
        </div>

        <div className="option">
          <div className="option__text">
            <label className="label" htmlFor="divisor">Divisor (gramos por onza)</label>
            <p className="note tight">
              Los gramos que tiene una onza troy en el cálculo. Lo normal es 31,1; entre{' '}
              {LIMITS.divisor.min} y {LIMITS.divisor.max}.
            </p>
          </div>
          <div className="option__control">
            <input
              id="divisor"
              className="input num"
              type="text"
              inputMode="decimal"
              value={draft.divisor}
              onChange={(e) => setDraft(d => ({ ...d, divisor: e.target.value }))}
            />
            {divisorPending && <span className="pending"><span className="dot stale" aria-hidden="true" /> Sin publicar</span>}
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__title">Este panel</h3>
        <p className="note tight">
          Solo afecta a cómo lo ves tú, en este navegador. No se publica ni se comparte.
        </p>

        <div className="option">
          <div className="option__text">
            <label className="label" htmlFor="inicio">Abrir el panel en</label>
          </div>
          <div className="option__control">
            <select
              id="inicio"
              className="select"
              value={prefs.inicio}
              onChange={(e) => set('inicio')(e.target.value)}
            >
              {SECCIONES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="option">
          <div className="option__text">
            <label className="label" htmlFor="densidad">Altura de las filas</label>
            <p className="note tight">Compacta entra más tabla en pantalla; cómoda se lee mejor.</p>
          </div>
          <div className="option__control">
            <select
              id="densidad"
              className="select"
              value={prefs.densidad}
              onChange={(e) => set('densidad')(e.target.value)}
            >
              <option value="comoda">Cómoda</option>
              <option value="compacta">Compacta</option>
            </select>
          </div>
        </div>

        <label className="option option--check">
          <input
            type="checkbox"
            checked={prefs.mostrarMargen}
            onChange={(e) => set('mostrarMargen')(e.target.checked)}
          />
          <span className="option__text">
            <span className="label">Columna de margen en las fórmulas</span>
            <span className="note tight">Cuánto te llevas sobre el valor del metal, ley por ley.</span>
          </span>
        </label>

        <label className="option option--check">
          <input
            type="checkbox"
            checked={prefs.confirmarBorrado}
            onChange={(e) => set('confirmarBorrado')(e.target.checked)}
          />
          <span className="option__text">
            <span className="label">Preguntar antes de eliminar una ley</span>
            <span className="note tight">Quítalo solo si estás reorganizando la tabla a fondo.</span>
          </span>
        </label>

        <button
          className="btn small"
          onClick={() => setPrefs({ ...DEFAULT_PREFS })}
        >
          Restablecer las preferencias
        </button>
      </section>

      <section className="panel">
        <h3 className="panel__title">Cuenta y estado</h3>
        <dl className="stats">
          <div className="stat">
            <dt>Sesión</dt>
            <dd>{user.name} <small>{user.username}</small></dd>
          </div>
          <div className="stat">
            <dt>Última consulta al mercado</dt>
            <dd>{market?.fetchedAt ? fmtDate(new Date(market.fetchedAt).toISOString()) : '—'}</dd>
          </div>
          <div className="stat">
            <dt>Muestras guardadas</dt>
            <dd className="num">{series.total}</dd>
          </div>
        </dl>
        <button className="btn" onClick={signOut}>Cerrar sesión</button>
      </section>
    </div>
  )
}
