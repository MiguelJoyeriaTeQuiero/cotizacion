// Utilidades comunes de las funciones serverless.

export function json(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (!headers['Cache-Control']) res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '))
  json(res, 405, { error: 'Método no permitido' })
}

/**
 * Cuerpo de la petición como objeto. Vercel ya parsea JSON en req.body, pero
 * leemos el stream manualmente como respaldo y limitamos el tamaño para que un
 * cuerpo enorme no consuma memoria de la función.
 */
export async function readJson(req, maxBytes = 64 * 1024) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) {
      const err = new Error('Cuerpo de la petición demasiado grande')
      err.code = 'BODY_TOO_LARGE'
      throw err
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const err = new Error('JSON no válido')
    err.code = 'BAD_JSON'
    throw err
  }
}

function requestHost(req) {
  return req.headers['x-forwarded-host'] || req.headers.host || ''
}

/**
 * Defensa CSRF: en peticiones que modifican estado exigimos cabecera Origin y
 * que coincida con el host de la petición. Los navegadores siempre la envían en
 * POST/PUT, así que un formulario alojado en otro dominio no puede pasar.
 * Se combina con la cookie SameSite=Strict.
 */
export function isSameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return false
  try {
    return new URL(origin).host === requestHost(req)
  } catch {
    return false
  }
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim()
  return req.socket?.remoteAddress || 'desconocida'
}

export function parseCookies(req) {
  if (req.cookies && typeof req.cookies === 'object') return req.cookies
  const header = req.headers.cookie
  if (!header) return {}
  const out = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const name = part.slice(0, idx).trim()
    if (!name) continue
    out[name] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

export function serializeCookie(name, value, { maxAge, expires } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict']
  // En desarrollo local (http://localhost) Secure impediría guardar la cookie.
  const isLocal = process.env.VERCEL_ENV === 'development' || !process.env.VERCEL
  if (!isLocal) parts.push('Secure')
  if (typeof maxAge === 'number') parts.push(`Max-Age=${Math.floor(maxAge)}`)
  if (expires) parts.push(`Expires=${expires}`)
  return parts.join('; ')
}
