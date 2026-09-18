// Cierres de punta a punta, sin red: el cliente pide, TQM ajusta y confirma.
//
// Lo que se está comprobando es lo que duele si se rompe: que un cliente no
// pueda tocar precios, que un precio puesto a mano por una persona no lo pise
// el mercado, y que lo que el cliente pidió no se pierda al ajustarlo.
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
const cuenta = (await import(`${BASE}/portal/cuenta.js`)).default
const cierres = (await import(`${BASE}/cierres.js`)).default
const store = await import(`${BASE}/_lib/store.js`)
const lib = await import(`${BASE}/_lib/cierres.js`)
const { gradePrice } = await import(`${BASE}/_lib/defaults.js`)

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
    end(x) { this.body = x ? JSON.parse(x) : null; this._d() },
  }
  return new Promise((ok, bad) => { res._d = () => ok(res); Promise.resolve(h(req, res)).catch(bad) })
}

let fails = 0
const check = (n, c, e = '') => { console.log(`${c ? 'OK   ' : 'FALLA'}  ${n}${c ? '' : ` ← ${e}`}`); if (!c) fails++ }
const cerca = (a, b, t = 0.005) => Math.abs(Number(a) - Number(b)) <= t

// Sin clave de mercado no hay cotización fiable y un cierre no se firma con
// una cotización dudosa: se deja una en la caché, como si viniera de la API.
const FIXING = { gold: 3082, silver: 29.92 }
await store.setMarketCache({ fixing: FIXING, change: { gold: 0, silver: 0 }, fetchedAt: Date.now() })

// ─── Sesiones ────────────────────────────────────────────────────────────────

let r = await call(login, { method: 'POST', body: { username: 'local', password: PW } })
check('entra el personal de TQM', r.statusCode === 200, JSON.stringify(r.body))
const admin = String(r.getHeader('set-cookie') || '').split(';')[0]

r = await call(cuenta, { method: 'POST', body: { accion: 'demo' } })
check('hay un cliente aprobado de prueba', r.statusCode === 200, JSON.stringify(r.body))

r = await call(cuenta, { method: 'POST', body: { accion: 'entrar', email: r.body.email, password: r.body.password } })
check('entra el cliente', r.statusCode === 200, JSON.stringify(r.body))
const cliente = String(r.getHeader('set-cookie') || '').split(';')[0]

// ─── El cliente pide ─────────────────────────────────────────────────────────

r = await call(cierres, {
  method: 'POST', cookie: cliente,
  body: { lineas: [{ metal: 'gold', key: 'au18', gramos: 100 }, { metal: 'gold', key: 'au9', gramos: 50 }] },
})
check('el cliente pide un cierre', r.statusCode === 201, JSON.stringify(r.body).slice(0, 160))
const ref = r.body.cierre?.ref
const pedido = r.body.cierre

const formulas = await store.getFormulas()
const tarifa = (metal, key) => {
  const ley = formulas[metal].find(g => g.key === key)
  const dec = metal === 'silver' ? 3 : 2
  return Math.round(gradePrice(FIXING[metal], ley, Number(formulas.divisor) || 31.1) * 10 ** dec) / 10 ** dec
}

check('el precio lo pone el servidor, no el navegador',
  cerca(pedido.lineas[0].precioGramo, tarifa('gold', 'au18')), JSON.stringify(pedido.lineas[0]))

// ─── Las dos sesiones en el mismo navegador ──────────────────────────────────
//
// La tienda que además tiene el panel abierto, o alguien de TQM probando el
// portal: las dos cookies viajan a la misma URL y hay que saber a quién se está
// atendiendo.

const ambas = `${admin}; ${cliente}`
const otroLote = { lineas: [{ metal: 'gold', key: 'au18', gramos: 10 }] }

r = await call(cierres, { method: 'POST', cookie: ambas, body: otroLote })
check('con las dos sesiones y sin decir quién eres, manda la del panel', r.statusCode === 403, r.statusCode)

r = await call(cierres, { method: 'POST', cookie: ambas, portal: true, body: otroLote })
check('el portal se identifica y pide su cierre igual', r.statusCode === 201, JSON.stringify(r.body).slice(0, 160))

r = await call(cierres, { method: 'GET', url: '/api/cierres', cookie: ambas, portal: true })
check('y sigue viendo solo los suyos',
  r.body.cierres?.length > 0 && r.body.cierres.every(c => c.clienteId === pedido.clienteId),
  JSON.stringify(r.body.cierres).slice(0, 160))

// ─── Ajustar: quién puede y quién no ─────────────────────────────────────────

r = await call(cierres, {
  method: 'PUT', cookie: cliente,
  body: { ref, accion: 'ajustar', lineas: [{ metal: 'gold', key: 'au18', gramos: 100, precioGramo: 999 }] },
})
check('un cliente no puede ajustar su propio cierre', r.statusCode === 403, r.statusCode)

r = await call(cierres, {
  method: 'PUT', cookie: admin,
  body: { ref, accion: 'ajustar', lineas: [{ metal: 'gold', key: 'au18', gramos: 98.4, precioGramo: -3 }] },
})
check('un precio negativo se rechaza', r.statusCode === 422, r.statusCode)

