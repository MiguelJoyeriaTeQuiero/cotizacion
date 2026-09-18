import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Diff } from '../components/Diff'
import { draftToSnapshot, toDraft, fmtDate, draftErrors } from '../lib/formulas'

// Escenarios: juegos de fórmulas guardados con nombre que no están publicados.
// Sirven para dejar preparada una subida de márgenes, compararla con lo que hay
// en la web y cargarla el día que toque.

export function Escenarios({ p }) {
  const { draft, baselineDraft, market, setDraft, notify, goTo, handleError } = p
  const [list, setList] = useState([])
  const [max, setMax] = useState(12)
  const [name, setName] = useState('')
  const [open, setOpen] = useState(null)
  const [state, setState] = useState({ loading: true, busy: false, error: null })

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await api.scenarios()
      setList(data.scenarios || [])
      setMax(data.max || 12)
      setState({ loading: false, busy: false, error: null })
    } catch (err) {
      if (handleError(err)) return
      setState({ loading: false, busy: false, error: err.message })
    }
  }, [handleError])

  useEffect(() => { load() }, [load])

  const errors = draftErrors(draft)

  const save = async () => {
    const clean = name.trim()
    if (!clean || state.busy) return
    if (errors.length) {
      setState(s => ({ ...s, error: 'Corrige los errores del editor antes de guardar el escenario.' }))
      return
    }
    setState(s => ({ ...s, busy: true, error: null }))
    try {
      const data = await api.saveScenario(clean, draftToSnapshot(draft))
      setList(data.scenarios || [])
      setName('')
      setState({ loading: false, busy: false, error: null })
      notify(`Escenario «${clean}» guardado. No se ha publicado nada.`)
    } catch (err) {
      if (handleError(err)) return
      const details = err.payload?.details
      setState(s => ({
        ...s,
        busy: false,
        error: details?.length ? `${err.message}: ${details.join(' · ')}` : err.message,
      }))
    }
  }

  const remove = async (entry) => {
    if (!window.confirm(`¿Eliminar el escenario «${entry.name}»?`)) return
    try {
      const data = await api.deleteScenario(entry.name)
      setList(data.scenarios || [])
      if (open === entry.name) setOpen(null)
    } catch (err) {
      if (handleError(err)) return
      setState(s => ({ ...s, error: err.message }))
    }
  }

  const cargar = (entry) => {
    if (!window.confirm(`¿Cargar «${entry.name}» en el editor? Todavía no se publicará: tendrás que pulsar «Guardar y publicar».`)) return
    setDraft(toDraft(entry.snapshot))
    notify(`«${entry.name}» cargado en el editor. Revísalo y publícalo cuando quieras.`)
    goTo('formulas')
  }

  return (
    <div className="view">
      <section className="panel">
        <h3 className="panel__title">Guardar lo que hay en el editor</h3>
        <div className="inline-form">
          <input
            className="input"
            type="text"
            value={name}
            maxLength={40}
            placeholder="Márgenes de verano"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
            aria-label="Nombre del escenario"
          />
          <button className="btn primary" onClick={save} disabled={!name.trim() || state.busy}>
            {state.busy ? 'Guardando…' : 'Guardar escenario'}
          </button>
        </div>
        <p className="note">
          Se guarda tal y como está el editor ahora mismo, <strong>sin publicar nada en la web</strong>.
          Repetir el nombre reemplaza el escenario anterior. Caben {max}.
        </p>
        {state.error && <div className="alert error" role="alert">{state.error}</div>}
      </section>

      <section className="panel">
        <h3 className="panel__title">Escenarios guardados</h3>

        {state.loading ? (
          <div className="skeleton" style={{ height: 72 }} />
        ) : list.length === 0 ? (
          <div className="empty-block">
            <h4>Todavía no hay ninguno</h4>
            <p>
              Un escenario es una versión de las fórmulas que se queda esperando: la preparas
              con calma, la comparas con lo que está publicado y la cargas el día que decidas.
            </p>
          </div>
        ) : (
          <ul className="cards">
            {list.map(entry => (
              <li className="card" key={entry.name}>
                <div className="card__head">
                  <div>
                    <strong className="card__title">{entry.name}</strong>
                    <span className="card__meta">
                      {fmtDate(entry.savedAt)} · {entry.savedBy} ·{' '}
                      {entry.snapshot?.gold?.length ?? 0} leyes de oro, {entry.snapshot?.silver?.length ?? 0} de plata
                    </span>
                  </div>
                  <div className="card__actions">
                    <button
                      className="btn small"
                      onClick={() => setOpen(open === entry.name ? null : entry.name)}
                    >
                      {open === entry.name ? 'Ocultar' : 'Comparar'}
                    </button>
                    <button className="btn small" onClick={() => cargar(entry)}>Cargar</button>
                    <button className="btn small danger" onClick={() => remove(entry)}>Eliminar</button>
                  </div>
                </div>

                {open === entry.name && (
                  <Diff
                    before={baselineDraft}
                    after={toDraft(entry.snapshot)}
                    fixing={market?.fixing}
                    nameBefore="Publicado"
                    nameAfter={entry.name}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
