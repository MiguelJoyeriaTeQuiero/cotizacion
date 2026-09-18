// Prueba de extremo a extremo de los endpoints, contra un Redis simulado que
// habla el protocolo REST de Upstash. No toca la red ni servicios externos.
import http from 'node:http'
import { Readable } from 'node:stream'

const BASE = new URL('../../api', import.meta.url).href

// ─── Redis simulado ──────────────────────────────────────────────────────────
const store = new Map()
const expiry = new Map()

const alive = (k) => {
  const e = expiry.get(k)
  if (e != null && Date.now() > e) { store.delete(k); expiry.delete(k); return false }
  return store.has(k)
}
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64')

function exec(cmd) {
  const op = String(cmd[0]).toLowerCase()
  const key = cmd[1]
  switch (op) {
    case 'set': {
      const value = cmd[2]
      const rest = cmd.slice(3).map(x => String(x).toLowerCase())
      const nx = rest.includes('nx')
      if (nx && alive(key)) return null
      const exIdx = rest.indexOf('ex')
      store.set(key, value)
      if (exIdx >= 0) expiry.set(key, Date.now() + Number(rest[exIdx + 1]) * 1000)
      else expiry.delete(key)
      return 'OK'
    }
    case 'get': return alive(key) ? b64(store.get(key)) : null
    case 'del': { const had = alive(key); store.delete(key); expiry.delete(key); return had ? 1 : 0 }
    case 'incr': { const n = (alive(key) ? Number(store.get(key)) : 0) + 1; store.set(key, String(n)); return n }
    case 'expire': { if (!alive(key)) return 0; expiry.set(key, Date.now() + Number(cmd[2]) * 1000); return 1 }
    case 'ttl': { if (!alive(key)) return -2; const e = expiry.get(key); return e == null ? -1 : Math.ceil((e - Date.now()) / 1000) }
    case 'lpush': { const list = alive(key) ? JSON.parse(store.get(key)) : []; list.unshift(...cmd.slice(2)); store.set(key, JSON.stringify(list)); return list.length }
    case 'ltrim': { const list = alive(key) ? JSON.parse(store.get(key)) : []; store.set(key, JSON.stringify(list.slice(Number(cmd[2]), Number(cmd[3]) + 1))); return 'OK' }
    case 'lrange': { const list = alive(key) ? JSON.parse(store.get(key)) : []; const stop = Number(cmd[3]); return list.slice(Number(cmd[2]), stop === -1 ? undefined : stop + 1).map(b64) }
    default: throw new Error(`comando no soportado: ${op}`)
  }
}

const server = http.createServer((req, res) => {
  let raw = ''
  req.on('data', c => { raw += c })
  req.on('end', () => {
    try {
      const parsed = JSON.parse(raw)
      res.setHeader('Content-Type', 'application/json')
      // El cliente agrupa comandos (auto-pipeline): el cuerpo puede ser una
      // sola orden ["get", k] o una lista de órdenes [["get", k], ...].
      if (Array.isArray(parsed[0])) {
        res.end(JSON.stringify(parsed.map(c => ({ result: exec(c) }))))
      } else {
        res.end(JSON.stringify({ result: exec(parsed) }))
      }
    } catch (err) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: err.message }))
    }
  })
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port

// ─── Entorno ─────────────────────────────────────────────────────────────────
process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${port}`
process.env.UPSTASH_REDIS_REST_TOKEN = 'token-de-prueba'
delete process.env.GOLDAPI_KEY // fuerza el camino de respaldo, sin salir a Internet

const { hashPassword } = await import(`${BASE}/_lib/crypto.js`)
const PASSWORD = 'contrasena-larga-de-prueba-2026'
process.env.ADMIN_USERS = JSON.stringify([
  { username: 'miguel', name: 'Miguel', password: hashPassword(PASSWORD) },
])

const login = (await import(`${BASE}/admin/login.js`)).default
const logout = (await import(`${BASE}/admin/logout.js`)).default
const session = (await import(`${BASE}/admin/session.js`)).default
const formulas = (await import(`${BASE}/admin/formulas.js`)).default
const history = (await import(`${BASE}/admin/history.js`)).default
const scenarios = (await import(`${BASE}/admin/scenarios.js`)).default
const seriesEndpoint = (await import(`${BASE}/admin/series.js`)).default
const { setMarketCache } = await import(`${BASE}/_lib/store.js`)
const cuenta = (await import(`${BASE}/portal/cuenta.js`)).default
const docsPortal = (await import(`${BASE}/portal/documentos.js`)).default
const clientesAdmin = (await import(`${BASE}/admin/clientes.js`)).default
const cierres = (await import(`${BASE}/cierres.js`)).default
const prices = (await import(`${BASE}/prices.js`)).default

// ─── Harness de req/res ──────────────────────────────────────────────────────
function call(handler, { method = 'GET', body, origin = 'https://www.oroalmayor.com', cookie, url = '' } = {}) {
  const payload = body ? JSON.stringify(body) : ''
  const req = Readable.from(payload ? [Buffer.from(payload)] : [])
  req.method = method
  // Los endpoints que leen parámetros de consulta necesitan una URL.
  req.url = `/api/prueba${url}`
  req.headers = { host: 'www.oroalmayor.com', 'user-agent': 'prueba' }
  if (origin) req.headers.origin = origin
  if (cookie) req.headers.cookie = cookie
  if (payload) req.headers['content-type'] = 'application/json'
  req.socket = { remoteAddress: '203.0.113.9' }

  const res = {
    statusCode: 200,
    _headers: {},
    setHeader(k, v) { this._headers[k.toLowerCase()] = v },
    getHeader(k) { return this._headers[k.toLowerCase()] },
    end(payload) { this.body = payload ? JSON.parse(payload) : null; this._done() },
  }
  return new Promise((resolve, reject) => {
    res._done = () => resolve(res)
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

const cookieFrom = (res) => String(res.getHeader('set-cookie') || '').split(';')[0]

let fails = 0
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'OK   ' : 'FALLA'}  ${name}${cond ? '' : ` ← ${extra}`}`)
  if (!cond) fails++
}

