# Auditoría de TQM Web — 17 de septiembre de 2026

**Resultado actualizado al alcance de lanzamiento:** los cierres no se publicarán en producción por ahora. Sus fallos quedan pendientes para su futuro lanzamiento y no bloquean esta salida si la funcionalidad está efectivamente excluida o desactivada en el servidor. Para las funciones que sí se publiquen, priorizaría autorización de documentos y seguridad de cuentas, integridad de expedientes/fórmulas y funcionamiento correcto de contacto y precios públicos.

**Decisión de alcance del usuario:** mantener cierres fuera de producción. Esto aplaza sus transiciones, reservas, referencias, ajustes y exportaciones PDF/CSV. Conservamos los hallazgos para retomarlos antes de activar el módulo. La revisión de la configuración actual muestra que `api/cierres.js` sigue presente, Vercel configura `api/**/*.js` y las entradas de portal/administración importan cierres; no se encontró un interruptor de desactivación en su endpoint. Antes de publicar, debe verificarse su exclusión efectiva o añadirse una desactivación de servidor cerrada por defecto y retirar sus pantallas/consultas. Ocultar el acceso visual por sí solo no deshabilita la API. Esta auditoría no ha implementado esa separación.

Este informe contiene **42 puntos de revisión y mejora**. No son 42 vulnerabilidades: incluye seguridad, integridad comercial, rendimiento, experiencia de uso y mantenibilidad. Las prioridades expresan el orden recomendado de trabajo, no una puntuación CVSS.

- **P1:** corregir antes de activar en producción la funcionalidad afectada. Los P1 exclusivos de cierres se aplazan hasta su lanzamiento.
- **P2:** abordar a continuación; afecta protección, disponibilidad, exactitud o agilidad de desarrollo.
- **P3:** optimización o consolidación posterior.
- **Reproducido:** comprobación local con datos sintéticos; cuando interviene un servicio externo, está simulado.
- **Estático:** deducido del código/configuración; no comprobado en un navegador desplegado.
- **Condicionado:** el impacto depende de una configuración o condición que se indica expresamente.

**Alcance y límites**

Se revisó el estado de trabajo disponible, incluidos archivos modificados y todavía sin incorporar a Git: 26 archivos en `api`, 44 en `src`, configuración de Vite/Vercel, entradas HTML, validadores, persistencia, autenticación, exportaciones, scripts de prueba y documentación del producto. El inventario de huellas identifica 90 archivos de código/configuración/documentación para poder detectar cambios posteriores.

La revisión no es un pentest del despliegue público. No comprueba permisos reales de las cuentas de Vercel, Redis o Blob, protección del dominio, restauración de copias, comportamiento del proxy de producción, cabeceras recibidas realmente por un navegador ni métricas de usuarios reales. Tampoco equivale a una búsqueda exhaustiva de secretos en todo el historial Git. No se muestran valores de credenciales.

No se modificó el código de la aplicación. Los archivos añadidos por esta auditoría están en `auditoria/2026-09-17/`. Las reproducciones finales utilizan almacenamiento en memoria, credenciales ficticias y red bloqueada/simulada.

**Comprobaciones ejecutadas**

| Comprobación | Resultado | Interpretación |
|---|---|---|
| Pruebas existentes, `npm test` | Las cinco suites terminan correctamente | Cubren escenarios locales; no detectan los fallos concurrentes detallados aquí |
| Compilación, `npm run build` | Correcta | No demuestra que las políticas de seguridad del despliegue permitan todos los flujos |
| Diagnósticos de esta auditoría | 22 de 22 comportamientos reproducidos | Son pruebas de existencia de problemas, no pruebas de que el sistema sea correcto |
| Dependencias, `npm audit` | 13 paquetes afectados: 7 altos, 3 moderados, 3 bajos | Todos en herramientas de desarrollo/compilación; no equivalen a 13 ataques demostrados contra la web publicada |
| Dependencias de producción, `npm audit --omit=dev` | 0 avisos conocidos | No cubre vulnerabilidades propias ni garantiza ausencia de problemas en dependencias |

**Controles existentes que conservaría**

Los permisos importantes se comprueban en el servidor; administración y clientes tienen sesiones diferenciadas; las cookies de sesión usan `HttpOnly` y `SameSite=Strict`; los tokens se generan criptográficamente y sus huellas se guardan en Redis; existen caducidades y validación de entradas; el servidor calcula el precio de los cierres sin aceptar directamente el precio enviado por el cliente. También hay cabeceras de protección, CSP en panel/portal, documentación privada y componentes React que escapan texto.

No he identificado una ejecución de código remoto, una inyección SQL ni una XSS explotable demostrada en esta revisión. Eso no elimina los problemas concretos descritos a continuación.

## Seguridad

**SEC-01 · P1 · Un cliente puede asociar y solicitar el borrado de un documento ajeno. Reproducido.**

Ubicación: [confirmación del documento](C:/Users/itjoy/Desarrollo/tqm-web/api/portal/documentos.js:100), [borrado desde el expediente](C:/Users/itjoy/Desarrollo/tqm-web/api/portal/documentos.js:43), [verificación en Blob](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/documentos.js:42).

Se valida que el `pathname` recibido empiece por la carpeta del cliente, pero se consulta y guarda una `url` independiente, también enviada por el navegador. No se comprueba que ambos identifiquen el mismo objeto ni que los metadatos reales correspondan al propietario autenticado. Un cliente cuyo expediente sea editable y que conozca la URL de otro documento puede incorporarla a su expediente con un pathname propio y después pedir su eliminación. La validación de un archivo inválido también puede intentar eliminarlo antes de verificar su propiedad.

La reproducción `S01` devuelve 200 al asociar y al borrar y registra la petición de borrado de una URL ajena en un Blob simulado. **No demuestra que las URL aleatorias sean adivinables ni una lectura directa del contenido por el cliente.** El SDK restringe destinos Blob: no lo presento como SSRF arbitraria hacia Internet.

Corrección: reservar en servidor un identificador de subida y su ruta; comprobar almacén, ruta canónica y propietario con los metadatos reales; asociar mediante ese identificador, no mediante una pareja de cadenas confiada al navegador. Ninguna verificación debe borrar un archivo antes de autorizar el acceso. Prueba de aceptación: una cuenta A no puede asociar, leer indirectamente ni borrar un objeto de B aunque conozca su URL.

**SEC-02 · P1 · El código de recuperación se puede consumir simultáneamente dos veces. Reproducido.**

Ubicación: [consumirCodigoClave](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/clientes.js:273).

La lectura y el borrado son dos operaciones independientes. Dos peticiones pueden leer el mismo código antes de que alguna lo borre, y ambas continúan con la recuperación. `S02` obtiene dos consumos aceptados. El riesgo requiere posesión de un código válido; no permite recuperar una cuenta sin código.

