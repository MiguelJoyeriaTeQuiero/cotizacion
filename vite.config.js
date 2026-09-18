import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, relative as relativePath, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectDocumentation } from './scripts/docs-vite.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Carga las variables de .env.local / .env en process.env para las funciones
 * de /api, igual que hace Vercel en producción.
 *
 * Sobrescribe siempre: el servidor de desarrollo vive mucho rato en el mismo
 * proceso de Node, así que si no se pisara el valor anterior, editar el archivo
 * no tendría ningún efecto hasta cerrar la terminal.
 */
function cargarEnvLocal() {
  for (const nombre of ['.env', '.env.local']) {
    const archivo = resolve(root, nombre)
    if (!existsSync(archivo)) continue
    for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
      const limpia = linea.trim()
      if (!limpia || limpia.startsWith('#')) continue
      const corte = limpia.indexOf('=')
      if (corte < 1) continue
      const clave = limpia.slice(0, corte).replace(/^export\s+/, '').trim()
      let valor = limpia.slice(corte + 1).trim()
      // Comillas envolventes: se quitan solo si abren y cierran.
      if (valor.length > 1 && /^(".*"|'.*')$/s.test(valor)) valor = valor.slice(1, -1)
      process.env[clave] = valor
    }
  }
}

/**
 * Repone la cuenta de cliente de pruebas cada vez que arranca el servidor.
 *
 * En local el almacén vive en la memoria del proceso, así que cualquier
 * reinicio —el tuyo o el que hace Vite al tocar la configuración— se lleva las
 * cuentas por delante. Con `CLIENTE_DEMO=correo:contraseña` en .env.local eso
 * deja de ser un paso que recordar: la cuenta se crea aprobada en cuanto el
 * servidor escucha.
 *
 * Se pide por HTTP al propio servidor a propósito: así pasa por el mismo módulo
 * del almacén que van a usar las peticiones, y no por otra copia cargada
 * aparte. La acción solo existe en local; en Vercel devuelve 404.
 */
function sembrarClienteDePrueba(server) {
  const httpServer = server.httpServer
  if (!httpServer) return

  httpServer.once('listening', async () => {
    const receta = (process.env.CLIENTE_DEMO || '').trim()
    if (!receta) return

    const corte = receta.indexOf(':')
    const email = corte > 0 ? receta.slice(0, corte).trim() : ''
    const password = corte > 0 ? receta.slice(corte + 1).trim() : ''
    if (!email || !password) {
      server.config.logger.warn('  [demo] CLIENTE_DEMO se escribe correo:contraseña')
      return
    }

    const { port } = httpServer.address() || {}
    const base = `http://localhost:${port}`

    try {
      const res = await fetch(`${base}/api/portal/cuenta`, {
        method: 'POST',
        // La comprobación de origen exige que la petición venga del mismo sitio.
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ accion: 'demo', email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `respuesta ${res.status}`)
      server.config.logger.info(`  ➜  Cliente de prueba:  ${email} (aprobado)`)
    } catch (err) {
      server.config.logger.warn(`  [demo] no se ha podido crear ${email}: ${err.message}`)
    }
  })
}

/**
 * Ejecuta las funciones de /api dentro del servidor de desarrollo de Vite, para
 * que `npm run dev` levante la web completa (precios incluidos) y el panel.
 *
 * Solo actúa en desarrollo: en producción las ejecuta Vercel.
 */
function apiDevServer() {
  return {
    name: 'api-dev-server',
    apply: 'serve',
    configureServer(server) {
      cargarEnvLocal()
      sembrarClienteDePrueba(server)
      // Vite reinicia el servidor al detectar cambios en .env*, y cada petición
      // vuelve a leer el archivo: editar credenciales surte efecto al momento.
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) cargarEnvLocal()
        next()
      })

      // `/admin` sin barra final no coincide con ningún archivo y acabaría en el
      // comodín que sirve la web principal. En Vercel lo resuelven las reglas de
      // vercel.json; aquí hace falta esta redirección equivalente. Lo mismo vale
      // para `/portal`.
      server.middlewares.use((req, res, next) => {
        const { pathname, search } = new URL(req.url, 'http://localhost')
        if (pathname !== '/admin' && pathname !== '/portal') return next()
        res.statusCode = 302
        res.setHeader('Location', `${pathname}/${search}`)
        res.end()
      })

      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname
        if (!pathname.startsWith('/api/')) return next()

        const relative = pathname.slice('/api/'.length).replace(/\/+$/, '')
        // Nada de subir por el árbol de directorios desde la URL.
        if (!/^[a-z0-9/_-]+$/i.test(relative) || relative.includes('..')) return next()

        const file = resolve(root, 'api', `${relative}.js`)
        if (!file.startsWith(resolve(root, 'api')) || !existsSync(file)) return next()

        try {
          // Se carga a través del grafo de módulos de Vite en lugar de con un
          // import() a pelo.
          //
          // Con import(), el sufijo ?t= solo refresca el archivo del endpoint:
          // lo que ese archivo importa (todo api/_lib) se queda cacheado en el
          // proceso de Node hasta cerrar la terminal. Es decir, editabas
          // api/_lib/validate.js, guardabas, recargabas... y seguía corriendo la
          // versión vieja sin avisar de nada.
          //
          // ssrLoadModule sí sigue las dependencias: al tocar cualquier archivo
          // de api/, la siguiente petición usa el código nuevo.
          const especificador = '/' + relativePath(root, file).split(sep).join('/')
          const mod = await server.ssrLoadModule(especificador)
          await mod.default(req, res)
        } catch (err) {
          server.config.logger.error(`[api] ${pathname} → ${err.message}`)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Error en la función local' }))
          }
        }
      })
    },
  }
}

// Tres entradas independientes: la web pública, el panel de administración y el
// portal de clientes. Son bundles separados, así que un visitante no descarga (ni puede
// inspeccionar) una sola línea del código del panel.
export default defineConfig({
  plugins: [projectDocumentation(), react(), apiDevServer()],
  server: { port: 3000 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        admin: resolve(root, 'admin/index.html'),
        portal: resolve(root, 'portal/index.html'),      },
    },
  },
})
