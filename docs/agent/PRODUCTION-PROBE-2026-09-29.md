# Production readiness probe — 2026-09-29 04:09 UTC

Read-only revalidation of the live storefront and Pages deployment. The probe made public GET requests and DNS lookups only; it did not change DNS, configuration, catalog data, accounts, orders, or payment settings.

## Observed results

| Check | Result | Meaning |
| --- | --- | --- |
| `https://tintinaccs.com/` | HTTP 200; canonical points to `https://tintinaccs.com/`; HTML contains Shopify theme/CDN markers | The commercial apex still serves Shopify. |
| `tintinaccs.com` DNS | A `23.227.38.65` | The apex still points at Shopify's storefront edge. |
| `www.tintinaccs.com` DNS and HTTP | CNAME `shops.myshopify.com`; HTTP 301 to the apex | `www` also routes through Shopify before redirecting. |
| `https://tintinaccs.com/api/health` | HTTP 404 | Pages Functions are not serving on the commercial apex. |
| `https://tintinaccesorios.pages.dev/` | HTTP 200; canonical points to `https://tintinaccesorios.pages.dev/` | Pages is deployed on its technical hostname; it is not yet the commercial canonical host. |
| Pages `GET /api/health` | HTTP 200, `ok: true`; runtime, configuration, Firebase, Admin runtime, and Visual Builder checks are true | Core Pages runtime is healthy. This is not a transaction or authenticated Admin acceptance test. |
| Pages `GET /api/public-catalog?resource=products` and `?resource=collections` | Both HTTP 200; `count: 0`, `items: []` | Catalog and public collections are empty from the storefront's API. |
| Pages `GET /sitemap-products.xml` | HTTP 200; zero `<url>` entries | There are no product URLs to index or use for a real product canary. |
| Pages `GET /api/paypal-config` | HTTP 200; enabled in `sandbox`, `rateSource: BCP`, rate date `2026-09-25`, updated `2026-09-28T19:26:01Z`, no unavailable reasons | The exchange rate is within the code's seven-day freshness window, but PayPal is sandbox-only; no real payment was tested. |
| Pages `GET /api/admin-runtime-health` | HTTP 401 without a session | Expected protected-endpoint behavior; authenticated Admin health remains unverified by this public probe. |

`npm run monitor:production` checked the public routes, health, payment configuration, catalog, sitemaps, and Visual Builder endpoints. It reported three readiness failures, all caused by the empty product catalog: empty product sitemap, no public product for the canary, and no product metadata sample. Other endpoint probes passed, including the expected unauthenticated `401`.

## Decision

**NO-GO for domain cutover and for closing Shopify.** Pages runtime health is green, but the commercial host still serves Shopify and Pages has no public product catalog. The Pages hostname's `200` responses do not establish that the domain, customer login, checkout, payment, email, or authenticated operations are ready.

## Remaining gates

1. Import the owner's real product and collection export into Firestore. Review handles, variants, prices, stock, collection mapping, and visibility. The importer must skip exact existing identities and stop on ambiguous matches; the pre-apply snapshot must be rechecked immediately before writes.
2. Run the authenticated Cloudinary media preflight and copy Shopify-hosted images. Verify product, variant, collection, and content URLs no longer depend on `cdn.shopify.com` before cancelling Shopify.
3. Prove the **Google Sheets → Firestore** sync direction using the protected Apps Script webhook and the dedicated inactive canary. Sheets synchronization is a Firestore integration; it is independent of the storefront domain and must not route to Shopify.
4. Complete purchase, stock update, account re-entry/blocking, App Check, order email, and any chosen live payment acceptance on Pages with the imported catalog.
5. Confirm Search Console ownership for `tintinaccs.com` and prepare its sitemap after Pages is attached to the commercial domain.
6. Only after the catalog is present, follow the same-session constraint recorded in PR #929: merge the domain cutover and attach the Pages Custom Domain together, then validate canonical, TLS, OAuth/App Check, redirects, sitemaps, and rollback on the live host.

Keep Shopify available until those gates pass. This recheck did not change the migration decision and does not certify real payment, authenticated CRUD, Apps Script deployment, or Google indexing.

## Observación directa de Apps Script — 2026-09-29