// ─── 1. CSRF: sin cabecera Origin no se entra ────────────────────────────────
let r = await call(login, { method: 'POST', body: { username: 'miguel', password: PASSWORD }, origin: null })
check('login sin Origin → 403 (defensa CSRF)', r.statusCode === 403, r.statusCode)

// ─── 2. Método incorrecto ────────────────────────────────────────────────────
r = await call(login, { method: 'GET' })
check('login por GET → 405', r.statusCode === 405, r.statusCode)

// ─── 3. Contraseña incorrecta ────────────────────────────────────────────────
r = await call(login, { method: 'POST', body: { username: 'miguel', password: 'mala' } })
check('contraseña incorrecta → 401', r.statusCode === 401, r.statusCode)
check('el error no revela la causa', r.body.error === 'Usuario o contraseña incorrectos', r.body.error)

// ─── 4. Usuario inexistente da el mismo mensaje ──────────────────────────────
r = await call(login, { method: 'POST', body: { username: 'fantasma', password: 'mala' } })
check('usuario inexistente → mismo mensaje (sin enumeración)', r.body.error === 'Usuario o contraseña incorrectos', r.body.error)

// ─── 5. Login: usuario + contraseña, en un solo paso ─────────────────────────
r = await call(login, { method: 'POST', body: { username: 'miguel', password: PASSWORD } })
check('usuario + contraseña → 200 (sin segundo factor)', r.statusCode === 200, JSON.stringify(r.body))
const setCookie = String(r.getHeader('set-cookie') || '')
check('la cookie es HttpOnly', setCookie.includes('HttpOnly'), setCookie)
check('la cookie es SameSite=Strict', setCookie.includes('SameSite=Strict'), setCookie)
const cookie = cookieFrom(r)
check('el token de sesión no se guarda en claro en Redis', ![...store.keys()].some(k => k.includes(cookie.split('=')[1])))

// ─── 6. El mayúsculas/minúsculas del usuario da igual ────────────────────────
r = await call(login, { method: 'POST', body: { username: '  MIGUEL ', password: PASSWORD } })
check('el usuario no distingue mayúsculas ni espacios sobrantes', r.statusCode === 200, r.statusCode)

// ─── 7. Contraseña en texto plano en las variables de entorno ────────────────
// Modo sencillo: ADMIN_USER + ADMIN_PASSWORD, sin hash ni JSON.
process.env.ADMIN_USER = 'tienda'
process.env.ADMIN_NAME = 'Tienda'
process.env.ADMIN_PASSWORD = 'clave-en-texto-plano-2026'
r = await call(login, { method: 'POST', body: { username: 'tienda', password: 'clave-en-texto-plano-2026' } })
check('ADMIN_USER + ADMIN_PASSWORD en texto plano → 200', r.statusCode === 200, JSON.stringify(r.body))
check('usa el nombre visible de ADMIN_NAME', r.body.user?.name === 'Tienda', JSON.stringify(r.body))
r = await call(login, { method: 'POST', body: { username: 'tienda', password: 'otra-cosa' } })
check('modo sencillo: contraseña mala → 401', r.statusCode === 401, r.statusCode)
delete process.env.ADMIN_USER
delete process.env.ADMIN_NAME
delete process.env.ADMIN_PASSWORD

// ─── 8. Acceso a las fórmulas ────────────────────────────────────────────────
r = await call(formulas, { method: 'GET' })
check('fórmulas sin sesión → 401', r.statusCode === 401, r.statusCode)

r = await call(formulas, { method: 'GET', cookie: 'tqm_admin=token-inventado-1234567890' })
check('fórmulas con cookie falsificada → 401', r.statusCode === 401, r.statusCode)

r = await call(formulas, { method: 'GET', cookie })
check('fórmulas con sesión → 200', r.statusCode === 200, r.statusCode)
check('incluye los factores comerciales', r.body.gold?.[0]?.f1 != null, JSON.stringify(r.body).slice(0, 120))

// ─── 9. Guardado ─────────────────────────────────────────────────────────────
const valid = { divisor: 31.1, gold: r.body.gold, silver: r.body.silver, expectedVersion: r.body.version ?? 0 }

let bad = JSON.parse(JSON.stringify(valid))
bad.gold[0].f1 = 99
r = await call(formulas, { method: 'PUT', cookie, body: bad })
check('factor fuera de rango → 422', r.statusCode === 422, r.statusCode)

r = await call(formulas, { method: 'PUT', cookie, body: valid, origin: null })
check('guardar sin Origin → 403', r.statusCode === 403, r.statusCode)

r = await call(formulas, { method: 'PUT', body: valid })
check('guardar sin sesión → 401', r.statusCode === 401, r.statusCode)

