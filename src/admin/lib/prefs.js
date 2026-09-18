// Preferencias de la interfaz. Viven en el navegador de cada uno: no son datos
// del negocio y no tiene sentido publicarlas ni guardarlas en el servidor.
//
// Aquí no se guarda nada de la sesión: esa sigue viajando en una cookie
// HttpOnly que el JavaScript de la página no puede leer.

const KEY = 'tqm.panel.prefs'

export const DEFAULT_PREFS = {
  inicio: 'resumen',        // sección en la que abre el panel
  densidad: 'comoda',       // 'comoda' | 'compacta'
  confirmarBorrado: true,   // preguntar antes de eliminar una ley
  mostrarMargen: true,      // columna de margen en la tabla de fórmulas
  rangoEvolucion: 30,       // ventana por defecto de la gráfica, en días
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const saved = JSON.parse(raw)
    // Campo a campo: una clave inesperada guardada a mano no entra.
    const out = { ...DEFAULT_PREFS }
    for (const key of Object.keys(DEFAULT_PREFS)) {
      if (saved[key] !== undefined && typeof saved[key] === typeof DEFAULT_PREFS[key]) {
        out[key] = saved[key]
      }
    }
    return out
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* modo privado o almacenamiento lleno: se sigue trabajando sin recordar */
  }
}
