// Cliente del panel. La sesión viaja en una cookie HttpOnly que el JavaScript
// no puede leer: aquí no se guarda ningún token ni nada en localStorage.

export class AuthError extends Error {
  constructor(message = 'Sesión no válida o caducada') {
    super(message)
    this.name = 'AuthError'
  }
}

export class ApiError extends Error {
  constructor(message, payload = {}, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.payload = payload
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('No hay conexión con el servidor')
  }

  const data = await res.json().catch(() => ({}))

  if (res.status === 401) throw new AuthError(data.error)
  if (!res.ok) throw new ApiError(data.error || `Error ${res.status}`, data, res.status)
  return data
}

export const api = {
  session: () => request('/api/admin/session'),
  login: (credentials) => request('/api/admin/login', { method: 'POST', body: credentials }),
  logout: () => request('/api/admin/logout', { method: 'POST' }),
  getFormulas: () => request('/api/admin/formulas'),
  saveFormulas: (payload) => request('/api/admin/formulas', { method: 'PUT', body: payload }),
  history: () => request('/api/admin/history'),
  series: (days = 30) => request(`/api/admin/series?days=${days}`),
  scenarios: () => request('/api/admin/scenarios'),
  saveScenario: (name, snapshot) => request('/api/admin/scenarios', { method: 'PUT', body: { name, snapshot } }),
  deleteScenario: (name) => request('/api/admin/scenarios', { method: 'DELETE', body: { name } }),
  clientes: () => request('/api/admin/clientes'),
  cliente: (id) => request(`/api/admin/clientes?id=${encodeURIComponent(id)}`),
  decidirCliente: (payload) => request('/api/admin/clientes', { method: 'PUT', body: payload }),
  codigoClave: (id) => request('/api/admin/clientes', { method: 'PUT', body: { accion: 'clave', id } }),
  // El documento se abre en una pestaña: la cookie de sesión viaja con ella.
  urlDocumento: (id, doc) =>
    `/api/admin/clientes?id=${encodeURIComponent(id)}&doc=${encodeURIComponent(doc)}`,
  cierres: () => request('/api/cierres'),
  cierre: (ref) => request(`/api/cierres?ref=${encodeURIComponent(ref)}`),
  decidirCierre: (payload) => request('/api/cierres', { method: 'PUT', body: payload }),
  ajustarCierre: (payload) => request('/api/cierres', { method: 'PUT', body: { ...payload, accion: 'ajustar' } }),
  // El justificante y el bloque para el ERP se piden a la misma URL: uno se
  // abre en una pestaña y el otro se lee en texto, para copiarlo.
  urlJustificante: (ref) => `/api/cierres?ref=${encodeURIComponent(ref)}&formato=pdf`,
  urlCsvCierre: (ref) => `/api/cierres?ref=${encodeURIComponent(ref)}&formato=csv`,
  csvCierre: async (ref) => {
    const res = await fetch(`/api/cierres?ref=${encodeURIComponent(ref)}&formato=csv`, {
      credentials: 'same-origin',
    })
    if (res.status === 401) throw new AuthError()
    if (!res.ok) throw new ApiError(`No se ha podido preparar el bloque (${res.status})`, {}, res.status)
    return (await res.text()).replace(/^﻿/, '')
  },
  prices: () => request('/api/prices'),
}
