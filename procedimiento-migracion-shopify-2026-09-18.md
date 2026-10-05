# Shopify migration runbook — futuro proceso autorizado

Este documento no autoriza ni ejecuta una migración comercial. Antes de usarlo, el operador debe aprobar explícitamente el archivo, el entorno y el catálogo destino.

1. **BACKUP** — generar y verificar snapshot operativo; confirmar checksum, alcance y restaurabilidad.
2. **UPLOAD** — cargar el CSV Shopify al entorno TEST/PREVIEW; no aceptar fuentes ambiguas.
3. **VALIDATE** — parsear por streaming, agrupar por Handle, validar precio/stock/SKU/HTML/estado/media y detener ante `BLOCKING_ERROR`.
4. **DRY RUN** — crear solo metadata del import job; revisar resumen, warnings, mapping, diffs y duplicados.
5. **REVIEW** — confirmar manualmente colecciones `CREATE_PROPOSED`/`AMBIGUOUS`, conflictos y media principal.
6. **STAGE** — con guard de Super Admin y entorno explícito, copiar media server-side a Cloudinary y escribir únicamente catálogo B; guardar checkpoints por chunk.
7. **VERIFY** — revisar integridad B, producto dinámico, 0..N imágenes, variantes, stock, precio, SEO, checkout de fixture y smoke responsive.
8. **ACTIVATE** — confirmar dos veces el catálogo B; cambiar únicamente la autoridad `activeCatalogId`, con lock/lease y auditoría.
9. **MONITOR** — observar errores de media, catálogo, checkout, LCP y logs durante la ventana acordada.
10. **ROLLBACK IF NEEDED** — volver a `previousCatalogId` sin borrar B; confirmar que A vuelve a servir.
11. **ARCHIVE** — marcar el catálogo anterior como `ARCHIVED`. El borrado físico es posterior, separado y requiere confirmación explícita.

Nunca ejecutar `DELETE ALL`, no reemplazar el catálogo activo antes de verificar staging, no permitir test fixtures contra producción, no desactivar App Check/Auth ni modificar Rules como atajo.
