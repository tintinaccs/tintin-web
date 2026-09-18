# Shopify Phase 2 — audit de implementación segura

## Alcance y base

Esta rama parte de `b8d5fff3c6371e8bda6580215093479016455d35`, con Header #839 ya desplegado. Se reutilizan `importacion-admin.js`, `shopify-import-core.mjs`, `normalizacion-importacion.mjs`, `admin-import-job.js`, la biblioteca multimedia Cloudinary y el contrato actual de `products`, `productInventory`, `collections` y `media`.

La Phase 1 ya tenía parser incremental CSV, agrupación por Handle, preview, backup operativo y un job server-side limitado a PREVIEW/READY. No se reconstruyó esa autoridad ni se habilitaron sus importadores legacy.

## Modelo final

`shopify-phase2-pipeline.mjs` es la capa pura de planificación: normaliza identidad, calcula diffs NEW/MATCHED/CHANGED/UNCHANGED/CONFLICT, valida SKU/colecciones/media, crea previews y chunks, y modela staging/activation/rollback. No escribe Firestore, no hace fetch y no toca el catálogo activo.

La identidad de producto es `shopify:<handle normalizado>` y se proyecta a un documento estable `imp_<hash>`. Las variantes se deduplican por SKU + opciones; las filas repetidas de imágenes no vuelven a sumar stock. El producto continúa siendo dinámico en `product.html`.

## Importación y validación

- CSV Shopify: delimitador coma, punto y coma o tabulador; parser RFC4180 incremental.
- Agrupación: múltiples filas por Handle, con variantes, opciones, imágenes y tags.
- Valores: precio localizado y stock entero no negativo; blank no significa stock infinito.
- SKU: duplicados conflictivos son `BLOCKING_ERROR`, no se corrigen silenciosamente.
- HTML: allowlist editorial existente (`p`, `br`, `strong`, `em`, `ul`, `ol`, `li`); se eliminan scripts, handlers, iframes, URLs `javascript:` y atributos.
- Estados Shopify: active/draft/archived se conservan; draft/archived no se publican automáticamente.
- Preview: resumen de productos, variantes, imágenes, colecciones, errores, warnings y diffs contra productos existentes.
- Dry-run: crea metadata de job como máximo; `products`, `productInventory`, `collections` y `media` comerciales no se escriben.

## Media lifecycle

La autoridad de media sigue siendo Cloudinary. El endpoint server-side `functions/api/admin-import-media.js` valida únicamente HTTPS y hosts Shopify permitidos, status, MIME de imagen, tamaño máximo de 15 MB, hash SHA-256 y límites de volumen. Sus estados son `PENDING`, `DOWNLOADING`, `VALIDATED`, `COPIED`, `DEDUPED`, `FAILED`, `SKIPPED`; registra identidad, origen, posición, intentos y error sin secretos.

`validate`/`dry-run` no copia nada. `copy` requiere Super Admin y `SHOPIFY_PHASE2_MEDIA_WRITE=1`, por lo que la copia comercial queda bloqueada por defecto y, si se autoriza en el futuro, ocurre en servidor hacia Cloudinary, nunca desde el browser. Los 4xx/MIME inválidos son permanentes; timeout, red y 5xx tienen retries limitados. Una media secundaria fallida no invalida todo el producto; la principal queda marcada.

## Colecciones

El mapping es explícito: `MAPPED_EXISTING`, `CREATE_PROPOSED`, `AMBIGUOUS`, `IGNORED`. Los tags no crean colecciones automáticamente. La creación comercial queda propuesta hasta revisión.

## Jobs, chunks e idempotencia

El lifecycle de Phase 2 es `CREATED → VALIDATING → READY_FOR_DRY_RUN → DRY_RUNNING → STAGING → READY_TO_ACTIVATE → ACTIVATING → ACTIVE`, con `PAUSED`, `FAILED`, `ROLLED_BACK` y `CANCELLED`. Cada chunk tiene checkpoint de job/chunk/processed/total/status. Aplicar dos veces el mismo chunk conserva una sola identidad estable por fingerprint. La UI conserva resume local y el endpoint conserva ownership server-side.

## Staging, activation y rollback

El catálogo público solo debe leer `activeCatalogId`. El plan crea un catálogo B en staging sin alterar A; activar exige estado `READY_TO_ACTIVATE`, guarda `previousCatalogId` y no borra A. Un fallo antes o durante activation conserva A. Rollback vuelve a A y archiva B. El borrado físico de un catálogo archivado no forma parte de activation y requiere una acción explícita separada.

## Seguridad y regresiones

Todas las mutaciones críticas del endpoint requieren Super Admin server-side. App Check, Auth, Firestore Rules, checkout, precio server-authoritative, stock transaccional, comentarios, notificaciones, favoritos, LCP #831, Header #839, responsive #835 y session restore #838 permanecen sin cambios. La media no se copia en el cliente. No hay delete-all, cutover, DNS ni modificación de Rules.

## Fixtures y evidencia

`tests/fixtures/shopify-phase2-fixture.csv` cubre producto simple, una/múltiples/sin imágenes, variantes, media duplicada, UTF-8, sale price, stock cero y HTML inseguro. Los tests cubren 1k/10k records sintéticos por chunks, idempotencia, interrupción/reanudación, diffs, mapping, media 200/404/HTML/timeout/5xx/oversize, XSS, activation fallida y rollback.

## Estado operativo

- `SHOPIFY PHASE 2 CODE`: implementable y verificable en TEST/fixture.
- `REAL COMMERCIAL MIGRATION`: NOT STARTED; requiere autorización explícita posterior.
- No se usó CSV comercial, no se escribieron productos comerciales, no cambió el catálogo activo y no se ejecutó activation en producción.
