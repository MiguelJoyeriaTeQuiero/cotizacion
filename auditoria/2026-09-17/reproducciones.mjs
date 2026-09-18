// Diagnóstico local de la auditoría. No carga .env ni contacta servicios reales.
// Cada COMPROBADO indica que se reproduce el comportamiento descrito, no que sea correcto.
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { readFile } from 'node:fs/promises'
import { MockAgent, setGlobalDispatcher } from 'undici'

const network = new MockAgent()
network.disableNetConnect()
setGlobalDispatcher(network)

for (const key of [
  'VERCEL', 'VERCEL_ENV', 'NODE_ENV', 'ADMIN_USER', 'ADMIN_PASSWORD', 'ADMIN_USERS',
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
  'GOLDAPI_KEY', 'BLOB_READ_WRITE_TOKEN', 'RESEND_API_KEY', 'CORREO_DESDE',
  'VERCEL_BLOB_API_URL', 'NEXT_PUBLIC_VERCEL_BLOB_API_URL',
]) delete process.env[key]
process.env.NODE_ENV = 'test'
process.env.ADMIN_USER = 'auditoria'
process.env.ADMIN_PASSWORD = 'solo-datos-sinteticos-2026'
globalThis.fetch = async () => { throw new Error('Red externa desactivada en la auditoría') }

const store = await import('../../api/_lib/store.js')
const clientes = await import('../../api/_lib/clientes.js')
const cierres = await import('../../api/_lib/cierres.js')
const auth = await import('../../api/_lib/auth.js')
const crypto = await import('../../api/_lib/crypto.js')
const { DEFAULT_FORMULAS, gradePrice } = await import('../../api/_lib/defaults.js')
const { resolveMarket } = await import('../../api/_lib/market.js')
const { csvCierre, pdfCierre } = await import('../../api/_lib/justificante.js')
const { readJson, parseCookies, isSameOrigin } = await import('../../api/_lib/http.js')
const { default: cuenta } = await import('../../api/portal/cuenta.js')
const { default: formulas } = await import('../../api/admin/formulas.js')
const { default: cierreEndpoint } = await import('../../api/cierres.js')
const { default: documentos } = await import('../../api/portal/documentos.js')

const r = store.redis()
const resultados = []
const cookieOf = res => String(res.headers['set-cookie'] || '').split(';')[0]
async function call(handler, { method = 'GET', body, cookie, headers = {}, url = '/' } = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  Object.assign(req, { method, url, headers: { host: 'localhost:3000', origin: 'http://localhost:3000', ...headers } })
  req.socket = { remoteAddress: '127.0.0.1' }
  if (cookie) req.headers.cookie = cookie
  const res = {
    statusCode: 200, headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v },
    end(raw) { this.body = raw ? JSON.parse(raw) : null },
  }
  await handler(req, res)
  return res
}
async function check(id, fn) {
  try {
    const evidencia = await fn()
    resultados.push({ id, reproducido: true, evidencia })
    console.log(`COMPROBADO ${id}: ${JSON.stringify(evidencia)}`)
  } catch (err) {
    resultados.push({ id, reproducido: false, error: err.message })
    console.error(`NO REPRODUCIDO ${id}: ${err.message}`)
    process.exitCode = 1
  }
}
const datos = (n) => ({
  empresa: { razonSocial: `Empresa sintética ${n}`, cif: `B${String(n).padStart(8, '0')}`, nombreComercial: '', direccion: 'Calle de Pruebas 1', poblacion: 'Pruebas', provincia: 'Pruebas', cp: '38001', iae: '' },
  contacto: { persona: 'Persona de prueba', telefono: '922000000', telefonoTienda: '', email: `audit${n}@example.test` },
  titular: { nombre: 'Persona de prueba', dni: '00000000T' },
  cobro: { iban: 'ES9121000418450200051332' },
})
const passwordHash = crypto.hashPassword('solo-pruebas-2026')
const crear = (n) => clientes.crearCliente(datos(n), { passwordHash, ip: '127.0.0.1', condicionesVersion: 'prueba' })
const cliente = await crear(1)
const fakeReq = { headers: {}, socket: { remoteAddress: '127.0.0.1' } }
const adminRes = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v } }
await auth.startSession(adminRes, auth.findUser('auditoria'), fakeReq)
const adminCookie = cookieOf(adminRes)
const fixing = { gold: 3082, silver: 29.92 }
const freshMarket = async () => store.setMarketCache({ fixing, change: { gold: 0, silver: 0 }, fetchedAt: Date.now() })
const lineas = [{ metal: 'gold', key: 'au18', gramos: 100 }]
await freshMarket()
const valoracion = await cierres.valorar(lineas)