Se revisó en modo lectura el proyecto `Tintin Sync — Motor` y su panel de ejecuciones, sin publicar código ni ejecutar funciones manuales. El historial de los últimos siete días mostraba 9.153 ejecuciones y una tasa de error de 0,32%. Entre los fallos visibles del 28/9, una ejecución de `tintinReconciliarAdminParidad` registró `Address unavailable` al consultar el endpoint de snapshot `sheets-sync-snapshot`; otra ejecución larga terminó con un error temporal genérico del servidor de Google. El listado reciente del 29/9 mostró ejecuciones consecutivas completadas de la reconciliación programada.

El hallazgo es compatible con fallos transitorios de transporte al leer el snapshot, no demuestra pérdida ni divergencia de datos. El PR #956 contiene reintentos acotados para ese caso y permanece draft; su código no se debe considerar desplegado en Apps Script hasta verificar la versión publicada. `npm run test:products-sync` en el HEAD evaluado pasó 76/76; esa prueba no equivale a una escritura real Sheets → Firestore.

La pestaña autenticada del panel de Admin en Pages abrió sin errores pendientes y sirvió el importador con la ruta de preflight de medios (`shopify-media-preflight-1`). La reconciliación de identidad del importador del PR #957 no aparece en el código publicado. No se cargó un CSV ni se ejecutó preflight, sincronización o escritura.

El proyecto de Apps Script registraba 0,32% de errores en la ventana de siete días, pero las últimas ejecuciones automáticas visibles ya estaban completadas. Mantener el gate operativo: desplegar/verificar el código con reintentos en la versión de Apps Script, ejecutar el canary inactivo `CANARY-SHEETS-FIRESTORE` y confirmar Firestore/cola/estado final. No reutilizar productos comerciales para esa prueba.

## Revalidación posterior — 2026-09-29 05:00 UTC

Se volvió a ejecutar `npm run monitor:production` desde el worktree de la revisión. Las rutas públicas, `api/health`, `api/paypal-config`, las APIs del catálogo, los sitemaps y las APIs públicas de Visual Builder respondieron como espera el monitor; `api/admin-runtime-health` devolvió 401 sin sesión, también esperado. El proceso terminó con código 1 por los mismos tres bloqueos de catálogo: sitemap de productos sin URLs, catálogo sin producto canary y metadata de producto sin muestra. No apareció un fallo nuevo de ruta en esta ejecución. Esto confirma el estado de Pages, no el dominio comercial ni los flujos autenticados.

Se preparó en la pestaña `Productos` del inventario conectado la fila de prueba `CANARY-SHEETS-FIRESTORE` / `PRUEBA QA · NO VENDER`: categoría `otros`, precio de prueba 1000, activo `No`, stock calculado 0, fórmulas y validaciones de fila conservadas. La primera lectura encontró que `Imagen URL` (T) había heredado una URL del CDN de Shopify; se limpió esa celda y la lectura posterior confirmó T vacía. La imagen de presentación (C) depende de T y queda vacía. La fila está **solo preparada en Sheets**; no se ejecutó trigger, webhook ni escritura de Firestore, así que todavía no acredita la sincronización.

Revalidación del canario en la hoja conectada: la búsqueda exacta en `Historial sync!A1:J531` no encontró filas para `CANARY-SHEETS-FIRESTORE`. También se detectó y limpió una fecha heredada en `Productos!V720` (`Última actualización`), para que el canario no aparente haberse sincronizado. La lectura posterior de la fila dejó vacía esa marca temporal.

CI de GitHub para `9c13a3de2ca254ae987430dd541c9ac3c7d2ccc7` (PR #957, ejecución #36523002919) terminó correctamente: todos los pasos del trabajo `Repository audit`, incluido Browser/accessibility/SEO/performance, quedaron en success. El PR sigue abierto, draft y mergeable. PR #956 sigue abierto y draft; su descripción confirma que el retry de Apps Script aún no está desplegado. PR #934 sigue abierto y actualmente `mergeable: false`; no se modificaron esas ramas ni se integraron cambios.

**Decisión continúa NO-GO.** La prueba pública mantiene tres gates de catálogo, la fila de Sheets aún no se escribió a Firestore, la reparación de Apps Script no está desplegada y el dominio comercial continúa separado del Pages host. No se cambió tráfico, catálogo Firestore, pedidos, pagos, DNS ni estado de los PRs.
