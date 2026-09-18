import { json, methodNotAllowed, readJson, isSameOrigin, clientIp } from '../_lib/http.js'
import { checkPassword, burnPasswordTime } from '../_lib/crypto.js'
import { findUser, getUsers, startSession } from '../_lib/auth.js'
import { readRate, bumpRate, clearRate, hasStorage } from '../_lib/store.js'

// Acceso en un solo paso: usuario y contraseña. Sin segundo factor.
//
// Queda un límite de intentos por IP para que nadie pueda probar contraseñas a
// lo bruto desde fuera. Es amplio a propósito: quien conoce su contraseña no
// llega nunca a rozarlo, y un fallo de escritura no bloquea la cuenta.
const WINDOW = 15 * 60
const MAX_PER_IP = 20

// Respuesta única para cualquier fallo: no se revela si el usuario existe o si
// lo que falló fue la contraseña.
const GENERIC = 'Usuario o contraseña incorrectos'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  if (!isSameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' })

  if (!hasStorage()) {
    console.error('[login] almacenamiento no configurado')
    return json(res, 503, { error: 'El panel no está configurado todavía' })
  }
  if (getUsers().length === 0) {
    console.error('[login] faltan ADMIN_USER y ADMIN_PASSWORD')
    return json(res, 503, { error: 'El panel no está configurado todavía' })
  }

  let body
  try {
    body = await readJson(req)
  } catch {
    return json(res, 400, { error: 'Petición no válida' })
  }

  const username = String(body.username ?? '').trim().toLowerCase().slice(0, 64)
  const password = String(body.password ?? '').slice(0, 256)
  const ip = clientIp(req)
  const ipBucket = `login:ip:${ip}`

  const ipRate = await readRate(ipBucket)
  if (ipRate.count >= MAX_PER_IP) {
    return json(res, 429, {
      error: 'Demasiados intentos. Inténtalo de nuevo más tarde.',
      retryAfter: ipRate.ttl,
    })
  }

  const fallo = async () => {
    await bumpRate(ipBucket, WINDOW)
    return json(res, 401, { error: GENERIC })
  }

  if (!username || !password) {
    burnPasswordTime(password)
    return fallo()
  }

  const user = findUser(username)
  if (!user) {
    burnPasswordTime(password) // mismo coste que una verificación real
    return fallo()
  }

  if (!checkPassword(password, user.password)) {
    return fallo()
  }

  await clearRate(ipBucket)
  const session = await startSession(res, user, req)

  return json(res, 200, {
    user: { username: session.username, name: session.name },
  })
}