const edited = JSON.parse(JSON.stringify(valid))
edited.gold[0].f1 = 0.985
r = await call(formulas, { method: 'PUT', cookie, body: edited })
check('guardado válido → 200', r.statusCode === 200, JSON.stringify(r.body).slice(0, 160))
check('la versión se incrementa', r.body.version === (valid.expectedVersion + 1), `${valid.expectedVersion} → ${r.body.version}`)
check('queda registrado quién guardó', r.body.updatedBy === 'miguel', r.body.updatedBy)

// ─── 10. Bloqueo optimista ───────────────────────────────────────────────────
r = await call(formulas, { method: 'PUT', cookie, body: edited }) // expectedVersion sigue siendo 0
check('guardado con versión obsoleta → 409 (no pisa a la otra persona)', r.statusCode === 409, r.statusCode)

// ─── 11. Historial ───────────────────────────────────────────────────────────
r = await call(history, { method: 'GET', cookie })
check('historial accesible con sesión', r.statusCode === 200 && r.body.entries.length === 1, JSON.stringify(r.body).slice(0, 120))
check('el historial guarda la instantánea', r.body.entries[0].snapshot?.gold?.[0]?.f1 === 0.985, JSON.stringify(r.body.entries[0]).slice(0, 160))
r = await call(history, { method: 'GET' })
check('historial sin sesión → 401', r.statusCode === 401, r.statusCode)

// ─── 12. Endpoint público ────────────────────────────────────────────────────
r = await call(prices, { method: 'GET', origin: null })
check('precios públicos accesibles sin sesión', r.statusCode === 200, r.statusCode)
const publicJson = JSON.stringify(r.body)
check('el precio por gramo llega calculado', typeof r.body.gold[0].pricePerGram === 'number', publicJson.slice(0, 120))
check('NO expone f1 ni f2', !publicJson.includes('"f1"') && !publicJson.includes('"f2"'))
check('NO expone el divisor', !publicJson.includes('divisor'))
check('refleja la fórmula recién guardada', Math.abs(r.body.gold[0].pricePerGram - (999.9 / 1000) * r.body.fixing.gold * 0.985 * 0.99 / 31.1) < 1e-9)

// ─── 12ter. Factor 3: descuento fijo por gramo ───────────────────────────────
r = await call(formulas, { method: 'GET', cookie })
const sinAjuste = r.body.gold[0]
check('las fórmulas traen el factor 3', sinAjuste.f3 === 0, JSON.stringify(sinAjuste))

const conAjuste = JSON.parse(JSON.stringify({
  divisor: r.body.divisor,
  gold: r.body.gold,
  silver: r.body.silver,
  expectedVersion: r.body.version,
}))
conAjuste.gold[0].f3 = -0.05
r = await call(formulas, { method: 'PUT', cookie, body: conAjuste })
check('se guarda un factor 3 negativo', r.statusCode === 200 && r.body.gold[0].f3 === -0.05, JSON.stringify(r.body).slice(0, 160))

r = await call(prices, { method: 'GET', origin: null })
const conDescuento = r.body.gold[0].pricePerGram
const esperado = (999.9 / 1000) * r.body.fixing.gold * 0.985 * 0.99 / 31.1 - 0.05
check('el factor 3 resta del precio público', Math.abs(conDescuento - esperado) < 1e-9, `${conDescuento} vs ${esperado}`)
check('el endpoint público NO expone el factor 3', !JSON.stringify(r.body).includes('"f3"'))

r = await call(formulas, { method: 'GET', cookie })
const fuera = JSON.parse(JSON.stringify({ divisor: r.body.divisor, gold: r.body.gold, silver: r.body.silver, expectedVersion: r.body.version }))
fuera.gold[0].f3 = -9999
r = await call(formulas, { method: 'PUT', cookie, body: fuera })
check('factor 3 desproporcionado → 422', r.statusCode === 422, r.statusCode)

// Se deja a 0 para que las comprobaciones siguientes partan de un precio limpio.
r = await call(formulas, { method: 'GET', cookie })
const limpio = JSON.parse(JSON.stringify({ divisor: r.body.divisor, gold: r.body.gold, silver: r.body.silver, expectedVersion: r.body.version }))
limpio.gold[0].f3 = 0
r = await call(formulas, { method: 'PUT', cookie, body: limpio })
check('se puede volver a dejar el factor 3 en cero', r.statusCode === 200 && r.body.gold[0].f3 === 0, r.statusCode)

// ─── 12bis. Frecuencia de consulta de precios ────────────────────────────────
r = await call(formulas, { method: 'GET', cookie })
check('las fórmulas traen la frecuencia de consulta', r.body.refreshSeconds === 60, r.body.refreshSeconds)

const conFrecuencia = {
  divisor: r.body.divisor,
  refreshSeconds: 300,
  gold: r.body.gold,
  silver: r.body.silver,
  expectedVersion: r.body.version,
}
r = await call(formulas, { method: 'PUT', cookie, body: conFrecuencia })
check('se guarda la frecuencia elegida en el panel', r.statusCode === 200 && r.body.refreshSeconds === 300, JSON.stringify(r.body).slice(0, 160))

r = await call(prices, { method: 'GET', origin: null })
check('el endpoint público publica la frecuencia vigente', r.body.refreshSeconds === 300, r.body.refreshSeconds)

r = await call(formulas, { method: 'GET', cookie })
r = await call(formulas, {
  method: 'PUT',
  cookie,
  body: { ...conFrecuencia, refreshSeconds: 2, expectedVersion: r.body.version },
})
check('frecuencia fuera de rango → 422', r.statusCode === 422, r.statusCode)

