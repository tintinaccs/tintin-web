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

La ausencia de un registro de historial tras esta edición por API es esperada por el contrato de Google Apps Script: las escrituras hechas por APIs/ejecuciones no disparan `onEdit`. Además, el reconciliador periódico `tintinReconciliarAdminParidad()` actualiza usuarios, pedidos y auditoría, no el catálogo de productos. La sincronización de este canario requiere invocar explícitamente `tintinProbarEdicionCatalogo()` después de verificar la versión desplegada del script y del webhook. Esa ejecución aún no está confirmada; el runbook canónico ahora indica los handlers, verificación y evidencia requeridos.

CI de GitHub para `9c13a3de2ca254ae987430dd541c9ac3c7d2ccc7` (PR #957, ejecución #36523002919) terminó correctamente: todos los pasos del trabajo `Repository audit`, incluido Browser/accessibility/SEO/performance, quedaron en success. El PR sigue abierto, draft y mergeable. PR #956 sigue abierto y draft; su descripción confirma que el retry de Apps Script aún no está desplegado. PR #934 sigue abierto y actualmente `mergeable: false`; no se modificaron esas ramas ni se integraron cambios.

**Decisión continúa NO-GO.** La prueba pública mantiene tres gates de catálogo, la fila de Sheets aún no se escribió a Firestore, la reparación de Apps Script no está desplegada y el dominio comercial continúa separado del Pages host. No se cambió tráfico, catálogo Firestore, pedidos, pagos, DNS ni estado de los PRs.

## Revalidación — 2026-09-29 05:55 UTC

Se repitió `npm run monitor:production`: las rutas, APIs públicas de catálogo y Visual Builder, `api/health`, `api/paypal-config`, los sitemaps y los headers respondieron; `api/admin-runtime-health` devolvió el 401 esperado sin sesión. El comando volvió a terminar con código 1 por los mismos tres requisitos que dependen de tener productos públicos: sitemap dinámico de productos vacío, ningún producto para el canary SEO y ninguna muestra de metadata. El catálogo público continúa vacío.

Lectura directa del inventario conectado a las 05:55 UTC: `Productos!A720:AI720` contiene el canary `CANARY-SHEETS-FIRESTORE` / `PRUEBA QA · NO VENDER`, inactivo y sin stock; la URL de imagen, fecha de última actualización y acción están vacías. La búsqueda en `Historial sync!A1:J531` devuelve cero filas para ese ID. Sí hay ejecuciones recientes `SYNCED` del reconciliador administrativo para usuarios, pedidos y auditoría, que no sincroniza productos.

En el commit `bda7e0ebae7b2256262b605e8062006ebd54de98`, GitHub Actions CI #3510 terminó **SUCCESS** en todas las etapas, incluidas reglas de Firestore, navegador, accesibilidad, SEO y rendimiento. `npm run test:products-sync` pasó 77/77, `node scripts/auditar-sync-authority.mjs` pasó y `npm run build:pages` verificó 19 páginas, 625 módulos y 911 archivos. El PR #957 sigue abierto y draft.

La prueba Sheets → Firestore no está acreditada: no hay registro de canary en el historial ni observación Firestore. El proyecto `Tintin Sync — Motor` debe recibir el código actualizado, y la función `tintinProbarEdicionCatalogo()` debe ejecutarse desde Apps Script; la conexión disponible permite leer la hoja, pero no ejecutar funciones del proyecto. **NO-GO continúa** hasta ese resultado, el catálogo/medios reales, la aceptación de compra/pago y los controles de dominio/Search Console. No se alteraron DNS, tráfico, pagos ni cuentas.

## Google Search Console — 2026-09-29 06:09 UTC

La única propiedad GSC conectada y verificada en la cuenta es `https://tintinaccesorios.pages.dev/` (`siteOwner`). No aparece una propiedad URL-prefix ni Domain para `tintinaccs.com`. `https://tintinaccesorios.pages.dev/sitemap.xml` fue enviado el 2026-09-28 01:58 UTC y figura pendiente, con cero advertencias y cero errores. Rendimiento GSC de los últimos 28 días disponibles (hasta 2026-09-26): 0 clics, 1 impresión. La inspección URL de Google da PASS, `Submitted and indexed`, robots ALLOWED, `INDEXING_ALLOWED`, fetch SUCCESSFUL y rastreo móvil para `/` (último rastreo 2026-09-13) y `/catalogo` (2026-09-21). Esto confirma indexación de páginas en el hostname técnico, no propiedad/indexación en el dominio comercial ni URLs de productos; el sitemap de productos y el catálogo dinámico siguen vacíos.

## Apps Script conectado — 2026-09-29 06:44 UTC

Revisión visible del proyecto `Tintin Sync — Motor` en la cuenta de producción, en modo lectura:

- El proyecto contiene `Código.gs`, `ReorganizacionSheets.gs`, `AdminParity.gs`, `Participacion.gs` y `BorradoCatalogoPayload.gs`; no contiene el archivo versionado `ProductosUnificados.gs` del repositorio. Por ello, el canary específico y la implementación vigente en Git no están acreditados como parte de la fuente conectada.
- La implementación web activa seleccionada muestra la versión 16, fechada el 22 de septiembre de 2026. El formulario indica que se ejecuta como la cuenta propietaria y permite acceso a cualquiera. No se registran aquí el ID ni la URL de implementación.
- Hay tres activadores instalados: `onOpen`, `tintinReconciliarAdminParidad` (basado en tiempo) y `tintinDespacharEdicionParidad` (al editar). Las ejecuciones recientes observadas del reconciliador terminaron completadas; estas son pruebas de sincronización administrativa, no de productos.
- La fila `Productos!720` sigue como `CANARY-SHEETS-FIRESTORE` / `PRUEBA QA · NO VENDER`; una lectura de `A720:V720` conserva el ID, el nombre y `Activo = No`. Una búsqueda exacta en `Historial sync!A1:J600` devuelve cero filas para el canary.

La inspección solo abrió el editor, la lista de activadores, ejecuciones y detalles de despliegue; no editó ni guardó código, no ejecutó funciones, no creó activadores y no cambió la implementación. El estado del proyecto explica por qué aún no hay evidencia de ejecución canaria. Seguir el runbook después de integrar el PR: sincronizar cuidadosamente el código con el proyecto conectado, conservar la URL de webhook, revisar la autorización del endpoint para la implementación “cualquiera” y validar el despliegue antes de invocar únicamente el canary inactivo. No actualizar manualmente ni publicar una implementación parcial.

**Decisión: NO-GO para cutover.** Se mantienen además los gates ya registrados: catálogo/sitemap de productos vacíos, dominio comercial todavía en Shopify, ausencia de propiedad GSC verificada para ese dominio y falta de aceptación de pago en producción.

### Revisión complementaria de la fuente guardada — 2026-09-29 06:58 UTC

La primera nota de Apps Script se refería al nombre del archivo, no a la presencia funcional de la integración. Al inspeccionar el editor de `Código.gs`, confirmé que el proyecto sí incluye `tintinProbarEdicionCatalogo()`, `tintinDiagnosticarWebhookProductos()`, `tintinSendProductRow_()` y el handler de edición con estados `SYNCING`, `SYNCED`, `ERROR` y `REJECTED`. La función canaria limita el envío a la fila única con ID/nombre acordados, estado inactivo, stock cero, categoría y precio válidos, sin imagen y sin acción. El helper de envío usa `SHEETS_ENGAGEMENT_SECRET` en `X-Tintin-Sheets-Secret` para el host de `TINTIN_STORE_URL`.

La fuente activa está guardada como `Código.gs` y su SHA-256/tamaño difieren del archivo canónico local `apps-script/ProductosUnificados.gs`; el nombre del archivo por sí solo no demuestra ausencia de lógica ni que la versión desplegada sea idéntica. La implementación consultada sigue mostrando versión 16 (22 sept 2026); aún no se inspeccionó esa versión histórica ni se comprobó que coincida con la fuente guardada. Los triggers y su log de ejecución no prueban productos: la fila canary sigue sin registro en `Historial sync`, y no hay lectura confirmatoria de `products`/`productInventory`.

La inspección estática de `doPost` y sus helpers encontró guards en la fuente guardada: `syncProducts` valida ID token y correo Super Admin; `syncProductsPayload` compara el secreto compartido. Esto es coherente con el despliegue web que ejecuta como propietaria y acepta conexiones públicas, pero no demuestra que versión 16 conserve esos guards. La función diagnóstica y la canaria envían el secreto de sincronización desde Apps Script al endpoint HTTPS `https://tintinaccesorios.pages.dev/api/sheets-products-webhook`. No se ejecutaron: la versión efectiva debe verificarse primero y la función requiere transmitir ese secreto. El canary no debe invocarse hasta confirmar que la revisión del endpoint es `products-canonical-v3`. El repositorio y su PR sí se actualizaron; Apps Script, Cloudflare y Firestore no se modificaron.

### Revalidación de conexiones y muestra QA — 2026-09-29 07:22 UTC

La vista autenticada de Diagnóstico en Admin se actualizó en vivo y devolvió **FAIL**: Firebase/Firestore, catálogo, inventario, colecciones, pedidos, usuarios, auditoría, ajustes, contenido, Visual Builder, Resend y Cloudinary figuran PASS; Google Sheets y Apps Script figuran FAIL. El detalle de Apps Script es `canonical_guard_not_confirmed · HTTP 200`; el detalle de Sheets indica que el secreto del puente y el protocolo de Apps Script no quedaron verificados. La cola reporta 18 pendientes, 2 en dead-letter, tarea más antigua de 4 días y última tarea exitosa alrededor del 28 de septiembre a las 22:02 UTC. Esto es evidencia fresca de salud autenticada; el commit que reporta el panel corresponde al despliegue productivo existente, no al HEAD del PR.

La revalidación en vivo de “Flujo de conexiones” mostró 36 nodos, 37 conexiones, 61 verificadas y 12 que requieren atención. Incluye relaciones de roles/perfil, pedidos/inventario, carrito/Firestore y servicios externos que no están verificadas. La tarjeta externa informó `externos configurados=false`; la respuesta de salud autenticada identificó explícitamente Sheets y Apps Script como fallidos. No se infiere a partir de esto que todos los secretos externos falten.

En Admin existe una muestra QA distinta de la fila canary de Sheets: producto `PRUEBA QA · NO VENDER` en la colección oculta `PRUEBA QA · NO PUBLICAR`, inactivo, sin imagen y con stock 1. No se alteró. Por estar oculto/inactivo no sirve como muestra del catálogo público y no demuestra Sheets → Firestore. La fila de Sheets `CANARY-SHEETS-FIRESTORE` continúa separada y sin registro confirmatorio en el historial de sincronización. El monitor público de aproximadamente 07:10 UTC seguía fallando por sitemap de productos vacío, ausencia de canary público y ausencia de muestra de metadata. No publicar ni activar la muestra QA para hacer pasar estos probes.

La Actions run `36534876930` para HEAD `e451ebba3f016a5573351ed62ed0daefcf77fa74` terminó **SUCCESS**. La API pública de GitHub confirma que PR #957 continúa abierto, draft y mergeable, con ese HEAD. Esto valida el CI del PR; no elimina los bloqueos operativos anteriores. No se ejecutó Apps Script, no se transmitieron secretos, y no se modificaron Firestore, pagos, Cloudflare, DNS, productos ni estado del PR.

**Decisión: NO-GO para migración/cutover.** Siguen pendientes la verificación y despliegue controlado del protocolo Sheets/Apps Script, la ejecución autenticada del canary con comprobación de Firestore, catálogo público/SEO real, pruebas de compra y pago en producción, y dominio/Search Console final. La muestra QA no se publicó y el PR no se integró.

### Monitor público y CI final del parche de reingreso — 2026-09-29 07:47 UTC

Se volvió a ejecutar `npm run monitor:production` desde la rama del PR. Las rutas `/`, `/catalogo`, `/collections`, `/product`, `/login`, `/perfil`, `robots.txt`, los tres sitemaps, `manifest.json`, APIs de salud/configuración/catálogo y Visual Builder devolvieron respuestas esperadas (200; `api/admin-runtime-health` devolvió el 401 esperado sin sesión). El monitor sigue terminando con código 1 únicamente por: `sitemap-products` vacío o inválido, ningún producto público para el canary SEO y ausencia de producto de muestra para probar metadata. El catálogo no se activó ni se cambió.

Durante la auditoría del flujo de cuentas se corrigió otro caso de compatibilidad de bajas antiguas: si sobrevive un perfil tombstone marcado como eliminado mientras Firebase Auth aún conserva una identidad habilitada, el correo OTP verificado ahora reemplaza esa identidad y permite un alta nueva, siempre que no exista un perfil bloqueado vigente. Se agregó regresión en `tests/accounts/email-otp-verify.test.mjs`. Verificación local: `npm run test:accounts` (34/34), OTP (12/12), contratos account-reentry/sync (18/18), `npm run build:pages`, y `npm audit` más `npm audit --omit=dev` (0 vulnerabilidades en esta rama).

La Actions run `36537686515` para HEAD `d2df07b15c99eaa514f3961ff3f4e12afa8a61ed` terminó **SUCCESS**; incluyó Browser, accessibility, SEO and performance gates. El PR #957 sigue abierto, draft, sin merge y mergeable. Los gates externos siguen en NO-GO: no se probó Sheets → Firestore, compra/pago real ni el dominio/propiedad Search Console final; no se ejecutó Apps Script ni se tocó producción.

### Revalidación autenticada posterior — 2026-09-29 07:52 UTC

Una actualización manual de solo lectura en la tarjeta de estado del ecosistema a las 07:51:45 UTC cambió la conclusión de salud de FAIL a **PASS**: Firebase/Firestore, productos, inventario, colecciones, pedidos, usuarios, auditoría, configuración, contenido, Visual Builder, Resend, Cloudinary, Google Sheets y Apps Script aparecen PASS. El puente muestra `apps-script-products-guard-v1 · 4210 ms`. Esto actualiza y supersede el estado FAIL observado a las 07:22 UTC para la comprobación de disponibilidad/protocolo; por sí solo no prueba la transferencia del producto canary a Firestore ni el procesamiento de la cola. La cola aún muestra 18 pendientes, 2 dead-letter y 4 días para la tarea más antigua.

La revalidación de “Flujo de conexiones” a las 07:52:14 UTC conserva 36 nodos, 37 conexiones, 61 verificadas y 12 que requieren atención. Su conexión agrupada de servicios externos aún falla con `GET /api/system-health · externos configurados=false`; 2 flujos cliente↔inicio/perfil, pedido↔inventario, admin↔productos/pedidos, Firestore↔carrito, likes, reseñas y correo siguen sin verificación o confirmación. Por lo tanto el estado se acota: el health check actual confirma que el puente Apps Script/Sheets responde, pero no que todos los flujos estén verdes.

El monitor público de 07:47 UTC sigue marcando los tres gates de catálogo/SEO vacíos. Dominio comercial/Search Console final y pago real tampoco están verificados. **NO-GO para cutover** continúa vigente hasta que se confirme canary Sheets → Firestore y se resuelvan o se acepten explícitamente las conexiones todavía en atención, junto con catálogo/SEO y dominio/pago.

### Corrección del criterio de PayPal en preparación — 2026-09-29 08:20 UTC

Al reconciliar el panel, el endpoint `/api/paypal-config` indicó PayPal habilitado en **sandbox**, con tasa BCP y sin razones de configuración faltante. El diagnóstico anterior trataba `configured=true` como suficiente para poner verdes los servicios externos, aunque Checkout requiere Live para una compra productiva. Se corrigió `/api/system-health` para usar la misma configuración resuelta que Checkout e informar `productionReady` sin exponer credenciales; el panel y el grafo ahora exigen PayPal Live para declarar producción lista. Se añadió regresión que mantiene sandbox en NO-GO aunque la tasa BCP sea válida. Pruebas locales: flujo de conexiones 26/26; system-health 6/6; vista del diagnóstico 1/1. `npm run build:pages` pasó después de regenerar el manifiesto y versionado de caché (19 páginas, 626 módulos, 912 archivos; auditoría de caché 287 archivos versionados y 79 cargas dinámicas resueltas).

Este parche aún no está desplegado. La evidencia sandbox solo describe el host técnico actual, no una transacción; la tasa vigente tampoco demuestra autorización/captura. NO-GO para cutover se mantiene por producto público y SEO vacíos, canary Sheets → Firestore sin confirmación, cola pendiente/dead-letter, 12 conexiones en atención, dominio/GSC comercial y pago Live sin verificar.
