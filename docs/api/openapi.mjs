import { schemas } from './schemas.mjs'
import { paths } from './paths.mjs'

const tags = [
  ['Precios públicos', 'Cotización y precios de la web pública.'],
  ['Sesión administrativa', 'Acceso por cookie HttpOnly de personal de TQM.'],
  ['Fórmulas y escenarios', 'Factores comerciales privados, publicaciones y borradores.'],
  ['Historial y series', 'Versiones de fórmulas y muestras de mercado.'],
  ['Clientes y documentación', 'Revisión administrativa y documentos del propio cliente.'],
  ['Cuenta del portal', 'Alta, acceso, recuperación y presentación del expediente.'],
  ['Cierres · fuera de producción', 'Funcionalidad aplazada por decisión de producto. Documentar no habilita ni deshabilita el código existente.'],
].map(([name, description]) => ({ name, description }))

function usedSchemas(selectedPaths, available) {
  const used = new Set()
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (typeof value.$ref === 'string' && value.$ref.startsWith('#/components/schemas/')) {
      const name = value.$ref.slice('#/components/schemas/'.length)
      if (!used.has(name)) { used.add(name); visit(available[name]) }
    }
    for (const child of Object.values(value)) visit(child)
  }
  visit(selectedPaths)
  return Object.fromEntries(Object.entries(available).filter(([name]) => used.has(name)))
}

/** Función pura: mismos contratos y metadatos producen el mismo documento. */
export function createSpec({ complete = false, version = '0.1.0', sourceState = {} } = {}) {
  const selectedPaths = structuredClone(Object.fromEntries(Object.entries(paths).filter(([path]) => complete || path !== '/api/cierres')))
  const selectedSchemas = structuredClone(schemas)
  if (!complete) {
    delete selectedSchemas.Error.properties.cierre
    delete selectedSchemas.Error.properties.revalorizado
  }
  const pending = sourceState.pendingReview || []
  const description = [
    pending.length ? `**REVISIÓN PENDIENTE:** ha cambiado código cubierto por este contrato: ${pending.map(p => `\`${p}\``).join(', ')}. Las formas descritas necesitan revisión; docs:check y build fallarán hasta resolverlo.` : '**Contrato revisado frente al código inventariado.**',
    complete ? '**Vista completa del código, incluidos cierres aplazados.**' : '**Vista del alcance actual: sin endpoints de cierres.** Esta selección documental no aplica un bloqueo de producción.',
    'Documentación en español de la implementación existente. Los cambios propuestos en la auditoría no se presentan como ya implementados. Todos los ejemplos son sintéticos.',
    '**Autenticación:** cookies HttpOnly `tqm_admin` y `tqm_cliente`, sin Bearer. Las mutaciones requieren `Origin`. Las sesiones se obtienen en la aplicación; el campo Authorize de Swagger no puede establecer una cookie HttpOnly. El explorador local es de consulta: no ejecuta peticiones contra la API.',
    '**Convenciones:** JSON salvo documentos/PDF/CSV; importes EUR y pesos en gramos; fechas ISO 8601 salvo fetchedAt/t/credencialesEn en milisegundos Unix. Un POST puede ofrecer varias acciones: elegir el ejemplo y esquema correspondientes.',
    '[Guía del proyecto, configuración y mantenimiento](/docs/guia) · [Auditoría y límites conocidos](/docs/auditoria) · [Descargar OpenAPI completo](/docs/openapi.json)',
  ].join('\n\n')
  return {
    openapi: '3.0.3',
    info: { title: complete ? 'TQM · API completa' : 'TQM · API del alcance actual', version, description },
    servers: [{ url: 'http://localhost:3000', description: 'Desarrollo local de la aplicación. Puerto ajustable al importar el contrato; Swagger local no ejecuta operaciones.' }],
    security: [], tags: tags.filter(t => complete || !t.name.startsWith('Cierres')),
    paths: selectedPaths,
    components: {
      securitySchemes: {
        AdminCookie: { type: 'apiKey', in: 'cookie', name: 'tqm_admin', description: 'Cookie HttpOnly emitida por POST /api/admin/login.' },
        PortalCookie: { type: 'apiKey', in: 'cookie', name: 'tqm_cliente', description: 'Cookie HttpOnly emitida por alta, entrar o restablecer en POST /api/portal/cuenta.' },
      },
      schemas: usedSchemas(selectedPaths, selectedSchemas),
    },
    'x-documentation': { profile: complete ? 'complete' : 'current-release', ...sourceState },
    'x-release-scope': { deferred: ['cierres'], enforcedByDocumentation: false },
  }
}