r = await call(history, { method: 'GET', cookie })
check('el historial guarda la frecuencia de cada versión', r.body.entries[0]?.snapshot?.refreshSeconds === 300, JSON.stringify(r.body.entries[0]?.snapshot).slice(0, 120))

// ─── 12.5. Escenarios (borradores con nombre) ───────────────────────────────
r = await call(scenarios, { method: 'GET' })
check('escenarios sin sesión → 401', r.statusCode === 401, r.statusCode)

r = await call(formulas, { method: 'GET', cookie })
const snapshot = { divisor: 31.1, refreshSeconds: 300, gold: r.body.gold, silver: r.body.silver }
const versionAntes = r.body.version

r = await call(scenarios, { method: 'PUT', cookie, body: { name: 'Verano', snapshot }, origin: null })
check('guardar escenario sin Origin → 403', r.statusCode === 403, r.statusCode)

r = await call(scenarios, { method: 'PUT', cookie, body: { name: '   ', snapshot } })
check('escenario sin nombre → 422', r.statusCode === 422, r.statusCode)

const roto = JSON.parse(JSON.stringify(snapshot))
roto.gold[0].f1 = 99
r = await call(scenarios, { method: 'PUT', cookie, body: { name: 'Roto', snapshot: roto } })
check('escenario con valores inválidos → 422', r.statusCode === 422, r.statusCode)

r = await call(scenarios, { method: 'PUT', cookie, body: { name: '  Verano 2026  ', snapshot } })
check('guardar escenario válido → 200', r.statusCode === 200, JSON.stringify(r.body).slice(0, 140))
check('el nombre se limpia de espacios sobrantes', r.body.scenarios?.[0]?.name === 'Verano 2026', r.body.scenarios?.[0]?.name)

r = await call(formulas, { method: 'GET', cookie })
check('guardar un escenario NO publica nada', r.body.version === versionAntes, `${versionAntes} → ${r.body.version}`)

r = await call(scenarios, { method: 'PUT', cookie, body: { name: 'Verano 2026', snapshot } })
check('repetir el nombre reemplaza en vez de duplicar', r.body.scenarios?.length === 1, r.body.scenarios?.length)

r = await call(scenarios, { method: 'GET', cookie })
check('la lista devuelve el escenario guardado', r.body.scenarios?.[0]?.snapshot?.gold?.length > 0, JSON.stringify(r.body).slice(0, 140))
check('el escenario guarda quién lo creó', r.body.scenarios?.[0]?.savedBy === 'miguel', r.body.scenarios?.[0]?.savedBy)

r = await call(scenarios, { method: 'DELETE', cookie, body: { name: 'Verano 2026' } })
check('eliminar escenario → lista vacía', r.body.scenarios?.length === 0, r.body.scenarios?.length)

// ─── 12.6. Evolución de precios ─────────────────────────────────────────────
r = await call(seriesEndpoint, { method: 'GET' })
check('serie sin sesión → 401', r.statusCode === 401, r.statusCode)

r = await call(seriesEndpoint, { method: 'POST', cookie })
check('serie por POST → 405', r.statusCode === 405, r.statusCode)

// Con cotización fresca en caché, el endpoint público registra una muestra.
await setMarketCache({ fixing: { gold: 3400, silver: 34 }, change: { gold: 0, silver: 0 }, fetchedAt: Date.now() })
await call(prices, { method: 'GET', origin: null })
r = await call(seriesEndpoint, { method: 'GET', cookie })
check('el endpoint público registra una muestra', r.body.samples?.length === 1, JSON.stringify(r.body).slice(0, 160))
check('la muestra guarda el fixing', r.body.samples?.[0]?.fixing?.gold === 3400, JSON.stringify(r.body.samples?.[0]).slice(0, 140))
check('la muestra guarda el precio publicado de cada ley', Object.keys(r.body.samples?.[0]?.gold || {}).length > 0, JSON.stringify(r.body.samples?.[0]?.gold).slice(0, 120))

await call(prices, { method: 'GET', origin: null })
r = await call(seriesEndpoint, { method: 'GET', cookie })
check('no se apunta una muestra por visita (hueco mínimo de una hora)', r.body.samples?.length === 1, r.body.samples?.length)

// ─── 12.7. El fixing del momento de publicar ────────────────────────────────
r = await call(formulas, { method: 'GET', cookie })
r = await call(formulas, {
  method: 'PUT',
  cookie,
  body: { divisor: 31.1, refreshSeconds: 300, gold: r.body.gold, silver: r.body.silver, expectedVersion: r.body.version },
})
check('al publicar se congela la cotización de ese momento', r.body.fixingAtPublish?.gold === 3400, JSON.stringify(r.body.fixingAtPublish))

r = await call(formulas, { method: 'GET', cookie })
check('la cotización congelada se devuelve al panel', r.body.fixingAtPublish?.silver === 34, JSON.stringify(r.body.fixingAtPublish))

