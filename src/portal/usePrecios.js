import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useRefresco } from '../shared/refresco'

// Tarifa del portal. Antes se pedía una sola vez al abrir la pantalla, así que
// un cambio de fórmulas en el panel no llegaba al cliente hasta que recargaba.
// Ahora se vuelve a pedir en cuanto caduca la cotización, igual que en la web
// pública (ver shared/refresco.js); con la pestaña oculta se espera a que
// vuelva. Pedirla no consume cuota de la API de mercado: responde la caché del
// servidor.

export function usePrecios({ onError } = {}) {
  const [precios, setPrecios] = useState(null)
  const [ronda, setRonda] = useState(0)

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
    } finally {
      setRonda(n => n + 1)
    }
  }, [])

  useEffect(() => { recargar() }, [recargar])

  useRefresco(recargar, precios, ronda)

  return { precios, recargar }
}
