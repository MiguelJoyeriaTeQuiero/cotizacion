import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve, relative, sep } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { createSpec } from '../docs/api/openapi.mjs'

export const ROOT = fileURLToPath(new URL('../', import.meta.url))
export const OUTPUTS = ['docs/openapi.actual.json', 'docs/openapi.json']
export const REVIEW_FILE = 'docs/reviewed-sources.json'
export const WATCH_DIRECTORIES = ['api', 'src', 'docs/api', 'docs/ui']
export const WATCH_FILES = ['package.json', 'package-lock.json', 'vite.config.js', 'vercel.json', 'docs/guia.md', REVIEW_FILE, 'PRODUCT.md', 'PANEL.md', 'PORTAL.md', 'DESIGN.md']
const METHODS = ['get', 'head', 'post', 'put', 'patch', 'delete', 'options', 'trace']
const hash = value => createHash('sha256').update(value).digest('hex')
export const sourceFingerprint = value => hash(value.replace(/\r\n?/g, '\n'))
export const serialize = value => `${JSON.stringify(value, null, 2)}\n`
const read = file => readFile(resolve(ROOT, file), 'utf8')

export async function filesUnder(directory) {
  const entries = await readdir(resolve(ROOT, directory), { withFileTypes: true })
  const lists = await Promise.all(entries.map(entry => {
    const name = `${directory}/${entry.name}`
    return entry.isDirectory() ? filesUnder(name) : [name]
  }))
  return lists.flat().sort()
}

export async function sourceFiles() {
  const api = await filesUnder('api')
  return [...api.filter(f => f.endsWith('.js')), 'src/admin/api.js', 'src/portal/api.js', 'package.json', 'package-lock.json', 'vite.config.js', 'vercel.json'].sort()
}

export async function fingerprints(files) {
  // Git puede convertir CRLF/LF entre Windows y CI Linux; no es un cambio de contrato.
  return Object.fromEntries(await Promise.all(files.map(async file => [file, sourceFingerprint(await read(file))])))
}

export function changedSources(current, reviewed) {
  return [...new Set([...Object.keys(current), ...Object.keys(reviewed)])]
    .filter(file => current[file] !== reviewed[file]).sort()
}

/** Inventario de las convenciones usadas por los handlers actuales, sin ejecutarlos. */
export function inspectHandler(code) {
  const methods = new Set([...code.matchAll(/req\.method\s*!?==?=?\s*['"]([A-Z]+)['"]/g)].map(m => m[1].toLowerCase()))
  for (const match of code.matchAll(/methodNotAllowed\(res,\s*\[([^\]]+)\]/g)) {
    for (const method of match[1].matchAll(/['"]([A-Z]+)['"]/g)) methods.add(method[1].toLowerCase())
  }
  const actions = new Set([...code.matchAll(/accion\s*!?==?=?\s*['"]([^'"]+)['"]/g)].map(m => m[1]))
  const map = code.match(/const ACCIONES\s*=\s*\{([^}]+)\}/)?.[1] || ''
  for (const match of map.matchAll(/\b([a-z]+)\s*:/g)) actions.add(match[1])
  const statuses = [...new Set([...code.matchAll(/json\(\s*res,\s*(\d{3})\b/g)].map(m => m[1]))].sort()
  return { methods: [...methods].filter(m => METHODS.includes(m)).sort(), actions: [...actions].sort(), statuses }
}

export async function inventory() {
  const api = (await filesUnder('api')).filter(file => file.endsWith('.js') && !file.startsWith('api/_lib/'))
  return Object.fromEntries(await Promise.all(api.map(async file => [`/${file.slice(0, -3)}`, { file, ...inspectHandler(await read(file)) }])))
}

export async function documents() {
  const current = await fingerprints(await sourceFiles())
  let reviewed = {}
  try { reviewed = JSON.parse(await read(REVIEW_FILE)).sources || {} } catch (err) { if (err.code !== 'ENOENT') throw err }
  const sourceInventory = await inventory()
  const projectFiles = [...await filesUnder('src'), ...await filesUnder('api'), ...WATCH_FILES.filter(f => f !== REVIEW_FILE)].sort()
  const projectHash = hash(serialize(await fingerprints(projectFiles)))
  const pendingReview = changedSources(current, reviewed)
  const version = JSON.parse(await read('package.json')).version
  const sourceState = {
    status: pendingReview.length ? 'needs-review' : 'reviewed', pendingReview,
    sourceHash: hash(serialize(current)), projectHash,
    inventory: sourceInventory,
    automation: 'Regenerado desde contratos versionados. Cambios en código protegido requieren revisar y registrar el contrato; no se infieren reglas de negocio.',
  }
  return {
    current: createSpec({ version, sourceState }), complete: createSpec({ complete: true, version, sourceState }), fingerprints: current,
  }
}

export async function generate() {
  const docs = await documents()
  for (const [file, spec] of [[OUTPUTS[0], docs.current], [OUTPUTS[1], docs.complete]]) {
    const next = serialize(spec)
    let old = ''
    try { old = await read(file) } catch (err) { if (err.code !== 'ENOENT') throw err }
    if (old !== next) await writeFile(resolve(ROOT, file), next)
  }
  return docs
}

export function coverageErrors(spec) {
  const failures = []
  const inventory = spec['x-documentation'].inventory
  for (const [path, entry] of Object.entries(inventory)) {
    const documented = spec.paths[path]
    if (!documented) { failures.push(`Falta la ruta ${path}`); continue }
    const actualMethods = Object.keys(documented).filter(m => METHODS.includes(m)).sort()
    if (serialize(actualMethods) !== serialize(entry.methods)) failures.push(`Métodos distintos en ${path}: código=${entry.methods}; contrato=${actualMethods}`)
    const actions = [...new Set(actualMethods.flatMap(m => documented[m]['x-actions'] || []))].sort()
    if (serialize(actions) !== serialize(entry.actions)) failures.push(`Acciones distintas en ${path}: código=${entry.actions}; contrato=${actions}`)
    const statuses = new Set(actualMethods.flatMap(m => Object.keys(documented[m].responses)))
    for (const status of entry.statuses) if (!statuses.has(status)) failures.push(`Falta respuesta ${status} de ${path}`)
    for (const method of actualMethods) if (documented[method]['x-source-file'] !== entry.file) failures.push(`Fuente incorrecta: ${method.toUpperCase()} ${path}`)
  }
  for (const path of Object.keys(spec.paths)) if (!inventory[path]) failures.push(`Ruta documentada inexistente: ${path}`)
  return failures
}

// OpenAPI 3.0 usa límites exclusivos booleanos; JSON Schema/Ajv usa el número.
function exampleSchema(value) {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(exampleSchema)
  const result = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, exampleSchema(child)]))
  for (const [exclusive, limit] of [['exclusiveMinimum', 'minimum'], ['exclusiveMaximum', 'maximum']]) {
    if (typeof result[exclusive] === 'boolean') {
      if (result[exclusive]) result[exclusive] = result[limit]
      else delete result[exclusive]
    }
  }
  return result
}

function exampleErrors(spec) {
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true })
  addFormats(ajv)
  // password/binary/byte son formatos OpenAPI, no validaciones estructurales adicionales.
  for (const format of ['password', 'binary', 'byte', 'int32', 'int64', 'float', 'double']) ajv.addFormat(format, true)
  const failures = []
  const validateContent = (content, where) => {
    for (const [mime, media] of Object.entries(content || {})) {
      if (!media.schema || !mime.includes('json')) continue
      const validate = ajv.compile(exampleSchema({ ...media.schema, components: spec.components }))
      for (const [name, ex] of Object.entries(media.examples || {})) {
        if (!validate(ex.value)) failures.push(`${where}, ejemplo ${name}: ${ajv.errorsText(validate.errors)}`)
      }
    }
  }
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      const op = item[method]
      if (!op) continue
      validateContent(op.requestBody?.content, `${method.toUpperCase()} ${path}`)
      for (const [status, res] of Object.entries(op.responses)) validateContent(res.content, `${method.toUpperCase()} ${path} → ${status}`)
    }
  }
  return failures
}

