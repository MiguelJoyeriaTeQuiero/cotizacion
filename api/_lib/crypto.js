import crypto from 'node:crypto'

// ─── Password hashing (scrypt, sin dependencias externas) ────────────────────
//
// Formato almacenado:  scrypt$N$r$p$saltBase64$hashBase64
// N=16384 r=8 p=1 → ~100 ms por verificación en el runtime de Vercel.

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 64
const MAXMEM = 64 * 1024 * 1024

const DUMMY_SALT = Buffer.alloc(16, 0x2a)

/**
 * Consume el mismo tiempo de CPU que una verificación real de contraseña.
 * Se llama cuando el usuario no existe, para que una petición con usuario
 * inexistente tarde lo mismo que una con usuario real y no se pueda averiguar
 * quién tiene cuenta midiendo tiempos de respuesta.
 */
export function burnPasswordTime(password) {
  try {
    crypto.scryptSync(String(password ?? '').normalize('NFKC'), DUMMY_SALT, KEYLEN, {
      N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAXMEM,
    })
  } catch {
    /* nada que hacer: solo sirve para igualar tiempos */
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = crypto.scryptSync(String(password).normalize('NFKC'), salt, KEYLEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAXMEM,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split('$')
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false
    const [, n, r, p, saltB64, keyB64] = parts
    const salt = Buffer.from(saltB64, 'base64')
    const key = Buffer.from(keyB64, 'base64')
    if (salt.length < 8 || key.length < 32) return false
    const test = crypto.scryptSync(String(password).normalize('NFKC'), salt, key.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
    })
    return crypto.timingSafeEqual(test, key)
  } catch {
    return false
  }
}

/**
 * Comprueba la contraseña admitiendo los dos formatos que puede tener la
 * variable de entorno:
 *
 *   - `scrypt$...`         → hash creado con `npm run credenciales`.
 *   - cualquier otro texto → la contraseña tal cual (modo sencillo).
 *
 * El modo sencillo existe para poder cambiar la contraseña desde el panel de
 * Vercel sin tener que ejecutar ningún script. La comparación se hace sobre el
 * SHA-256 de ambos valores: así siempre se comparan cadenas de la misma
 * longitud y el tiempo de respuesta no revela nada.
 */
export function checkPassword(password, stored) {
  const value = String(stored ?? '')
  if (!value) return false
  if (value.startsWith('scrypt$')) return verifyPassword(password, value)
  return safeEqualStr(
    sha256(String(password ?? '').normalize('NFKC')),
    sha256(value.normalize('NFKC')),
  )
}

// ─── Tokens de sesión ────────────────────────────────────────────────────────

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

// Alfabeto sin caracteres que se confunden al leerlos en voz alta: fuera la O y
// el 0, la I, la L y el 1, y la U (que por teléfono suena como la V).
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Un código para dictar por teléfono: cuatro grupos de cuatro, mayúsculas y sin
 * letras dudosas. Son unos 78 bits, de sobra para algo que caduca en una hora,
 * solo vale una vez y está limitado por intentos.
 *
 * Se descartan los bytes que caerían fuera del último ciclo completo del
 * alfabeto: con el módulo a secas, las primeras letras saldrían más veces.
 */
export function codigoLegible(largo = 16) {
  const tope = 256 - (256 % ALFABETO.length)
  let salida = ''
  while (salida.length < largo) {
    for (const b of crypto.randomBytes(largo)) {
      if (b >= tope) continue
      salida += ALFABETO[b % ALFABETO.length]
      if (salida.length === largo) break
    }
  }
  return salida.match(/.{1,4}/g).join('-')
}

/** Lo que se teclea nunca viene igual que lo que se dictó: guiones, espacios y
 *  minúsculas se quitan antes de comparar. */
export function normalizarCodigo(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
}

// En Redis solo se guarda el SHA-256 del token: un volcado de la base de datos
// no permite suplantar sesiones activas.
export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

export function safeEqualStr(a, b) {
  const bufA = Buffer.from(String(a), 'utf8')
  const bufB = Buffer.from(String(b), 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
