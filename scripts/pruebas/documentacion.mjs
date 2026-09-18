import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createSpec } from '../../docs/api/openapi.mjs'
import { changedSources, coverageErrors, documents, inspectHandler, isDocumentationInput, sourceFingerprint, validateDocuments } from '../docs-core.mjs'
import { startDocs } from '../docs-server.mjs'

test('OpenAPI válido, todos los handlers cubiertos, ejemplos y artefactos sincronizados', async () => {
  const result = await validateDocuments(await documents())
  assert.equal(result.routes, 12)
  assert.equal(result.operations, 22)
})

test('la vista de lanzamiento excluye cierres y la completa conserva su estado aplazado', () => {
  const current = createSpec()
  const complete = createSpec({ complete: true })
  assert.equal(current.paths['/api/cierres'], undefined)
  assert.ok(complete.paths['/api/cierres'])
  for (const op of Object.values(complete.paths['/api/cierres'])) assert.equal(op['x-release-status'], 'deferred')
  assert.equal(complete['x-release-scope'].enforcedByDocumentation, false)
})

test('la regeneración no modifica contratos fuente y es determinista', () => {
  const first = createSpec({ complete: true })
  first.paths['/api/prices'].get.summary = 'Cambio ajeno a la fuente'
  assert.notEqual(createSpec({ complete: true }).paths['/api/prices'].get.summary, first.paths['/api/prices'].get.summary)
  assert.deepEqual(createSpec(), createSpec())
})

test('un cambio, alta o borrado de archivo exige revisión; no se aprueba automáticamente', () => {
  assert.deepEqual(changedSources({ 'api/a.js': 'nuevo', 'api/b.js': 'alta' }, { 'api/a.js': 'viejo', 'api/c.js': 'borrado' }), ['api/a.js', 'api/b.js', 'api/c.js'])
  const spec = createSpec({ sourceState: { pendingReview: ['api/a.js'] } })
  assert.match(spec.info.description, /REVISIÓN PENDIENTE/)
})

test('check rechaza explícitamente cambios de código no revisados', async () => {
  const docs = await documents()
  docs.complete['x-documentation'].pendingReview = ['api/_lib/validate.js']
  await assert.rejects(validateDocuments(docs, { requireGenerated: false }), /Revisar contrato.*validate\.js/)
})

test('la cobertura detecta rutas, métodos, acciones y respuestas añadidos', async () => {
  const docs = await documents()
  const inventory = docs.complete['x-documentation'].inventory
  inventory['/api/nueva'] = { file: 'api/nueva.js', methods: ['post'], actions: [], statuses: ['201'] }
  inventory['/api/portal/cuenta'].actions.push('accion_nueva')
  inventory['/api/prices'].methods.push('delete')
  inventory['/api/prices'].statuses.push('418')
  const failures = coverageErrors(docs.complete).join('\n')
  assert.match(failures, /Falta la ruta \/api\/nueva/)
  assert.match(failures, /Acciones distintas.*cuenta/)
  assert.match(failures, /Métodos distintos.*prices/)
  assert.match(failures, /Falta respuesta 418/)
})

test('el inventario reconoce las convenciones de handlers actuales', () => {
  assert.deepEqual(inspectHandler("if (req.method === 'HEAD') {} if (accion !== 'enviar') {} return methodNotAllowed(res, ['GET', 'POST']); json(res, 201, {})"), {
    methods: ['get', 'head', 'post'], actions: ['enviar'], statuses: ['201'],
  })
})

test('el observador incluye reglas compartidas y excluye secretos y JSON generados', () => {
  assert.ok(isDocumentationInput('api/_lib/validate.js'))
  assert.ok(isDocumentationInput('src/components/Contact.jsx'))
  assert.ok(isDocumentationInput('docs/api/schemas.mjs'))
  assert.equal(isDocumentationInput('.env.local'), false)
  assert.equal(isDocumentationInput('docs/openapi.json'), false)
  assert.equal(isDocumentationInput('node_modules/paquete/index.js'), false)
})

test('las huellas son reproducibles entre Windows y CI Linux, conservando cambios de contenido', () => {
  assert.equal(sourceFingerprint('const limite = 10\r\nconst estado = "pendiente"\r\n'), sourceFingerprint('const limite = 10\nconst estado = "pendiente"\n'))
  assert.notEqual(sourceFingerprint('const limite = 10\n'), sourceFingerprint('const limite = 11\n'))
})

test('el servidor documental es solo lectura y no expone API, archivos arbitrarios ni secretos', async t => {
  const server = await startDocs({ port: 0, observe: false, log: () => {} })
  t.after(async () => { server.closeAllConnections(); server.close(); await once(server, 'close') })
  const base = `http://127.0.0.1:${server.address().port}`
  for (const path of ['/docs/', '/docs/guia', '/docs/openapi.json', '/docs/openapi.actual.json', '/docs/status.json', '/docs/assets/swagger-ui-bundle.js']) {
    const response = await fetch(base + path)
    assert.equal(response.status, 200, path)
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/)
    await response.arrayBuffer()
  }
  for (const path of ['/api/prices', '/.env.local', '/docs/.env.local', '/docs/../package.json', '/docs/archivo-desconocido']) {
    const response = await fetch(base + path)
    assert.equal(response.status, 404, path)
    await response.text()
  }
  const post = await fetch(base + '/docs/openapi.json', { method: 'POST', body: '{}' })
  assert.equal(post.status, 405)
  assert.equal(post.headers.get('allow'), 'GET, HEAD')
  await post.text()
})