// ─── 12.8. Portal de clientes: alta ─────────────────────────────────────────
const ALTA = {
  accion: 'alta',
  empresa: {
    razonSocial: 'Joyería Ejemplo SL', cif: 'B12345678', nombreComercial: 'Oro Sur',
    direccion: 'Calle del Castillo 12', poblacion: 'Santa Cruz de Tenerife',
    provincia: 'Santa Cruz de Tenerife', cp: '38002', iae: '491.1',
  },
  contacto: { persona: 'Ana Pérez', telefono: '922000111', telefonoTienda: '', email: 'Ana@Joyeria.example ' },
  titular: { nombre: 'Ana Pérez', dni: '12345678Z' },
  cobro: { iban: 'ES91 2100 0418 4502 0005 1332' },
  password: 'una-clave-larga-2026',
  condiciones: true,
}

// Un PNG y un PDF de verdad, aunque diminutos: la comprobación mira la firma.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PDF = Buffer.from('%PDF-1.4 1 0 obj endobj', 'utf8').toString('base64')
const NO_ES_IMAGEN = Buffer.from('esto es texto plano, no una imagen', 'utf8').toString('base64')

r = await call(cuenta, { method: 'POST', body: ALTA, origin: null })
check('alta sin Origin → 403', r.statusCode === 403, r.statusCode)

r = await call(cuenta, { method: 'POST', body: { ...ALTA, empresa: { ...ALTA.empresa, cif: 'X' } } })
check('alta con CIF inválido → 422', r.statusCode === 422, r.statusCode)
check('el error dice qué corregir', (r.body.details || []).some(d => d.includes('CIF')), JSON.stringify(r.body.details))

r = await call(cuenta, { method: 'POST', body: { ...ALTA, condiciones: false } })
check('alta sin aceptar condiciones → 422', r.statusCode === 422, r.statusCode)

r = await call(cuenta, { method: 'POST', body: ALTA })
check('alta correcta → 201', r.statusCode === 201, JSON.stringify(r.body).slice(0, 160))
const cookieCliente = cookieFrom(r)
check('la sesión del cliente es HttpOnly', String(r.getHeader('set-cookie')).includes('HttpOnly'))
check('el correo se normaliza', r.body.cliente?.contacto?.email === 'ana@joyeria.example', r.body.cliente?.contacto?.email)
check('la solicitud nace sin enviar', r.body.cliente?.enviadoEn === null, r.body.cliente?.enviadoEn)
const clienteId = r.body.cliente.id

r = await call(cuenta, { method: 'POST', body: { ...ALTA, empresa: { ...ALTA.empresa, cif: 'B87654321' } } })
check('mismo correo → 409', r.statusCode === 409, r.statusCode)
r = await call(cuenta, { method: 'POST', body: { ...ALTA, contacto: { ...ALTA.contacto, email: 'otra@joyeria.example' } } })
check('mismo CIF → 409', r.statusCode === 409, r.statusCode)

r = await call(cuenta, { method: 'GET', cookie: cookieCliente })
check('el cliente ve su expediente', r.body.cliente?.empresa?.cif === 'B12345678', JSON.stringify(r.body).slice(0, 120))
check('el expediente no lleva la contraseña', !JSON.stringify(r.body).includes('scrypt'), 'aparece el hash')
check('el portal informa del almacén disponible', r.body.almacen === 'memoria', r.body.almacen)

r = await call(cuenta, { method: 'POST', body: { accion: 'entrar', email: 'ana@joyeria.example', password: 'mala' } })
check('contraseña incorrecta → 401', r.statusCode === 401, r.statusCode)
check('no se revela si la cuenta existe', r.body.error === 'Correo o contraseña incorrectos', r.body.error)

r = await call(cuenta, { method: 'POST', body: { accion: 'entrar', email: 'ana@joyeria.example', password: ALTA.password } })
check('entrar con la contraseña correcta → 200', r.statusCode === 200, r.statusCode)

// ─── 12.9. Portal y panel son dos mundos ────────────────────────────────────
r = await call(formulas, { method: 'GET', cookie: cookieCliente })
check('una sesión de cliente NO abre el panel', r.statusCode === 401, r.statusCode)
r = await call(cuenta, { method: 'GET', cookie })
check('una sesión del panel NO abre el portal', r.statusCode === 401, r.statusCode)
r = await call(clientesAdmin, { method: 'GET', cookie: cookieCliente })
check('un cliente no puede listar clientes', r.statusCode === 401, r.statusCode)

// ─── 12.10. Documentos ──────────────────────────────────────────────────────
r = await call(docsPortal, { method: 'POST', body: { accion: 'local', base64: PNG, nombre: 'cif.png', tipo: 'image/png', etiqueta: 'CIF' } })
check('subir documento sin sesión → 401', r.statusCode === 401, r.statusCode)

r = await call(docsPortal, {
  method: 'POST', cookie: cookieCliente,
  body: { accion: 'local', base64: NO_ES_IMAGEN, nombre: 'trampa.png', tipo: 'image/png', etiqueta: 'Trampa' },
})
check('un archivo que no es lo que dice → 422', r.statusCode === 422, r.statusCode)

r = await call(docsPortal, {
  method: 'POST', cookie: cookieCliente,
  body: { accion: 'local', base64: PNG, nombre: 'cif.png', tipo: 'image/png', etiqueta: '  CIF de la empresa  ' },
})
check('subir un PNG → 200', r.statusCode === 200, JSON.stringify(r.body).slice(0, 140))
check('el documento queda en el expediente', r.body.cliente?.documentos?.length === 1, r.body.cliente?.documentos?.length)
check('la etiqueta se limpia', r.body.cliente?.documentos?.[0]?.etiqueta === 'CIF de la empresa', r.body.cliente?.documentos?.[0]?.etiqueta)
const docId = r.body.cliente.documentos[0].id

