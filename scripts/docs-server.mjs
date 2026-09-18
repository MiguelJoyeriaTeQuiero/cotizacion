import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { watch } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { marked } from 'marked'
import { ROOT, WATCH_DIRECTORIES, WATCH_FILES, isDocumentationInput } from './docs-core.mjs'

const require = createRequire(import.meta.url)
const swaggerRoot = require('swagger-ui-dist').getAbsoluteFSPath()
const publicRoot = resolve(ROOT, 'docs/ui')
const markdownPages = {
  '/docs/guia': ['Guía del proyecto', 'docs/guia.md'],
  '/docs/auditoria': ['Auditoría', 'auditoria/2026-09-17/INFORME.md'],
  '/docs/producto': ['Producto', 'PRODUCT.md'], '/docs/panel': ['Panel', 'PANEL.md'],
  '/docs/portal': ['Portal', 'PORTAL.md'], '/docs/diseno': ['Diseño', 'DESIGN.md'],
}
const staticFiles = new Map([
  ['/docs/', [resolve(publicRoot, 'index.html'), 'text/html; charset=utf-8']],
  ['/docs/app.js', [resolve(publicRoot, 'app.js'), 'text/javascript; charset=utf-8']],
  ['/docs/styles.css', [resolve(publicRoot, 'styles.css'), 'text/css; charset=utf-8']],
  ['/docs/openapi.json', [resolve(ROOT, 'docs/openapi.json'), 'application/json; charset=utf-8']],
  ['/docs/openapi.actual.json', [resolve(ROOT, 'docs/openapi.actual.json'), 'application/json; charset=utf-8']],
  ...['swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js', 'swagger-ui.css'].map(file => [`/docs/assets/${file}`, [resolve(swaggerRoot, file), file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8']]),
])
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const header = '<header class="docs-header"><a class="brand" href="/docs/">TQM <span>Documentación</span></a><nav aria-label="Documentación"><a href="/docs/">API / Swagger</a><a href="/docs/guia">Guía del proyecto</a><a href="/docs/auditoria">Auditoría</a><a href="/docs/openapi.json" download="tqm-openapi.json">OpenAPI JSON</a></nav></header>'
const page = (title, html) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · TQM</title><link rel="stylesheet" href="/docs/styles.css"></head><body>${header}<div id="doc-status" role="status" class="status">Documentación local · actualización automática</div><main class="guide">${html}</main><script src="/docs/app.js" defer></script></body></html>`

/** Solo rutas expresamente permitidas; nunca expone carpetas, .env ni la API. */
export function createDocsMiddleware() {
  const clients = new Set()
  const notify = data => {
    for (const client of clients) client.write(`data: ${JSON.stringify(data)}\n\n`)
  }
  async function handler(req, res, next = () => { res.statusCode = 404; res.end('No encontrado') }) {
    const path = new URL(req.url, 'http://localhost').pathname
    if (path !== '/docs' && !path.startsWith('/docs/')) return next()
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD'); res.end('Solo lectura'); return
    }
    if (path === '/docs') { res.statusCode = 302; res.setHeader('Location', '/docs/'); res.end(); return }
    try {
      if (path === '/docs/events' && req.method === 'GET') {
        res.setHeader('Content-Type', 'text/event-stream'); res.flushHeaders()
        res.write(': conectado\n\n'); clients.add(res)
        req.on('close', () => clients.delete(res)); return
      }
      let body, type
      if (path === '/docs/status.json') {
        const spec = JSON.parse(await readFile(resolve(ROOT, 'docs/openapi.json'), 'utf8'))
        body = JSON.stringify(spec['x-documentation']); type = 'application/json; charset=utf-8'
      } else if (markdownPages[path]) {
        const [title, file] = markdownPages[path]
        body = page(title, marked.parse(await readFile(resolve(ROOT, file), 'utf8'))); type = 'text/html; charset=utf-8'
      } else if (staticFiles.has(path)) {
        const [file, contentType] = staticFiles.get(path)
        body = await readFile(file); type = contentType
      } else { res.statusCode = 404; res.end('Documento no encontrado'); return }
      res.setHeader('Content-Type', type); res.end(req.method === 'HEAD' ? undefined : body)
    } catch (err) {
      res.statusCode = err.code === 'ENOENT' ? 404 : 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('No se pudo leer la documentación. Ejecuta npm run docs:generate y revisa la salida local.')
    }
  }
  return { handler, notify, close: () => { for (const client of clients) client.end(); clients.clear() } }
}

/** Proceso nuevo: las importaciones del contrato también se refrescan al editar. */
export function createRegenerator(onResult) {
  let timer, running = false, again = false, closed = false, child
  const run = () => {
    if (closed) return
    if (running) { again = true; return }
    running = true
    child = spawn(process.execPath, [resolve(ROOT, 'scripts/docs.mjs'), 'generate'], { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-6000) })
    child.on('error', err => { output += err.message })
    child.on('close', code => {
      running = false
      if (!closed) onResult({ type: code === 0 ? 'reload' : 'error', message: output.trim() })
      if (again) { again = false; run() }
    })
  }
  return {
    schedule: () => { if (closed) return; clearTimeout(timer); timer = setTimeout(run, 200) },
    close: () => { closed = true; clearTimeout(timer); child?.kill() },
  }
}

export async function startDocs({ port = 3001, observe = true, log = console.log } = {}) {
  const middleware = createDocsMiddleware()
  const server = createServer((req, res) => {
    if (req.url === '/') { res.statusCode = 302; res.setHeader('Location', '/docs/'); res.end(); return }
    void middleware.handler(req, res)
  })
  const generator = createRegenerator(result => { log(`[docs] ${result.message}`); middleware.notify(result) })
  const watchers = []
  if (observe) {
    for (const dir of WATCH_DIRECTORIES) {
      watchers.push(watch(resolve(ROOT, dir), { recursive: true }, (_, name) => {
        if (name && isDocumentationInput(resolve(ROOT, dir, String(name)))) generator.schedule()
      }))
    }
    // Directorios padre: resiste escrituras atómicas del editor (rename).
    for (const dir of ['', 'docs']) {
      watchers.push(watch(resolve(ROOT, dir), (_, name) => {
        const file = [dir, String(name || '')].filter(Boolean).join('/')
        if (WATCH_FILES.includes(file)) generator.schedule()
      }))
    }
  }
  server.on('close', () => { generator.close(); middleware.close(); for (const watcher of watchers) watcher.close() })
  await new Promise((accept, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); accept() })
  }).catch(err => { generator.close(); for (const watcher of watchers) watcher.close(); throw err })
  log(`[docs] http://127.0.0.1:${server.address().port}/docs/ · consulta local, sin ejecutar API`)
  return server
}
