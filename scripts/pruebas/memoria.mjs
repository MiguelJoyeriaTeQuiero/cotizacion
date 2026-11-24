// Verifica el almacén en memoria (desarrollo local, sin Upstash ni nada).
import { Readable } from 'node:stream'
const BASE = new URL('../../api', import.meta.url).href
delete process.env.UPSTASH_REDIS_REST_URL
delete process.env.UPSTASH_REDIS_REST_TOKEN
delete process.env.VERCEL
delete process.env.GOLDAPI_KEY

const { hashPassword } = await import(`${BASE}/_lib/crypto.js`)
const PW = 'contrasena-de-prueba-local-2026'
process.env.ADMIN_USERS = JSON.stringify([{ username: 'local', name: 'Local', password: hashPassword(PW) }])

const login = (await import(`${BASE}/admin/login.js`)).default
const formulas = (await import(`${BASE}/admin/formulas.js`)).default
const history = (await import(`${BASE}/admin/history.js`)).default
const prices = (await import(`${BASE}/prices.js`)).default

function call(h, { method='GET', body, cookie, origin='http://localhost:3000' } = {}) {
  const p = body ? JSON.stringify(body) : ''
  const req = Readable.from(p ? [Buffer.from(p)] : [])
  req.method = method
  req.headers = { host: 'localhost:3000', 'user-agent': 'x' }
  if (origin) req.headers.origin = origin
  if (cookie) req.headers.cookie = cookie
  req.socket = { remoteAddress: '127.0.0.1' }
  const res = { statusCode: 200, _h: {}, setHeader(k,v){this._h[k.toLowerCase()]=v}, getHeader(k){return this._h[k.toLowerCase()]}, end(x){this.body=x?JSON.parse(x):null; this._d()} }
  return new Promise((ok, bad) => { res._d = () => ok(res); Promise.resolve(h(req,res)).catch(bad) })
}

let fails = 0
const check = (n, c, e='') => { console.log(`${c?'OK   ':'FALLA'}  ${n}${c?'':` ← ${e}`}`); if(!c) fails++ }

let r = await call(login, { method:'POST', body:{ username:'local', password:PW } })
check('login sin Upstash configurado', r.statusCode === 200, JSON.stringify(r.body))
const cookie = String(r.getHeader('set-cookie')||'').split(';')[0]

r = await call(formulas, { method:'GET', cookie })
check('la sesión sobrevive entre peticiones', r.statusCode === 200, r.statusCode)

const doc = { divisor: r.body.divisor, gold: r.body.gold, silver: r.body.silver, expectedVersion: r.body.version }
doc.gold[0].f1 = 0.9
r = await call(formulas, { method:'PUT', cookie, body: doc })
check('guardado en memoria', r.statusCode === 200, JSON.stringify(r.body).slice(0,120))

r = await call(prices, { method:'GET', origin:null })
check('el cambio se refleja en /api/prices', Math.abs(r.body.gold[0].pricePerGram - 999.9/1000*3082*0.9*0.99/31.1) < 1e-9, r.body.gold[0].pricePerGram)

r = await call(history, { method:'GET', cookie })
check('el historial funciona en memoria', r.body.entries?.length === 1, JSON.stringify(r.body).slice(0,120))

r = await call(login, { method:'POST', body:{ username:'local', password:'mala' } })
check('sigue rechazando contraseñas incorrectas', r.statusCode === 401, r.statusCode)

// ── Media del día con el almacén en memoria ──
const dia = await import(`${BASE}/_lib/precios-dia.js`)
const { redis, SERIES_MAX } = await import(`${BASE}/_lib/store.js`)
const SERIE = 'tqm:prices:series'
await redis().del(SERIE)
const muestra = (t, oro) => ({ t, fixing: { gold: oro, silver: 30 }, version: 1, gold: { au18: oro / 40 }, silver: { ag925: 0.9 } })
// Martes 3 de noviembre de 2026 (invierno): de 05:00 a 18:00, una por hora.
for (let h = 5; h <= 18; h++) await redis().lpush(SERIE, muestra(Date.UTC(2026, 10, 3, h), 3000 + h))
const ahoraMem = Date.UTC(2026, 10, 18, 12)
let m = await dia.mediaDelDia('2026-11-03', { ahora: ahoraMem })
check('la media sale de las muestras mientras están enteras', m.fuente === 'muestras' && m.media?.n === 10, JSON.stringify(m).slice(0, 160))
check('solo cuenta de 7:00 a 17:00', m.media?.fixing?.gold?.min === 3007 && m.media?.fixing?.gold?.max === 3016, JSON.stringify(m.media?.fixing))
check('un martes es laborable', m.laborable === true && m.festivo === null, JSON.stringify(m))
check('un día pasado ya no está en curso', m.enCurso === false)
check('la primera lectura resume los días que ya había', (await redis().get('tqm:prices:dia:2026-11-03'))?.horario?.n === 10)

// Se recortan las muestras: 1000 posteriores al día 3. La media sigue saliendo,
// ahora del resumen guardado.
await redis().del(SERIE)
const desde = Date.UTC(2026, 10, 5, 0)
for (let i = 0; i < SERIES_MAX; i++) await redis().lpush(SERIE, muestra(desde + i * 3600e3, 3100))
m = await dia.mediaDelDia('2026-11-03', { ahora: ahoraMem })
check('recortadas las muestras, la media sale del resumen', m.fuente === 'resumen' && m.media?.n === 10 && m.media?.fixing?.gold?.media === 3011.5, JSON.stringify(m).slice(0, 200))
m = await dia.mediaDelDia('2026-11-02', { ahora: ahoraMem })
check('un día sin registros no tiene media', m.fuente === null && m.media === null, JSON.stringify(m).slice(0, 160))

// Cada muestra nueva se suma al resumen de su día.
await dia.apuntarEnDia(muestra(Date.UTC(2026, 10, 3, 12, 30), 4000))
const resumen = await redis().get('tqm:prices:dia:2026-11-03')
check('una muestra nueva se suma a su día', resumen?.horario?.n === 11 && resumen?.dia?.n === 15, JSON.stringify(resumen?.horario).slice(0, 120))
await dia.apuntarEnDia(muestra(Date.UTC(2026, 10, 3, 20), 4000))
check('fuera de 7 a 17 solo cuenta para el día entero', (await redis().get('tqm:prices:dia:2026-11-03'))?.horario?.n === 11)

m = await dia.mediaDelDia('2026-11-07', { ahora: ahoraMem })
check('un sábado se calcula igual, marcado como no laborable', m.laborable === false && m.media?.n > 0, JSON.stringify(m).slice(0, 160))
m = await dia.mediaDelDia('2026-11-18', { ahora: ahoraMem })
check('hoy antes de las 17:00 está en curso', m.enCurso === true)
await redis().del(SERIE)

// Lo más importante: en Vercel este atajo NO puede activarse.
process.env.VERCEL = '1'
process.env.NODE_ENV = 'production'
const store = await import(`${BASE}/_lib/store.js?produccion`)
check('en producción sin Upstash NO hay almacén en memoria', store.hasStorage() === false)
let lanzo = false
try { store.redis() } catch (e) { lanzo = e.code === 'STORAGE_NOT_CONFIGURED' }
check('en producción sin Upstash la función falla en vez de improvisar', lanzo)

console.log(fails===0 ? '\nAlmacén en memoria correcto.' : `\n${fails} FALLOS`)
process.exit(fails===0?0:1)
