import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Diff } from '../components/Diff'
import { toDraft, fmtDate, sinceText } from '../lib/formulas'

// Las últimas 50 publicaciones, con quién y cuándo. Cada una se puede abrir
// para ver exactamente qué cambió respecto a la anterior y cuánto movió el
// precio de cada ley.

export function Historial({ p }) {
  const { docMeta, market, setDraft, notify, goTo, handleError } = p
  const [entries, setEntries] = useState([])
  const [open, setOpen] = useState(null)
  const [state, setState] = useState({ loading: true, error: null })

  const load = useCallback(async () => {
    setState({ loading: true, error: null })
    try {
      const data = await api.history()
      setEntries(data.entries || [])
      setState({ loading: false, error: null })
    } catch (err) {
      if (handleError(err)) return
      setState({ loading: false, error: err.message })
    }
  }, [handleError])

  useEffect(() => { load() }, [load])

  const cargar = (entry) => {
    if (!window.confirm(`¿Cargar la versión ${entry.version} en el editor? Todavía no se publicará: tendrás que pulsar «Guardar y publicar».`)) return
    setDraft(toDraft(entry.snapshot))
    notify(`Versión ${entry.version} cargada en el editor. Revísala y publícala.`)
    goTo('formulas')
  }

  return (
    <div className="view">
      <section className="panel">
        <h3 className="panel__title">Publicaciones</h3>

        {state.error && <div className="alert error" role="alert">{state.error}</div>}

        {state.loading ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : entries.length === 0 ? (
          <div className="empty-block">
            <h4>Todavía no hay cambios registrados</h4>
            <p>Cada vez que publiques, la versión anterior quedará aquí guardada para poder volver a ella.</p>
          </div>
        ) : (
          <ul className="timeline">
            {entries.map((entry, i) => {
              const previous = entries[i + 1]
              const isCurrent = entry.version === docMeta.version
              const opened = open === entry.version
              return (
                <li key={entry.version} className={isCurrent ? 'current' : ''}>
                  <div className="timeline__top">
                    <span className="timeline__version">Versión {entry.version}</span>
                    {isCurrent && <span className="tag">En la web</span>}
                  </div>
                  <div className="timeline__meta">
                    {fmtDate(entry.at)}
                    {sinceText(entry.at) ? ` · ${sinceText(entry.at)}` : ''} · {entry.by}
                    {entry.snapshot
                      ? ` · ${entry.snapshot.gold?.length ?? 0} leyes de oro, ${entry.snapshot.silver?.length ?? 0} de plata`
                      : ''}
                  </div>

                  {entry.snapshot && (
                    <div className="timeline__actions">
                      <button
                        className="btn small"
                        onClick={() => setOpen(opened ? null : entry.version)}
                        disabled={!previous?.snapshot}
                        title={previous?.snapshot
                          ? 'Comparar con la versión anterior'
                          : 'Es la publicación más antigua que se conserva'}
                      >
                        {opened ? 'Ocultar cambios' : 'Ver qué cambió'}
                      </button>
                      {!isCurrent && (
                        <button className="btn small" onClick={() => cargar(entry)}>
                          Cargar en el editor
                        </button>
                      )}
                    </div>
                  )}

                  {opened && previous?.snapshot && (
                    <Diff
                      before={toDraft(previous.snapshot)}
                      after={toDraft(entry.snapshot)}
                      fixing={market?.fixing}
                      nameBefore={`Versión ${previous.version}`}
                      nameAfter={`Versión ${entry.version}`}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
