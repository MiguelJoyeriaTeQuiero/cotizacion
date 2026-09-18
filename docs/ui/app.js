const status = document.getElementById('doc-status')
async function showStatus() {
  try {
    const response = await fetch('/docs/status.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('Estado no disponible')
    const data = await response.json()
    const pending = data.pendingReview || []
    status.classList.toggle('pending', pending.length > 0)
    status.textContent = pending.length
      ? `Revisión pendiente del contrato · ${pending.join(', ')} · la compilación quedará bloqueada hasta revisarlo.`
      : 'Contrato sincronizado · actualización automática al guardar · cierres fuera de la salida actual · consulta sin ejecutar operaciones'
  } catch {
    status.classList.add('pending')
    status.textContent = 'No se pudo comprobar la sincronización. Revisa la salida de npm run docs.'
  }
}
void showStatus()

if (document.getElementById('swagger-ui')) {
  window.ui = SwaggerUIBundle({
    dom_id: '#swagger-ui',
    urls: [
      { url: '/docs/openapi.actual.json', name: 'Alcance actual · sin cierres' },
      { url: '/docs/openapi.json', name: 'Completa · incluye cierres aplazados' },
    ],
    'urls.primaryName': 'Alcance actual · sin cierres',
    deepLinking: true, filter: true, displayRequestDuration: false,
    docExpansion: 'list', defaultModelsExpandDepth: -1, defaultModelExpandDepth: 2,
    showCommonExtensions: true, supportedSubmitMethods: [],
    validatorUrl: null, persistAuthorization: false, withCredentials: false,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: 'StandaloneLayout',
  })
}

const updates = new EventSource('/docs/events')
updates.onmessage = event => {
  const result = JSON.parse(event.data)
  if (result.type === 'reload') location.reload()
  else {
    status.classList.add('pending')
    status.textContent = `No se pudo regenerar Swagger. Corrige el contrato: ${result.message}`
  }
}
addEventListener('pagehide', () => updates.close())