Corrección: consumo atómico con `GETDEL` o una operación condicional equivalente; combinarlo con control de versión de credenciales para que dos cambios de contraseña no se pisen. Verificar que, de dos recuperaciones concurrentes, solo una pueda completarse. Referencias: [Redis GETDEL](https://redis.io/docs/latest/commands/getdel/) y [recuperación de contraseñas en OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

**SEC-03 · P1 · Otros códigos pendientes siguen válidos después de cambiar la contraseña. Reproducido.**

Ubicación: [crearCodigoClave](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/clientes.js:258), [cambiarClave](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/clientes.js:302).

Cada código tiene una clave independiente. Cambiar la contraseña actualiza `credencialesEn` para las sesiones, pero el consumo de códigos no consulta esa marca. `S03` genera dos códigos, cambia la contraseña con uno y todavía acepta el anterior. Un código previamente comprometido puede devolver el acceso durante su vigencia.

Corrección: asociar cada código a una generación de credenciales, incrementar esa generación al cambiar la contraseña e invalidar códigos anteriores. Definir también si pedir un código nuevo revoca los pendientes; debe ser una política explícita. La generación y el cambio de contraseña necesitan consistencia atómica.

**SEC-04 · P1 · Cambiar la contraseña del administrador no revoca sus sesiones. Reproducido.**

Ubicación: [creación de sesión](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/auth.js:89), [validación posterior](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/auth.js:115).

La sesión registra el nombre de usuario y se comprueba que siga existiendo, pero no qué versión de credenciales la creó. `S04` cambia la contraseña configurada y mantiene válida una sesión anterior. Puede durar hasta el límite absoluto de 12 horas si continúa utilizándose; la caducidad por inactividad es de 45 minutos.

Corrección: versión revocable de credenciales por administrador, comprobada en cada petición; mecanismo de cierre de todas las sesiones; autenticación reforzada para administración y reautenticación en acciones especialmente sensibles. No guardar la contraseña ni una huella reutilizable como credencial dentro de la sesión.

**SEC-05 · P1 · Iniciar sesión con una cuenta propia reinicia el límite de intentos de toda la IP. Reproducido.**

Ubicación: [login del portal](C:/Users/itjoy/Desarrollo/tqm-web/api/portal/cuenta.js:83), [limitadores](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/store.js:336).

El contador se comparte por IP y se borra tras cualquier login correcto. Una persona con una cuenta propia puede alternar intentos contra otras cuentas con su login válido antes de agotar el cupo. `S09` comprueba que el contador pasa de 1 a 0. Además, comprobar y aumentar el contador no es atómico; `INCR` y asignar caducidad tampoco forman una única operación, y los errores de lectura se interpretan como cero intentos.

Corrección: límites atómicos por cuenta, IP y conjunto del servicio, con retraso progresivo; un éxito no debe borrar el presupuesto de intentos contra otras cuentas. Aplicar la cuota antes del cálculo costoso de contraseña y devolver `Retry-After`. Definir el comportamiento seguro cuando el limitador no está disponible. La confianza en la IP reenviada se trata en SEC-11.

**SEC-06 · P2 · El alta revela cuentas existentes sin consumir su cuota de intentos. Reproducido y estático.**

Ubicación: [validación de email/CIF en el alta](C:/Users/itjoy/Desarrollo/tqm-web/api/portal/cuenta.js:260), [recuperación por correo](C:/Users/itjoy/Desarrollo/tqm-web/api/portal/cuenta.js:130), [comparación de contraseñas](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/crypto.js:69).

Los conflictos de email/CIF devuelven 409 antes de aumentar el contador del alta. `S10` realiza siete consultas repetidas que revelan duplicidad y consumen cero cuota. La respuesta genérica del login no evita esta enumeración por otro endpoint. En recuperación, solo las cuentas existentes esperan escrituras y envío de correo, lo que puede revelar diferencias de tiempo. En administración con contraseña en texto plano, la verificación rápida por SHA-256 también difiere del scrypt usado para usuarios inexistentes.

Corrección: contabilizar todas las solicitudes relevantes antes de las búsquedas, evitar respuestas que permitan enumeración innecesaria y sacar el envío de correo del tiempo observable de la petición mediante una cola fiable. Homogeneizar el camino de verificación del administrador con hashes de contraseña. Las diferencias de tiempo son riesgos derivados del código, no una medición contra producción.

**SEC-07 · P2 · El CSV permite introducir fórmulas de hoja de cálculo. Reproducido.**

Ubicación: [csvCierre](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/justificante.js:180).

Escapar comillas, punto y coma o saltos de línea no neutraliza celdas que empiezan por `=`, `+`, `-` o `@`. La razón social la controla el cliente. `S05` exporta `=1+1` como celda interpretable, sin neutralización. El efecto final depende de la aplicación y de cómo se abra el archivo; no se ha demostrado ejecución de comandos.

Corrección: exportación explícitamente segura para hojas de cálculo, tratando las columnas de texto como texto y controlando prefijos/caracteres de control. Si el ERP necesita valores originales, separar el formato de intercambio del archivo destinado a abrirse en Excel. Las comillas CSV por sí solas no son defensa. Referencia: [OWASP, CSV Injection](https://community.owasp.org/attacks/CSV_Injection).

**SEC-08 · P2 · El parser omite el límite de tamaño con JSON preprocesado y falla con cookies malformadas. Reproducido.**

Ubicación: [readJson](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/http.js:22), [parseCookies](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/http.js:69).

Si Vercel entrega un objeto en `req.body`, se devuelve antes de comprobar `maxBytes`. `S06` acepta un campo de 70.000 caracteres con límite declarado de 1.024 bytes. La plataforma puede imponer su propio límite, pero el límite específico de cada endpoint queda eludido. Por otro lado, `decodeURIComponent` puede lanzar una excepción ante cualquier cookie malformada: `S07` lo reproduce con una cookie ajena a la sesión. Un JSON válido como `null` también necesita rechazo como cuerpo de negocio antes de acceder a sus campos.

Corrección: límites efectivos en el adaptador del runtime y validación de esquema/tipo en cada entrada; si el cuerpo ya está procesado, comprobar su tamaño representable dentro del límite de plataforma. Decodificar cookies con recuperación por cookie y centralizar respuestas de error. Pruebas con cuerpo preprocesado, stream, `null`, arrays, cadenas y cookies inválidas.

**SEC-09 · P2 · Las cuotas de documentos no controlan subidas pendientes ni consumo total. Estático.**

Ubicación: [emisión de tokens](C:/Users/itjoy/Desarrollo/tqm-web/api/portal/documentos.js:58), [borrado tolerante a fallos](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/documentos.js:111).

El límite de diez documentos mira los ya asociados al expediente. Se pueden solicitar autorizaciones de subida sin completar esa asociación, acumulando objetos y coste. No existe reserva atómica de bytes/documentos pendientes ni el límite agregado de 40 MB descrito en la documentación. Los borrados fallidos y las subidas abandonadas pueden dejar huérfanos.

Corrección: cupo por cuenta de archivos, bytes y frecuencia; reservarlo al autorizar y liberarlo al finalizar/caducar; limpieza de huérfanos con reintentos y registro. Comprobar propietario antes de limpiar. La firma inicial del archivo no prueba que un PDF o una imagen sean íntegros o seguros: incorporar validación estructural y, según el tratamiento previsto, cuarentena/análisis de archivos. No he demostrado una XSS de documentos; el visor administrativo ya incorpora aislamiento.

**SEC-10 · P2 · Fortalecer el almacenamiento de contraseñas y eliminar el bloqueo de CPU del servidor. Estático, con medición local orientativa.**

Ubicación: [configuración y funciones scrypt](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/crypto.js:8), [configuración administrativa](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/auth.js:36).

Se utiliza scrypt con `N=16384, r=8, p=1`. Queda por debajo de las combinaciones recomendadas actualmente por OWASP; para ese N, la guía propone p=5. Además, `scryptSync` bloquea el hilo de ejecución; una operación local rondó 28 ms, dato que no predice la latencia en Vercel. El modo sencillo del administrador conserva la contraseña original en una variable de entorno.

Corrección: aceptar hashes en producción, calibrar coste y concurrencia con la memoria real del despliegue, migrar hashes antiguos al autenticar y usar `crypto.scrypt` asíncrono con concurrencia limitada. Al elevar N, revisar también `maxmem`. La rapidez debe venir de no bloquear solicitudes y de limitar abuso, manteniendo un coste criptográfico adecuado. Facilitar contraseñas largas y segundo factor para administración. Referencias: [Password Storage de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) y [scrypt asíncrono de Node.js](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).

**SEC-11 · P2 · El origen y la IP dependen de cabeceras del proxy; Secure depende de Vercel. Condicionado.**

Ubicación: [origen e IP](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/http.js:45), [cookie](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/http.js:86), [base del enlace de recuperación](C:/Users/itjoy/Desarrollo/tqm-web/api/portal/cuenta.js:132).

La comparación de origen toma `x-forwarded-host` como autoridad y compara solo host, no el origen completo. `S08` demuestra aceptación con cabeceras construidas en una prueba unitaria. Su explotación real depende de si el proxy permite o sanea esas cabeceras: no se ha demostrado un bypass de CSRF en Vercel. La IP también se toma del primer valor reenviado. El correo de recuperación construye su base a partir de la petición. Fuera de Vercel, incluso en producción, la cookie puede omitirse como `Secure` por la condición actual.

Corrección: `APP_ORIGIN` canónico validado al iniciar; lista exacta de orígenes permitidos; direcciones de recuperación construidas con ese valor; confianza solo en cabeceras garantizadas por la plataforma; cookies seguras en cualquier producción HTTPS. Mantener las protecciones CSRF y SameSite existentes.

**SEC-12 · P1 si se comparte persistencia · El modo demo local puede resetear una cuenta real. Condicionado.**

Ubicación: [acción demo](C:/Users/itjoy/Desarrollo/tqm-web/api/portal/cuenta.js:193), [selección del almacén](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/store.js:23).

La acción de desarrollo permite elegir un email, cambiar su contraseña y aprobar su cuenta sin autenticación previa. Está deshabilitada en producción según las variables comprobadas, pero el almacén local elige Redis real si hay credenciales disponibles. Por tanto, ejecutar el servidor de desarrollo conectado a una base real mezcla un atajo de pruebas con expedientes reales. No encontré esas credenciales Redis en los nombres de variables del archivo local comprobado; el riesgo es condicional.

Corrección: creación de demos por una herramienta explícita ligada al adaptador de memoria o a un entorno de pruebas aislado; rechazo del modo demo si existe persistencia compartida; namespaces y credenciales separados. También restringir a la máquina local el servidor de desarrollo cuando esté activo el acceso administrativo de demostración.

**SEC-13 · P2 · El script externo de la web pública comparte origen con las áreas autenticadas. Estático.**

Ubicación: [carga de TradingView](C:/Users/itjoy/Desarrollo/tqm-web/src/components/TradingViewChart.jsx:35), [cabeceras](C:/Users/itjoy/Desarrollo/tqm-web/vercel.json:31).

El script externo se ejecuta en la página pública. Esa página no tiene la CSP de panel/portal y comparte origen con sus endpoints. Si ese script se comprometiera, el aislamiento de bundles y `HttpOnly` no impedirían peticiones autenticadas del mismo origen desde el navegador. Esto describe exposición a una dependencia externa, no una intrusión observada.

Corrección: aislar la integración externa en un contexto que no ejecute código privilegiado en el origen principal y valorar un origen separado para administración, con cookies limitadas al host. Añadir CSP a la web pública ajustada a las integraciones reales. Mantener el panel sin scripts externos; los archivos JavaScript separados mejoran carga, pero la autorización del servidor sigue siendo la barrera de seguridad.

**SEC-14 · P2 · Actualizar y controlar la cadena de herramientas de desarrollo. Confirmado por auditoría de dependencias.**

Ubicación: [package.json](C:/Users/itjoy/Desarrollo/tqm-web/package.json), [resultado completo](C:/Users/itjoy/Desarrollo/tqm-web/auditoria/2026-09-17/dependencias.json).

La instalación revisada tiene Vite 5.4.21 y 13 paquetes señalados en la cadena de desarrollo, con siete clasificados como altos. Hay avisos para Vite, esbuild y otras dependencias transitivas. El aviso de Vite GHSA-fx2h-pf6j-xcff afecta a controles de acceso a archivos del servidor de desarrollo en Windows; su relevancia aumenta si ese servidor se expone a otras máquinas. No es una prueba de fuga de archivos desde el sitio estático compilado.

Corrección: actualizar Vite y su plugin React a versiones mantenidas y compatibles, revisar cambios, regenerar el lockfile y ejecutar las pruebas/compilación. No aplicar automáticamente una actualización forzada sin revisar incompatibilidades. Restringir el servidor de desarrollo y separar secretos/entornos. El aviso indica correcciones en 6.4.3, 7.3.5 y 8.0.16 para esa vulnerabilidad concreta; eso no implica que todas esas ramas sean la mejor elección futura. Referencia: [aviso oficial de Vite](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff).

## Integridad de operaciones y funcionamiento

**INT-01 · P1 · El bloqueo de versiones de las fórmulas no es atómico. Reproducido.**

Ubicación: [PUT de fórmulas](C:/Users/itjoy/Desarrollo/tqm-web/api/admin/formulas.js:48), [saveFormulas](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/store.js:137).

Se compara `expectedVersion` y después se guarda mediante varias operaciones independientes. Además, la versión esperada es opcional. `C01` publica dos cambios simultáneos: ambos reciben 200 y ambos quedan etiquetados como versión 2. Se pierde la protección prometida frente a sobrescrituras, y la relación entre documento vigente e historial puede dejar de ser fiable.

Corrección: exigir revisión esperada y hacer una comparación/escritura atómica, incluyendo nueva revisión y evento de historial. En Redis, usar una operación condicional en Lua o un mecanismo transaccional con control de concurrencia compatible con el cliente utilizado. Un `MULTI` que solo agrupe escrituras no sustituye la comparación de versión. Aceptación: un ganador y un 409 ante dos publicaciones de la misma revisión. Referencia: [transacciones de Redis](https://redis.io/docs/latest/develop/using-commands/transactions/).

**INT-02 · P1 · Las escrituras de expedientes y cierres pierden cambios y aceptan decisiones contradictorias. Reproducido.**

Ubicación: [persistencia de clientes](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/clientes.js:113), [persistencia de cierres](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:205), [decisiones de cierre](C:/Users/itjoy/Desarrollo/tqm-web/api/cierres.js:175).

Se lee un documento, se construye una copia y se sobrescribe entero. Los índices globales siguen el mismo patrón. `C02` crea dos expedientes pero deja solo uno en el índice; `C08` confirma y anula el mismo cierre a la vez, ambas respuestas son 200 y el registro termina anulado. Un guardado con una copia vieja de cliente también puede sobrescribir cambios de contraseña, aprobación o documentos. Las comprobaciones previas de email/CIF no garantizan unicidad ante dos altas simultáneas.

Corrección: versión por entidad, transición condicional desde estado permitido y actualización atómica; índices con operaciones por elemento; unicidad reservada atómicamente; idempotencia en creación de operaciones para tolerar reintentos. La confirmación debe validar dentro de la misma operación estado, revisión, vigencia y autorización relevante. Probar concurrencia tanto entre dos administradores como entre administrador y cliente.

**INT-03 · P1 · La referencia del cierre se repite cada año y puede sobrescribir operaciones. Reproducido.**

Ubicación: [nuevaReferencia](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:37), [escritura del cierre](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:243).

La referencia contiene día y mes, sin año. El contador caduca a los 31 días, mientras que el cierre se conserva sin esa caducidad. `C05` genera `TQM-1709-0001` en dos años y el segundo registro sustituye al primero. Si falla Redis, el número aleatorio de cuatro cifras también puede colisionar.

Corrección: identificador interno globalmente único; referencia humana con año y secuencia atómica; escritura inicial que rechace colisiones; zona horaria empresarial explícita. No sustituir un fallo de secuencia por un número aleatorio corto. Auditar posibles duplicados antes de migrar datos existentes.

**INT-04 · P1 · Una reserva caducada puede revalorizarse y confirmarse con mercado obsoleto. Reproducido.**

Ubicación: [revalorizar](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:321), [confirmación](C:/Users/itjoy/Desarrollo/tqm-web/api/cierres.js:236), [frescura del mercado](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/market.js:51).

La creación comprueba `stale`, pero la revalorización solo comprueba `ok`. Reabre la reserva incluso si la cotización procede de una caché vencida. `C03` usa mercado de 24 horas: la primera confirmación devuelve 409 y revaloriza; la segunda confirma con 200. También se confunde la frecuencia configurable de consulta con la máxima antigüedad admisible para comprometer precios. El adaptador asigna la hora de recepción y no conserva una marca temporal original del proveedor.

Corrección: una única política de cotización operativa, aplicada al crear, revalorizar y confirmar; rechazar datos obsoletos, de emergencia o sin metadatos suficientes. Distinguir antigüedad del dato, hora de recepción, frecuencia de sondeo y duración de reserva. Validar precios positivos, unidad, divisa y fecha del proveedor. La caché antigua puede servir para una visualización identificada como histórica, con una política diferente de la contratación.

**INT-05 · P1 · Un error al leer fórmulas se transforma en una tarifa de respaldo aparentemente operativa. Reproducido.**

Ubicación: [getFormulas](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/store.js:125), [valorar](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:132).

La indisponibilidad o ausencia de fórmulas termina devolviendo valores predeterminados. La valoración determina `stale` solo a partir del mercado. `C04` provoca una excepción de lectura de fórmulas y obtiene `ok: true`, `stale: false`, usando los márgenes de respaldo. El sistema puede comprometer un importe distinto del aprobado por TQM.

Corrección: resultados explícitos `disponible`, `sinConfigurar` y `noDisponible`; para una operación económica, exigir una versión publicada válida. Inicializar las fórmulas mediante una operación consciente y auditable. No convertir errores de infraestructura en decisiones comerciales silenciosas.

**INT-06 · P1 · Ajustar el peso puede cambiar la tarifa reservada sin actualizar la versión registrada. Reproducido.**

Ubicación: [ajustarCierre](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:264).

El ajuste conserva el fixing del cierre, pero carga las fórmulas publicadas actuales. Si se cambiaron los márgenes desde la reserva, el precio unitario cambia incluso al corregir solo el peso. `C09` pasa de 70,80 a 80,80 €/g aplicando la fórmula 99 mientras el cierre sigue registrando la versión 1.

Corrección: snapshot de tarifa/fórmula y reglas de redondeo al reservar; un ajuste de peso utiliza ese snapshot. Definir qué ocurre al introducir una ley que no estaba en el lote original. Cualquier repricing intencional debe crear una revisión y explicar el cambio al cliente y al administrador.

**INT-07 · P1 · Portal y servidor calculan importes distintos; falta vincular la aceptación a una cotización concreta. Reproducido y estático.**

Ubicación: [resumen del portal](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/Cierre.jsx:277), [valoración de servidor](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:144), [envío](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/Cierre.jsx:329).

El servidor redondea primero el precio por gramo a dos o tres decimales, luego cada importe a céntimos. El portal multiplica por el precio sin ese redondeo intermedio. En `C06`, 1.000 g de oro de 18k producen 70.798,79 € en el resumen frente a 70.800,00 € en el servidor: diferencia de 1,21 €. El envío contiene pesos, pero no la revisión de precio que el usuario acaba de aceptar, por lo que puede cambiar silenciosamente al recalcular.

Corrección: una especificación monetaria única y funciones puras compartidas que trabajen con unidades enteras o decimales controlados. Compartir las reglas de importes sobre precios unitarios públicos, sin trasladar márgenes privados al navegador. El servidor debe emitir una cotización identificada, con revisión, caducidad y total; aceptar contra esa revisión y solicitar reconfirmación si cambia. Conservar al servidor como autoridad del precio.

**INT-08 · P1 · Los precios públicos contienen oscilaciones e históricos ficticios presentados como actuales. Estático.**

Ubicación: [useMetalPrices](C:/Users/itjoy/Desarrollo/tqm-web/src/hooks/useMetalPrices.js:123), [presentación de actualidad](C:/Users/itjoy/Desarrollo/tqm-web/src/components/PriceCard.jsx:74).

El hook añade oscilaciones con `Math.random`, genera puntos de gráfico sintéticos y aplica ese movimiento a fixing/precios. Además, registra como actualización la llegada de la petición, inventa una hora de actualización al fallar y no conserva claramente los estados de dato obsoleto o de emergencia recibidos del servidor. La etiqueta «En directo» no representa fielmente esa procedencia.

Corrección: mostrar únicamente cotizaciones y muestras reales, conservar su fecha de origen y distinguir dato vigente, retrasado y no disponible. Si se mantienen ejemplos para una demo, deben estar explícitamente etiquetados y fuera de la operativa real. Quitar las oscilaciones también elimina trabajo innecesario de React.

**INT-09 · P1 para límites operativos · El índice de los últimos 300 cierres se usa como si fuera el registro completo. Estático.**

Ubicación: [recorte del índice](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:205), [control de solicitudes pendientes](C:/Users/itjoy/Desarrollo/tqm-web/api/cierres.js:144).

Los documentos antiguos siguen existiendo por referencia, pero desaparecen del índice global. Ese mismo índice alimenta historial y controles de pendientes. Al superarse 300 cierres globales, se puede ocultar una operación todavía pendiente y calcular límites sobre información incompleta. El historial de un cliente también depende de cuánto operen los demás.

Corrección: índices paginados por cliente, estado y fecha; contador de pendientes mantenido de forma consistente con las transiciones. Limitar una página de resultados no debe limitar la información sobre la que se decide una autorización de negocio. Prueba con más de 300 cierres y solicitudes antiguas aún abiertas.

**INT-10 · P1 si se requiere documentación para el alta · La CSP del portal bloquea el destino de subida del SDK instalado. Comprobado en código y configuración.**

Ubicación: [connect-src del portal](C:/Users/itjoy/Desarrollo/tqm-web/vercel.json:106), [componente de subida](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/PortalApp.jsx:2).

La versión instalada de `@vercel/blob` usa por defecto `https://vercel.com/api/blob` para su API de subida. `connect-src` permite el propio origen y ciertos dominios `blob.vercel-storage.com`, pero no `vercel.com`. `C11` comprueba la incompatibilidad entre SDK y configuración. Los ensayos en memoria no aplican cabeceras del navegador, por eso no detectan el bloqueo. No se ha hecho una subida real contra un despliegue.

Corrección: permitir únicamente los destinos necesarios de la versión y modalidad efectivamente utilizadas; verificar subida, confirmación, visualización y borrado con las cabeceras de producción. No resolverlo desactivando la CSP ni con un comodín global.

**INT-11 · P1 para la web comercial · El formulario informa de un envío que no realiza. Estático.**

Ubicación: [handleSubmit](C:/Users/itjoy/Desarrollo/tqm-web/src/components/Contact.jsx:50), [mensaje de éxito](C:/Users/itjoy/Desarrollo/tqm-web/src/components/Contact.jsx:135).

Enviar solo ejecuta `preventDefault()` y `setSent(true)`. No hay petición, persistencia ni correo, aunque se anuncia «Mensaje enviado correctamente» y se promete respuesta. Se pueden perder contactos comerciales sin ningún error visible.

Corrección: endpoint de contacto con validación, destinatarios permitidos definidos en servidor, protección frente a abuso y confirmación real del proveedor o almacenamiento fiable. Alternativamente, ofrecer un contacto directo explícito mientras se implementa. La interfaz debe diferenciar envío en curso, recibido y fallo con reintento.

**INT-12 · P2 · Los justificantes PDF pueden perder filas y cambiar retrospectivamente. Reproducido y estático.**

Ubicación: [generación de justificante](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/justificante.js:80), [filas y pie](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/justificante.js:122), [obtención de cliente para el documento](C:/Users/itjoy/Desarrollo/tqm-web/api/cierres.js:80).

El PDF usa posiciones fijas en una página. `C10` con 24 líneas y precios manuales coloca texto en y=-17,11, fuera de la página. Nombres/direcciones largos no tienen una estrategia completa de ajuste; los gramos se muestran con menos precisión que la almacenada. La etiqueta de fecha también necesita distinguir confirmación de otros estados. Parte de los datos fiscales se toma del expediente actual, por lo que regenerar un justificante puede cambiarlo después de la operación.

Corrección: motor con salto de página y ajuste de texto; pruebas visuales con máximos de líneas y longitudes; precisión coherente entre pantalla, PDF y CSV; snapshot del emisor/receptor y de la operación al confirmar. Fijar fecha y zona horaria en la representación. Mantener un documento estable o su versión y huella.

**INT-13 · P2 · Endurecer invariantes numéricas y claves del lote. Reproducido y estático.**

Ubicación: [validación de líneas](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:77), [total aceptado](C:/Users/itjoy/Desarrollo/tqm-web/api/cierres.js:247), [estado de cantidades](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/Cierre.jsx:283).

Se comprueba peso positivo antes de redondear: `C07` acepta 0,0001 g y almacena 0 g. Debe validarse el valor normalizado. También conviene rechazar valores no finitos en cualquier comprobación del total visto; `Number` puede producir `NaN` y volver ineficaz una comparación por diferencia. Las cantidades del portal están indexadas solo por `key`, mientras la unicidad de leyes se valida por metal: claves coincidentes entre oro y plata pueden interferir.

Corrección: unidades enteras con límites tras normalización, clave compuesta `metal:key`, esquema estricto y revisión obligatoria del cierre. Decidir explícitamente la política de líneas duplicadas y si el límite de gramos se aplica por línea o por lote. Probar fronteras, separadores decimales, NaN, Infinity y redondeos.

## Experiencia de uso y exactitud de la interfaz

**UX-01 · P2 · Estados de operaciones y sesiones se quedan desactualizados. Estático.**

Ubicación: [carga y temporizador del cierre](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/Cierre.jsx:251), [detalle almacenado](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/Cierre.jsx:151), [gestión global de sesión](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/PortalApp.jsx:1001), [clientes HTTP](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/api.js:27).

El temporizador actualiza el reloj visual, pero no vuelve a consultar precios ni decisiones de otros usuarios. Cabeceras y pantallas mantienen cargas independientes. El detalle de un cierre puede seguir cacheado tras cambiar su estado. El manejador global de `unhandledrejection` no recibe errores que las pantallas ya capturan. Cerrar sesión ignora fallos de red y cambia la interfaz aunque la cookie del servidor pueda seguir siendo válida.

Corrección: caché compartida por recurso, refresco al volver a la pestaña y después de cambios, sondeo moderado solo cuando sea necesario, invalidación del detalle y fechas reales. Tratamiento explícito de 401 desde el cliente HTTP; cierre de sesión comprobado, con estado de error/reintento. Añadir timeout, cancelación y protección contra respuestas fuera de orden.

**UX-02 · P2 · Volver desde una página legal puede dejar secciones ocultas. Estático.**

Ubicación: [IntersectionObserver de App](C:/Users/itjoy/Desarrollo/tqm-web/src/App.jsx:105), [estilo fade-up](C:/Users/itjoy/Desarrollo/tqm-web/src/index.css:439).

El efecto que registra elementos en el observador solo se ejecuta al montar App. Al navegar a una página legal y regresar, los elementos de portada son nuevos y pueden quedar sin observar, con opacidad cero. También ocurre al entrar directamente en una ruta legal y pasar luego a portada.

Corrección: observación ligada al montaje de cada sección o a la ruta; contenido visible por defecto y animación como mejora progresiva. Probar navegación de ida/vuelta y carga directa. Este comportamiento se deduce del ciclo de montaje; no se ha ejecutado aquí una prueba de navegador.

**UX-03 · P2 · Enlaces legales y teléfonos del portal no corresponden a la web. Estático.**

Ubicación: [enlaces del alta](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/PortalApp.jsx:632), [teléfono de recuperación](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/PortalApp.jsx:389), [contacto central](C:/Users/itjoy/Desarrollo/tqm-web/src/contactInfo.js).

El portal enlaza a `/aviso-legal` y `/politica-privacidad`, mientras la web resuelve `/#/aviso-legal` y `/#/politica-de-privacidad`; no hay rewrites específicos para las rutas del portal. Pueden terminar en 404 o en portada sin mostrar el texto pedido. Recuperación y ficha usan el teléfono de ejemplo 922 00 00 00. «Condiciones» enlaza al aviso legal: debe apuntar al documento realmente aceptado y versionado.

Corrección: rutas y datos de contacto compartidos, con enlaces comprobados desde cada entrada. Asegurar que el texto y versión de condiciones guardados se correspondan con el documento mostrado.

**UX-04 · P2 · El consentimiento cambia más preferencias de las que pide el botón del gráfico. Estático.**

Ubicación: [preferencias iniciales](C:/Users/itjoy/Desarrollo/tqm-web/src/components/CookieBanner.jsx:7), [aceptación del gráfico](C:/Users/itjoy/Desarrollo/tqm-web/src/components/TradingViewChart.jsx:91), [persistencia del consentimiento](C:/Users/itjoy/Desarrollo/tqm-web/src/cookieConsent.js:7).

«Aceptar y ver el gráfico» habilita análisis y publicidad, aunque el texto presenta la aceptación como necesaria para el gráfico. Puede sobrescribir un rechazo previo de publicidad. La configuración parte de ambos interruptores activados. Se guarda una fecha pero nunca se evalúa su antigüedad; localStorage puede conservar la decisión más allá de la cookie. El banner no se sincroniza plenamente con cambios hechos fuera de él ni entre pestañas.

Corrección: activar solo las finalidades elegidas, preservar las demás, partir de opciones voluntarias desactivadas y versionar/esquematizar/caducar la decisión según la política adoptada. Sincronizar los consumidores del consentimiento. Es una revisión de comportamiento del código, no un dictamen de cumplimiento legal.

**UX-05 · P2 · Completar accesibilidad y recuperación de errores. Estático.**

Ubicación: [formulario público](C:/Users/itjoy/Desarrollo/tqm-web/src/components/Contact.jsx:145), [diálogo de cookies](C:/Users/itjoy/Desarrollo/tqm-web/src/components/CookieBanner.jsx:51), [gráfico administrativo](C:/Users/itjoy/Desarrollo/tqm-web/src/admin/components/Chart.jsx).

Hay etiquetas sin asociación `htmlFor/id`; interruptores de cookies sin nombre accesible suficientemente asociado; un diálogo modal sin ciclo/restauración de foco; gráficos cuya información depende de interacción visual; y animaciones públicas que necesitan respetar reducción de movimiento. La existencia de atributos ARIA aislados no completa navegación con teclado y lector de pantalla.

Corrección: etiquetas y descripciones de error vinculadas, orden de foco, gestión de apertura/cierre de diálogos, nombres accesibles y alternativa tabular de gráficos. Añadir pruebas automáticas de accesibilidad y un recorrido manual con teclado y lector. Usar estados de carga/error/éxito que sean anunciados y permitan recuperarse.

## Programación funcional, rapidez y agilidad

**ARQ-01 · P2 · Extraer un núcleo funcional de reglas de negocio.**

Ubicación: [reglas de cierres](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js), [fórmulas administrativas](C:/Users/itjoy/Desarrollo/tqm-web/src/admin/lib/formulas.js), [lotes compartidos](C:/Users/itjoy/Desarrollo/tqm-web/src/shared/lote.js).

Ya hay una base útil: validadores que devuelven resultados, funciones de cálculo y transformaciones con `map`. El acoplamiento principal está en funciones como `valorar`, `ajustarCierre` y `revalorizar`, que combinan lecturas, reglas, reloj y escrituras. Eso dificulta comprobar las reglas de forma independiente y permitió inconsistencias de snapshot y redondeo.

Propuesta de separación incremental:

| Capa | Responsabilidad | Dependencias permitidas |
|---|---|---|
| Dominio | Validar cantidades, valorar, comprobar vigencia, decidir transiciones | Datos recibidos y funciones puras |
| Casos de uso | Cargar contexto, autorizar, ejecutar regla, guardar con revisión | Interfaces de repositorio, reloj, identidad, mercado |
| Adaptadores | Redis, Blob, correo, HTTP y generación de documentos | SDK y APIs externas |
| Presentación | Formularios, estados de petición, navegación y renderizado | DTO públicos y cliente HTTP |

Funciones que extraería primero:

| Función propuesta | Entradas explícitas | Salida |
|---|---|---|
| `normalizarLineas` | Datos recibidos y límites | Líneas normalizadas o errores |
| `calcularImportes` | Cantidades, precios unitarios y política de redondeo | Importes y total exactos |
| `valorarLote` | Líneas, snapshot de fórmula y cotización válida | Valoración completa o error tipado |
| `decidirTransicion` | Cierre, comando, actor y hora actual | Nueva revisión y eventos, o conflicto |
| `presentarCierre` | Snapshot y rol del destinatario | DTO con campos permitidos |

El dominio no leería `process.env`, Redis, `Date.now()` ni `Math.random()` por su cuenta. Esas dependencias llegarían desde el caso de uso. La hora explícita permite probar vencimientos sin alterar el reloj global; los precios explícitos permiten comparar navegador y servidor con los mismos casos.

Adoptaría TypeScript de forma gradual o, como primer paso, JSDoc con comprobación de tipos. Modelaría estados y resultados como uniones discriminadas: una cotización `noDisponible` no puede usarse por accidente como `vigente`; una transición exige la revisión anterior. Usaría DTO por lista de campos permitidos, especialmente al devolver registros que almacenan datos sensibles.

Las transformaciones puras deben ser deterministas y no modificar entradas observables. Es válido construir localmente un array con un bucle cuando simplifica el cálculo y evita copias. Cambiar indiscriminadamente bucles por `reduce`, multiplicar capas genéricas o añadir `useMemo` a todo no resuelve las consultas repetidas ni la concurrencia. El criterio debe ser claridad de invariantes y medición del trabajo realizado.

**ARQ-02 · P2 · Coordinar las actualizaciones de la caché de mercado. Reproducido.**

Ubicación: [resolveMarket](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/market.js:51), [muestras en la respuesta pública](C:/Users/itjoy/Desarrollo/tqm-web/api/prices.js:49).

Varias peticiones que encuentran caché vacía/vencida consultan al proveedor por separado. `P01` lanza cinco peticiones concurrentes y produce diez llamadas simuladas —oro y plata por petición— frente a las dos necesarias para una sola actualización. La caché/CDN reduce tráfico habitual, pero no coordina el fallo simultáneo de caché ni evita reintentos repetidos durante una caída. Guardar una muestra histórica también añade lecturas/escrituras al camino de respuesta.

Corrección: una promesa de actualización compartida por proceso y un bloqueo breve distribuido para distintas instancias serverless, con propietario y liberación segura. Definir espera acotada, backoff, caducidad y comportamiento de último dato conocido según INT-04. Hacer atómica la decisión de registrar una muestra por intervalo. Sacar tareas no imprescindibles del tiempo de respuesta solo con un mecanismo de ejecución fiable; una promesa sin esperar puede perderse al terminar la función.

Medir llamadas al proveedor por renovación, tasa de acierto, antigüedad de datos, latencia p50/p95 y coste por operación. La mejora demostrable inicial es reducir llamadas duplicadas; no hay aquí una medición de aceleración real de producción.

**ARQ-03 · P2 · Sustituir los índices JSON globales por acceso por entidad y páginas.**

Ubicación: [reindexado de clientes](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/clientes.js:113), [reindexado de cierres](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:205).

Cada actualización lee, filtra, ordena y reescribe listas globales. El coste y el volumen transferido crecen con toda la base, incluso para una modificación pequeña, y la contención favorece las pérdidas de INT-02. Consultar sesión, expediente y renovar TTL añade viajes a Redis que conviene medir y agrupar cuando sean independientes.

Corrección: documentos por identificador, índices por miembro y fecha con conjuntos/estructuras ordenadas, páginas y campos mínimos para listados; transacciones condicionales para los cambios relacionados. Usar pipeline para viajes independientes, sin confundirlo con una garantía de atomicidad. Si el negocio exige muchas relaciones, unicidad y consultas cruzadas, evaluar una base transaccional con un diseño concreto y coste medido. La migración debe incluir reconstrucción verificable de índices y comparación de registros.

**ARQ-04 · P2 · Aislar actualizaciones visuales frecuentes.**

Ubicación: [scroll de App](C:/Users/itjoy/Desarrollo/tqm-web/src/App.jsx:95), [actualización de precios](C:/Users/itjoy/Desarrollo/tqm-web/src/hooks/useMetalPrices.js:123).

El evento scroll actualiza estado en App y vuelve a ejecutar el árbol de la portada; los cambios ficticios de precios provocan renders periódicos adicionales. Es más importante evitar esa propagación que optimizar cálculos sobre unas pocas leyes o líneas.

Corrección: extraer barra de progreso/navegación a componentes con estado local, actualizar una vez por fotograma cuando sea necesario o usar una capacidad CSS apropiada con alternativa; eliminar oscilaciones sintéticas; mantener las actualizaciones de cotización en su subárbol. Pausar sondeos con la pestaña oculta y cancelar peticiones al desmontar. Validar con un perfil de React y una traza de interacción en móvil; no se ha medido aquí el rendimiento visual en un dispositivo real.

**ARQ-05 · P3 · Cargar pantallas y recursos cuando se necesiten.**

Ubicación: [importaciones administrativas](C:/Users/itjoy/Desarrollo/tqm-web/src/admin/AdminApp.jsx:8), [entrada del portal](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/PortalApp.jsx:1), [fuentes públicas](C:/Users/itjoy/Desarrollo/tqm-web/index.html:66).

El panel importa todas sus vistas desde el inicio y el portal incluye el SDK de subida aunque se entre solo a consultar. Las entradas separadas ya ayudan. La compilación revisada produjo estos tamaños aproximados, en kB decimales; gzip se calculó sobre los archivos generados:

| Recurso | Sin comprimir | gzip |
|---|---:|---:|
| JavaScript compartido | 143,00 | 45,87 |
| JavaScript portada | 77,85 | 20,72 |
| JavaScript administración | 88,58 | 25,06 |
| JavaScript portal | 138,65 | 39,08 |
| CSS portada | 36,44 | 7,18 |
| CSS administración | 40,05 | 8,70 |
| CSS portal | 33,07 | 7,27 |

La carga inicial de JavaScript compartido más entrada es aproximadamente 66,6 kB gzip en portada, 70,9 en administración y 85,0 en portal. No incluye fuentes, imágenes, scripts externos ni cabeceras. El logo PNG ronda 328 kB y se reutiliza como icono/favicón. Las fuentes públicas piden varias familias y pesos; el panel ya dispone de fuentes locales.

Corrección: cargar con `lazy` las vistas secundarias, importar el SDK al abrir la subida, servir iconos dimensionados y logo optimizado, reducir pesos tipográficos y valorar fuentes locales con subconjuntos. Establecer presupuesto de recursos por entrada y medir LCP/INP/CLS antes de decidir más fragmentación. Estas cifras no son una puntuación Lighthouse ni tiempos de carga.

**ARQ-06 · P2 · Dividir los componentes según flujos y estados de negocio.**

Ubicación: [PortalApp](C:/Users/itjoy/Desarrollo/tqm-web/src/portal/PortalApp.jsx), [AdminApp](C:/Users/itjoy/Desarrollo/tqm-web/src/admin/AdminApp.jsx), [vista administrativa de cierres](C:/Users/itjoy/Desarrollo/tqm-web/src/admin/views/Cierres.jsx).

PortalApp supera las mil líneas; AdminApp ronda seiscientas; la vista de cierres también supera seiscientas. El tamaño no es por sí mismo un fallo, pero aquí reúne autenticación, formularios, navegación, carga de datos y decisiones de negocio. La combinación de muchos estados booleanos y props generales hace más fácil representar situaciones incompatibles y más costoso cambiar un flujo.

Corrección: separar recuperación, alta, documentación, ficha y cierres; hooks por recurso y por caso de uso; reducers puros para formularios/flujos con estados explícitos. Compartir el transporte HTTP y la presentación común, conservando autorizaciones distintas de cliente y administrador. Concentrar rutas, contacto, límites y formatos; evitar duplicar fórmulas en componentes. Mantener CSS por responsabilidad con tokens compartidos; eliminar reglas duplicadas solo tras comprobar sus consumidores.

**ARQ-07 · P2 · Diferenciar historial de pantalla, series de precios y auditoría persistente.**

Ubicación: [retención](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/store.js:111), [historial de cliente](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/clientes.js:168), [ajustes](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:298).

Solo se conservan 50 publicaciones y 1.000 muestras con intervalo mínimo de una hora. Con actividad horaria continua, las muestras cubren unos 41,7 días, aunque la interfaz ofrece 90; con menos actividad cubren más tiempo pero hay huecos. Los ajustes guardan autor, fecha y motivo, sin un snapshot completo de cada transición. Las revalorizaciones pueden sustituir datos previos. El historial del cliente también recorta unas acciones y trata otras de forma distinta.

Corrección: eventos de negocio con actor, revisión, fecha, antes/después relevante e identificador de petición; retención explícita y acceso restringido, separada de la lista visible. Guardar precios/fórmulas aceptados por cada operación. Para gráficas, agregaciones por intervalo que preserven mínimo/máximo y expliquen huecos; calcular estadísticas sobre datos apropiados, no exclusivamente sobre una muestra reducida para dibujar. Definir archivo, copia y restauración de acuerdo con necesidades reales de operación.

**ARQ-08 · P2 · Hacer visibles los fallos de infraestructura sin confundirlos con ausencia de datos.**

Ubicación: [lecturas del repositorio](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/clientes.js:55), [lecturas de cierres](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/cierres.js:169), [errores de persistencia](C:/Users/itjoy/Desarrollo/tqm-web/api/_lib/store.js:125).

Varias funciones devuelven `null`, `[]`, `false` o valores predeterminados ante una excepción. La capa superior no distingue «no existe» de «no se pudo leer». Eso puede esconder expedientes, permitir una comprobación de unicidad equivocada o mostrar un cierre de sesión como si las credenciales estuvieran mal. Logs dispersos no permiten reconstruir una operación de varias etapas.

Corrección: resultados tipados y traducción HTTP central: entrada incorrecta, falta de autenticación, prohibición, conflicto, validación, límite y servicio no disponible. Registrar identificador de petición, duración, operación y categoría de error, evitando contraseñas, tokens y documentos. Alertar sobre antigüedad de mercado, fallos de guardado, acumulación de huérfanos y conflictos anómalos. Probar recuperación tras caídas parciales, copias y restauraciones; estos controles de infraestructura no se han verificado aquí.

**ARQ-09 · P2 · Ampliar pruebas por invariantes y por integración real del despliegue.**

Ubicación: [scripts de prueba](C:/Users/itjoy/Desarrollo/tqm-web/scripts/pruebas/unidad.mjs), [scripts del proyecto](C:/Users/itjoy/Desarrollo/tqm-web/package.json).

Las cinco suites son una base útil, pero no hay tareas de lint/comprobación de tipos ni configuración de integración continua en el árbol revisado. Los mocks de memoria no reproducen por sí solos respuestas del SDK, diferencias del runtime HTTP ni cabeceras del navegador. Que todas pasen no comprueba atomicidad o recuperación ante fallos.

Pruebas prioritarias:

1. Una sola decisión efectiva por revisión, un solo consumo por código y unicidad de alta/referencia bajo concurrencia.
2. Importe idéntico entre resumen y servidor; suma de líneas igual al total; pesos normalizados positivos; ajuste de peso conserva tarifa.
3. Caídas de mercado/Redis/Blob/correo, timeouts y guardados parcialmente ejecutados, con reintentos idempotentes.
4. Matriz de permisos anónimo/cliente A/cliente B/administrador para cada recurso y documento.
5. Redis aislado real para operaciones condicionales; navegador en entorno de prueba con CSP, cookies y rutas equivalentes a producción.
6. Recorrido alta → documentación → aprobación → cierre → decisión → justificante, incluidas dos pestañas/actores y sesión caducada.
7. PDF con 24 líneas, nombres largos y varios estados; CSV con fórmulas y delimitadores; vuelta de página legal; contacto con fallo de envío.

Integración continua propuesta: instalación reproducible con lockfile, análisis estático, tipos, pruebas de dominio/integración, compilación y revisión de dependencias. Convertir las reproducciones relevantes de esta auditoría en pruebas que esperen el comportamiento corregido. Evitar pruebas que solo copien la implementación: expresar las invariantes anteriores.

**ARQ-10 · P3 · Simplificar la configuración de desarrollo y ajustar la documentación a lo implementado.**

Ubicación: [carga manual de entorno](C:/Users/itjoy/Desarrollo/tqm-web/vite.config.js:17), [adaptador local](C:/Users/itjoy/Desarrollo/tqm-web/vite.config.js:101), [documentación del portal](C:/Users/itjoy/Desarrollo/tqm-web/PORTAL.md).

Se releen sincrónicamente archivos de entorno en cada petición API local y se sobrescribe `process.env`. Las variables eliminadas del archivo no se eliminan necesariamente del proceso y algunos módulos calculan su modo de ejecución al importarse. Es posible una mezcla de configuración antigua y nueva. La documentación mezcla funcionalidades terminadas con pendientes y contiene garantías que el código no cumple: cuota total de documentos, cola de expedientes, conservación de datos o protección por separación de bundles.

Corrección: configuración validada y única al arrancar, usando un parser estándar y reinicio claro ante cambios; versión de Node fijada a una versión soportada comprobada por CI; entorno y almacenamiento explícitos, separados por namespace. Documentar reglas e invariantes verificables, dependencias de despliegue y procedimiento de recuperación. Mantener una lista de pendientes coherente con los flujos realmente disponibles.

## Orden recomendado de ejecución

La secuencia se ajusta a la decisión de no publicar cierres todavía. Las correcciones de cuentas/documentos se aplican si esas funciones forman parte de esta salida. Los problemas compartidos de persistencia, fórmulas y precios públicos conservan su relevancia aunque no se activen cierres.

| Etapa | Trabajo | Criterio para darla por terminada |
|---|---|---|
| 0. Delimitar lo que se publica | Excluir o desactivar cierres en servidor y retirar pantallas/consultas asociadas | Las peticiones directas al módulo no ejecutan operaciones; la web publicada no depende de él |
| 1. Proteger cuentas y documentos publicados | SEC-01 a SEC-05; aislar demo SEC-12; normalizar errores de entrada | Ninguna cuenta opera sobre documentos ajenos; códigos de un solo uso; revocación efectiva; límite resistente a reinicios por login |
| 2. Asegurar datos y flujos de esta salida | INT-01 y parte de clientes de INT-02; precios reales INT-08; contacto INT-11; subidas INT-10 si se publica documentación | No se pierden expedientes ni publicaciones; los precios explican su procedencia/antigüedad; contacto y documentación funcionan |
| 3. Completar protección y experiencia | Dependencias, origen/CSP, sesión, enlaces, consentimiento, accesibilidad y cuotas | Recorrido de las funciones publicadas probado con configuración equivalente a producción |
| 4. Reducir latencia y consolidar agilidad | Coordinación de mercado, índices, async scrypt, renderizados, carga diferida, tipos y CI | Medidas comparables antes/después y cambios de reglas verificables automáticamente |
| Futuro, antes de activar cierres | INT-03 a INT-07, INT-09, INT-12 e INT-13; parte de cierres de INT-02; CSV SEC-07; resto de pruebas de operaciones | No hay decisiones dobles ni sobrescrituras; precio aceptado identificado; sin compromisos con datos de respaldo; exportaciones correctas |

Actualizar dependencias y añadir pruebas de regresión puede avanzar dentro de las primeras etapas. No asigno plazos cerrados sin conocer volumen, datos ya existentes, equipo y restricciones de despliegue. Las migraciones de referencias/índices necesitan inventario y respaldo antes de tocar datos reales.

**Qué medir para saber si la mejora funciona**

- Tiempo p50/p95 y tasa de error por endpoint, separando acierto/fallo de caché y arranque de función.
- Llamadas a Redis y al proveedor de mercado por operación; volumen transferido en listados.
- Antigüedad real de cotización, conflictos de versión, reintentos idempotentes y consistencia entre índices/documentos.
- Duración y concurrencia del hash de contraseñas, memoria y bloqueo del hilo de ejecución.
- Tamaño de recursos, LCP/INP/CLS y renders durante scroll, edición y refresco de precios en dispositivos representativos.
- Tiempo necesario para modificar una regla y comprobarla: el núcleo puro debería permitir verificarla sin levantar Redis, navegador ni correo.

## Evidencia y reproducción

El diagnóstico se ejecuta desde la raíz del proyecto:

```text
node auditoria/2026-09-17/reproducciones.mjs
```

El script utiliza las dependencias de la instalación revisada, incluido `undici`, actualmente transitivo. No es una propuesta de nueva dependencia productiva. Borra de su propio proceso las variables de integración pertinentes, usa memoria y bloquea conexiones reales. **«COMPROBADO» significa que se reproduce el problema descrito.** Cuando se corrija el código, estas aserciones de diagnóstico deben transformarse en expectativas del comportamiento correcto.

| Diagnóstico | Evidencia obtenida | Hallazgo |
|---|---|---|
| S01 | Asociación 200 y borrado 200 de URL ajena en Blob simulado | SEC-01 |
| S02 | Dos consumos aceptados para un código | SEC-02 |
| S03 | Código anterior aceptado tras cambiar contraseña | SEC-03 |
| S04 | Sesión administrativa anterior sigue válida | SEC-04 |
| C01 | Dos publicaciones 200 con la misma versión 2 | INT-01 |
| C02 | Dos clientes guardados; uno visible en índice | INT-02 |
| C03 | Mercado de 24 horas: revalorización y confirmación 200 | INT-04 |
| C04 | Fallo de fórmulas convertido en valoración operativa de respaldo | INT-05 |
| C05 | Referencia anual repetida y documento anterior sobrescrito | INT-03 |
| S05 | Texto `=1+1` exportado sin neutralización | SEC-07 |
| C06 | Diferencia de 1,21 € para 1.000 g | INT-07 |
| C07 | 0,0001 g aceptados y almacenados como 0 g | INT-13 |
| P01 | Cinco peticiones generan diez llamadas al proveedor simulado | ARQ-02 |
| S06 | 70.000 caracteres aceptados con límite declarado de 1.024 bytes | SEC-08 |
| S07 | Cookie malformada provoca error del parser | SEC-08 |
| S08 | Origen aceptado con host reenviado controlado en prueba unitaria | SEC-11, condicionado al proxy |
| S09 | Login propio borra el contador compartido por IP | SEC-05 |
| S10 | Siete consultas de alta duplicada; ninguna aumenta el contador | SEC-06 |
| C08 | Confirmar y anular reciben ambas 200; queda anulado | INT-02 |
| C09 | Precio 70,80 → 80,80; usa fórmula 99 y conserva versión 1 | INT-06 |
| C10 | PDF de 24 líneas con texto en coordenada y=-17,11 | INT-12 |
| C11 | Destino del SDK fuera de `connect-src` configurado | INT-10, comprobación estática |

Archivos entregados:

- [Diagnósticos ejecutables](C:/Users/itjoy/Desarrollo/tqm-web/auditoria/2026-09-17/reproducciones.mjs).
- [Salida de las 22 comprobaciones](C:/Users/itjoy/Desarrollo/tqm-web/auditoria/2026-09-17/reproducciones.txt).
- [Auditoría completa de dependencias](C:/Users/itjoy/Desarrollo/tqm-web/auditoria/2026-09-17/dependencias.json).
- [Auditoría de dependencias productivas](C:/Users/itjoy/Desarrollo/tqm-web/auditoria/2026-09-17/dependencias-produccion.json).
- [Huellas de los archivos inventariados](C:/Users/itjoy/Desarrollo/tqm-web/auditoria/2026-09-17/estado-auditado.json).

Las referencias a líneas corresponden al estado local auditado. El comportamiento efectivo en producción debe verificarse después de cada corrección con los servicios y cabeceras reales de un entorno de pruebas aislado.
