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
