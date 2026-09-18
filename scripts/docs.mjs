import { generate, documents, recordReview, validateDocuments } from './docs-core.mjs'

const command = process.argv[2] || 'serve'
try {
  if (command === 'generate') {
    const docs = await generate()
    const pending = docs.complete['x-documentation'].pendingReview.length
    console.log(`[docs] OpenAPI regenerado${pending ? `; ${pending} fuentes pendientes de revisión` : '; contrato revisado'}.`)
  } else if (command === 'check') {
    const result = await validateDocuments(await documents())
    console.log(`[docs] Válido: ${result.routes} rutas, ${result.operations} operaciones; ejemplos, cobertura y revisión sincronizados.`)
  } else if (command === 'review') {
    await recordReview()
    console.log('[docs] Revisión registrada. Comprueba el diff de los contratos y ejecuta npm run docs:check.')
  } else if (command === 'serve') {
    const { startDocs } = await import('./docs-server.mjs')
    const index = process.argv.indexOf('--port')
    const port = index < 0 ? 3001 : Number(process.argv[index + 1])
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Puerto no válido.')
    await generate()
    await startDocs({ port })
  } else throw new Error(`Comando desconocido: ${command}`)
} catch (err) {
  console.error(`[docs] ${err.message}`)
  process.exitCode = 1
}