await check('S01-documento-ajeno', async () => {
  const { token } = await clientes.abrirSesionCliente(cliente, fakeReq)
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_auditstore_tokenficticio'
  const prevFetch = globalThis.fetch
  const peticiones = []
  network.get('https://auditstore.private.blob.vercel-storage.com')
    .intercept({ path: '/clientes/cli_otra_cuenta/privado.pdf', method: 'GET' })
    .reply(200, '%PDF-1.4\narchivo sintetico', { headers: { 'content-type': 'application/pdf', 'content-length': '26' } })
  process.env.VERCEL_BLOB_API_URL = 'https://blob-api.example.test'
  network.get('https://blob-api.example.test')
    .intercept({ path: '/delete', method: 'POST' })
    .reply(opts => { peticiones.push({ method: 'POST', body: opts.body }); return { statusCode: 200, data: '{}' } })
  try {
    const foreign = 'https://auditstore.private.blob.vercel-storage.com/clientes/cli_otra_cuenta/privado.pdf'
    const attached = await call(documentos, { method: 'POST', cookie: `tqm_cliente=${token}`, body: {
      accion: 'confirmar', pathname: `clientes/${cliente.id}/propio.pdf`, url: foreign, nombre: 'prueba.pdf', etiqueta: 'Prueba',
    } })
    assert.equal(attached.statusCode, 200)
    const saved = await clientes.getCliente(cliente.id)
    assert.equal(saved.documentos[0].url, foreign)
    const deleted = await call(documentos, { method: 'DELETE', cookie: `tqm_cliente=${token}`, body: { id: saved.documentos[0].id } })
    assert.equal(deleted.statusCode, 200)
    const requestedDelete = peticiones.some(p => p.method !== 'GET' && String(p.body).includes(foreign))
    assert.ok(requestedDelete)
    return { asociacion: attached.statusCode, borrado: deleted.statusCode, solicitoBorrarUrlAjena: requestedDelete, servicio: 'Blob simulado, sin red' }
  } finally { globalThis.fetch = prevFetch; delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.VERCEL_BLOB_API_URL }
})

await check('S02-codigo-doble-consumo', async () => {
  const { token } = await clientes.crearCodigoClave(await clientes.getCliente(cliente.id))
  const results = await Promise.all([clientes.consumirCodigoClave(token), clientes.consumirCodigoClave(token)])
  assert.equal(results.filter(Boolean).length, 2)
  return { consumosAceptados: 2 }
})

await check('S03-codigo-anterior-sigue-vivo', async () => {
  const old = await clientes.crearCodigoClave(await clientes.getCliente(cliente.id))
  const newer = await clientes.crearCodigoClave(await clientes.getCliente(cliente.id))
  const current = await clientes.consumirCodigoClave(newer.token)
  await clientes.cambiarClave(current, passwordHash)
  assert.ok(await clientes.consumirCodigoClave(old.token))
  return { codigoAnteriorAceptadoTrasCambiarClave: true }
})

await check('S04-sesion-admin-tras-rotacion', async () => {
  process.env.ADMIN_PASSWORD = 'otra-contrasena-de-auditoria'
  const active = await auth.readSession({ headers: { cookie: adminCookie } })
  assert.ok(active)
  return { sesionAnteriorContinuaValida: true }
})

await check('C01-publicaciones-simultaneas', async () => {
  const base = await store.getFormulas()
  const payload = { ...structuredClone(DEFAULT_FORMULAS), expectedVersion: base.version }
  const results = await Promise.all([10, 20].map(f3 => call(formulas, { method: 'PUT', cookie: adminCookie, body: { ...payload, gold: payload.gold.map(g => ({ ...g, f3 })) } })))
  assert.deepEqual(results.map(x => x.statusCode), [200, 200])
  assert.equal(results[0].body.version, results[1].body.version)
  return { respuestas: results.map(x => x.statusCode), versiones: results.map(x => x.body.version) }
})

await check('C02-indice-pierde-clientes', async () => {
  const created = await Promise.all([crear(2), crear(3)])
  const index = await clientes.listarClientes()
  const presentes = created.filter(c => index.some(x => x.id === c.id)).length
  assert.equal(presentes, 1)
  return { expedientesCreados: 2, visiblesEnIndice: presentes }
})

await check('C03-revaloriza-y-confirma-con-mercado-obsoleto', async () => {
  const created = await cierres.crearCierre({ cliente, valoracion, reservaMinutos: 60, ip: 'prueba' })
  await cierres.guardarCierre({ ...created, expiraEn: new Date(Date.now() - 1000).toISOString() })
  await store.setMarketCache({ fixing, fetchedAt: Date.now() - 86400000 })
  const renewed = await call(cierreEndpoint, { method: 'PUT', cookie: adminCookie, body: { ref: created.ref, accion: 'confirmar', totalVisto: created.total } })
  assert.equal(renewed.statusCode, 409)
  assert.equal(renewed.body.revalorizado, true)
  const confirmed = await call(cierreEndpoint, { method: 'PUT', cookie: adminCookie, body: { ref: created.ref, accion: 'confirmar', totalVisto: renewed.body.cierre.total } })
  assert.equal(confirmed.statusCode, 200)
  assert.equal(confirmed.body.cierre.estado, 'confirmado')
  return { primeraRespuesta: 409, segundaRespuesta: 200, resultado: 'confirmado', antiguedadMercadoHoras: 24 }
})