export async function validateDocuments(docs, { requireReview = true, requireGenerated = true } = {}) {
  const failures = coverageErrors(docs.complete)
  for (const spec of [docs.current, docs.complete]) {
    // Copia: SwaggerParser puede resolver/modificar objetos. No permite $ref remotas.
    await SwaggerParser.validate(structuredClone(spec), { resolve: { external: false } })
    failures.push(...exampleErrors(spec))
  }
  if (docs.current.paths['/api/cierres']) failures.push('Cierres aparece en el perfil del alcance actual')
  for (const operation of Object.values(docs.complete.paths['/api/cierres'] || {})) {
    if (operation['x-release-status'] !== 'deferred') failures.push('Operación de cierres sin marca de aplazamiento')
  }
  if (requireReview && docs.complete['x-documentation'].pendingReview.length) failures.push(`Revisar contrato por cambios en: ${docs.complete['x-documentation'].pendingReview.join(', ')}`)
  if (requireGenerated) {
    for (const [file, spec] of [[OUTPUTS[0], docs.current], [OUTPUTS[1], docs.complete]]) {
      let saved = ''
      try { saved = await read(file) } catch (err) { if (err.code !== 'ENOENT') throw err }
      if (saved !== serialize(spec)) failures.push(`Archivo desactualizado: ${file}. Ejecutar npm run docs:generate.`)
    }
  }
  if (failures.length) throw new Error(failures.join('\n'))
  return { routes: Object.keys(docs.complete.paths).length, operations: Object.values(docs.complete.paths).reduce((n, item) => n + METHODS.filter(m => item[m]).length, 0) }
}

export async function recordReview() {
  const docs = await documents()
  await validateDocuments(docs, { requireReview: false, requireGenerated: false })
  await writeFile(resolve(ROOT, REVIEW_FILE), serialize({ description: 'Revisión explícita de contratos contra fuentes. No actualizar automáticamente ante cambios de API.', sources: docs.fingerprints }))
  return generate()
}

export function isDocumentationInput(file) {
  const normalized = relative(ROOT, resolve(ROOT, file)).split(sep).join('/')
  return WATCH_FILES.includes(normalized) || WATCH_DIRECTORIES.some(dir => normalized.startsWith(`${dir}/`))
}
