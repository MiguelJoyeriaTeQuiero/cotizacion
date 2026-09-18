# Documentación del proyecto

- Los cierres están aplazados para producción. Mantener esa distinción en documentación y cambios; una marca OpenAPI no sustituye un bloqueo real de servidor.
- Al modificar una ruta, método, acción, permiso, payload, respuesta, límite o regla de negocio, actualizar en el mismo cambio `docs/api/paths.mjs`, `docs/api/schemas.mjs`, ejemplos y las partes afectadas de `docs/guia.md`.
- Documentar el comportamiento implementado. Separar fallos conocidos y propuestas; no presentar una corrección pendiente como una garantía existente.
- Los JSON OpenAPI son generados. Ejecutar `npm run docs:generate`; no editarlos directamente.
- Después de contrastar explícitamente el contrato con un cambio de código protegido, ejecutar `npm run docs:review` y `npm run docs:check`. No ejecutar `docs:review` solo para silenciar un fallo: primero revisar y actualizar las explicaciones/esquemas pertinentes.
- Ejecutar `npm run test:docs` cuando se cambie la automatización o los contratos. Las pruebas de comportamiento siguen siendo necesarias para cambios de aplicación.
- La documentación debe seguir disponible solo en desarrollo, fuera del build público, sin cargar `.env` ni servicios en el servidor Swagger independiente. Usar exclusivamente ejemplos sintéticos.
- Conservar cambios ajenos ya presentes en el árbol de trabajo. No hay autorización implícita para desplegar o publicar por añadir documentación.