await check('C04-fallback-formulas-operativo', async () => {
  await freshMarket()
  const get = r.get
  r.get = async function (key) { if (key === 'tqm:formulas') throw new Error('fallo sintético de fórmulas'); return get.call(this, key) }
  try {
    const result = await cierres.valorar(lineas)
    assert.ok(result.ok && !result.stale)
    return { ok: result.ok, stale: result.stale, version: result.formulasVersion, usoFormulasDeRespaldo: true }
  } finally { r.get = get }
})

await check('C05-referencia-se-repite-al-anio', async () => {
  const RealDate = globalThis.Date
  let clock = RealDate.parse('2026-09-17T12:00:00Z')
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [clock])) } static now() { return clock } }
  try {
    // Fecha aislada respecto al contador usado por los casos anteriores.
    await r.del('tqm:cierres:seq:1709')
    const one = await cierres.crearCierre({ cliente, valoracion, reservaMinutos: 60, ip: 'prueba' })
    clock = RealDate.parse('2027-09-17T12:00:00Z')
    const two = await cierres.crearCierre({ cliente, valoracion, reservaMinutos: 60, ip: 'prueba' })
    assert.equal(one.ref, two.ref)
    assert.equal((await cierres.getCierre(one.ref)).creadoEn, two.creadoEn)
    return { mismaReferencia: one.ref, originalSobrescrito: true }
  } finally { globalThis.Date = RealDate }
})

await check('S05-formula-en-csv', async () => {
  const csv = csvCierre({ ref: 'PRUEBA', estado: 'confirmado', cliente: { razonSocial: '=1+1' }, lineas: valoracion.lineas })
  assert.ok(csv.includes(';=1+1;'))
  return { celdaDeTextoExportadaComoFormula: '=1+1' }
})

await check('C06-redondeo-web-servidor', async () => {
  await r.set('tqm:formulas', structuredClone(DEFAULT_FORMULAS))
  await freshMarket()
  const server = await cierres.valorar([{ metal: 'gold', key: 'au18', gramos: 1000 }])
  const grade = DEFAULT_FORMULAS.gold.find(g => g.key === 'au18')
  const preview = Math.round(gradePrice(fixing.gold, grade, DEFAULT_FORMULAS.divisor) * 1000 * 100) / 100
  assert.notEqual(preview, server.total)
  return { gramos: 1000, resumenPortal: preview, totalServidor: server.total, diferencia: Math.round((preview - server.total) * 100) / 100 }
})

await check('C07-peso-positivo-redondea-a-cero', async () => {
  const result = cierres.validarLineas([{ metal: 'gold', key: 'au18', gramos: 0.0001 }])
  assert.ok(result.ok && result.value[0].gramos === 0)
  return { entrada: 0.0001, aceptado: result.ok, gramosGuardados: 0 }
})

await check('P01-estampida-cache-mercado', async () => {
  await r.del('tqm:prices:cache')
  process.env.GOLDAPI_KEY = 'solo-prueba'
  const previous = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ price: 100, chp: 0 }), { headers: { 'content-type': 'application/json' } }) }
  try {
    await Promise.all(Array.from({ length: 5 }, () => resolveMarket(60)))
    assert.equal(calls, 10)
    return { peticionesConcurrentes: 5, llamadasProveedorSimulado: calls, necesariasConCoordinacion: 2 }
  } finally { globalThis.fetch = previous; delete process.env.GOLDAPI_KEY }
})

await check('S06-limite-json-preparseado', async () => {
  const req = Readable.from([])
  req.body = { texto: 'a'.repeat(70000) }
  const result = await readJson(req, 1024)
  assert.equal(result.texto.length, 70000)
  return { limiteDeclarado: 1024, textoAceptado: 70000 }
})

await check('S07-cookie-malformada', async () => {
  assert.throws(() => parseCookies({ headers: { cookie: 'cualquiera=%ZZ' } }), URIError)
  return { cookieNoRelacionadaRompeParser: true }
})

await check('S08-origen-confia-en-forwarded-host', async () => {
  const accepted = isSameOrigin({ headers: { host: 'localhost:3000', 'x-forwarded-host': 'otro.example.test', origin: 'https://otro.example.test' } })
  assert.equal(accepted, true)
  return { aceptado: true, alcance: 'unidad; depende de que el proxy permita esa cabecera' }
})

