// Volver a entrar cuando se pierde la contraseña, y el justificante de un
// cierre. Las dos cosas tocan dinero o cuentas ajenas, así que lo que se
// comprueba aquí es sobre todo lo que NO debe pasar: que no se pueda averiguar
// qué tiendas existen, que un código no valga dos veces, que cambiar la
// contraseña tumbe las sesiones abiertas y que un cliente no vea el papel de
// otro.
import { Readable } from 'node:stream'

const BASE = new URL('../../api', import.meta.url).href
delete process.env.UPSTASH_REDIS_REST_URL
delete process.env.UPSTASH_REDIS_REST_TOKEN
delete process.env.VERCEL
delete process.env.GOLDAPI_KEY
delete process.env.RESEND_API_KEY
delete process.env.CORREO_DESDE

const { hashPassword } = await import(`${BASE}/_lib/crypto.js`)
const PW = 'contrasena-de-prueba-local-2026'
process.env.ADMIN_USERS = JSON.stringify([{ username: 'local', name: 'Local', password: hashPassword(PW) }])

const login = (await import(`${BASE}/admin/login.js`)).default
const cuenta = (await import(`${BASE}/portal/cuenta.js`)).default
const clientes = (await import(`${BASE}/admin/clientes.js`)).default
const cierres = (await import(`${BASE}/cierres.js`)).default
const store = await import(`${BASE}/_lib/store.js`)
const { hayCorreo } = await import(`${BASE}/_lib/correo.js`)

function call(h, { method = 'GET', url = '/', body, cookie, portal, origin = 'http://localhost:3000' } = {}) {
  const p = body ? JSON.stringify(body) : ''
  const req = Readable.from(p ? [Buffer.from(p)] : [])
  req.method = method
  req.url = url
  req.headers = { host: 'localhost:3000', 'user-agent': 'x' }
  if (origin) req.headers.origin = origin
  if (cookie) req.headers.cookie = cookie
  if (portal) req.headers['x-tqm-portal'] = '1'
  req.socket = { remoteAddress: '127.0.0.1' }
  const res = {
    statusCode: 200, _h: {},
    setHeader(k, v) { this._h[k.toLowerCase()] = v },
    getHeader(k) { return this._h[k.toLowerCase()] },
    end(x) {
      this.crudo = x
      // Un PDF no es JSON: se guarda tal cual y ya lo mira quien toque.
      try { this.body = x ? JSON.parse(x) : null } catch { this.body = null }
      this._d()
    },
  }
  return new Promise((ok, bad) => { res._d = () => ok(res); Promise.resolve(h(req, res)).catch(bad) })
}

let fails = 0
const check = (n, c, e = '') => { console.log(`${c ? 'OK   ' : 'FALLA'}  ${n}${c ? '' : ` ← ${e}`}`); if (!c) fails++ }
const galleta = (res) => String(res.getHeader('set-cookie') || '').split(';')[0]

check('sin proveedor configurado, el correo no se da por enviado', hayCorreo() === false)

await store.setMarketCache({
  fixing: { gold: 3958.84, silver: 58.74 }, change: { gold: 0, silver: 0 }, fetchedAt: Date.now(),
})

// ─── Preparar cuentas ────────────────────────────────────────────────────────

let r = await call(login, { method: 'POST', body: { username: 'local', password: PW } })
const admin = galleta(r)

r = await call(cuenta, { method: 'POST', body: { accion: 'demo' } })
const CORREO = r.body.email
const ANTIGUA = r.body.password
const clienteId = r.body.cliente.id

r = await call(cuenta, { method: 'POST', body: { accion: 'entrar', email: CORREO, password: ANTIGUA } })
const sesionVieja = galleta(r)
check('el cliente entra con su contraseña de siempre', r.statusCode === 200, r.statusCode)

// ─── Pedirla sin que se pueda tantear quién existe ───────────────────────────

const desconocido = await call(cuenta, { method: 'POST', body: { accion: 'olvide', email: 'nadie@ejemplo.es' } })
const conocido = await call(cuenta, { method: 'POST', body: { accion: 'olvide', email: CORREO } })
check('pedir la contraseña responde igual exista la cuenta o no',
  desconocido.statusCode === conocido.statusCode &&
  JSON.stringify(desconocido.body) === JSON.stringify(conocido.body),
  `${desconocido.statusCode} vs ${conocido.statusCode}`)

r = await call(clientes, { method: 'GET', url: `/api/admin/clientes?id=${clienteId}`, cookie: admin })
check('la petición queda marcada en la ficha, para darlo por teléfono',
  Boolean(r.body.cliente?.claveSolicitadaEn), JSON.stringify(r.body.cliente?.claveSolicitadaEn))

// ─── El código lo genera el panel ────────────────────────────────────────────

r = await call(clientes, { method: 'PUT', cookie: admin, body: { accion: 'clave', id: clienteId } })
check('TQM genera un código para dictarlo', r.statusCode === 200 && typeof r.body.codigo === 'string', JSON.stringify(r.body))
const codigo = r.body.codigo

check('el código se puede dictar por teléfono sin equivocarse',
  /^[2-9A-HJ-NP-TV-Z]{4}(-[2-9A-HJ-NP-TV-Z]{4}){3}$/.test(codigo), codigo)

r = await call(clientes, { method: 'PUT', body: { accion: 'clave', id: clienteId } })
check('sin sesión de panel no se generan códigos', r.statusCode === 401, r.statusCode)

