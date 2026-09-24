import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

// Tarifa del portal. Antes se pedía una sola vez al abrir la pantalla, así que
// un cambio de fórmulas en el panel no llegaba al cliente hasta que recargaba.
// Ahora se vuelve a pedir al ritmo que marque el panel (con los mismos topes
// que la web pública) y, además, en cuanto la pestaña vuelve a estar visible.
// Pedirla no consume cuota de la API de mercado: responde la caché del servidor.

const POLL_MIN_MS = 30_000
const POLL_MAX_MS = 600_000
const POLL_FALLBACK_MS = 60_000

function pollInterval(refreshSeconds) {
  const ms = Number(refreshSeconds) * 1000
  if (!Number.isFinite(ms) || ms <= 0) return POLL_FALLBACK_MS
  return Math.min(POLL_MAX_MS, Math.max(POLL_MIN_MS, ms))
}

export function usePrecios({ onError } = {}) {
  const [precios, setPrecios] = useState(null)

  // En una referencia para que un callback nuevo en cada render no rearme el
  // temporizador ni dispare peticiones de más.
  const avisar = useRef(onError)
  avisar.current = onError
  const hayTarifa = useRef(false)

  const recargar = useCallback(async () => {
    try {
      setPrecios(await api.precios())
      hayTarifa.current = true
    } catch (err) {
      // Se conserva la última tarifa buena en lugar de dejar la tabla vacía, y
      // un fallo puntual de un refresco no se le enseña al cliente.
      if (!hayTarifa.current) avisar.current?.(err.message)
    }
  }, [])

  useEffect(() => { recargar() }, [recargar])

  const pollMs = pollInterval(precios?.refreshSeconds)

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') recargar()
    }, pollMs)
    const alVolver = () => { if (document.visibilityState === 'visible') recargar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [recargar, pollMs])

  return { precios, recargar }
}