r = await call(cierres, {
  method: 'PUT', cookie: admin,
  body: { ref, accion: 'ajustar', lineas: [{ metal: 'gold', key: 'au18', gramos: 98.4, precioGramo: 99999 }] },
})
check('un precio disparatado se rechaza', r.statusCode === 422, r.statusCode)

r = await call(cierres, {
  method: 'PUT', cookie: admin,
  body: { ref, accion: 'ajustar', lineas: [{ metal: 'gold', key: 'au18', gramos: 0 }] },
})
check('unos gramos a cero se rechazan', r.statusCode === 422, r.statusCode)

// ─── El ajuste bueno ─────────────────────────────────────────────────────────
//
// La báscula dice 98,4 gramos en vez de 100, se ha pactado 60 € el gramo, el 9k
// no venía en el paquete y aparece plata que no se había dicho.

r = await call(cierres, {
  method: 'PUT', cookie: admin,
  body: {
    ref, accion: 'ajustar', motivo: 'Pesado en tienda',
    lineas: [
      { metal: 'gold', key: 'au18', gramos: 98.4, precioGramo: 60 },
      { metal: 'silver', key: 'ag925', gramos: 1000 },
    ],
  },
})
check('TQM ajusta gramos, precio y líneas', r.statusCode === 200, JSON.stringify(r.body).slice(0, 200))

const ajustado = r.body.cierre
const esperado = Math.round((98.4 * 60 + 1000 * tarifa('silver', 'ag925')) * 100) / 100

check('el total sale de los números nuevos', cerca(ajustado?.total, esperado), `${ajustado?.total} ≠ ${esperado}`)
check('los gramos son los de la báscula', cerca(ajustado?.gramos, 1098.4), ajustado?.gramos)
check('el precio puesto a mano queda marcado', ajustado?.lineas[0]?.precioManual === true, JSON.stringify(ajustado?.lineas[0]))
check('y se guarda cuál era la tarifa', cerca(ajustado?.lineas[0]?.precioTarifa, tarifa('gold', 'au18')), ajustado?.lineas[0]?.precioTarifa)
check('la línea sin precio va a tarifa', ajustado?.lineas[1]?.precioManual === undefined && cerca(ajustado?.lineas[1]?.precioGramo, tarifa('silver', 'ag925')), JSON.stringify(ajustado?.lineas[1]))
check('lo que pidió el cliente no se pierde', cerca(ajustado?.pedido?.total, pedido.total), JSON.stringify(ajustado?.pedido).slice(0, 120))
check('el ajuste queda firmado', ajustado?.ajustadoPor === 'local' && ajustado?.ajustes?.at(-1)?.motivo === 'Pesado en tienda', JSON.stringify(ajustado?.ajustes))

// Al cliente le llega el lote y lo que pidió, pero no quién lo tocó.
r = await call(cierres, { method: 'GET', url: `/api/cierres?ref=${ref}`, cookie: cliente })
check('el cliente ve el lote ajustado', cerca(r.body.cierre?.total, esperado), r.body.cierre?.total)
check('el cliente ve lo que él pidió', cerca(r.body.cierre?.pedido?.total, pedido.total), JSON.stringify(r.body.cierre?.pedido))
check('pero no quién lo ajustó', r.body.cierre?.ajustadoPor === undefined && r.body.cierre?.ajustes === undefined, JSON.stringify(r.body.cierre?.ajustes))

// ─── Un segundo ajuste no pisa el original ───────────────────────────────────

r = await call(cierres, {
  method: 'PUT', cookie: admin,
  body: { ref, accion: 'ajustar', lineas: [{ metal: 'gold', key: 'au18', gramos: 98.4, precioGramo: 61 }] },
})
check('el segundo ajuste mantiene el pedido original',
  cerca(r.body.cierre?.pedido?.total, pedido.total) && r.body.cierre.ajustes.length === 2,
  JSON.stringify(r.body.cierre?.pedido).slice(0, 120))

// ─── El mercado no pisa un precio pactado ────────────────────────────────────

const doc = await lib.getCierre(ref)
await lib.guardarCierre({ ...doc, expiraEn: new Date(Date.now() - 60000).toISOString() })

r = await call(cierres, { method: 'PUT', cookie: admin, body: { ref, accion: 'confirmar', totalVisto: doc.total } })
check('con la reserva vencida se vuelve a valorar y se pide confirmar otra vez', r.statusCode === 409, r.statusCode)
check('pero el precio pactado sigue siendo el pactado',
  cerca(r.body.cierre?.lineas[0]?.precioGramo, 61), JSON.stringify(r.body.cierre?.lineas[0]))

// ─── Confirmar ───────────────────────────────────────────────────────────────

const total = r.body.cierre.total
r = await call(cierres, { method: 'PUT', cookie: admin, body: { ref, accion: 'confirmar', totalVisto: total } })
check('se confirma el número que se está viendo', r.statusCode === 200 && r.body.cierre.estado === 'confirmado', JSON.stringify(r.body).slice(0, 160))

r = await call(cierres, {
  method: 'PUT', cookie: admin,
  body: { ref, accion: 'ajustar', lineas: [{ metal: 'gold', key: 'au18', gramos: 1 }] },
})
check('un cierre confirmado ya no se ajusta', r.statusCode === 409, r.statusCode)

console.log(fails ? `\n${fails} comprobación(es) fallan.\n` : '\nCierres correctos.\n')
process.exit(fails ? 1 : 0)
