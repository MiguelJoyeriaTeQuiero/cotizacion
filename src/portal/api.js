// Cliente del portal. La sesión viaja en una cookie HttpOnly propia
// (`tqm_cliente`), distinta de la del panel de TQM: aquí no se guarda ningún
// token ni nada en localStorage.

export class SinSesion extends Error {
  constructor(message = 'La sesión ha caducado') {
    super(message)
    this.name = 'SinSesion'
  }
}

export class ErrorApi extends Error {
  constructor(message, payload = {}, status = 0) {
    super(message)
    this.name = 'ErrorApi'
    this.payload = payload
    this.status = status
  }
}

// Quien está aquí es un cliente, y se dice en cada petición. Si no, en un
// navegador que tenga también abierto el panel de TQM —la misma máquina de la
// tienda, o alguien de casa probando el portal— mandaría la sesión del panel,
// que viaja a las mismas URLs, y el portal contestaría con otro sombrero.
const CABECERA_PORTAL = { 'X-TQM-Portal': '1' }

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body
        ? { ...CABECERA_PORTAL, 'Content-Type': 'application/json', Accept: 'application/json' }
        : { ...CABECERA_PORTAL, Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ErrorApi('No hay conexión con el servidor')
  }

  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new SinSesion(data.error)
  if (!res.ok) throw new ErrorApi(data.error || `Error ${res.status}`, data, res.status)
  return data
}

export const api = {
  sesion: () => request('/api/portal/cuenta'),
  entrar: (email, password) => request('/api/portal/cuenta', { method: 'POST', body: { accion: 'entrar', email, password } }),
  alta: (datos) => request('/api/portal/cuenta', { method: 'POST', body: { accion: 'alta', ...datos } }),
  enviar: () => request('/api/portal/cuenta', { method: 'POST', body: { accion: 'enviar' } }),
  salir: () => request('/api/portal/cuenta', { method: 'POST', body: { accion: 'salir' } }),
  olvide: (email) => request('/api/portal/cuenta', { method: 'POST', body: { accion: 'olvide', email } }),
  restablecer: (token, password) =>
    request('/api/portal/cuenta', { method: 'POST', body: { accion: 'restablecer', token, password } }),

  confirmarDocumento: (doc) => request('/api/portal/documentos', { method: 'POST', body: { accion: 'confirmar', ...doc } }),
  subirDocumentoLocal: (doc) => request('/api/portal/documentos', { method: 'POST', body: { accion: 'local', ...doc } }),
  etiquetarDocumento: (id, etiqueta) => request('/api/portal/documentos', { method: 'POST', body: { accion: 'etiqueta', id, etiqueta } }),
  quitarDocumento: (id) => request('/api/portal/documentos', { method: 'DELETE', body: { id } }),

  cierres: () => request('/api/cierres'),
  cierre: (ref) => request(`/api/cierres?ref=${encodeURIComponent(ref)}`),
  pedirCierre: (lineas) => request('/api/cierres', { method: 'POST', body: { lineas } }),
  anularCierre: (ref) => request('/api/cierres', { method: 'DELETE', body: { ref } }),

  precios: () => request('/api/prices'),
}