// ─── Gastarlo ────────────────────────────────────────────────────────────────

const NUEVA = 'otra-contrasena-2026'

r = await call(cuenta, { method: 'POST', body: { accion: 'restablecer', token: 'no-existe-este-codigo-largo', password: NUEVA } })
check('un código inventado no vale', r.statusCode === 400, r.statusCode)

r = await call(cuenta, { method: 'POST', body: { accion: 'restablecer', token: codigo, password: 'corta' } })
check('una contraseña corta se rechaza', r.statusCode === 422, r.statusCode)

// Nadie teclea un código como se lo han dictado: en minúsculas, con espacios o
// sin guiones, tiene que valer igual.
const comoLoTeclean = codigo.toLowerCase().replace(/-/g, ' ')
r = await call(cuenta, { method: 'POST', body: { accion: 'restablecer', token: comoLoTeclean, password: NUEVA } })
check('con el código bueno se cambia la contraseña, se escriba como se escriba',
  r.statusCode === 200, JSON.stringify(r.body).slice(0, 120))
check('y se entra directamente, sin volver a teclearla', Boolean(galleta(r)), 'sin cookie')
const sesionNueva = galleta(r)

r = await call(cuenta, { method: 'POST', body: { accion: 'restablecer', token: codigo, password: 'otra-mas-todavia-2026' } })
check('el mismo código no vale dos veces', r.statusCode === 400, r.statusCode)

// ─── Lo que tiene que haber pasado ───────────────────────────────────────────

r = await call(cuenta, { method: 'GET', cookie: sesionVieja })
check('la sesión que estaba abierta antes deja de valer', r.statusCode === 401, r.statusCode)

r = await call(cuenta, { method: 'GET', cookie: sesionNueva })
check('la recién abierta sigue viva', r.statusCode === 200, r.statusCode)

r = await call(cuenta, { method: 'POST', body: { accion: 'entrar', email: CORREO, password: ANTIGUA } })
check('la contraseña vieja ya no entra', r.statusCode === 401, r.statusCode)

r = await call(cuenta, { method: 'POST', body: { accion: 'entrar', email: CORREO, password: NUEVA } })
check('la nueva sí', r.statusCode === 200, r.statusCode)
const cliente = galleta(r)

r = await call(clientes, { method: 'GET', url: `/api/admin/clientes?id=${clienteId}`, cookie: admin })
check('y la marca de «lo ha pedido» se retira sola', !r.body.cliente?.claveSolicitadaEn, r.body.cliente?.claveSolicitadaEn)

// ─── El justificante ─────────────────────────────────────────────────────────

r = await call(cierres, {
  method: 'POST', cookie: cliente, portal: true,
  body: { lineas: [{ metal: 'gold', key: 'au18', gramos: 120.5 }] },
})
const ref = r.body.cierre?.ref
check('hay un cierre del que sacar el papel', r.statusCode === 201, JSON.stringify(r.body).slice(0, 120))

r = await call(cierres, { method: 'GET', url: `/api/cierres?ref=${ref}&formato=pdf`, cookie: cliente, portal: true })
const pdf = r.crudo
check('el cliente se descarga su justificante en PDF',
  r.statusCode === 200 && Buffer.isBuffer(pdf) && pdf.subarray(0, 5).toString('latin1') === '%PDF-',
  `${r.statusCode} · ${String(pdf).slice(0, 20)}`)
check('y el PDF está cerrado en condiciones',
  Buffer.isBuffer(pdf) && pdf.subarray(-8).toString('latin1').includes('%%EOF'),
  Buffer.isBuffer(pdf) ? pdf.subarray(-8).toString('latin1') : 'no es un buffer')
check('con su nombre de archivo',
  String(r.getHeader('content-disposition')).includes(`${ref}.pdf`), r.getHeader('content-disposition'))

r = await call(cierres, { method: 'GET', url: `/api/cierres?ref=${ref}&formato=csv`, cookie: cliente, portal: true })
check('el bloque del ERP no es cosa del cliente', r.statusCode === 403, r.statusCode)

r = await call(cierres, { method: 'GET', url: `/api/cierres?ref=${ref}&formato=csv`, cookie: admin })
const csv = String(r.crudo || '')
check('TQM sí se lo lleva al ERP', r.statusCode === 200 && csv.includes('referencia;estado'), csv.slice(0, 60))
check('con una fila por línea del lote y sin separador de miles',
  csv.trim().split('\r\n').length === 2 && /;120,500;/.test(csv), csv.split('\r\n')[1])

// Otro cliente no puede asomarse al papel del primero.
r = await call(cuenta, {
  method: 'POST',
  body: { accion: 'demo', email: 'otra-tienda@ejemplo.es', password: 'otra-tienda-2026', razonSocial: 'Otra Tienda SL' },
})
r = await call(cuenta, { method: 'POST', body: { accion: 'entrar', email: 'otra-tienda@ejemplo.es', password: 'otra-tienda-2026' } })
const otro = galleta(r)
r = await call(cierres, { method: 'GET', url: `/api/cierres?ref=${ref}&formato=pdf`, cookie: otro, portal: true })
check('y el de otra tienda no existe para él', r.statusCode === 404, r.statusCode)

console.log(fails ? `\n${fails} comprobación(es) fallan.\n` : '\nAcceso y justificantes correctos.\n')
process.exit(fails ? 1 : 0)