await check('S09-login-propio-borra-limite-ip', async () => {
  const current = await clientes.getCliente(cliente.id)
  await store.bumpRate('portal:login:127.0.0.1', 900)
  const before = (await store.readRate('portal:login:127.0.0.1')).count
  const logged = await call(cuenta, { method: 'POST', body: { accion: 'entrar', email: current.contacto.email, password: 'solo-pruebas-2026' } })
  assert.equal(logged.statusCode, 200)
  const after = (await store.readRate('portal:login:127.0.0.1')).count
  assert.ok(before > 0 && after === 0)
  return { intentosAntes: before, intentosDespues: after }
})

await check('S10-alta-enumera-sin-consumir-cupo', async () => {
  const body = { accion: 'alta', ...datos(1), password: 'solo-pruebas-2026', condiciones: true }
  const results = []
  for (let i = 0; i < 7; i++) results.push((await call(cuenta, { method: 'POST', body })).statusCode)
  const count = (await store.readRate('portal:alta:127.0.0.1')).count
  assert.ok(results.every(x => x === 409) && count === 0)
  return { respuestas: results, cupoConsumido: count }
})

await check('C08-confirmacion-y-anulacion-concurrentes', async () => {
  const current = await clientes.getCliente(cliente.id)
  const { token } = await clientes.abrirSesionCliente(current, fakeReq)
  const created = await cierres.crearCierre({ cliente: current, valoracion, reservaMinutos: 60, ip: 'prueba' })
  const results = await Promise.all([
    call(cierreEndpoint, { method: 'PUT', cookie: adminCookie, body: { ref: created.ref, accion: 'confirmar', totalVisto: created.total } }),
    call(cierreEndpoint, { method: 'DELETE', cookie: `tqm_cliente=${token}`, body: { ref: created.ref } }),
  ])
  assert.deepEqual(results.map(x => x.statusCode), [200, 200])
  return { respuestas: results.map(x => ({ status: x.statusCode, estado: x.body.cierre.estado })), persistido: (await cierres.getCierre(created.ref)).estado }
})

await check('C09-ajuste-recalcula-con-formula-nueva', async () => {
  await r.set('tqm:formulas', structuredClone(DEFAULT_FORMULAS))
  await freshMarket()
  const priced = await cierres.valorar(lineas)
  const created = await cierres.crearCierre({ cliente, valoracion: priced, reservaMinutos: 60, ip: 'prueba' })
  await r.set('tqm:formulas', { ...structuredClone(DEFAULT_FORMULAS), version: 99, gold: DEFAULT_FORMULAS.gold.map(g => ({ ...g, f3: 10 })) })
  const adjusted = await cierres.ajustarCierre(created, lineas, { por: 'prueba', motivo: 'mismos gramos' })
  assert.equal(adjusted.cierre.lineas[0].precioGramo, priced.lineas[0].precioGramo + 10)
  assert.equal(adjusted.cierre.formulasVersion, priced.formulasVersion)
  return { precioReservado: priced.lineas[0].precioGramo, precioAjustado: adjusted.cierre.lineas[0].precioGramo, versionRegistrada: adjusted.cierre.formulasVersion, formulaAplicada: 99 }
})

await check('C10-pdf-24-lineas-sale-de-pagina', async () => {
  const rows = Array.from({ length: 24 }, () => ({ ...valoracion.lineas[0], precioManual: true, precioTarifa: 70 }))
  const pdf = pdfCierre({ ref: 'PRUEBA', estado: 'confirmado', cliente: datos(1).empresa, lineas: rows, total: 100, gramos: 100, fixing, creadoEn: new Date().toISOString() }).toString('latin1')
  const ys = [...pdf.matchAll(/1 0 0 1 [-\d.]+ ([-\d.]+) Tm/g)].map(m => Number(m[1]))
  assert.ok(ys.some(y => y < 0))
  return { lineas: rows.length, textoFueraDePagina: true, coordenadaMinima: Math.min(...ys) }
})

await check('C11-csp-bloquea-sdk-blob', async () => {
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'))
  const portal = config.headers.find(x => x.source === '/portal/:path*')
  const csp = portal.headers.find(x => x.key === 'Content-Security-Policy').value
  const sdk = await readFile(new URL('../../node_modules/@vercel/blob/dist/chunk-YYMLUMXS.js', import.meta.url), 'utf8')
  assert.ok(sdk.includes('defaultVercelBlobApiUrl = "https://vercel.com/api/blob"'))
  assert.ok(!csp.includes('https://vercel.com'))
  return { destinoSdkInstalado: 'https://vercel.com/api/blob', permitidoEnConnectSrc: false, alcance: 'código y configuración, sin despliegue real' }
})

console.log(JSON.stringify({ comprobaciones: resultados.length, reproducidas: resultados.filter(r => r.reproducido).length }, null, 2))
await network.close()
