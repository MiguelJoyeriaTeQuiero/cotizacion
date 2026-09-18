import { ref, schemas } from './schemas.mjs'
import { alta, cliente, snapshot, precios, formulas, cierre } from './examples.mjs'

const admin = [{ AdminCookie: [] }]
const portal = [{ PortalCookie: [] }]
const either = [...admin, ...portal]
const origin = { name: 'Origin', in: 'header', required: true, description: 'Origen exacto de la aplicación. El navegador lo envía; en un cliente HTTP indicar, por ejemplo, http://localhost:3000. La implementación compara el host; véase SEC-11.', schema: { type: 'string' }, example: 'http://localhost:3000' }
const query = (name, description, schema = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema })
const example = (summary, value) => ({ summary, value })
const content = (schema, examples) => ({ 'application/json': { schema, ...(examples ? { examples } : {}) } })
const response = (description, schema, examples, headers) => ({ description, ...(schema ? { content: content(schema, examples) } : {}), ...(headers ? { headers } : {}) })
const cookie = { 'Set-Cookie': { description: 'Cookie HttpOnly y SameSite=Strict, Secure en despliegue Vercel no local. El navegador la gestiona.', schema: { type: 'string' } } }
const jsonBody = (schema, examples, description) => ({ required: true, ...(description ? { description } : {}), content: content(schema, examples) })
const variants = names => ({
  oneOf: names.map(ref),
  discriminator: { propertyName: 'accion', mapping: Object.fromEntries(names.map(name => [schemas[name].properties.accion.enum[0], `#/components/schemas/${name}`])) },
})
const errorMessages = {
  400: 'Petición no válida o acción no reconocida.', 401: 'Sin sesión o credenciales incorrectas.',
  403: 'Origen o permiso no permitido.', 404: 'Recurso no encontrado o acción local no disponible.',
  405: 'Método no permitido.', 409: 'Conflicto de estado, versión, duplicidad o límite del expediente.',
  422: 'Validación de datos fallida.', 429: 'Límite de intentos o solicitudes alcanzado.',
  500: 'No se pudo completar la escritura.', 501: 'Modalidad de archivos no configurada.', 503: 'Servicio o configuración no disponible.',
}
const errors = (...codes) => Object.fromEntries(codes.map(code => [code, response(errorMessages[code], ref('Error'), { error: example('Ejemplo de error', { error: errorMessages[code] }) }, code === 405 ? { Allow: { schema: { type: 'string' }, description: 'Métodos admitidos por el recurso.' } } : undefined)]))
const source = name => ({ 'x-source-file': `api/${name}.js` })
const operation = (file, tag, operationId, summary, security, details) => ({ ...source(file), tags: [tag], operationId, summary, security, ...details })
const known = (...ids) => ({ 'x-audit-findings': ids })
const deferred = {
  'x-release-status': 'deferred',
  'x-release-target': 'not-in-current-production-release',
  'x-release-note': 'Decisión de producto: NO publicar cierres todavía. Esta marca documental no desactiva el endpoint; el código actual aún lo incluye.',
}
const closureSelectors = [
  { name: 'X-TQM-Portal', in: 'header', required: false, schema: { type: 'string', enum: ['1'] }, description: 'Fuerza sesión de cliente cuando el navegador tiene ambas cookies; no concede permisos.' },
  query('portal', 'Alternativa para enlaces de descarga: portal=1 fuerza sesión del cliente.', { type: 'string', enum: ['1'] }),
]