r = await call(docsPortal, {
  method: 'POST', cookie: cookieCliente,
  body: { accion: 'local', base64: PDF, nombre: 'escritura.pdf', tipo: 'application/pdf', etiqueta: 'Escritura' },
})
check('subir un PDF → 200', r.statusCode === 200, r.statusCode)

r = await call(docsPortal, { method: 'POST', cookie: cookieCliente, body: { accion: 'etiqueta', id: docId, etiqueta: 'CIF actualizado' } })
check('renombrar la etiqueta → 200', r.body.cliente?.documentos?.find(d => d.id === docId)?.etiqueta === 'CIF actualizado', r.statusCode)

for (let i = 0; i < 8; i++) {
  await call(docsPortal, { method: 'POST', cookie: cookieCliente, body: { accion: 'local', base64: PNG, nombre: `extra${i}.png`, tipo: 'image/png', etiqueta: `Extra ${i}` } })
}
r = await call(docsPortal, { method: 'POST', cookie: cookieCliente, body: { accion: 'local', base64: PNG, nombre: 'once.png', tipo: 'image/png', etiqueta: 'De más' } })
check('el documento número once → 409', r.statusCode === 409, r.statusCode)

r = await call(docsPortal, { method: 'DELETE', cookie: cookieCliente, body: { id: docId } })
check('quitar un documento → 200', r.body.cliente?.documentos?.length === 9, r.body.cliente?.documentos?.length)

// ─── 12.11. Enviar a revisión ───────────────────────────────────────────────
r = await call(cuenta, { method: 'POST', cookie: cookieCliente, body: { accion: 'enviar' } })
check('enviar a revisión → 200', r.statusCode === 200, JSON.stringify(r.body).slice(0, 120))
check('queda constancia de cuándo se envió', Boolean(r.body.cliente?.enviadoEn), r.body.cliente?.enviadoEn)

// ─── 12.12. Revisión desde el panel ─────────────────────────────────────────
r = await call(clientesAdmin, { method: 'GET' })
check('la lista de clientes sin sesión → 401', r.statusCode === 401, r.statusCode)

r = await call(clientesAdmin, { method: 'GET', cookie })
check('la solicitud aparece en la cola', r.body.clientes?.some(c => c.id === clienteId), JSON.stringify(r.body).slice(0, 140))
check('la cola cuenta las pendientes', r.body.pendientes >= 1, r.body.pendientes)

r = await call(clientesAdmin, { method: 'GET', cookie, url: `?id=${clienteId}` })
check('la ficha completa se abre', r.body.cliente?.id === clienteId, r.statusCode)
check('la ficha no expone la contraseña', r.body.cliente?.password === undefined, 'viene el hash')

r = await call(clientesAdmin, { method: 'PUT', cookie, body: { id: clienteId, accion: 'rechazar' } })
check('rechazar sin motivo → 422', r.statusCode === 422, r.statusCode)

r = await call(clientesAdmin, { method: 'PUT', cookie, body: { id: clienteId, accion: 'documentacion', nota: 'Falta el certificado bancario' }, origin: null })
check('decidir sin Origin → 403', r.statusCode === 403, r.statusCode)

r = await call(clientesAdmin, { method: 'PUT', cookie, body: { id: clienteId, accion: 'documentacion', nota: 'Falta el certificado bancario' } })
check('pedir documentación → 200', r.body.cliente?.estado === 'documentacion', r.statusCode)

r = await call(cuenta, { method: 'GET', cookie: cookieCliente })
check('el cliente lee la nota tal cual', r.body.cliente?.nota === 'Falta el certificado bancario', r.body.cliente?.nota)

r = await call(clientesAdmin, {
  method: 'PUT', cookie,
  body: { id: clienteId, accion: 'aprobar', limites: { porCierre: 8000, reservaMinutos: 60 } },
})
check('aprobar → 200', r.body.cliente?.estado === 'aprobado', r.statusCode)
check('se guardan los límites de la ficha', r.body.cliente?.limites?.reservaMinutos === 60, JSON.stringify(r.body.cliente?.limites))
check('la decisión queda firmada', r.body.cliente?.historial?.[0]?.por === 'miguel', JSON.stringify(r.body.cliente?.historial?.[0]))

r = await call(docsPortal, { method: 'POST', cookie: cookieCliente, body: { accion: 'local', base64: PNG, nombre: 'tarde.png', tipo: 'image/png', etiqueta: 'Tarde' } })
check('un expediente aprobado ya no se toca → 409', r.statusCode === 409, r.statusCode)

// ─── 12.13. Cierres ─────────────────────────────────────────────────────────
// El cliente de las pruebas anteriores ya está aprobado con reserva de 60 min.

r = await call(formulas, { method: 'GET', cookie })
const LEY_ORO = r.body.gold[0].key
const LEY_PLATA = r.body.silver[0].key

r = await call(cierres, { method: 'POST', body: { lineas: [{ metal: 'gold', key: LEY_ORO, gramos: 100 }] } })
check('pedir un cierre sin sesión → 401', r.statusCode === 401, r.statusCode)

r = await call(cierres, {
  method: 'POST', cookie: cookieCliente,
  body: { lineas: [{ metal: 'gold', key: LEY_ORO, gramos: 100 }] }, origin: null,
})
check('pedir un cierre sin Origin → 403', r.statusCode === 403, r.statusCode)

