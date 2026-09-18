# Documentación de TQM

Ejecutar `npm run docs` y abrir http://127.0.0.1:3001/docs/. También disponible en `/docs/` con `npm run dev`.

- `guia.md`: arquitectura, configuración, desarrollo, permisos, flujos, persistencia, pruebas y despliegue.
- `api/`: contrato fuente con esquemas, operaciones y ejemplos sintéticos.
- `openapi.actual.json`: API del alcance actual, sin endpoints de cierres.
- `openapi.json`: API completa del código, incluidos cierres aplazados.
- `reviewed-sources.json`: huellas de las fuentes contrastadas con el contrato.

La documentación se regenera al guardar y antes de compilar. `npm run docs:check` y CI detectan cambios sin revisión, contratos incompletos y artefactos desactualizados. Actualizar la fuente, revisar el cambio y ejecutar `npm run docs:review`; no aprobar huellas para ocultar documentación pendiente.

Los cierres quedan fuera de producción por decisión de producto. El filtro documental no implementa su desactivación. Swagger se sirve solo en desarrollo y no forma parte de `dist`.
