import { randomToken, sha256 } from './crypto.js'
import { putSession, readSessionRecord, touchSession, deleteSession } from './store.js'
import { json, parseCookies, serializeCookie, clientIp } from './http.js'

export const COOKIE_NAME = 'tqm_admin'

// Caducidad absoluta: aunque se esté trabajando, a las 12 h hay que volver a
// identificarse. Caducidad por inactividad: 45 min sin tocar el panel.
const ABSOLUTE_TTL = 12 * 60 * 60
const IDLE_TTL = 45 * 60

/**
 * Cuentas con acceso al panel. Se leen de variables de entorno (y no de la base
 * de datos) para que ni siquiera alguien con acceso a Redis pueda añadirse una
 * cuenta. Hay dos formas de definirlas, por orden de prioridad:
 *
 * 1. Modo sencillo — una sola cuenta, sin JSON ni scripts:
 *
 *      ADMIN_USER=miguel
 *      ADMIN_PASSWORD=la-contraseña-que-quieras
 *      ADMIN_NAME=Miguel            (opcional, solo el nombre que se muestra)
 *
 * 2. Varias cuentas — array JSON en ADMIN_USERS. El campo `password` acepta
 *    tanto texto plano como un hash `scrypt$...` de `npm run credenciales`:
 *
 *      [{"username":"miguel","name":"Miguel","password":"..."}]
 *
 * Sin nada configurado y ejecutando en el propio ordenador se activa una cuenta
 * de desarrollo (admin / admin) para poder abrir el panel. En Vercel ese atajo
 * nunca se aplica: sin variables no hay acceso.
 */
const DEV_USER = { username: 'admin', name: 'Administrador', password: 'admin' }
const isLocalDev = !process.env.VERCEL && process.env.NODE_ENV !== 'production'

function normalize(user) {
  return {
    username: String(user.username).trim().toLowerCase(),
    name: typeof user.name === 'string' && user.name.trim() ? user.name.trim() : String(user.username).trim(),
    password: String(user.password),
  }
}

export function getUsers() {
  const simpleUser = String(process.env.ADMIN_USER ?? '').trim()
  const simplePassword = String(process.env.ADMIN_PASSWORD ?? '')
  if (simpleUser && simplePassword) {
    return [normalize({
      username: simpleUser,
      name: process.env.ADMIN_NAME,
      password: simplePassword,
    })]
  }

  const raw = process.env.ADMIN_USERS
  if (raw) {
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error('[auth] ADMIN_USERS no es un JSON válido')
      return []
    }
    if (!Array.isArray(parsed)) {
      console.error('[auth] ADMIN_USERS debe ser un array')
      return []
    }
    const users = parsed
      .filter(u => u && typeof u.username === 'string' && typeof u.password === 'string' && u.password)
      .map(normalize)
    if (users.length) return users
  }

  if (isLocalDev) {
    console.warn(
      '[auth] Sin ADMIN_USER/ADMIN_PASSWORD configurados: usando la cuenta de\n' +
      '       desarrollo admin / admin (solo en local, nunca en Vercel).'
    )
    return [normalize(DEV_USER)]
  }
  return []
}

export function findUser(username) {
  const target = String(username ?? '').trim().toLowerCase()
  if (!target) return null
  return getUsers().find(u => u.username === target) || null
}

export async function startSession(res, user, req) {
  const token = randomToken(32)
  const record = {
    username: user.username,
    name: user.name,
    ip: clientIp(req),
    ua: String(req.headers['user-agent'] || '').slice(0, 180),
    createdAt: Date.now(),
    expiresAt: Date.now() + ABSOLUTE_TTL * 1000,
  }
  await putSession(sha256(token), record, IDLE_TTL)
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, token, { maxAge: ABSOLUTE_TTL }))
  return record
}

export async function endSession(req, res) {
  const token = parseCookies(req)[COOKIE_NAME]
  if (token) await deleteSession(sha256(token))
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', { maxAge: 0 }))
}

/**
 * Devuelve la sesión válida o null. Comprueba además que la cuenta siga
 * existiendo en ADMIN_USERS: si se retira a alguien de la variable de entorno,
 * su sesión abierta deja de funcionar en la siguiente petición.
 */
export async function readSession(req) {
  const token = parseCookies(req)[COOKIE_NAME]
  if (!token || typeof token !== 'string' || token.length < 20) return null

  const hash = sha256(token)
  const record = await readSessionRecord(hash)
  if (!record || typeof record !== 'object') return null

  if (!record.expiresAt || Date.now() > record.expiresAt) {
    await deleteSession(hash)
    return null
  }
  if (!findUser(record.username)) {
    await deleteSession(hash)
    return null
  }

  // Renueva la ventana de inactividad sin pasarse de la caducidad absoluta.
  const remaining = Math.floor((record.expiresAt - Date.now()) / 1000)
  await touchSession(hash, Math.min(IDLE_TTL, Math.max(remaining, 1)))
  return record
}

/**
 * Guardia para los endpoints del panel. Si no hay sesión responde 401 y
 * devuelve null; el llamante solo tiene que hacer `if (!session) return`.
 */
export async function requireSession(req, res) {
  const session = await readSession(req)
  if (!session) {
    res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', { maxAge: 0 }))
    json(res, 401, { error: 'Sesión no válida o caducada' })
    return null
  }
  return session
}