r = await call(cierres, { method: 'POST', cookie: cookieCliente, body: { lineas: [] } })
check('un lote vacío → 422', r.statusCode === 422, r.statusCode)

r = await call(cierres, {
  method: 'POST', cookie: cookieCliente,
  body: { lineas: [{ metal: 'oro', key: LEY_ORO, gramos: 100 }] },
})
check('un metal inventado → 422', r.statusCode === 422, r.statusCode)

r = await call(cierres, {
  method: 'POST', cookie: cookieCliente,
  body: { lineas: [{ metal: 'gold', key: LEY_ORO, gramos: -5 }] },
})
check('gramos negativos → 422', r.statusCode === 422, r.statusCode)

r = await call(cierres, {
  method: 'POST', cookie: cookieCliente,
  body: { lineas: [{ metal: 'gold', key: 'no_existe', gramos: 10 }] },
})
check('una ley que no está en la tabla → 422', r.statusCode === 422, r.statusCode)

// El precio lo pone el servidor: lo que mande el navegador da igual.
r = await call(cierres, {
  method: 'POST', cookie: cookieCliente,
  body: {
    lineas: [
      { metal: 'gold', key: LEY_ORO, gramos: 100, precioGramo: 999999, importe: 1 },
      { metal: 'silver', key: LEY_PLATA, gramos: 250 },
    ],
  },
})
check('pedir un cierre → 201', r.statusCode === 201, JSON.stringify(r.body).slice(0, 200))
const cierre = r.body.cierre
check('la referencia tiene forma de referencia', /^TQM-\d{4}-\d{4}$/.test(cierre?.ref || ''), cierre?.ref)
check('el precio que mande el cliente se ignora', cierre.lineas[0].precioGramo !== 999999, cierre.lineas[0].precioGramo)
check('el importe se recalcula en el servidor',
  Math.abs(cierre.lineas[0].importe - 100 * cierre.lineas[0].precioGramo) < 0.01,
  `${cierre.lineas[0].importe} vs ${100 * cierre.lineas[0].precioGramo}`)
check('el total es la suma de los importes',
  Math.abs(cierre.total - (cierre.lineas[0].importe + cierre.lineas[1].importe)) < 0.01, cierre.total)
check('queda congelada la cotización', cierre.fixing?.gold === 3400, JSON.stringify(cierre.fixing))
check('nace pendiente de confirmar', cierre.estado === 'pendiente', cierre.estado)
check('la reserva es la de la ficha del cliente', cierre.reservaMinutos === 60, cierre.reservaMinutos)
check('al cliente no se le devuelve su IP', cierre.ip === undefined, 'viene la IP')

// ─── 12.14. Cada uno ve lo suyo ─────────────────────────────────────────────
r = await call(cierres, { method: 'GET', cookie: cookieCliente })
check('el cliente ve sus cierres', r.body.cierres?.length === 1, r.body.cierres?.length)

r = await call(cierres, { method: 'GET', cookie })
check('TQM ve la bandeja', r.body.cierres?.some(c => c.ref === cierre.ref), JSON.stringify(r.body).slice(0, 140))
check('la bandeja cuenta los pendientes', r.body.pendientes >= 1, r.body.pendientes)

// Un segundo cliente no puede ver el cierre del primero.
const OTRA = {
  accion: 'alta',
  empresa: {
    razonSocial: 'Oro Sur SL', cif: 'B10101010', nombreComercial: '',
    direccion: 'Avenida de los Reyes 3', poblacion: 'Arona',
    provincia: 'Santa Cruz de Tenerife', cp: '38640', iae: '',
  },
  contacto: { persona: 'Luis Ramos', telefono: '922333444', telefonoTienda: '', email: 'luis@orosur.example' },
  titular: { nombre: 'Luis Ramos', dni: '11223344X' },
  cobro: { iban: 'ES9121000418450200051332' },
  password: 'otra-clave-larga-2026',
  condiciones: true,
}
r = await call(cuenta, { method: 'POST', body: OTRA })
const cookieOtra = cookieFrom(r)
r = await call(cierres, { method: 'GET', cookie: cookieOtra, url: `?ref=${cierre.ref}` })
check('otro cliente no puede abrir un cierre ajeno → 404', r.statusCode === 404, r.statusCode)
r = await call(cierres, { method: 'GET', cookie: cookieOtra })
check('otro cliente no ve cierres que no son suyos', (r.body.cierres || []).length === 0, r.body.cierres?.length)

r = await call(cierres, {
  method: 'POST', cookie: cookieOtra,
  body: { lineas: [{ metal: 'gold', key: LEY_ORO, gramos: 10 }] },
})
check('un cliente sin aprobar no puede cerrar → 403', r.statusCode === 403, r.statusCode)

// ─── 12.15. Confirmar y rechazar ────────────────────────────────────────────
r = await call(cierres, { method: 'PUT', cookie: cookieCliente, body: { ref: cierre.ref, accion: 'confirmar' } })
check('un cliente no puede confirmar su propio cierre → 403', r.statusCode === 403, r.statusCode)

r = await call(cierres, { method: 'PUT', cookie, body: { ref: cierre.ref, accion: 'rechazar' } })
check('rechazar sin motivo → 422', r.statusCode === 422, r.statusCode)

r = await call(cierres, {
  method: 'PUT', cookie,
  body: { ref: cierre.ref, accion: 'confirmar', totalVisto: cierre.total + 100 },
})
check('confirmar un total distinto del que se ve → 409', r.statusCode === 409, r.statusCode)