export const paths = {
  '/api/prices': {
    get: operation('prices', 'Precios públicos', 'consultarPrecios', 'Cotización y precios por ley', [], {
      description: 'Devuelve EUR/oz y EUR/g ya calculados, sin f1/f2/f3. Consulta GoldAPI si la caché ha vencido. En caída entrega el último dato o fixing de emergencia con stale=true. Puede responder 200 con respaldo; comprobar stale y fetchedAt. Registra muestras cuando el mercado está vigente. Los precios públicos no están vinculados a una reserva de cierre.',
      responses: { 200: response('Precios calculados.', ref('Precios'), { vigente: example('Datos ficticios vigentes', precios), retrasado: example('Último dato conocido', { ...precios, stale: true }) }, { 'Cache-Control': { schema: { type: 'string' }, example: 'public, s-maxage=30, stale-while-revalidate=300' } }), ...errors(405, 503) },
      ...known('INT-05', 'INT-08', 'ARQ-02'),
    }),
    head: operation('prices', 'Precios públicos', 'cabecerasPrecios', 'Cabeceras de la cotización', [], {
      description: 'Ejecuta actualmente el mismo cálculo que GET; el transporte HTTP omite el cuerpo. No es una comprobación de salud sin efectos: puede refrescar caché y registrar muestra.',
      responses: { 200: response('Mismas cabeceras de GET, sin cuerpo.'), 503: response('Cotización temporalmente no disponible, sin cuerpo.') },
    }),
  },
  '/api/admin/login': { post: operation('admin/login', 'Sesión administrativa', 'entrarAdmin', 'Iniciar sesión administrativa', [], {
    description: '20 fallos por IP en 15 minutos según el limitador actual. El éxito limpia ese contador. Sesión de 12 horas absolutas y 45 minutos de inactividad. Devuelve cookie, no un token Bearer. El modo de desarrollo puede proporcionar una cuenta local si no se configura ninguna.',
    parameters: [origin], requestBody: jsonBody(ref('LoginAdmin'), { acceso: example('Cuenta ficticia; usar credenciales propias', { username: 'operador', password: 'Ejemplo-sintetico-2026' }) }),
    responses: { 200: response('Sesión iniciada.', ref('SesionAdmin'), { sesion: example('Usuario administrativo', { user: { username: 'operador', name: 'Operador de ejemplo' } }) }, cookie), ...errors(400, 401, 403, 405, 429, 503) }, ...known('SEC-04', 'SEC-10'),
  }) },
  '/api/admin/logout': { post: operation('admin/logout', 'Sesión administrativa', 'salirAdmin', 'Cerrar sesión administrativa', [], {
    description: 'Acepta ausencia de sesión: elimina la cookie y solicita borrado del token si existe. Requiere Origin incluso sin sesión.', parameters: [origin],
    responses: { 200: response('Cookie expirada.', ref('Ok'), { ok: example('Resultado', { ok: true }) }, cookie), ...errors(403, 405) },
  }) },
  '/api/admin/session': { get: operation('admin/session', 'Sesión administrativa', 'sesionAdmin', 'Consultar sesión administrativa', admin, {
    description: 'Valida la existencia actual del usuario y renueva la caducidad por inactividad sin superar el límite absoluto.',
    responses: { 200: response('Usuario identificado.', ref('SesionAdmin')), ...errors(401, 405) },
  }) },
  '/api/admin/formulas': {
    get: operation('admin/formulas', 'Fórmulas y escenarios', 'consultarFormulas', 'Leer fórmulas completas', admin, {
      description: 'Incluye factores comerciales privados, revisión y origen store/defaults/fallback. El respaldo es comportamiento actual; no significa que la lectura del almacén haya sido satisfactoria.',
      responses: { 200: response('Documento vigente o de respaldo.', ref('Formulas'), { formulas: example('Fórmulas sintéticas', formulas) }), ...errors(401, 405) }, ...known('INT-05'),
    }),
    put: operation('admin/formulas', 'Fórmulas y escenarios', 'publicarFormulas', 'Publicar una revisión de fórmulas', admin, {
      description: 'Valida tabla de oro/plata, escribe versión e historial. expectedVersion es opcional en el código actual y su comprobación no es atómica. Las leyes deben ser únicas por metal. No hay PATCH: se envían las dos tablas completas.',
      parameters: [origin], requestBody: jsonBody(ref('PublicarFormulas'), { publicar: example('Publicar tras consultar la versión', { ...snapshot, expectedVersion: 1 }) }),
      responses: { 200: response('Publicación guardada; source no se incluye en PUT.', ref('Formulas')), ...errors(400, 401, 403, 405, 409, 422, 500, 503) }, ...known('INT-01'),
    }),
  },
  '/api/admin/history': { get: operation('admin/history', 'Historial y series', 'historialFormulas', 'Últimas publicaciones de fórmulas', admin, {
    description: 'Hasta 50 entradas, recientes primero, con autor, IP, fixing y snapshot. Un fallo de lectura puede producir lista vacía en el código actual. Para restaurar se publica el snapshot mediante PUT /api/admin/formulas; no hay endpoint específico de rollback.',
    responses: { 200: response('Historial disponible.', ref('Historial'), { vacio: example('Sin publicaciones', { entries: [] }) }), ...errors(401, 405) }, ...known('ARQ-07', 'ARQ-08'),
  }) },
  '/api/admin/series': { get: operation('admin/series', 'Historial y series', 'seriePrecios', 'Evolución de precios publicados', admin, {
    description: 'Ventanas 7, 30 o 90 días; cualquier otra entrada usa 30. Filtra y ordena cronológicamente hasta 1.000 muestras almacenadas y devuelve como máximo 240 por muestreo. total cuenta todas las muestras almacenadas, antes del filtro. El histórico se alimenta del tráfico a prices.',
    parameters: [query('days', 'Ventana solicitada; valor por defecto 30.', { type: 'integer', enum: [7, 30, 90], default: 30 })],
    responses: { 200: response('Serie reducida para visualización.', ref('Serie'), { vacia: example('Sin muestras', { days: 30, total: 0, samples: [] }) }), ...errors(401, 405) }, ...known('ARQ-07'),
  }) },
  '/api/admin/scenarios': {
    get: operation('admin/scenarios', 'Fórmulas y escenarios', 'listarEscenarios', 'Listar escenarios sin publicar', admin, {
      description: 'Hasta 12 borradores con nombre. Guardar un escenario no modifica los precios públicos.',
      responses: { 200: response('Escenarios guardados.', ref('Escenarios'), { vacio: example('Sin escenarios', { scenarios: [], max: 12 }) }), ...errors(401, 405) },
    }),
    put: operation('admin/scenarios', 'Fórmulas y escenarios', 'guardarEscenario', 'Guardar o reemplazar un escenario', admin, {
      description: 'El mismo nombre reemplaza el escenario anterior. Un nombre nuevo se coloca primero; si se supera el máximo, el escenario más antiguo se descarta. No se devuelve conflicto por alcanzar el máximo.', parameters: [origin],
      requestBody: jsonBody(ref('GuardarEscenario'), { guardar: example('Borrador sintético', { name: 'Ejemplo septiembre', snapshot }) }),
      responses: { 200: response('Lista tras guardar.', ref('Escenarios')), ...errors(400, 401, 403, 405, 422, 500, 503) },
    }),
    delete: operation('admin/scenarios', 'Fórmulas y escenarios', 'borrarEscenario', 'Borrar un escenario por nombre', admin, {
      description: 'DELETE con cuerpo JSON. Si el nombre no existe, devuelve la lista sin cambios.', parameters: [origin],
      requestBody: jsonBody(ref('BorrarEscenario'), { borrar: example('Nombre exacto', { name: 'Ejemplo septiembre' }) }),
      responses: { 200: response('Lista restante.', ref('Escenarios')), ...errors(400, 401, 403, 405, 422, 500, 503) },
    }),
  },
  '/api/admin/clientes': {
    get: operation('admin/clientes', 'Clientes y documentación', 'consultarClientes', 'Listar clientes, abrir expediente o leer documento', admin, {
      description: 'Tres variantes en una ruta: sin id devuelve índice; con id devuelve expediente sin password; con id y doc transmite el archivo privado. estado solo filtra la lista y un estado desconocido no la filtra. pendientes se calcula antes del filtro. La lista actual incluye expedientes aún no enviados. Un doc sin id no activa la descarga.',
      parameters: [query('id', 'Identificador de cliente.'), query('doc', 'Identificador del documento; necesita id.'), query('estado', 'Filtro opcional.', { type: 'string', enum: ['pendiente', 'documentacion', 'aprobado', 'rechazado'] })],
      responses: {
        200: { description: 'Lista, expediente o archivo binario según parámetros.', content: {
          ...content({ oneOf: [ref('Clientes'), ref('RespuestaClienteAdmin')] }),
          ...Object.fromEntries(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'].map(type => [type, { schema: { type: 'string', format: 'binary' } }])),
        }, headers: { 'Content-Disposition': { schema: { type: 'string' }, description: 'Para archivos: inline; filename="nombre-saneado".' }, 'Content-Security-Policy': { schema: { type: 'string' }, description: 'Para archivos: default-src none y sandbox.' } } },
        ...errors(401, 404, 405),
      }, ...known('INT-02', 'ARQ-08'),
    }),
    put: operation('admin/clientes', 'Clientes y documentación', 'gestionarCliente', 'Decidir expediente, ajustar límites o emitir recuperación', admin, {
      description: '| accion | Resultado | Condición |\n|---|---|---|\n| aprobar | Estado aprobado | Nota se vacía |\n| documentacion | Solicita documentos | nota obligatoria |\n| rechazar | Estado rechazado | nota obligatoria |\n| limites | Actualiza límites válidos | Al menos uno válido; destinado a cierres aplazados |\n| clave | Devuelve código de 60 minutos | Debe verificarse la identidad por el procedimiento interno |\n\nEl código actual permite decidir desde cualquier estado; no presupone transiciones adicionales. La nota se trunca a 400 caracteres.',
      'x-actions': ['aprobar', 'documentacion', 'rechazar', 'limites', 'clave'], parameters: [origin],
      requestBody: jsonBody(variants(['AprobarCliente', 'PedirDocumentacion', 'RechazarCliente', 'CambiarLimites', 'GenerarCodigo']), {
        aprobar: example('Aprobar', { accion: 'aprobar', id: cliente.id }), documentacion: example('Pedir documentos', { accion: 'documentacion', id: cliente.id, nota: 'Falta el documento identificativo.' }),
        rechazar: example('Rechazar', { accion: 'rechazar', id: cliente.id, nota: 'Datos incompletos.' }), limites: example('Límites del módulo aplazado', { accion: 'limites', id: cliente.id, limites: { porCierre: 5000, reservaMinutos: 60 } }), clave: example('Generar código', { accion: 'clave', id: cliente.id }),
      }),
      responses: { 200: response('Expediente actualizado o código visible una vez.', { oneOf: [ref('RespuestaClienteAdmin'), ref('CodigoGenerado')] }), ...errors(400, 401, 403, 404, 405, 422) }, ...known('SEC-03', 'INT-02'),
    }),
  },
  '/api/portal/cuenta': {
    get: operation('portal/cuenta', 'Cuenta del portal', 'sesionCliente', 'Consultar cuenta y modo de documentos', portal, {
      description: 'Renueva inactividad. Si no hay sesión, responde 401 y expira la cookie. Devuelve todos los datos del propio expediente, sin hash de contraseña, URL de documentos ni historial interno.',
      responses: { 200: response('Cuenta identificada.', ref('Cuenta'), { cuenta: example('Cuenta sintética', { cliente, almacen: 'memoria' }) }), ...errors(401, 405) },
    }),
    post: operation('portal/cuenta', 'Cuenta del portal', 'gestionarCuenta', 'Alta, acceso, recuperación, revisión y salida', [{}, ...portal], {
      description: '| accion | Sesión previa | Éxito | Cuota actual |\n|---|---|---|---|\n| alta | No | 201, crea sesión | 5 altas/hora/IP; conflictos no consumen |\n| entrar | No | 200, crea sesión | 20 fallos/15 min/IP |\n| salir | No obligatoria | 200, expira cookie | — |\n| olvide | No | 200 genérico | 5/hora/IP |\n| restablecer | Código válido | 200, cambia clave y crea sesión | 20/hora/IP |\n| enviar | Sí | 200, vuelve a pendiente | Al menos un documento; no aprobado |\n| demo | No, solo desarrollo | 200, crea/modifica cuenta aprobada | Sin cuota; no abre sesión |\n\nSesión cliente: 30 días absolutos y 12 horas de inactividad. olvide devuelve ok aunque no exista el correo o el proveedor no envíe el mensaje; la emisión asistida del código se hace desde administración. Los límites, revocación y consumo de códigos tienen incidencias abiertas en la auditoría.',
      'x-actions': ['alta', 'entrar', 'salir', 'olvide', 'restablecer', 'enviar', 'demo'], parameters: [origin],
      requestBody: jsonBody(variants(['Alta', 'Entrar', 'Salir', 'Olvide', 'Restablecer', 'EnviarSolicitud', 'Demo']), {
        alta: example('Alta sintética completa', alta), entrar: example('Acceder', { accion: 'entrar', email: 'tienda@example.test', password: 'Ejemplo-sintetico-2026' }),
        salir: example('Cerrar sesión', { accion: 'salir' }), olvide: example('Solicitar recuperación', { accion: 'olvide', email: 'tienda@example.test' }),
        restablecer: example('Código ficticio', { accion: 'restablecer', token: '2345-6789-ABCD-EFGH', password: 'Otro-ejemplo-sintetico-2026' }),
        enviar: example('Enviar expediente a revisión', { accion: 'enviar' }), demo: example('Solo entorno de pruebas aislado', { accion: 'demo', email: 'demo@example.test', password: 'Ejemplo-sintetico-2026', razonSocial: 'Empresa sintética' }),
      }),
      responses: { 200: response('Resultado según acción.', { anyOf: [ref('Cuenta'), ref('Ok'), ref('RespuestaDemo')] }, undefined, cookie), 201: response('Alta creada y sesión abierta.', ref('Cuenta'), { alta: example('Resultado sintético', { cliente, almacen: 'memoria' }) }, cookie), ...errors(400, 401, 403, 404, 405, 409, 422, 429, 503) },
      ...known('SEC-02', 'SEC-03', 'SEC-05', 'SEC-06', 'SEC-12'),
    }),
  },
  '/api/portal/documentos': {
    post: operation('portal/documentos', 'Clientes y documentación', 'gestionarDocumento', 'Autorizar subida, registrar archivo o cambiar etiqueta', portal, {
      description: 'Requiere expediente no aprobado. Máximo actual de 10 documentos asociados, PDF/JPEG/PNG/WEBP; hasta 8 MiB en Blob y 2,5 MiB en memoria. Cuerpo JSON declarado hasta 5 MiB (el bypass del preprocesado está auditado).\n\n1. En Blob, el SDK pide token mediante type=blob.generate-client-token (10 minutos de vigencia, ruta clientes/{id}/ y sufijo aleatorio).\n2. El navegador sube directamente a Blob con el SDK.\n3. Confirma con accion=confirmar y la referencia del resultado.\n4. En memoria usa accion=local con base64.\n5. accion=etiqueta renombra un documento.\n\nNo es una subida multipart/form-data a esta API. Los callbacks internos del SDK también pasan primero por autenticación y Origin: no hay webhook público adicional. El código comprueba firma inicial, no análisis antimalware; no garantiza cuota total de 40 MB ni reserva de subidas pendientes. La propiedad URL/ruta y la CSP tienen incidencias abiertas.',
      'x-actions': ['confirmar', 'local', 'etiqueta'], 'x-sdk-events': ['blob.generate-client-token', 'blob.upload-completed'], parameters: [origin],
      requestBody: jsonBody({ oneOf: ['ConfirmarDocumento', 'DocumentoLocal', 'EtiquetarDocumento', 'BlobToken', 'BlobUploaded'].map(ref) }, {
        token: example('Evento generado por el SDK', { type: 'blob.generate-client-token', payload: { pathname: `clientes/${cliente.id}/identificacion.pdf`, multipart: false, clientPayload: null } }),
        confirmar: example('URL de ejemplo no operativa', { accion: 'confirmar', url: `https://example.private.blob.vercel-storage.com/clientes/${cliente.id}/archivo-ejemplo.pdf`, pathname: `clientes/${cliente.id}/archivo-ejemplo.pdf`, nombre: 'identificacion.pdf', etiqueta: 'Identificación' }),
        local: example('Bytes sintéticos de cabecera, no documento real', { accion: 'local', base64: 'JVBERi0xLjQK', tipo: 'application/pdf', nombre: 'ejemplo.pdf', etiqueta: 'Ejemplo local' }),
        etiqueta: example('Cambiar etiqueta', { accion: 'etiqueta', id: 'doc_ejemplo1', etiqueta: 'Identificación actualizada' }),
      }),
      responses: { 200: response('Cliente actualizado o respuesta del SDK.', { oneOf: [ref('RespuestaCliente'), ref('BlobTokenRespuesta'), ref('BlobUploadedRespuesta')] }), ...errors(400, 401, 403, 404, 405, 409, 422, 501) }, ...known('SEC-01', 'SEC-08', 'SEC-09', 'INT-10'),
    }),
    delete: operation('portal/documentos', 'Clientes y documentación', 'borrarDocumento', 'Quitar un documento del expediente editable', portal, {
      description: 'Busca el identificador dentro del expediente, intenta eliminar el objeto y guarda la lista restante. El borrado físico puede fallar y dejar un huérfano aunque se responda 200.', parameters: [origin], requestBody: jsonBody(ref('BorrarDocumento'), { borrar: example('Documento sintético', { id: 'doc_ejemplo1' }) }),
      responses: { 200: response('Expediente actualizado.', ref('RespuestaCliente')), ...errors(400, 401, 403, 404, 405, 409) }, ...known('SEC-01', 'SEC-09'),
    }),
  },
  '/api/cierres': {
    get: operation('cierres', 'Cierres · fuera de producción', 'consultarCierres', 'Consultar cierres o descargar PDF/CSV', either, {
      ...deferred, description: 'Módulo aplazado. Sin ref: listado; con ref: detalle; con ref y formato: exportación. El administrador ve todos; el cliente solo los propios. PDF disponible para ambos, CSV/ERP solo administrador. La sesión administrativa tiene prioridad salvo X-TQM-Portal: 1 o portal=1. El listado actual deriva del índice global de 300 entradas, sin paginación. estado filtra literalmente; un valor desconocido devuelve lista vacía. Una referencia ajena al cliente devuelve 404.',
      parameters: [...closureSelectors, query('ref', 'Referencia del cierre.'), query('estado', 'Filtro de estado.', { type: 'string', enum: ['pendiente', 'confirmado', 'rechazado', 'anulado'] }), query('formato', 'Requiere ref. El bloque para ERP usa formato=csv.', { type: 'string', enum: ['pdf', 'csv'] })],
      responses: { 200: { description: 'JSON, PDF o CSV según parámetros.', content: { ...content({ anyOf: [ref('Cierres'), ref('RespuestaCierre'), ref('RespuestaCierreAdmin')] }), 'application/pdf': { schema: { type: 'string', format: 'binary' } }, 'text/csv': { schema: { type: 'string' }, example: 'referencia;estado;fecha_solicitud;fecha_confirmacion;cif;razon_social;metal;ley;milesimas;gramos;precio_gramo;importe;precio_acordado\r\nTQM-1709-0001;pendiente;2026-09-17T09:00:00.000Z;;B12345678;Joyería Ejemplo SL;oro;Oro 18k;750;10,000;75,00;750,00;no\r\n' } }, headers: { 'Content-Disposition': { schema: { type: 'string' }, description: 'attachment para PDF y CSV.' } } }, ...errors(400, 401, 403, 404, 405) }, ...known('SEC-07', 'INT-09', 'INT-12'),
    }),
    post: operation('cierres', 'Cierres · fuera de producción', 'pedirCierre', 'Solicitar reserva de precio', portal, {
      ...deferred, description: 'Solo cliente aprobado. Hasta 24 líneas y 100.000 g por línea; máximo 10 solicitudes pendientes según el índice actual. El servidor ignora precios del cliente y calcula importe/reserva. Rechaza mercado stale en esta creación. porCierre es actualmente informativo, no un límite de rechazo automático. No hay idempotency key ni aceptación de quoteId.',
      parameters: [origin, ...closureSelectors], requestBody: jsonBody(ref('PedirCierre'), { lote: example('Lote sintético', { lineas: [{ metal: 'gold', key: 'au18', gramos: 10 }] }) }),
      responses: { 201: response('Solicitud pendiente creada.', ref('RespuestaCierre'), { cierre: example('Reserva ficticia', { cierre }) }), ...errors(400, 401, 403, 405, 422, 429, 503) }, ...known('INT-03', 'INT-05', 'INT-07', 'INT-13'),
    }),
    put: operation('cierres', 'Cierres · fuera de producción', 'decidirCierre', 'Ajustar, confirmar o rechazar una solicitud', admin, {
      ...deferred, description: 'Solo administrador y cierre pendiente. ajustar recibe líneas y motivo opcional; precioGramo manual hasta 1.000 en oro o 100 en plata. rechazar requiere nota. confirmar: si ha vencido, revaloriza y responde 409 con revalorizado=true; requiere nueva confirmación. totalVisto es opcional y una diferencia >0,005 genera 409. Las incidencias de concurrencia, mercado vencido y tarifa congelada siguen abiertas.',
      'x-actions': ['ajustar', 'rechazar', 'confirmar'], parameters: [origin, ...closureSelectors],
      requestBody: jsonBody(variants(['AjustarCierre', 'RechazarCierre', 'ConfirmarCierre']), {
        ajustar: example('Ajustar peso', { accion: 'ajustar', ref: cierre.ref, lineas: [{ metal: 'gold', key: 'au18', gramos: 9.8 }], motivo: 'Peso verificado' }),
        rechazar: example('Rechazar', { accion: 'rechazar', ref: cierre.ref, nota: 'Lote no disponible.' }), confirmar: example('Confirmar total visto', { accion: 'confirmar', ref: cierre.ref, totalVisto: 750 }),
      }), responses: { 200: response('Cierre actualizado.', ref('RespuestaCierreAdmin')), ...errors(400, 401, 403, 404, 405, 409, 422, 503) }, ...known('INT-02', 'INT-04', 'INT-06'),
    }),
    delete: operation('cierres', 'Cierres · fuera de producción', 'anularCierre', 'Anular una solicitud propia pendiente', portal, {
      ...deferred, description: 'Solo sesión cliente, propietario y estado pendiente. DELETE con cuerpo JSON; la caducidad de la reserva no impide anular mientras siga pendiente.', parameters: [origin, ...closureSelectors], requestBody: jsonBody(ref('AnularCierre'), { anular: example('Referencia sintética', { ref: cierre.ref }) }),
      responses: { 200: response('Cierre anulado.', ref('RespuestaCierre')), ...errors(400, 401, 403, 404, 405, 409, 503) }, ...known('INT-02'),
    }),
  },
}
