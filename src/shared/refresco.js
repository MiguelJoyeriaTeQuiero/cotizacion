import { useEffect } from 'react'

// Cuándo vuelven a pedir la tarifa la web y el portal.
//
// La cotización caduca a una hora que se sabe: la de la consulta (fetchedAt)
// más la frecuencia elegida en el panel. Se pregunta justo después, y no a
// intervalos fijos contados desde que se abrió la pestaña: con un reloj propio,
// cada pestaña podía ir una vuelta entera por detrás del mercado. Pedirla no
// consume cuota de la API de mercado; cuándo se consulta lo decide el servidor.

// Acotado: ni tan seguido que sobre, ni tan espaciado que una pestaña abierta
// se quede con fórmulas de hace horas cuando la frecuencia es larga.
const PERIODO_MIN_MS = 30_000
const PERIODO_MAX_MS = 600_000
const PERIODO_RESPALDO_MS = 60_000

// Pasada la caducidad, un margen para que el servidor tenga ya la nueva, y un
// reparto al azar para que no lleguen todas las pestañas en el mismo segundo.
const MARGEN_MS = 2_000
const REPARTO_MS = 3_000

// Si la cotización recibida ya había caducado (otra petición la estaba
// renovando, o el reloj del equipo va adelantado), se vuelve a mirar pronto.
const REINTENTO_MS = 5_000

/** Cada cuánto se pregunta cuando no hay una caducidad a la que apuntar. */
export function periodoRefresco(refreshSeconds) {
  const ms = Number(refreshSeconds) * 1000
  if (!Number.isFinite(ms) || ms <= 0) return PERIODO_RESPALDO_MS
  return Math.min(PERIODO_MAX_MS, Math.max(PERIODO_MIN_MS, ms))
}

/** Milisegundos hasta la próxima petición, a partir de la última tarifa recibida. */
export function esperaRefresco(tarifa, ahora = Date.now(), azar = Math.random()) {
  const periodo = periodoRefresco(tarifa?.refreshSeconds)
  // Con el dato retrasado o el de emergencia no hay caducidad: el servidor
  // reintenta a su ritmo y aquí se pregunta cada periodo.
  if (tarifa?.stale || typeof tarifa?.fetchedAt !== 'number') return periodo
  const caduca = tarifa.fetchedAt + Number(tarifa.refreshSeconds) * 1000
  if (!Number.isFinite(caduca)) return periodo
  const espera = caduca - ahora + MARGEN_MS + azar * REPARTO_MS
  return Math.round(Math.min(periodo, Math.max(REINTENTO_MS, espera)))
}

/**
 * Vuelve a llamar a `pedir` cuando caduca `tarifa`. Con la pestaña oculta no
 * pide nada: si vence mientras tanto, pide al volver. `ronda` tiene que cambiar
 * en cada intento, salga bien o mal, para que un fallo no pare el refresco.
 */
export function useRefresco(pedir, tarifa, ronda) {
  useEffect(() => {
    let pendiente = false
    const visible = () => document.visibilityState === 'visible'

    const vence = () => {
      if (!visible()) { pendiente = true; return }
      pendiente = false
      pedir()
      // Si la petición se quedara colgada, el refresco no se para: se vuelve a
      // probar al cabo de un periodo. Lo normal es que antes llegue la
      // respuesta, cambie la ronda y esto se reprograme.
      id = setTimeout(vence, periodoRefresco(tarifa?.refreshSeconds))
    }
    let id = setTimeout(vence, esperaRefresco(tarifa))

    const alVolver = () => { if (pendiente) vence() }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [pedir, tarifa, ronda])
}
