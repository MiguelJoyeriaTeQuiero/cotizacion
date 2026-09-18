// Contratos documentales: no importan servicios ni leen variables de entorno.
export const ref = name => ({ $ref: `#/components/schemas/${name}` })
export const text = (description, extra = {}) => ({ type: 'string', description, ...extra })
export const number = (description, extra = {}) => ({ type: 'number', description, ...extra })
export const integer = (description, extra = {}) => ({ type: 'integer', description, ...extra })
export const list = (items, extra = {}) => ({ type: 'array', items, ...extra })
export const object = (properties, required = [], extra = {}) => ({
  type: 'object', properties, ...(required.length ? { required } : {}), ...extra,
})
const timestamp = (description, nullable = false) => text(description, { format: 'date-time', nullable })
const nullableText = description => text(description, { nullable: true })
const action = (name, properties = {}, required = [], extra = {}) => object({
  accion: text('Acción del recurso.', { enum: [name] }), ...properties,
}, ['accion', ...required], extra)
const id = text('Identificador opaco del cliente.', { example: 'cli_ejemplo01' })
const docId = text('Identificador opaco del documento.', { example: 'doc_ejemplo1' })
const cierreRef = text('Referencia actual sin año. Cierres fuera del lanzamiento; colisiones pendientes de corregir.', { example: 'TQM-1709-0001' })
const email = text('Correo normalizado en minúsculas.', { format: 'email', maxLength: 120, example: 'tienda@example.test' })
const password = text('Contraseña; nunca devuelta salvo la acción local demo.', { format: 'password', minLength: 8, maxLength: 200, writeOnly: true })
const codigo = text('Código de recuperación: 16 caracteres alfanuméricos, normalmente en cuatro grupos. Ejemplo ficticio.', { example: '2345-6789-ABCD-EFGH' })
const mime = text('Tipo admitido.', { enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] })
const leyKey = text('Identificador único dentro de cada metal.', { pattern: '^[a-z][a-z0-9_]{1,23}$', example: 'au18' })
const numInput = (description, min, max) => ({
  description: `${description} Se recomienda JSON numérico; el validador también convierte cadenas con coma decimal.`,
  oneOf: [{ type: 'number', minimum: min, maximum: max }, { type: 'string', example: String(min) }],
})

