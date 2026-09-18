import { createDocsMiddleware, createRegenerator } from './docs-server.mjs'
import { isDocumentationInput, WATCH_FILES, ROOT } from './docs-core.mjs'
import { resolve } from 'node:path'

/** Solo desarrollo. No añade entradas ni activos al build de producción. */
export function projectDocumentation() {
  return {
    name: 'tqm-project-documentation', apply: 'serve',
    configureServer(server) {
      const docs = createDocsMiddleware()
      server.middlewares.use(docs.handler)
      const generator = createRegenerator(result => {
        const logger = result.type === 'error' ? 'error' : 'info'
        server.config.logger[logger](`[docs] ${result.message}`)
        docs.notify(result)
      })
      server.watcher.add(WATCH_FILES.map(file => resolve(ROOT, file)))
      const onChange = file => { if (isDocumentationInput(file)) generator.schedule() }
      for (const event of ['add', 'change', 'unlink']) server.watcher.on(event, onChange)
      generator.schedule()
      server.httpServer?.once('close', () => {
        generator.close(); docs.close()
        for (const event of ['add', 'change', 'unlink']) server.watcher.off(event, onChange)
      })
    },
  }
}