r = await call(cierres, {
  method: 'PUT', cookie,
  body: { ref: cierre.ref, accion: 'confirmar', totalVisto: cierre.total },
})
check('confirmar → 200', r.body.cierre?.estado === 'confirmado', r.statusCode)
check('la confirmación queda firmada', r.body.cierre?.decididoPor === 'miguel', r.body.cierre?.decididoPor)

r = await call(cierres, { method: 'PUT', cookie, body: { ref: cierre.ref, accion: 'confirmar' } })
check('no se confirma dos veces → 409', r.statusCode === 409, r.statusCode)

r = await call(cierres, { method: 'DELETE', cookie: cookieCliente, body: { ref: cierre.ref } })
check('un cierre confirmado ya no se anula → 409', r.statusCode === 409, r.statusCode)

// ─── 12.16. La reserva vencida se vuelve a valorar ──────────────────────────
r = await call(cierres, {
  method: 'POST', cookie: cookieCliente,
  body: { lineas: [{ metal: 'gold', key: LEY_ORO, gramos: 50 }] },
})
const caducado = r.body.cierre
const totalAntes = caducado.total

// Se le adelanta el reloj a mano y se cambia el mercado: es lo que pasaría si
// nadie mira la bandeja durante una hora.
const { getCierre, guardarCierre } = await import(`${BASE}/_lib/cierres.js`)
await guardarCierre({ ...(await getCierre(caducado.ref)), expiraEn: new Date(Date.now() - 60000).toISOString() })
await setMarketCache({ fixing: { gold: 3800, silver: 34 }, change: { gold: 0, silver: 0 }, fetchedAt: Date.now() })

r = await call(cierres, { method: 'PUT', cookie, body: { ref: caducado.ref, accion: 'confirmar' } })
check('confirmar con la reserva vencida → 409, no se confirma', r.statusCode === 409, r.statusCode)
check('y se devuelve el precio nuevo', r.body.cierre?.total > totalAntes, `${totalAntes} → ${r.body.cierre?.total}`)
check('con la cotización actualizada', r.body.cierre?.fixing?.gold === 3800, JSON.stringify(r.body.cierre?.fixing))
check('el cierre sigue pendiente', r.body.cierre?.estado === 'pendiente', r.body.cierre?.estado)

r = await call(cierres, {
  method: 'PUT', cookie,
  body: { ref: caducado.ref, accion: 'confirmar', totalVisto: r.body.cierre.total },
})
check('confirmando el precio nuevo sí entra', r.body.cierre?.estado === 'confirmado', r.statusCode)

// ─── 12.17. Anular una solicitud propia ─────────────────────────────────────
r = await call(cierres, {
  method: 'POST', cookie: cookieCliente,
  body: { lineas: [{ metal: 'silver', key: LEY_PLATA, gramos: 1000 }] },
})
const anulable = r.body.cierre
r = await call(cierres, { method: 'DELETE', cookie: cookieOtra, body: { ref: anulable.ref } })
check('no se puede anular el cierre de otro → 404', r.statusCode === 404, r.statusCode)
r = await call(cierres, { method: 'DELETE', cookie: cookieCliente, body: { ref: anulable.ref } })
check('anular el propio → 200', r.body.cierre?.estado === 'anulado', r.statusCode)

// ─── 13. Fuerza bruta ────────────────────────────────────────────────────────
let blocked = false
let intentos = 0
for (let i = 0; i < 30; i++) {
  intentos++
  const attempt = await call(login, { method: 'POST', body: { username: 'miguel', password: `intento${i}` } })
  if (attempt.statusCode === 429) { blocked = true; break }
}
check('la IP se bloquea tras muchos intentos fallidos → 429', blocked, `${intentos} intentos`)
check('el margen es amplio (no bloquea por unos pocos errores)', intentos > 10, `${intentos} intentos`)

// ─── 14. Cierre de sesión ────────────────────────────────────────────────────
r = await call(session, { method: 'GET', cookie })
check('la sesión sigue viva antes de salir', r.statusCode === 200, r.statusCode)
r = await call(logout, { method: 'POST', cookie })
check('logout → 200', r.statusCode === 200, r.statusCode)
check('la cookie se borra', String(r.getHeader('set-cookie')).includes('Max-Age=0'))
r = await call(session, { method: 'GET', cookie })
check('la sesión ya no vale tras salir', r.statusCode === 401, r.statusCode)

// ─── 15. Retirar la cuenta invalida las sesiones abiertas ────────────────────
process.env.ADMIN_USERS = JSON.stringify([{ username: 'miguel', name: 'Miguel', password: hashPassword(PASSWORD) }])
// nueva sesión (los contadores de intentos se limpian al acertar)
store.clear(); expiry.clear()
r = await call(login, { method: 'POST', body: { username: 'miguel', password: PASSWORD } })
const cookie2 = cookieFrom(r)
check('nueva sesión creada', r.statusCode === 200, r.statusCode)
process.env.ADMIN_USERS = '[]' // se retira la cuenta
r = await call(session, { method: 'GET', cookie: cookie2 })
check('quitar la cuenta corta la sesión abierta al instante', r.statusCode === 401, r.statusCode)

server.close()
console.log(fails === 0 ? '\nTodas las comprobaciones de extremo a extremo pasan.' : `\n${fails} COMPROBACIONES FALLIDAS`)
process.exit(fails === 0 ? 0 : 1)