const empresa = object({
  razonSocial: text('Razón social; se limpia y trunca a 120 caracteres.', { minLength: 2, maxLength: 120 }),
  cif: text('Comprobación de formato, sin validación de dígito de control.', { pattern: '^[A-Z0-9][0-9]{7}[A-Z0-9]$', example: 'B12345678' }),
  nombreComercial: text('Opcional; se trunca a 80 caracteres.', { maxLength: 80 }),
  direccion: text('Dirección fiscal.', { minLength: 4, maxLength: 160 }),
  poblacion: text('Población.', { minLength: 2, maxLength: 80 }),
  provincia: text('Provincia.', { minLength: 2, maxLength: 60 }),
  cp: text('Código postal de cinco cifras.', { pattern: '^\\d{5}$', example: '38001' }),
  iae: text('Epígrafe opcional.', { maxLength: 20 }),
}, ['razonSocial', 'cif', 'direccion', 'poblacion', 'provincia', 'cp'])
const contacto = object({
  persona: text('Persona de contacto.', { minLength: 2, maxLength: 80 }),
  telefono: text('Formato de teléfono; no se comprueba su existencia.', { maxLength: 20, example: '+34922000000' }),
  telefonoTienda: text('Teléfono adicional opcional.', { maxLength: 20 }), email,
}, ['persona', 'telefono', 'email'])
const titular = object({
  nombre: text('Nombre del administrador/titular.', { minLength: 2, maxLength: 80 }),
  dni: text('7–12 caracteres alfanuméricos, sin validación del dígito de control.', { pattern: '^[A-Z0-9]{7,12}$', example: '00000000T' }),
}, ['nombre', 'dni'])
const cobro = object({
  iban: text('IBAN normalizado; se valida formato, no módulo 97.', { pattern: '^[A-Z]{2}\\d{2}[A-Z0-9]{10,30}$', example: 'ES9121000418450200051332' }),
}, ['iban'])
const limites = object({
  porCierre: integer('Umbral informativo actual. No es un rechazo automático del endpoint de cierres.', { minimum: 0, maximum: 1000000, default: 5000 }),
  reservaMinutos: integer('Duración de reserva del módulo de cierres aplazado.', { minimum: 5, maximum: 1440, default: 60 }),
})
const documento = object({
  id: docId, etiqueta: text('Etiqueta visible.', { maxLength: 40 }), nombre: text('Nombre del archivo.', { maxLength: 120 }),
  tipo: mime, tamano: integer('Tamaño en bytes.', { minimum: 1, maximum: 8388608 }), subidoEn: timestamp('Fecha de subida.'),
}, ['id', 'etiqueta', 'nombre', 'tipo', 'tamano', 'subidoEn'])
const cliente = object({
  id, estado: ref('EstadoCliente'), enviadoEn: timestamp('Último envío a revisión; null si no se ha enviado.', true),
  nota: nullableText('Mensaje de revisión visible para el cliente.'), empresa: ref('Empresa'), contacto: ref('Contacto'),
  titular: ref('Titular'), cobro: ref('Cobro'), documentos: list(ref('DocumentoCliente')),
  limites: ref('LimitesCliente'), creadoEn: timestamp('Fecha de alta.'),
}, ['id', 'estado', 'enviadoEn', 'empresa', 'contacto', 'titular', 'cobro', 'documentos', 'limites', 'creadoEn'])
const formulaFields = {
  divisor: number('Divisor de conversión usado por el negocio.', { minimum: 1, maximum: 1000, example: 31.1 }),
  refreshSeconds: integer('Frecuencia de consulta al mercado.', { minimum: 30, maximum: 86400, default: 60 }),
  gold: list(ref('LeyFormula'), { minItems: 1, maxItems: 24 }), silver: list(ref('LeyFormula'), { minItems: 1, maxItems: 24 }),
}
const lineaInput = object({
  metal: text('Metal.', { enum: ['gold', 'silver'] }), key: leyKey,
  gramos: numInput('Gramos: mayor que cero y hasta 100.000 por línea; se redondean a tres decimales.', 0, 100000),
}, ['metal', 'key', 'gramos'])
const lineaValorada = object({
  ...lineaInput.properties, gramos: number('Peso normalizado a tres decimales.'), label: text('Nombre de la ley.'),
  fineness: number('Pureza en milésimas.'), precioGramo: number('EUR/g: dos decimales en oro, tres en plata.'),
  importe: number('Importe de línea en EUR, redondeado a céntimos.'),
  precioTarifa: number('Tarifa usada como referencia en un ajuste.'), precioManual: { type: 'boolean' },
}, ['metal', 'key', 'gramos', 'label', 'fineness', 'precioGramo', 'importe'])
const cierre = object({
  ref: cierreRef, clienteId: id,
  cliente: object({ razonSocial: text('Razón social al solicitar.'), cif: text('CIF.'), telefono: text('Teléfono.'), persona: text('Persona de contacto.') }, ['razonSocial', 'cif', 'telefono', 'persona']),
  lineas: list(ref('LineaValorada')), total: number('Total en EUR.'), gramos: number('Peso total en gramos.'), fixing: ref('Fixing'),
  estado: text('Estado persistido.', { enum: ['pendiente', 'confirmado', 'rechazado', 'anulado'] }),
  reservaMinutos: integer('Minutos de reserva.'), creadoEn: timestamp('Fecha de solicitud.'), expiraEn: timestamp('Caducidad de la reserva.'),
  revalorizadoEn: timestamp('Última revalorización.', true), decididoEn: timestamp('Última decisión.', true),
  decididoPor: nullableText('Usuario administrador o cliente; este campo también llega al portal.'), nota: nullableText('Nota de decisión.'),
  vencido: { type: 'boolean', description: 'Calculado: solo true si está pendiente y la reserva ha vencido.' },
  ajustadoEn: timestamp('Último ajuste, cuando exista.'),
  pedido: object({ lineas: list(ref('LineaValorada')), total: number('Total original.'), gramos: number('Peso original.') }, ['lineas', 'total', 'gramos']),
}, ['ref', 'clienteId', 'cliente', 'lineas', 'total', 'gramos', 'fixing', 'estado', 'reservaMinutos', 'creadoEn', 'expiraEn', 'vencido'])

