# TQM · Guía del proyecto

La web reúne una portada comercial, un panel administrativo y un portal de clientes. Esta guía describe el código existente y sus límites; las mejoras de la auditoría siguen pendientes salvo cambios posteriores verificados.

**Decisión de lanzamiento:** los cierres no se publican en producción por ahora. El explorador muestra por defecto la API sin sus endpoints y permite cambiar a la vista completa para documentar el trabajo futuro. Filtrar Swagger no desactiva el módulo: su exclusión efectiva del despliegue sigue siendo una tarea separada.

## Abrir y mantener la documentación

```text
npm ci
npm run docs
```

Abre [Swagger local](http://127.0.0.1:3001/docs/). El puerto se puede cambiar con `npm run docs -- --port 3002`. El servidor escucha solo en la máquina local, no carga archivos `.env`, no ejecuta los handlers de la API y sirve sus recursos desde las dependencias instaladas, sin CDN. El explorador permite buscar operaciones, abrir esquemas, elegir ejemplos y descargar OpenAPI. La ejecución de operaciones está desactivada: para pruebas usar la aplicación y un entorno de datos aislado.

Con `npm run dev`, la misma documentación también está disponible en `/docs/` dentro del servidor de desarrollo. No se añade a las entradas de compilación ni a `public`, y no se publica con la compilación normal.

| Comando | Función |
|---|---|
| `npm run docs` | Abre servidor documental con vigilancia de archivos y recarga automática |
| `npm run docs:generate` | Regenera los dos JSON OpenAPI y la información del código inventariado |
| `npm run docs:check` | Valida OpenAPI, cobertura, ejemplos, revisión del código y archivos generados |
| `npm run docs:review` | Registra la revisión del contrato frente al código actual; usar después de actualizarlo y comprobarlo |
| `npm run test:docs` | Comprueba generación, detección de cambios y servidor documental |
| `npm run build` | Regenera y comprueba la documentación antes de compilar la aplicación |

**Actualización automática y revisión:** guardar código o documentación activa la regeneración y recarga cuando está abierto el servidor de desarrollo o `npm run docs`. Un cambio en API, validadores, librerías internas, clientes HTTP, paquetes o configuración relevante se compara con la revisión registrada. Si falta revisar el contrato, Swagger lo indica y la comprobación impide dar la compilación por válida. Añadir un endpoint, método, acción o código de respuesta sin documentarlo también falla. La automatización detecta cambios; una explicación nueva de permisos o de una regla comercial debe escribirse en el contrato. No se oculta esa necesidad confirmando automáticamente las revisiones.

El contrato fuente vive en `docs/api/`: `schemas.mjs` define modelos; `paths.mjs`, operaciones/permisos/errores; `examples.mjs`, datos ficticios; `openapi.mjs`, perfiles. Se escriben allí los cambios. Los archivos `docs/openapi.json` y `docs/openapi.actual.json` son generados y no deben editarse a mano. Las huellas revisadas están en `docs/reviewed-sources.json`; no contienen secretos.

Flujo al cambiar la API:

1. Modificar código, contrato, ejemplos y guía afectados.
2. Ejecutar pruebas del comportamiento, no solo del esquema.
3. Revisar el contrato contra el cambio, ejecutar `npm run docs:review` y luego `npm run docs:check`.
4. Incorporar al mismo cambio los contratos y archivos generados. CI repetirá las comprobaciones sin aprobar revisiones por su cuenta.

Cambios de UI también actualizan el inventario; si cambian un flujo descrito aquí, actualizar su explicación. Un formateo de un archivo protegido también requiere confirmar revisión: el control utiliza huellas del archivo completo para evitar pasar por alto modificaciones.

## Arquitectura y recorrido de una petición

| Zona | Entrada | Responsabilidad |
|---|---|---|
| Web pública | `/`, `src/App.jsx` | Presentación, contacto, precios y páginas legales por hash |
| Panel | `/admin/`, `src/admin/AdminApp.jsx` | Sesión de personal, fórmulas, escenarios, clientes e histórico |
| Portal | `/portal/`, `src/portal/PortalApp.jsx` | Cuenta del cliente, documentación y seguimiento |
| API | `api/*.js`, `api/admin/`, `api/portal/` | Autenticación, permisos, validación y respuestas |
| Dominio/adaptadores | `api/_lib/` | Cálculo, sesiones, Redis, Blob, mercado, correo y exportación |
| Compartido UI | `src/shared/` | Estilos y utilidades de lotes |

Los componentes llaman a `src/admin/api.js` o `src/portal/api.js`. La cookie viaja con la petición, el handler verifica permisos y entradas, las librerías realizan lecturas/cálculos/escrituras y el resultado se transforma para su destinatario. El navegador no conoce las credenciales de Redis, Blob, GoldAPI o correo.

Tecnologías: React 18, Vite, funciones Node/Vercel, Upstash Redis y Vercel Blob. No hay servidor Express ni base SQL en esta implementación. Vite ejecuta los handlers mediante un adaptador propio solo en desarrollo; `vite preview` sirve la compilación estática y no equivale a un despliegue completo de API.

## Desarrollo local

```text
npm ci
npm run dev
npm test
npm run build
```

La aplicación intenta usar el puerto 3000. Vite puede elegir otro si está ocupado; consultar la dirección mostrada. Crear `.env.local` a partir de las variables de `.env.example`, usando credenciales del entorno apropiado. No incorporar secretos al repositorio ni usar prefijo `VITE_` para secretos: las variables cliente se exponen al navegador.

Sin Redis y fuera de producción, el proyecto utiliza memoria que desaparece al reiniciar. Si se configuran credenciales Redis, se usa ese Redis incluso desde desarrollo. Por ello, las demos y pruebas deben apuntar a memoria o a un almacén de pruebas separado. El servidor Swagger independiente no inicializa esos servicios.

`npm run credenciales` genera hashes administrativos. `npm run demo` y la acción `demo` del portal son herramientas de desarrollo: pueden crear, cambiar y aprobar una cuenta; no utilizarlas contra datos reales. El alta normal necesita revisión administrativa.

## Configuración

| Variable | Uso actual | Disponibilidad |
|---|---|---|
| `ADMIN_USER`, `ADMIN_PASSWORD` | Una cuenta administrativa; admite contraseña o formato hash soportado | Necesarios para ese modo en producción |
| `ADMIN_NAME` | Nombre visible | Opcional |
| `ADMIN_USERS` | Lista JSON de cuentas; alternativa al modo anterior | Opcional; el par simple tiene prioridad |
| `GOLDAPI_KEY` | Consulta XAU/EUR y XAG/EUR | Necesaria para cotización del proveedor |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Persistencia y sesiones | Necesarias en producción, o alias KV |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Alias de las variables Redis | Alternativa |
| `BLOB_READ_WRITE_TOKEN` | Archivos privados del portal | Necesaria para documentos en Blob |
| `RESEND_API_KEY`, `CORREO_DESDE` | Enlace de recuperación por correo | Opcionales; sin ellos queda la vía asistida |
| `CLIENTE_DEMO` | Preparar cuenta local `correo:contraseña` | Solo desarrollo aislado |
| `VERCEL`, `VERCEL_ENV`, `NODE_ENV` | Detección de entorno y comportamiento de cookies/memoria | Proporcionadas por runtime/herramientas |

No se necesita ninguna variable para abrir Swagger. Las URLs internas alternativas del SDK Blob no forman parte de la configuración normal recomendada. El control documental lee nombres/código/huellas de archivos autorizados, nunca `.env` ni contenido de una base de datos.

## Sesiones, permisos y convenciones

| Actor | Cookie | Alcance |
|---|---|---|
| Visitante | Ninguna | Cotizaciones públicas y acciones anónimas de cuenta |
| Personal TQM | `tqm_admin` | Administración de fórmulas/clientes; sesiones de 12 h absolutas y 45 min de inactividad |
| Cliente | `tqm_cliente` | Su cuenta y documentos; sesiones de 30 días absolutos y 12 h de inactividad |

Se usa `HttpOnly`, `SameSite=Strict` y `Secure` según el entorno actual. Los tokens aleatorios se guardan por huella. Las peticiones que modifican estado requieren `Origin` aceptado. No hay OAuth, JWT Bearer, segundo factor ni API key pública de TQM. La cabecera `X-TQM-Portal: 1` selecciona la identidad del cliente en cierres cuando coexisten ambas cookies; no otorga permisos.

Swagger documenta cookies como esquemas de seguridad, pero un campo de autorización no puede escribir una cookie HttpOnly. Los clientes HTTP de pruebas deben conservar `Set-Cookie` y reenviar la cookie; los navegadores lo hacen desde una sesión real en el mismo origen. Referencia: [autenticación por cookies en Swagger](https://swagger.io/docs/specification/v3_0/authentication/cookie-authentication/).

Respuestas normalmente JSON, con errores `{ "error": "mensaje", "details": ["detalle"] }`. `details` es opcional. Los límites pueden añadir `retryAfter` al JSON; no se garantiza una cabecera homónima. Los handlers no centralizan todos los errores inesperados: la plataforma puede producir un 500 no JSON. Estado inexistente y servicio caído pueden confundirse en algunas lecturas; consultar auditoría.

Unidades: fixing en EUR/onza; precio en EUR/gramo; peso en gramos. Fechas de negocio en ISO 8601, y muestras/recepción/cambio de credenciales en milisegundos Unix. No confundir la hora de recepción con la hora original del proveedor.

## Precios, fórmulas, escenarios e histórico

La fórmula actual es `max(0, (ley / 1000) × fixing × f1 × f2 / divisor + f3)`. El endpoint público entrega el resultado, no los factores. El panel sí recibe fórmulas completas. Divisor permitido: 1–1000; pureza: 1–1000; f1/f2: 0,01–2; f3: −100–100 EUR/g. Cada metal admite 1–24 leyes.

El refresco de mercado se configura entre 30 y 86.400 segundos; por defecto 60. GoldAPI tiene un timeout de seis segundos y oro/plata se solicitan en paralelo. Redis conserva último mercado con fecha. Ante fallo se devuelve último dato o fixing de emergencia con `stale=true`. La CDN puede conservar precios durante 30 segundos y revalidar durante 300. La web actual introduce variaciones sintéticas adicionales: es un problema pendiente de INT-08, no una fuente de mercado.

Publicar guarda una nueva versión y una entrada de histórico. expectedVersion es opcional y todavía no protege atómicamente frente a dos publicaciones. Hay hasta 50 publicaciones, 12 escenarios y 1.000 muestras históricas con intervalo mínimo previsto de una hora. Los escenarios no publican automáticamente; se cargan y se publican mediante fórmulas. Un escenario nuevo al superar 12 elimina de la lista el más antiguo. Las series ofrecen ventanas de 7/30/90 días y reducen la respuesta a 240 puntos.

## Alta, revisión y documentación de clientes

1. `alta`: valida empresa, contacto, titular, cobro, contraseña y aceptación. Crea expediente pendiente con `enviadoEn=null` y abre sesión.
2. El cliente sube documentos. En Blob: autorizar token → SDK sube archivo → confirmar referencia. En memoria: enviar JSON base64.
3. `enviar`: exige al menos un documento y expediente no aprobado; registra envío y estado pendiente.
4. El administrador aprueba, rechaza o pide documentación. Estas dos últimas decisiones necesitan nota visible para el cliente.
5. Recuperación: `olvide` devuelve respuesta genérica; correo si está configurado o código emitido por personal tras verificar identidad. `restablecer` consume código, cambia contraseña y abre sesión.

Estados: pendiente, documentacion, aprobado y rechazado. El código actual permite editar documentos siempre que no esté aprobado, incluso en estado rechazado. El índice administrativo incluye borradores todavía no enviados. Son comportamientos actuales que difieren de algunas notas históricas del producto.

Archivos: PDF, JPEG, PNG y WEBP; 8 MiB por objeto Blob, 2,5 MiB en memoria, máximo 10 documentos asociados. No hay límite agregado efectivo de 40 MB ni cupo atómico de subidas pendientes. La firma inicial se comprueba; esto no equivale a análisis estructural o antimalware. El propietario no recibe las URL privadas en la vista de su expediente. Personal accede al contenido por `GET /api/admin/clientes?id=...&doc=...`, con respuesta aislada mediante CSP/sandbox.

CIF, DNI, teléfono e IBAN se comprueban por formato, no por existencia ni dígitos de control completos. Los textos se limpian/truncan según campo. El modelo de entrada documenta formas normales; algunas conversiones permisivas del código no son una recomendación para nuevos clientes.

## Cierres: documentados para más adelante

Esta funcionalidad no forma parte de la salida actual. La vista completa de Swagger conserva GET/POST/PUT/DELETE de `/api/cierres`, sus cuerpos y permisos para trabajar en el futuro.

El cliente aprobado solicita un lote; TQM ajusta, confirma o rechaza; el cliente puede anular mientras siga pendiente. Estados: pendiente, confirmado, rechazado y anulado. La caducidad es una propiedad calculada del pendiente, no otro estado. PDF para propietario/personal; CSV/ERP solo personal.

Límites actuales: 24 líneas, 100.000 g por línea, diez solicitudes pendientes contadas sobre el índice visible, reserva configurada por cliente de 5–1440 minutos. `porCierre` es informativo en esta implementación. Oro se redondea a dos decimales por gramo, plata a tres y los importes de línea a céntimos. Persisten incidencias de redondeo entre interfaz/servidor, concurrencia, referencias sin año, revalorización con mercado antiguo, ajustes con fórmula nueva y exportaciones. No considerar la existencia de Swagger como validación de este flujo para producción.

## Persistencia e integraciones

| Grupo Redis | Datos |
|---|---|
| `tqm:formulas`, `tqm:formulas:history`, `tqm:formulas:scenarios` | Publicación vigente, histórico y borradores |
| `tqm:prices:cache`, `tqm:prices:series` | Mercado y muestras |
| `tqm:session:*`, `tqm:rl:*` | Sesiones administrativas y contadores |
| `tqm:cliente:*` | Expedientes, índice, búsquedas email/CIF, sesiones y códigos de recuperación |
| `tqm:doc:*` | Base64 del adaptador de documentos local |
| `tqm:cierre:*`, `tqm:cierres:*` | Registros, secuencias e índice del módulo aplazado |

Las escrituras actuales no forman una transacción global. Los índices JSON de clientes/cierres pueden perder cambios concurrentes. Blob contiene documentos privados y Redis sus referencias. Resend solo se usa para recuperación; el formulario comercial todavía no tiene envío backend. No documentamos un endpoint de contacto inexistente.

## Compilación y despliegue

Vite genera tres entradas en `dist`: portada, administración y portal. Vercel sirve archivos y funciones de `api`, con rewrites para `/admin` y `/portal`, límites de función y cabeceras en `vercel.json`. Swagger es una herramienta local separada y sus recursos no se incorporan a `dist`.

Antes de publicar: comprobar alcance real sin cierres, configurar servicios aislados por entorno, resolver bloqueantes de las funciones publicadas y ejecutar pruebas con las cabeceras reales. La CSP del portal tiene una incompatibilidad auditada con la URL usada por el SDK de Blob instalado. El build correcto no comprueba subida de documentos ni permisos del proveedor.

La compilación incorpora automáticamente generación y control de documentación. El flujo CI comprueba instalación reproducible, contrato, pruebas documentales, pruebas existentes y compilación. Un cambio de API sin revisión documental bloquea el flujo; aprobarlo es una revisión del contrato, no una certificación de seguridad del código.

## Pruebas, auditoría y mantenimiento

Las suites existentes viven en `scripts/pruebas`: unidad, endpoints, memoria, cierres y clave. El diagnóstico adicional de auditoría está separado y comprueba la presencia de fallos; **no es una suite que deba seguir pasando cuando se corrigen**. Los tests de documentación verifican esquemas y cobertura, no reemplazan pruebas de autorización/concurrencia ni pruebas con servicios reales aislados.

Consultar [auditoría del 17/09/2026](/docs/auditoria): 42 puntos de seguridad, integridad, rendimiento y mantenibilidad, con el alcance de cierres actualizado. Prioridades actuales: documentos/cuentas si se publican, expedientes/fórmulas consistentes, precios reales, contacto operativo y bloqueo efectivo del módulo aplazado.

La dirección recomendada es un núcleo de funciones puras para validación/cálculo/transiciones, con repositorios, reloj, correo y mercado como dependencias explícitas; tipos de resultados y operaciones atómicas en persistencia. Esta separación es una propuesta de evolución, no una arquitectura ya implantada por esta documentación.

## Documentos de referencia y fuentes

- [Producto](/docs/producto), [panel](/docs/panel), [portal](/docs/portal) y [diseño](/docs/diseno): notas existentes. Pueden contener planes o afirmaciones anteriores; contrastar con el contrato, esta guía y la auditoría.
- [OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3.html): formato del contrato exportado.
- [Configuración oficial de Swagger UI](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/): explorador sin ejecución y validación remota desactivada.
- [Cookies en Swagger](https://swagger.io/docs/specification/v3_0/authentication/cookie-authentication/): limitaciones del navegador con autenticación por cookies.

Los ejemplos, nombres, teléfonos, correos y documentos del contrato son ficticios. La documentación se obtiene del repositorio, sin consultar ni copiar datos de clientes.