export const schemas = {
  Error: object({
    error: text('Mensaje visible del error.'), details: list(text('Error de validación.')),
    retryAfter: integer('Segundos de espera cuando el limitador los incluye; viaja en JSON, no se garantiza cabecera Retry-After.'),
    currentVersion: { type: 'integer', nullable: true }, updatedAt: timestamp('Última modificación.', true), updatedBy: nullableText('Autor.'),
    revalorizado: { type: 'boolean' }, cierre: ref('CierreAdmin'),
  }, ['error']),
  Ok: object({ ok: { type: 'boolean', enum: [true] } }, ['ok']),
  UsuarioAdmin: object({ username: text('Identificador administrativo.'), name: text('Nombre visible.') }, ['username', 'name']),
  SesionAdmin: object({ user: ref('UsuarioAdmin') }, ['user']),
  LoginAdmin: object({ username: text('Se normaliza y trunca a 64 caracteres.', { maxLength: 64 }), password: text('Se trunca a 256 caracteres.', { format: 'password', maxLength: 256, writeOnly: true }) }, ['username', 'password']),
  Fixing: object({ gold: number('EUR por onza de oro.', { example: 3000 }), silver: number('EUR por onza de plata.', { example: 30 }) }, ['gold', 'silver']),
  FixingPublicacion: object({ gold: number('EUR/oz de oro.'), silver: number('EUR/oz de plata.'), at: { type: 'integer', format: 'int64', nullable: true } }, ['gold', 'silver'], { nullable: true }),
  LeyPublica: object({ key: leyKey, label: text('Nombre de la ley.'), fineness: number('Pureza en milésimas.'), pricePerGram: number('Precio calculado en EUR/g, sin redondeo contractual de cierres.') }, ['key', 'label', 'fineness', 'pricePerGram']),
  Precios: object({
    fixing: ref('Fixing'), change: object({ gold: number('Variación porcentual.'), silver: number('Variación porcentual.') }, ['gold', 'silver']),
    fetchedAt: { type: 'integer', format: 'int64', nullable: true, description: 'Recepción del proveedor en milisegundos Unix; null para respaldo sin caché.' },
    stale: { type: 'boolean', description: 'True si se entrega caché vencida o fixing de emergencia.' },
    refreshSeconds: integer('Frecuencia configurada, en segundos.'), formulasVersion: { type: 'integer', nullable: true },
    gold: list(ref('LeyPublica')), silver: list(ref('LeyPublica')),
  }, ['fixing', 'change', 'fetchedAt', 'stale', 'refreshSeconds', 'formulasVersion', 'gold', 'silver']),
  LeyFormula: object({
    key: leyKey, label: text('Nombre de la ley.', { minLength: 1, maxLength: 48 }), fineness: number('Pureza; se redondea a dos decimales.', { minimum: 1, maximum: 1000 }),
    f1: number('Factor multiplicativo.', { minimum: 0.01, maximum: 2 }), f2: number('Segundo factor multiplicativo.', { minimum: 0.01, maximum: 2 }),
    f3: number('Ajuste aditivo en EUR/g; predeterminado cero.', { minimum: -100, maximum: 100, default: 0 }),
  }, ['key', 'label', 'fineness', 'f1', 'f2']),
  FormulaSnapshot: object(formulaFields, ['divisor', 'gold', 'silver'], { description: 'Valores normalizados. También se aceptan cadenas numéricas en el servidor, aunque aquí se recomienda JSON numérico.' }),
  PublicarFormulas: object({ ...formulaFields, expectedVersion: { type: 'integer', nullable: true, description: 'Opcional en la implementación actual. Comparación no atómica; ver auditoría INT-01.' } }, ['divisor', 'gold', 'silver']),
  Formulas: object({
    ...formulaFields, version: { type: 'integer', nullable: true }, updatedAt: timestamp('Fecha de publicación.', true), updatedBy: nullableText('Autor.'),
    fixingAtPublish: ref('FixingPublicacion'), source: text('Solo GET: store, defaults o fallback.', { enum: ['store', 'defaults', 'fallback'] }),
  }, ['divisor', 'refreshSeconds', 'gold', 'silver', 'version', 'updatedAt', 'updatedBy', 'fixingAtPublish']),
  Publicacion: object({ version: integer('Versión.'), at: timestamp('Publicación.'), by: text('Autor.'), ip: text('IP registrada.'), fixing: ref('FixingPublicacion'), snapshot: ref('FormulaSnapshot') }, ['version', 'at', 'by', 'ip', 'fixing', 'snapshot']),
  Historial: object({ entries: list(ref('Publicacion'), { maxItems: 50 }) }, ['entries']),
  Muestra: object({ t: { type: 'integer', format: 'int64', description: 'Milisegundos Unix.' }, fixing: ref('Fixing'), version: { type: 'integer', nullable: true }, gold: { type: 'object', additionalProperties: { type: 'number' } }, silver: { type: 'object', additionalProperties: { type: 'number' } } }, ['t', 'fixing', 'version', 'gold', 'silver']),
  Serie: object({ days: integer('Ventana efectiva.', { enum: [7, 30, 90] }), total: integer('Total almacenado antes de filtrar, no el número de puntos devueltos.'), samples: list(ref('Muestra'), { maxItems: 240 }) }, ['days', 'total', 'samples']),
  Escenario: object({ name: text('Nombre exacto del escenario.', { maxLength: 40 }), snapshot: ref('FormulaSnapshot'), savedAt: timestamp('Fecha de guardado.'), savedBy: text('Autor.') }, ['name', 'snapshot', 'savedAt', 'savedBy']),
  Escenarios: object({ scenarios: list(ref('Escenario'), { maxItems: 12 }), max: integer('Capacidad de la lista.', { enum: [12] }) }, ['scenarios', 'max']),
  GuardarEscenario: object({ name: text('Nombre; se limpian controles/espacios.', { minLength: 1, maxLength: 40 }), snapshot: ref('FormulaSnapshot') }, ['name', 'snapshot']),
  BorrarEscenario: object({ name: text('Nombre exacto.', { minLength: 1, maxLength: 40 }) }, ['name']),
  Empresa: empresa, Contacto: contacto, Titular: titular, Cobro: cobro, LimitesCliente: limites,
  EstadoCliente: text('Estado del expediente.', { enum: ['pendiente', 'documentacion', 'aprobado', 'rechazado'] }),
  DocumentoCliente: documento,
  DocumentoAdmin: object({ ...documento.properties, almacen: text('Backend.', { enum: ['blob', 'memoria'] }), pathname: text('Ruta registrada.'), url: text('Referencia privada de Blob; null en memoria.', { nullable: true }) }, [...documento.required, 'almacen', 'pathname', 'url']),
  Cliente: cliente,
  ClienteAdmin: object({
    ...cliente.properties, documentos: list(ref('DocumentoAdmin')),
    condiciones: object({ version: text('Versión aceptada.', { example: '2026-08' }), aceptadoEn: timestamp('Aceptación.'), ip: text('IP registrada.') }, ['version', 'aceptadoEn', 'ip']),
    historial: list(object({ at: timestamp('Fecha.'), por: text('Actor.'), accion: text('Acción.'), nota: nullableText('Nota.') }, ['at', 'por', 'accion', 'nota'])),
    actualizadoEn: timestamp('Último guardado.'), credencialesEn: { type: 'integer', format: 'int64', description: 'Marca de cambio de contraseña, cuando exista.' },
    claveSolicitadaEn: timestamp('Última solicitud de recuperación, si existe.', true),
  }, [...cliente.required, 'condiciones', 'historial', 'actualizadoEn'], { description: 'Documento administrativo actual sin password. Incluye datos personales y referencias privadas; nunca publicar como API anónima.' }),
  ClienteResumen: object({ id, razonSocial: text('Razón social.'), nombreComercial: text('Nombre comercial.'), cif: text('CIF.'), poblacion: text('Población.'), email, telefono: text('Teléfono.'), estado: ref('EstadoCliente'), enviadoEn: timestamp('Envío a revisión.', true), documentos: integer('Número de documentos.'), creadoEn: timestamp('Alta.'), actualizadoEn: timestamp('Actualización.') }, ['id', 'razonSocial', 'nombreComercial', 'cif', 'poblacion', 'email', 'telefono', 'estado', 'enviadoEn', 'documentos', 'creadoEn', 'actualizadoEn']),
  Clientes: object({ clientes: list(ref('ClienteResumen')), pendientes: integer('Pendientes de todo el índice, antes del filtro por estado.') }, ['clientes', 'pendientes']),
  RespuestaCliente: object({ cliente: ref('Cliente') }, ['cliente']),
  Cuenta: object({ cliente: ref('Cliente'), almacen: text('Disponibilidad de archivos.', { enum: ['blob', 'memoria', null], nullable: true }) }, ['cliente', 'almacen']),
  RespuestaClienteAdmin: object({ cliente: ref('ClienteAdmin') }, ['cliente']),
  Alta: action('alta', { empresa: ref('Empresa'), contacto: ref('Contacto'), titular: ref('Titular'), cobro: ref('Cobro'), password, condiciones: { type: 'boolean', enum: [true] } }, ['empresa', 'contacto', 'titular', 'cobro', 'password', 'condiciones']),
  Entrar: action('entrar', { email, password: text('Contraseña.', { format: 'password', writeOnly: true }) }, ['email', 'password']),
  Salir: action('salir'), EnviarSolicitud: action('enviar'), Olvide: action('olvide', { email }, ['email']),
  Restablecer: action('restablecer', { token: codigo, password }, ['token', 'password']),
  Demo: action('demo', { email, password, razonSocial: text('Razón social sintética opcional.') }, [], { description: 'Solo desarrollo; crea o cambia una cuenta y la aprueba. No usar con Redis compartido o productivo. No abre sesión.' }),
  RespuestaDemo: object({ email, password: text('Contraseña de prueba devuelta solo por demo.'), cliente: ref('Cliente') }, ['email', 'password', 'cliente']),
  AprobarCliente: action('aprobar', { id, limites: ref('LimitesCliente') }, ['id']),
  PedirDocumentacion: action('documentacion', { id, nota: text('Motivo visible al cliente.', { minLength: 1, maxLength: 400 }), limites: ref('LimitesCliente') }, ['id', 'nota']),
  RechazarCliente: action('rechazar', { id, nota: text('Motivo visible al cliente.', { minLength: 1, maxLength: 400 }), limites: ref('LimitesCliente') }, ['id', 'nota']),
  CambiarLimites: action('limites', { id, limites: ref('LimitesCliente') }, ['id', 'limites'], { description: 'Debe contener al menos un límite válido; los valores inválidos se omiten. Se usa en el módulo de cierres aplazado.' }),
  GenerarCodigo: action('clave', { id }, ['id']),
  CodigoGenerado: object({ codigo, minutos: integer('Vigencia.', { enum: [60] }) }, ['codigo', 'minutos']),
  ConfirmarDocumento: action('confirmar', { url: text('URL privada devuelta por Blob.', { format: 'uri' }), pathname: text('Ruta devuelta por Blob dentro de clientes/{id}/.'), nombre: text('Nombre; por defecto documento.', { maxLength: 120 }), etiqueta: text('Etiqueta opcional.', { maxLength: 40 }) }, ['url', 'pathname']),
  DocumentoLocal: action('local', { base64: text('Archivo codificado en base64; bytes decodificados <= 2,5 MiB.', { format: 'byte' }), tipo: mime, nombre: text('Nombre opcional.', { maxLength: 120 }), etiqueta: text('Etiqueta opcional.', { maxLength: 40 }) }, ['base64'], { description: 'Solo con modo de documentos memoria; no es multipart/form-data.' }),
  EtiquetarDocumento: action('etiqueta', { id: docId, etiqueta: text('Si está vacía se recupera el nombre del documento.', { maxLength: 40 }) }, ['id']),
  BorrarDocumento: object({ id: docId }, ['id']),
  BlobToken: object({ type: text('Evento del SDK.', { enum: ['blob.generate-client-token'] }), payload: object({ pathname: text('Debe empezar por clientes/{id}/.'), multipart: { type: 'boolean' }, clientPayload: { type: 'string', nullable: true } }, ['pathname', 'multipart', 'clientPayload']) }, ['type', 'payload'], { description: 'Protocolo de @vercel/blob 2.8.0. El SDK gestiona estos mensajes; no subir bytes del archivo a esta operación.' }),
  BlobUploaded: object({ type: text('Evento del SDK.', { enum: ['blob.upload-completed'] }), payload: object({ blob: object({ url: text('URL del objeto.'), downloadUrl: text('URL de descarga.'), pathname: text('Ruta.'), contentType: text('Tipo.'), contentDisposition: text('Disposición.') }, ['url', 'downloadUrl', 'pathname', 'contentType', 'contentDisposition']), tokenPayload: { type: 'string', nullable: true } }, ['blob']) }, ['type', 'payload'], { description: 'Evento interno del SDK. Este handler exige además cookie de cliente y Origin antes de delegar, por lo que no equivale a un webhook público de Blob.' }),
  BlobTokenRespuesta: object({ type: text('Evento.', { enum: ['blob.generate-client-token'] }), clientToken: text('Token efímero; no registrar ni compartir.') }, ['type', 'clientToken']),
  BlobUploadedRespuesta: object({ type: text('Evento.', { enum: ['blob.upload-completed'] }), response: text('Acuse del SDK.', { enum: ['ok'] }) }, ['type', 'response']),
  LineaCierre: lineaInput,
  LineaAjuste: object({ ...lineaInput.properties, precioGramo: { oneOf: [{ type: 'number', minimum: 0, exclusiveMinimum: true, maximum: 1000, nullable: true }, { type: 'string' }], description: 'Opcional. Vacío o null usa tarifa. Debe ser > 0; máximo 1.000 EUR/g oro y 100 plata. Se redondea a 2/3 decimales.' } }, lineaInput.required),
  LineaValorada: lineaValorada, Cierre: cierre,
  CierreAdmin: object({ ...cierre.properties, formulasVersion: { type: 'integer', nullable: true }, ajustadoPor: text('Último autor del ajuste.'), ajustes: list(object({ at: timestamp('Fecha.'), por: text('Actor.'), motivo: nullableText('Motivo.') }, ['at', 'por', 'motivo'])) }, cierre.required),
  CierreResumen: object({ ref: cierreRef, clienteId: id, razonSocial: text('Razón social.'), total: number('EUR.'), gramos: number('Gramos.'), numLineas: integer('Número de líneas.'), estado: cierre.properties.estado, creadoEn: timestamp('Solicitud.'), expiraEn: timestamp('Caducidad.') }, ['ref', 'clienteId', 'razonSocial', 'total', 'gramos', 'numLineas', 'estado', 'creadoEn', 'expiraEn']),
  Cierres: object({ cierres: list(ref('CierreResumen')), pendientes: integer('Pendientes visibles para este actor, antes del filtro por estado.') }, ['cierres', 'pendientes']),
  RespuestaCierre: object({ cierre: ref('Cierre') }, ['cierre']), RespuestaCierreAdmin: object({ cierre: ref('CierreAdmin') }, ['cierre']),
  PedirCierre: object({ lineas: list(ref('LineaCierre'), { minItems: 1, maxItems: 24 }) }, ['lineas']),
  AnularCierre: object({ ref: cierreRef }, ['ref']),
  ConfirmarCierre: action('confirmar', { ref: cierreRef, totalVisto: number('Opcional en el código actual. Diferencia > 0,005 EUR genera conflicto.'), nota: text('Nota opcional.', { maxLength: 400 }) }, ['ref']),
  RechazarCierre: action('rechazar', { ref: cierreRef, nota: text('Motivo obligatorio.', { minLength: 1, maxLength: 400 }) }, ['ref', 'nota']),
  AjustarCierre: action('ajustar', { ref: cierreRef, lineas: list(ref('LineaAjuste'), { minItems: 1, maxItems: 24 }), motivo: text('Motivo opcional.', { maxLength: 200 }) }, ['ref', 'lineas']),
}
