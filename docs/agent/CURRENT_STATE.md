# Estado actual de reparación — independencia de Shopify

> Registro actualizado para esta tarea y rama. La evidencia de cada estado corresponde al commit indicado y no se hereda de auditorías históricas.

## Revalidación vigente — 2026-09-29 08:49 UTC

- Worktree `codex/shopify-import-identity-reconciliation`, limpio antes de esta actualización documental en HEAD `e49dcb3c`. PR #957 permanece abierto, Draft y sin merge. Actions CI #3525 para ese HEAD terminó **SUCCESS** (10m48s), con auditoría de navegador, accesibilidad, SEO y rendimiento. Cloudflare creó el preview `https://codex-shopify-import-identit.tintinaccesorios.pages.dev`; no es producción ni se tocó DNS.
- `npm run build:pages` PASS (19 páginas, 626 módulos, 912 archivos; cache audit 287 archivos y 79 imports dinámicos). Suites locales: conexiones 26/26; system-health 6/6 + vista 1/1; cuentas 34/34; importación Phase 2 34/34; PayPal 6/6; checkout 99/99. Incluyen cuentas eliminadas/bloqueadas, reingreso, flujo OTP/WhatsApp, checkout y reconciliación de identidad Shopify.
- Monitor del Pages host productivo a las 08:25 UTC: rutas y APIs responden; NO-GO por sitemap de productos vacío, catálogo sin producto canary SEO y ausencia de muestra para metadata.
- Monitor del preview a las 08:42 UTC: rutas, login/perfil, robots, sitemaps, APIs públicas y Visual Builder responden. `/api/health` devuelve 503 con `configuration=false`; Firebase, Admin y Visual Builder responden. PayPal de Preview está deshabilitado por configuración incompleta; el catálogo está vacío y el canonical/sitemap de preview no pasan. No se copiaron secretos productivos a Preview.
- Revalidación autenticada de solo lectura del grafo en producción a las 08:46:12.706 UTC: 36 nodos, 37 conexiones, 61 verificadas y 12 requieren atención. Login/auth, sesión/perfil/roles de la sesión actual, Firestore/Rules, Pages/APIs, Sheets/Apps Script protocol, carrito renderizado, favoritos y notificaciones verificaron. Persisten 2 rutas de cliente role→home/profile sin runtime verificado, CRUD de pedidos/inventario/productos/pedidos admin sin prueba de mutación, Firestore→carrito, likes/reseñas/correo sin arista runtime confirmada y la conexión de servicios externos en error.
- Desajuste confirmado en el runtime productivo: `GET /api/paypal-config` devuelve `enabled=true`, `sandbox`, USD, tasa BCP con fecha 2026-09-25 y sin razones de indisponibilidad; en la misma revalidación el sistema de conexiones recibe del `/api/system-health` antiguo `Resend=true`, `Cloudinary=true`, `PayPal=no configurado`. El nuevo código del PR usa el resolver compartido de Checkout y mostrará sandbox como no listo para producción; PayPal Live sigue sin estar habilitado/probado.
- Canario `CANARY-SHEETS-FIRESTORE` sigue sin historial ni evidencia de escritura Firestore. Apps Script conectado sigue en deployment v16 (2026-09-22), fuente consolidada distinta de la fuente canónica local y equivalencia del deployment no verificada. No se invocó porque enviaría el secreto compartido al endpoint de producción y escribiría el canario en Firestore.
- DNS del último sondeo: apex y `www` aún en Shopify; GSC solo verifica `pages.dev`, no el dominio comercial. No hay catálogo/medios comerciales reales ni pago real verificado. Health anterior de producción indicaba 18 tareas de Sheets pendientes y 2 dead-letter.
- **NO-GO para cutover/cierre de Shopify.** Pendientes: conciliar y verificar Apps Script + canario Sheets→Firestore, importar/revisar catálogo real y SEO, verificar flujos de negocio sin falsear evidencia, configurar/testear PayPal Live y preparar dominio/GSC. No se cambiaron datos productivos, DNS, Apps Script, cuentas ni pagos.
Las secciones históricas inferiores conservan el estado registrado en sus fechas y ramas; para la decisión vigente, prevalece esta revalidación y `PRODUCTION-PROBE-2026-09-29.md`.

## Baseline

- Rama de trabajo: `codex/shopify-independence-audit`
- Último commit de código verificado localmente: `f207206a` (`feat: preflight Shopify media imports safely`); pruebas focalizadas completadas.
- Commit base observado: `0d060922bdc17eb99ef4ce7fcdeb0acf86cd858c` (main, 2026-09-27)
- Objetivo: dejar el sitio preparado para migrar el catálogo desde Shopify y operar sin la cuenta ni los servicios de Shopify.
- Producción: no modificada por esta rama.
- DNS, cuenta Shopify y publicación: sin cambios.

## Evidencia observada

- `https://tintinaccs.com/`: HTTP 200.
- `https://tintinaccs.com/sitemap-products.xml`: HTTP 404.
- `https://tintinaccs.com/api/health` and `/api/public-catalog?resource=products`: HTTP 404, consistente con que el dominio todavía sirve el storefront de Shopify y no está cortado hacia Pages.
- `https://tintinaccesorios.pages.dev/`: HTTP 200.
- `https://tintinaccesorios.pages.dev/sitemap-products.xml`: HTTP 200 con 0 `<loc>`.
- `https://tintinaccesorios.pages.dev/api/public-catalog?resource=products`: HTTP 200, `ok: true`, `count: 0`.
- `https://tintinaccesorios.pages.dev/api/health`: HTTP 200, `ok: true`; configuration, Firebase, runtime administrativo y Visual Builder están en verde, igual que los 12 probes de Admin/Firestore.
- Search Console conserva una propiedad de URL para `https://tintinaccesorios.pages.dev/`; la verificación del dominio propio fue pendiente en el primer sondeo y se volvió a revisar el 2026-09-28 10:05 UTC abajo. La evidencia histórica de envío a `pages.dev` (01:58 UTC) decía accepted/pending; el estado vigente que muestra la interfaz está en la sección de revalidación reciente.
- La auditoría SEO en vivo de Search Console encontró que la imagen principal de portada no tenía texto alternativo; se corrigió en la rama con una descripción de los relojes, sin duplicar el H1. `audit:images` lo exige, `audit:final` pasa y el preview actual de Cloudflare sirve el texto alternativo corregido. La propiedad pages.dev en producción aún necesita rastrear la versión integrada.
- La URL genérica `/product` que se auditó sin ID devuelve `noindex` y sin H1; es la ruta de plantilla sin un producto, no una ficha importada. Las fichas públicas con ID cuentan con su suite separada de canonical, JSON-LD y metadata.
- Preview del PR `#937` para el último commit: home, login, sitemaps y robots responden HTTP 200; el catálogo está vacío. El health del preview responde 503 con `configuration: false` porque los secretos de producción no están configurados para previews; esto no altera el health verde de Pages en producción.
- Check de salud de producción del commit `0d060922` (run `36363311286`): falla la imposición final del estado; los pasos de catálogo, login/perfil, entrega y headers pasan, pero el producto/sitemap no tienen datos reales. App Check para el browser runner se limitó por reCAPTCHA de CI.
- `npm run audit:final`: PASS en la rama de preparación, tras regenerar los manifiestos y CSP canónicos.
- `npm run build:pages`: PASS (rutas, CSP y manifiesto reproducibles; 38 rutas HTML, 149 handlers con hash).
- CI del commit `1edffe420f452736498972437a7d6926bab64c56`: PASS; build y drift de artefactos, preflight de dominio, contratos estáticos y operativos, emuladores/reglas Firestore, pruebas de navegador, accesibilidad, SEO, rendimiento y responsive.
- `npm run test:phase11-seo` contra servidor local: PASS, 6/6.
- `npm run audit:canonical-viewports` contra servidor local: PASS, 126/126 combinaciones (18 páginas, 7 tamaños).
- `npm run test:accounts`: PASS, 32/32; incluye bloqueo por identidad deshabilitada/perfil bloqueado, reingreso con UID nuevo tras eliminación y aviso WhatsApp.
- Redirect SEO de productos heredados: agregado soporte para `sourceMetadata.handle` (y su alias legacy), con 2 tests automatizados en `audit:final`.
- Loader: wordmark oscuro con contraste AA medido por la auditoría contra el fondo rosa; cache tags renovados en las páginas.
- `npm audit --audit-level=moderate`: PASS, 0 vulnerabilidades tras actualizar `firebase-tools` y sus dependencias transitivas compatibles.
- Responsive, arquitectura, contratos de checkout/pedidos, roles, medios, sincronización, importación y SEO estático pasan las comprobaciones incluidas en `audit:final`.
- La auditoría local del emulador de Firestore no es ejecutable en este equipo: Java no está instalado. CI sí confirmó las reglas e identidad para el commit actual.
- Las funciones de importación son CSV y no requieren Shopify Admin API para operar. La fase de medios todavía puede copiar imágenes desde Shopify CDN a Cloudinary bajo una bandera de escritura explícita; hay que completar esa copia y verificar cero URLs Shopify antes de cerrar la cuenta.
- La carga de medios ahora lee el body en streaming, cancela al superar 15 MiB y aplica timeout de 20 s al origen. `npm run test:phase2-import` (24/24), `npm run audit:phase2-contract`, `npm run audit:products-media` (39 comprobaciones) y `npm run build:pages` pasan en `12895b0c`; el manifiesto diagnóstico generado incluye los nuevos hashes.
- Se confirmó en vivo en esta continuación: `tintinaccs.com/` y su sitemap responden 200, pero `/api/health` responde 404; Pages `/api/health` responde 200, el catálogo devuelve `count: 0` y el sitemap de productos contiene 0 ubicaciones. El dominio comercial sigue atendido por Shopify.
- Feedback CRUD central: los CRUD individuales y masivos de productos, colecciones, clientes y pedidos usan el cargador central centrado, etapas de progreso y diálogo de resultado de éxito o error. Dos pruebas Playwright cubren resultado y centrado. Verificado otra vez en local el 2026-09-28 (2/2); está en el PR #937, aún no integrado en `main` ni en producción.

## Seguimiento actual — 2026-09-28

- Estado de código local: rama `codex/shopify-independence-audit`, HEAD `b0f76cf2cf148f3f0020a59d1e5c10666fb8963d`, árbol limpio y sincronizado con `origin/codex/shopify-independence-audit`. No se modificaron DNS, cuentas, catálogo ni producción.
- Verificación local del HEAD: `npm run test:admin-operations-browser` PASS (2/2), `npm run build:pages` PASS (19 páginas, 620 módulos, 902 archivos, 286 recursos versionados y 79 imports dinámicos resueltos), `npm run audit:final` PASS, `npm audit --audit-level=moderate` PASS (0 vulnerabilidades), `git diff --check` PASS.
- Se agregó un gate post-cutover de solo lectura (`scripts/auditar-cutover-live.mjs`) para rechazar URLs Shopify residuales en HTML, productos, variantes, descripciones y colecciones del catálogo público. El detector tiene 3 pruebas unitarias; no se ejecuta como gate general antes de importar porque el catálogo actual está vacío.
- GitHub PR #937 sigue abierto, sin merge, y la comparación reporta `mergeable: true`. El run `36384730555` del commit funcional pasó todos los gates, incluido navegador/accesibilidad/SEO/rendimiento. El run `36386135668` para el HEAD actual pasó hasta «Canonical integrations and authority map» y está en «Full static contract». PR #929 continúa separado y con archivos solapados; no integrar las ramas a ciegas.
- Sondeo público renovado a las 2026-09-28 06:14 UTC: `tintinaccs.com` A → `23.227.38.65`; `www` CNAME → `shops.myshopify.com`; `tintinaccesorios.pages.dev` y su `/api/health` responden 200 con `ok: true`. El catálogo devuelve `count: 0` y `sitemap-products.xml` no contiene URLs. Los endpoints API en el dominio comercial responden 404 mientras este sigue servido por Shopify. No se modificó DNS ni contenido productivo.
- Decisión: **no está listo el cutover**. Mantener Shopify activo. Próximos bloqueos: importar y revisar catálogo real, copiar/verificar todas las imágenes fuera de Shopify CDN, aceptar con datos reales los flujos de catálogo, cuenta, compra, pago/correo y búsqueda, completar D/E del runbook con dominio y App Check, y verificar Search Console del dominio final.
- Límites de la prueba nueva: confirma el comportamiento visible del componente contra un servidor local; no simula escritura en Firestore ni reemplaza la aceptación autenticada de cada operación en la tienda de producción.

## Estado de aceptación (commit base)

| Dominio | Estado | Evidencia / siguiente paso |
| --- | --- | --- |
| Build y estructura | PASS | `build:pages`, `audit:final` y CI del commit actual correctos. |
| Home y shell público | PASS_WITH_LIMIT | Contratos, responsive y auditorías locales correctos; el browser de producción no pudo completar el flujo de catálogo vacío. |
| Catálogo y colecciones | FAIL | Producción Pages devuelve catálogo `count: 0` y sitemap de productos vacío. |
| Producto | BLOCKED | No existe producto público con el que verificar ficha, precio, stock, medios o metadata. |
| Carrito | PASS | `audit:final` y contratos de checkout verifican identidad, variantes, sincronización y recuperación. |
| Checkout, pedidos, stock y pagos | PASS_WITH_LIMIT | Contratos server-side y pagos simulados pasan; falta validar el runtime con catálogo real y los emuladores en CI. |
| Login, sesión y perfil | PASS_WITH_LIMIT | Tests locales 32/32 y auditorías pasan; navegador CI quedó limitado por reCAPTCHA. |
| Roles y Super Admin | PASS_WITH_LIMIT | Auditorías estáticas/contractuales pasan; las reglas del emulador requieren Java en CI. |
| Firestore y App Check | PASS_WITH_LIMIT | CI ejecutó y aprobó reglas e identidad con emuladores; falta validar flujos de compra autenticados con catálogo real. |
| Integraciones | PASS_WITH_LIMIT | Contratos de Firebase, Cloudinary, Resend, PayPal y Sheets pasan; credenciales/servicios reales y migración de medios siguen por comprobar en producción. |
| CSP, rutas, caché y diagnóstico | PASS | `build:pages`, CSP, rutas limpias, manifiestos y 286 recursos versionados verificados. |
| Responsive y accesibilidad | PASS_WITH_LIMIT | Matrices responsive, contraste y accesibilidad del gate pasan; los flujos reales de compra requieren catálogo. |
| Performance y SEO | PASS_WITH_LIMIT | SEO estático, metadata, robots, canonicals y sitemap pasan; redirects de handles Shopify importados cubiertos; sitemap de productos sigue vacío hasta importar catálogo. |
| Correos y notificaciones | PASS_WITH_LIMIT | Contratos de correo y colas pasan; entrega depende de credenciales y verificación runtime. |
| Producción | FAIL | Health Pages y 12 probes conectados están verdes, pero el catálogo está vacío y el dominio propio no apunta a Pages; no se realizó ningún cambio de producción. |
| Search Console | PASS_WITH_LIMIT | Solo está conectada Pages; el sitemap sigue pendiente y hay tráfico orgánico casi nulo. Tras importar el catálogo y cambiar DNS, registrar/verificar el dominio propio, enviar sus sitemaps y comprobar indexación. |
| Recuperación | IN_PROGRESS | Hay contratos de copias/importación y checkpoint; falta ejecutar un ensayo completo con exportación real y documentar aceptación del catálogo importado. |

## Límites de esta fase

- La migración real de productos, compras/cobros, DNS, cierre de cuenta Shopify y deploy del dominio final no se ejecutan desde esta auditoría.
- Los requisitos de datos reales que solo el dueño puede validar (precio, variantes, stock, imágenes y política de envío/devolución) deben quedar marcados como bloqueo hasta verificarse.
- No declarar independencia de Shopify mientras las URLs de imágenes u otra infraestructura sigan sirviendo contenido desde Shopify.

## Bloqueos para declarar lista la migración

1. Importar el catálogo real de Shopify mediante el flujo CSV de preview, validar errores y aplicar solo después de revisar productos y colecciones.
2. Copiar todas las imágenes a un proveedor bajo control propio y confirmar que ningún producto, CSS, contenido o metadata depende de `cdn.shopify.com`.
3. Verificar en producción productos, colecciones, sitemaps, ficha, precio/stock, carrito, checkout y correos con datos reales y medios accesibles.
4. Conseguir PASS de emulator rules/account purge y de los checks del commit en CI; la máquina local no tiene Java.
5. Cambiar DNS del dominio propio de Shopify a Cloudflare Pages, esperar propagación y validar HTTPS, rutas limpias, headers, robots y Search Console.
6. Mantener Shopify accesible hasta confirmar la migración de CSV e imágenes; desactivar/cerrar la tienda solo cuando dominios, activos y datos estén verificados fuera de Shopify.

Las modificaciones de esta rama son de código, documentación y dependencias de desarrollo. No cambiaron el sitio publicado, DNS, cuentas, clientes ni catálogo real.

## Avance local — 2026-09-28

- El importador de Shopify ahora solicita, antes de escribir cualquier producto, la copia autenticada de todas las imágenes Shopify CDN a Cloudinary. Solo sustituye URLs cuando el endpoint confirma una copia HTTPS válida; un medio fallido cancela la escritura del catálogo. El endpoint conserva su guardia explícita `SHOPIFY_PHASE2_MEDIA_WRITE=1`, que todavía debe habilitarse durante la sesión real de importación.
- La interfaz CRUD usa el panel central para el progreso y el resultado final. Las pruebas Playwright locales verifican centrado, cierre del loader y diálogos de éxito/error (2/2); los tags de caché del cargador y de las operaciones se auditan como URLs únicas.
- `test:phase2-import` (27/27), `audit:phase2-contract` (15/15), el detector de dependencias de medios Shopify (3/3), el audit de App Check y `npm audit --audit-level=moderate` (0 vulnerabilidades) pasan en esta revisión local.
- Estos cambios están publicados en el preview del PR #937, no integrados en `main` ni en producción. Catálogo Pages vacío, dominio propio servido por Shopify y medios/catálogo real pendientes; por eso la migración aún no está lista.

## Search Console recheck — 2026-09-28

- Solo está conectada la propiedad `https://tintinaccesorios.pages.dev/`; no hay propiedad conectada para `tintinaccs.com`.
- El sitemap `sitemap.xml` de Pages continúa `pending` en Google, sin errores ni advertencias. Las inspecciones de Google dan PASS/indexed para la portada y `/catalogo`, rastreadas como móvil; el sitemap de productos sigue vacío, así que no existe evidencia de indexación de productos.
- Rendimiento de GSC para 2026-08-29–2026-09-25: 1 impresión y 0 clics. Ver [PRODUCTION-PROBE-2026-09-28.md](PRODUCTION-PROBE-2026-09-28.md) para la captura y estados de inspección.
- `npm run monitor:production` GET-only contra Pages ahora revisa catálogo de productos y colecciones, las 12 configuraciones del Visual Builder y la configuración global en busca de URLs alojadas en Shopify. La última lectura encontró cero referencias en los datos/configuración públicos devueltos, pero productos y colecciones también están vacíos; el monitor sigue fallando en los tres gates de catálogo (cero productos, `sitemap-products` vacío y sin ficha para comprobar metadatos). No envía pedidos ni toca datos.

## Revalidación — 2026-09-28 08:16 UTC

- HEAD actual: `a5be1430dc06127c8061c4b9d7d67d8fe487aed5` en `codex/shopify-independence-audit`; árbol limpio al empezar esta revalidación.
- PR #937 sigue abierto y GitHub reporta `mergeable: true`. El workflow específico del PR para este SHA terminó con `success`; la auditoría integral `36395618448` seguía activa en «Browser, accessibility, SEO and performance gates»; sus 16 etapas anteriores habían concluido correctamente.
- PR #929 sigue abierto con `mergeable: false`. Los PR #937 y #929 modifican 22 rutas en común; no combinar ni actualizar una rama desde la otra a ciegas.
- Prueba del diálogo CRUD: Playwright local contra el código del HEAD actual pasó 2/2 (éxito y error, loader centrado y diálogo final). El primer intento usó el `baseURL` predeterminado de producción, por lo que cargó el módulo publicado antiguo y falló al buscar `centerLoader`; al fijar `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173` sirviendo este checkout, ambas pruebas pasaron. No se identificó fallo de implementación.
- Lectura HTTP de Pages a las 08:16 UTC: `/api/health` 200 con `ok: true`; catálogo público con 0 productos y 0 colecciones; `sitemap-products.xml` 200 con 0 `<loc>`; PayPal deshabilitado por `stale_exchange_rate`. `tintinaccs.com` y `www.tintinaccs.com` respondieron con markup de Shopify.
- Decisión: **NO-GO para cambiar la URL a producción**. Catálogo, dominio y validaciones posimportación siguen bloqueando. No se modificaron DNS, Shopify, datos productivos ni pagos.
- Actualización CI del HEAD `dc0af46539deb374c9cb371223417a17a4a8e8f8`: la primera ejecución (`36396665394`) detectó manifiesto desactualizado tras cambiar estos documentos. Se regeneró `diagnostic-manifest.json`, `npm run build:pages` terminó correctamente y la ejecución integral siguiente (`36397057805`) pasó todas las etapas, incluidas navegador, accesibilidad, SEO, rendimiento y emulador de Firestore; no hubo pasos fallidos.

## Reparación del test CRUD local — 2026-09-28 08:51 UTC

- Síntoma reproducido previamente: `npm run test:admin-operations-browser` heredaba el `baseURL` general de producción (`pages.dev`), por lo que importaba el módulo antiguo publicado y fallaba antes de probar el loader del checkout actual.
- Causa corregida: el test ahora usa `playwright.operations.config.js`, establece `http://127.0.0.1:4173` como origen y arranca/reutiliza `scripts/servidor-local-pruebas.mjs`, el servidor de pruebas canónico ya usado por CI.
- Verificación local: el comando normal `npm run test:admin-operations-browser` terminó PASS, 2/2 (éxito centrado y error central). No requirió definir variables de entorno ni acceder a producción.
- Impacto acotado a configuración de pruebas y script npm; no cambió checkout de producción, configuración Firebase, clientes, pedidos ni DNS. El cambio aún necesita CI del nuevo HEAD.

## Preflight de preparación de medios Shopify — 2026-09-28

- El API de copia ahora ofrece `action: preflight`, únicamente tras autenticar Super Admin. Devuelve solo `ready`, booleanos y reason codes; comprueba que la bandera temporal `SHOPIFY_PHASE2_MEDIA_WRITE` esté activa y que Cloudinary tenga configuración completa, sin revelar valores ni transferir archivos.
- Antes de copiar cualquier URL de Shopify CDN, el importador consulta ese preflight. Una configuración incompleta detiene la aplicación antes de descargar imágenes o escribir productos. Si no hay URLs de Shopify CDN en el preview, no hace falta el copiado.
- `tests/import/shopify-phase2-media-api.test.mjs` comprueba los dos estados y que la respuesta no incluya credenciales; `scripts/auditar-shopify-phase2-contract.mjs` exige que el preflight ocurra antes de la copia/catalog write.
- Se añadió [importacion-shopify-media.md](../importacion-shopify-media.md) con el paso de configuración temporal en Cloudflare Pages Production, la desactivación al terminar y la aceptación posterior. No se activó ninguna variable ni se escribieron medios/catálogo reales.

## Revalidación preflight y panel CRUD — 2026-09-28 09:20 UTC

- HEAD local/remoto: `f207206a` en `codex/shopify-independence-audit`, commit enviado al PR #937. El cambio no se ha mergeado ni desplegado.
- Verificación local: `npm run test:phase2-import` PASS 28/28; `npm run audit:phase2-contract` PASS; `npm run audit:products-media` PASS 41 comprobaciones; `npm run audit:cache-versioning` PASS; `npm run verify:diagnostics` PASS; `npm run test:admin-operations-browser` PASS 2/2 (éxito/error y loader centrado).
- CI para `f207206a`: Cloudflare Pages PASS, CodeQL actions PASS y Repository audit + CodeQL JavaScript/TypeScript todavía en curso al 09:20 UTC.
- El panel central está implementado para CRUD individual y masivo de productos, colecciones, clientes y pedidos. No equivale a decir que cada acción administrativa de todos los demás módulos use ese panel.
- Preparación de catálogo/CDN documentada en `docs/importacion-shopify-media.md`; el preflight autenticado solo comprueba disponibilidad, nunca copia medios ni escribe productos.
- Estado producción sigue **NO-GO** para empezar importación/cambiar la URL: catálogo Pages vacío y DNS del dominio todavía apunta al storefront Shopify, según el último sondeo en vivo de 08:16 UTC. La copia real de catálogo/media, pagos, pedido/email con datos reales, Search Console del dominio y aceptación DNS siguen pendientes.

## Corrección de build exacto del loader — 2026-09-28

- CI del commit `b7884cc5` encontró que `Build exact public artifact` fallaba en `audit:cache-versioning`: el generador `scripts/sincronizar-inicio-navegacion-publica.js` reconstruía 14 páginas con `shopify-media-loader-1`, mientras las demás usaban `shopify-media-loader-2`.
- Se actualizó la versión en la fuente canónica del shell y en las tres auditorías que exigían el número anterior. `npm run build:pages` ahora termina PASS, sin drift en la segunda ejecución; versionado consistente: 286 archivos y 79 imports dinámicos.
- Regresiones: `npm run audit:app-check-bootstrap`, `npm run audit:phase8-ui` (15/15), `npm run audit:phase10` (12/12), `git diff --check` PASS.
- El arreglo quedó en `d256d8f5`; Repository audit, Cloudflare Pages, CodeQL JavaScript/TypeScript y CodeQL Actions terminaron PASS. No se cambiaron DNS, producción ni catálogo.

## Importador publicado frente al importador preparado — 2026-09-28 09:47 UTC

- Lectura directa de `https://tintinaccesorios.pages.dev/admin.html` y del módulo publicado `js/admin/aplicar-importacion-admin.js`: producción aún importa el módulo antiguo `shopify-apply-1`; ese módulo aplica registros desde el cliente, sin solicitar preflight ni copiar/reemplazar imágenes de Shopify antes de escribir.
- El código preparado en esta rama usa el módulo versionado `shopify-media-preflight-1`, autentica el preflight, copia las imágenes Shopify CDN a Cloudinary y sustituye sus URLs antes de la escritura del catálogo. No importar productos con la versión publicada actual: conservaría URLs dependientes de Shopify.
- El `POST` público sin autenticación a `/api/admin-import-media` da 401 (`Falta la autenticación`), tanto en Pages productivo como en el preview. Esto confirma la protección del endpoint, pero no verifica la preparación de Cloudinary ni el permiso/resultado de una sesión Super Admin.
- Sondeo productivo actualizado: `/api/health` Pages 200/ok; catálogo público 0 productos y 0 colecciones; sitemap de productos vacío; PayPal `enabled:false` por `stale_exchange_rate`. `tintinaccs.com/api/health` y `/sitemap-products.xml` responden 404; `tintinaccs.com` resuelve a `23.227.38.65` y `www` a `shops.myshopify.com`. Los resolvers públicos 1.1.1.1 y 8.8.8.8 confirman NS `gemma.ns.cloudflare.com` y `leo.ns.cloudflare.com` (la pantalla de overview de Cloudflare mostraba un aviso pendiente que no coincide con la delegación pública actual).
- Coordinación: PR #937 está abierto, mergeable y su CI pasó completamente en `d256d8f5`; PR #929 sigue abierto/no mergeable y comparte 42 archivos con #937. El cuerpo de #929 requiere no integrarlo hasta que el catálogo esté cargado y se ejecute la sección D del cutover. No mezclar esas ramas ni desplegar el flujo de cutover ahora.
- Decisión: **NO-GO para iniciar la importación en producción** hasta integrar/desplegar el importador seguro y validar su preflight autenticado contra variables de Production. **NO-GO para el cambio de dominio** por catálogo vacío y aceptación posimportación pendiente. No se alteró producción ni se hicieron mutaciones con datos reales.
- CI del commit `253a2b99` terminó PASS (Repository audit, Cloudflare Pages y CodeQL JavaScript/TypeScript + Actions; run `36405935386`).
- `npm run monitor:production` ejecutado en modo público/solo lectura a las 10:00 UTC: 30 probes de páginas, headers/CSP, robots/sitemaps, APIs de salud, catálogos, Visual Builder y Visual Studio pasaron; el comando termina con exit 1 solo por tres gates de aceptación sin catálogo real: sitemap-productos vacío, cero producto canary y metadata de producto no disponible. PayPal informa `enabled:false`, razón `stale_exchange_rate`. No se hicieron pedidos, escrituras ni envíos.

## Search Console: revalidación de propiedad y sitemaps — 2026-09-28 10:05 UTC

- En la sesión de Google Search Console del comercio se abrió correctamente `sc-domain:tintinaccs.com`. Esto prueba que esa propiedad de dominio existe y es visible para la cuenta actual; no infiere el nivel exacto de permisos/propiedad.
- Su resumen muestra una recomendación asociada a 261 productos, 27 páginas HTTPS y 23 resultados válidos de breadcrumbs. Son datos del dominio que hoy entrega Shopify, no validación del despliegue Pages nuevo.
- La vista de sitemaps de `sc-domain:tintinaccs.com` no tiene sitemaps enviados. Por lo tanto, después del corte habrá que enviar allí el sitemap generado por Pages y seguir su procesamiento.
- La propiedad URL `https://tintinaccesorios.pages.dev/` sí tiene `/sitemap.xml` enviado (27-sep-2026), pero la interfaz muestra tipo `Desconocido`, última lectura “No se ha podido obtener” y 0 páginas descubiertas. Repetí GET con User-Agent normal y Googlebot: sitemap index HTTP 200, `application/xml`, XML válido y 3 child sitemaps; el sitemap-pages también responde 200/XML válido con 10 ubicaciones, mientras productos y colecciones están vacíos. El origen de la discrepancia de Search Console sigue sin determinarse; la respuesta HTTP por sí sola no acredita que Google ya lo haya procesado.

## Revalidación operativa y de importador — 2026-09-28 10:16 UTC

- Repetí `npm run monitor:production` en modo GET-only. Las rutas públicas, CSP/headers, robots/sitemaps, `/api/health`, catálogos, health guard administrativo, páginas del Visual Builder y configuración global respondieron como espera el monitor. El comando conserva exit 1 únicamente por los tres canaries que necesitan productos reales: sitemap de productos vacío, cero productos en catálogo y sin ficha de muestra para revisar metadata. La respuesta pública de PayPal sigue `enabled:false`, `stale_exchange_rate`; su `PAYPAL_RATE_UPDATED_AT` reportado corresponde a `2026-09-10T18:59:53Z`, mientras el código exige una tasa de no más de siete días. No refrescar ni inventar una tasa: es un dato financiero que debe actualizarse con valor vigente antes de probar PayPal.
- Confirmé otra vez que el `admin.html` de Pages y su módulo publicado aún usan `shopify-apply-1`, sin el preflight/copiado a Cloudinary preparado en esta rama. El catálogo publicado permanece con cero productos, cero colecciones y sitemap de productos sin URLs.
- En la rama `codex/shopify-independence-audit`: `npm run audit:final` terminó exit 0; `npm run test:phase2-import` pasó 28/28; `npm run audit:phase2-contract` pasó sus 16 contratos; `npm run test:admin-operations-browser` pasó 2/2. El test de navegador verifica el loader central durante CRUD y los resultados centralizados de éxito/error. `git status` quedó limpio tras estas verificaciones.
- CI de GitHub para el HEAD `84cc6b50`: run `36407214552` fue cancelado automáticamente al ceder prioridad a una solicitud de auditoría del mismo PR; el run `36407771681` permanece `Waiting` a que cierre el anterior. No se informa como CI aprobado para el HEAD actual. GitHub REST estaba respondiendo 403 por límite no autenticado; se verificó mediante la UI pública de Actions.
- Estado de integración: PR #937 sigue abierto y PR #929 sigue siendo el cambio de dominio separado, con condición explícita de esperar al catálogo y ejecutar la sección D. No fusionar el cutover ni alterar DNS en esta etapa.
- Decisión: se mantiene **NO-GO para iniciar importación** hasta integrar/desplegar la versión segura y completar un preflight autenticado de Production con Cloudinary/guardia listos. Se mantiene **NO-GO para cutover** hasta completar importación y aceptación de compra, cuenta, pagos/correos/App Check, redirects e indexación en el dominio final. No se escribieron datos de negocio ni se hicieron cambios a producción.

## Search Console y estado de Actions — 2026-09-28 10:25 UTC

- `GSC Wizard` estaba inicialmente conectado solo a la propiedad URL `https://tintinaccesorios.pages.dev/`. Registré la propiedad de dominio ya existente `sc-domain:tintinaccs.com`; Google respondió `permissionLevel: siteOwner`, sin crear una propiedad nueva en Search Console. La visibilidad del dashboard quedó activada (2 de 10 espacios usados).
- Después del registro, las consultas GSC directas para `sc-domain:tintinaccs.com` funcionan, pero `list_sites` todavía enumera solo `pages.dev`; `list_sitemaps` para el dominio no tiene entradas y no hay Indexing Tracker configurado. La herramienta avisa que su dashboard puede tardar hasta una hora en refrescar. Revalidar el listado cuando pase ese plazo; no enviar un sitemap antes de que Pages atienda el dominio.
- Baseline GSC de `sc-domain:tintinaccs.com`, API asentada hasta 2026-09-25: últimos 28 días con 23 impresiones, 0 clics, CTR 0 y posición promedio 9; en el periodo anterior los datos devueltos fueron 0. Esto es baseline del dominio todavía servido por Shopify, no resultado postmigración.
- Sitemap de `https://tintinaccesorios.pages.dev/sitemap.xml`: GSC lo reporta pendiente, con 0 errores y 0 warnings; el sitemap incluye 10 URLs públicas. En Performance, dos URLs (portada y catálogo) recibieron una impresión cada una durante el rango asentado y no hubo clics. Las impresiones no sustituyen la inspección de cobertura de indexación.
- A las 10:25 UTC, GitHub Actions seguía mostrando el run `36408785024` (`2f89312`) en espera del `36407771681`; el PR #937 continúa abierto. No hay aprobación CI del HEAD vigente.

## Revalidación de producción y auditoría local — 2026-09-28 10:35 UTC

- HEAD local y remoto de `codex/shopify-independence-audit`: `4462d541c082cef7eb5d182ca5344a5630d2ab20`; el árbol estaba limpio antes de anotar esta evidencia. PR #937 continúa abierto. Actions listó el run #3453 de sincronización del PR en progreso; no contarlo como PASS hasta que finalice.
- `npm run audit:final` terminó exit 0 en esta rama. `npm run test:admin-operations-browser` pasó 2/2: loader CRUD centrado durante la operación y panel central de resultado de éxito/error.
- `npm run test:accounts` pasó 32/32, incluida la baja que permite registro con identidad nueva, y el rechazo de login/OTP para cuentas bloqueadas.
- Recheck Pages a las 10:33:22 UTC: health 200; catálogo público de productos y colecciones 200 con `count: 0`; sitemap de productos 200 vacío. El monitor GET-only pasa sus probes de rutas/cabeceras/CSP/SEO/configuración y termina exit 1 únicamente por los tres canaries que requieren un producto real (sitemap, muestra del catálogo y metadata server-rendered).
- Reconfirmé el importador en el despliegue público: el módulo servido todavía referencia `shopify-apply-1` y no llama al preflight de medios. El importador con copia a Cloudinary y validación previa está solo en PR #937; no aplicar CSV desde la versión desplegada.
- PayPal sigue `enabled:false`, `stale_exchange_rate`, con timestamp `2026-09-10T18:59:53Z`. `tintinaccs.com/api/health` responde 404; el host propio todavía no está sirviendo Pages. La indexación de Search Console requiere volver a validarse sobre el dominio final después del cambio de host.
- Decisión: **NO-GO para importar catálogo con la publicación actual y NO-GO para el cutover**. PR #929 exige explícitamente esperar a que el catálogo esté cargado y hacer la sección D del runbook en una misma sesión. Mantener ambos PRs separados y el dominio/Shopify operativos hasta completar esos requisitos y las pruebas reales.

## CI completo y health del preview actualizado — 2026-09-28 10:58 UTC

- En commit `a1d85cfcdd8345b201e83f8377f009dc297173fe`, los checks `Repository audit`, `Cloudflare Pages`, CodeQL y los dos análisis de código terminaron en verde. El PR #937 sigue abierto y GitHub lo marca `clean`; PR #929 sigue abierto y `dirty`, tal como indica su título de no fusionar antes del catálogo y la sección D.
- El branch preview actual sirve el importador con `shopify-media-preflight-1`, incluido el llamado a `/api/admin-import-media`. Su `/api/health` devuelve 503 con `configuration:false`; no divulgar variables ni copiar secretos de Production a Preview. La configuración de Preview no habilita pruebas autenticadas.
- Producción Pages `/api/health` responde 200 y `configuration:true`, pero no valida por sí solo las credenciales ni el preflight autenticado de Cloudinary. Los catálogos de Production permanecen vacíos y el módulo de importación público sigue en `shopify-apply-1`.
- PayPal en Preview devuelve `enabled:false` con configuración faltante y tasa vencida; Production ya se había comprobado deshabilitado por `stale_exchange_rate`. No se cambió la configuración financiera.
- Decisión vigente: **NO-GO**. El código del importador pasó CI y está en Preview, pero aún no está integrado/desplegado en Production, no se verificó el preflight autenticado allí y falta catálogo real con aceptación posterior. El PR #929 continúa apartado para no interferir con el trabajo de cutover.

## CI del HEAD y CRUD ejecutado en Preview — 2026-09-28 11:19 UTC

- HEAD remoto/local confirmado con `git ls-remote`: `4c298cbc78053316f1227a3929292ef3b0919eb3` (rama `codex/shopify-independence-audit`). GitHub Actions run #3455 terminó `Success`; `Repository audit` duró 10m26s. El preview de rama sirve la versión con preflight de medios.
- Ejecuté el test Playwright existente directamente contra `https://codex-shopify-independence-a.tintinaccesorios.pages.dev` con configuración temporal, sin escribir archivos permanentes ni llamar a Firestore: **2/2 PASS** (loader centrado y resultados de éxito/error en el módulo realmente desplegado).
- Sondeo de Production renovado: Pages `/api/health` 200 con configuration/Firebase/Admin runtime true; productos 0, colecciones 0, sitemap-products 0 URLs. El módulo publicado `aplicar-importacion-admin.js?v=tintin-20260927-shopify-apply-1` no contiene preflight. PayPal continúa `enabled:false` por `stale_exchange_rate`. `tintinaccs.com/api/health` y `www.tintinaccs.com/api/health` responden 404 y la portada comercial contiene markup Shopify.
- El test de loader contra Preview solo comprueba la interfaz estática con operaciones de fixture; no certifica configuración de runtime ni un preflight autenticado. Preview `/api/health` sigue en 503 por `configuration:false`.
- Decisión: **NO-GO** para empezar la importación desde la publicación actual y para el cutover. Mantener Shopify y DNS como están. PR #937 no se integró; PR #929 permanece aparte por su condición de catálogo/Sección D y por el conflicto ya documentado.

## Revalidación de Search Console — 2026-09-28 11:25 UTC

- Después de más de una hora desde que registré la propiedad existente `sc-domain:tintinaccs.com` y la dejé visible, repetí `list_sites`: todavía devuelve solo `https://tintinaccesorios.pages.dev/`. Repetí `set_dashboard_visibility` para el dominio y la herramienta devolvió `visible:true`, `unchanged:["sc-domain:tintinaccs.com"]`, 2/10 espacios usados y la nota de que los MCP deberían ver la propiedad inmediatamente; `list_sites` siguió omitiéndola.
- Una consulta directa `list_sitemaps({siteUrl:"sc-domain:tintinaccs.com"})` funciona y devuelve lista vacía. La propiedad `pages.dev` aún tiene `sitemap.xml` pendiente, con 0 errores y 0 advertencias. No se envió ni se creó otro sitemap.
- Esto confirma una discrepancia persistente en el listado/dashboard del conector; no es evidencia de pérdida de la propiedad GSC. Sigue sin ser posible validar URLs de producto ni la cobertura/indexación del dominio final porque el catálogo está vacío y el dominio aún sirve Shopify.
- La decisión del cutover no cambia: **NO-GO**.

## Revalidación del feedback CRUD — 2026-09-28 11:44 UTC

- HEAD de la rama de preparación: `a4f839e8b6d24f6e5f7076c1e13e4d883b128d6c`; PR #937 sigue abierto y GitHub lo marca mergeable/clean. Se detectaron además los PR #938, #934, #933, #932 y #929 abiertos. No se combinaron ramas ni se integró ningún PR.
- `npm run test:admin-operations-browser`: **2/2 PASS** en Chromium. La prueba confirma loader centrado y resultado central de éxito, y cierre del loader con resultado central de error. Son operaciones fixture/mocked: no realizan escrituras de negocio.
- Lectura estática del código vigente: el helper `runAdminCrudOperation` se invoca en 18 puntos de `admin-app.js` y el helper `runAdminBulk` cubre acciones masivas de clientes y pedidos; productos también tienen flujos bulk dedicados. Las notificaciones CRUD se convierten a resultados centrales para producto, colección, cliente/cuenta y pedido. Esto verifica la conexión de las entidades principales; no prueba que cada acción de todos los módulos secundarios del Super Admin use idéntico panel.
- `npm run build:diagnostics` regeneró el manifiesto con **19 páginas, 621 módulos y 904 archivos**. `npm run audit:diagnostics` terminó exit 0: pasó los contratos de solo lectura, el inventario completo y su reproducibilidad.
- La prueba remota contra el Preview ya anotada en la sección anterior también fue 2/2; el Preview conserva health 503 por configuración incompleta y ese test no representa operaciones autenticadas ni estado de producción.
- La decisión operativa sigue **NO-GO**: producción aún no publica el importador seguro, faltan verificación autenticada del preflight en Production, catálogo real y aceptación comercial, y el dominio todavía sirve Shopify. No se modificaron datos de negocio, DNS, despliegue ni merge.

## Revalidación de CI, cuentas e importador — 2026-09-28 11:59 UTC

- PR #937 HEAD `2f95ef03817a9b05cbdeea16cfbe87fc1c6c29c5`: el run GitHub Actions `36417842856` terminó **success**; `Repository audit`, `Cloudflare Pages`, `CodeQL`, `Analyze (javascript-typescript)` y `Analyze (actions)` están en verde. GitHub indica `mergeable:true`, `mergeable_state:clean`. No se integró el PR.
- Volví a ejecutar `npm run test:admin-operations-browser`: 2/2 PASS; `npm run test:accounts`: 32/32 PASS; `npm run test:phase2-import`: 28/28 PASS; `npm run audit:phase2-contract`: 16/16 PASS.
- El monitor público GET-only volvió a pasar rutas, CSP/headers, robots, APIs, health, guardia Admin y Visual Builder. Sale exit 1 solo por tres aceptaciones que requieren catálogo real: sitemap de productos vacío, ningún producto para el canary y ninguna ficha para validar metadatos. PayPal informa `enabled:false`, `stale_exchange_rate`, tasa fechada `2026-09-10T18:59:53Z`. Ambos hosts comerciales continúan devolviendo 404 en `/api/health`, mientras Pages informa `ok:true`.
- Revisión de concurrencia basada en las listas actuales de archivos de los PR: #933 modifica 28/28 rutas también modificadas por #937; su corrección del contraste del wordmark ya está incluida en #937, que también tiene cambios adicionales del cargador/cache. #932 comparte 6 archivos y añade 9 rutas que no están en #937 (conciliación operativa de checkout/health y política de colecciones); su base es anterior y GitHub aún no informa mergeability. #934 comparte 8 rutas y tiene 2 rutas adicionales no presentes en #937; está dirty. #929 comparte 22 rutas y está dirty. No copiar ni rebasar estas ramas sin coordinar dependencias.
- Criterio: **NO-GO para importar productos desde el Production Admin o cambiar el dominio**. Primero hace falta integrar/desplegar el importador protegido, demostrar el preflight autenticado con la configuración real, preparar el medio de pago y cargar/revisar el catálogo real. El cliente puede volver a registrarse después de eliminación y las cuentas bloqueadas siguen bloqueadas, según las 32 pruebas; no se usaron cuentas de clientes en Production.

## Revisión del panel Cloudflare y sincronización del PR — 2026-09-28 12:16 UTC

- En Workers & Pages, el proyecto `tintinaccesorios` muestra el entorno Production en `main`, commit `0d060922`; la lista de dominios del proyecto muestra únicamente `tintinaccesorios.pages.dev`. El preview de `codex/shopify-independence-audit` sí fue creado; el último preview listado corresponde a `acd2e0c`. Esto confirma en el panel que la rama del PR no está desplegada como Production ni tiene el dominio comercial conectado a Pages.
- El Overview de zona Cloudflare aún presenta el banner “Esperando a que su registrador propague sus nuevos servidores de nombres” y muestra los servidores anteriores de Google Domains como instrucción. La consulta directa a los servidores del padre .com, y Google/Cloudflare DNS sobre el dominio, devuelve `gemma.ns.cloudflare.com` y `leo.ns.cloudflare.com`. La delegación en el padre ya es Cloudflare; el banner del dashboard parece desactualizado. La discrepancia no cambia el tráfico actual: los resolvers públicos devuelven apex `23.227.38.65` y `www CNAME shops.myshopify.com`; ambas URLs sirven HTML de Shopify.
- No se pudo verificar si la variable de guardia de importación está lista: Wrangler no está instalado en este entorno y el preview no permite una verificación autenticada por health/configuration=false. No se listaron secretos ni se mostraron valores. El preflight autenticado de Production sigue pendiente.
- El cuerpo del PR #937 se actualizó para quitar datos de HEAD/checks obsoletos y reflejar el estado y los bloqueos actuales. A las 12:16 UTC, su HEAD es `acd2e0c34b3d247f2bf3ddc72cca65b5ac3d50e7`; GitHub muestra 5/5 checks OK y mergeable/clean. PR permanece abierto y sin merge.
- Decisión: **NO-GO** para la importación del catálogo y el cambio del dominio, porque Pages Production todavía sirve `main@0d06092`, no tiene conectado `tintinaccs.com` y aún no verifica el preflight Cloudinary autenticado.

## Revalidación de preparación de migración — 2026-09-29 04:26 UTC

- PR #957, rama `codex/shopify-import-identity-reconciliation`, HEAD `44f4f409def06672c025ac65e3998d3330441d79`; GitHub Actions run #3504 terminó **success**. El cambio de identidad del importador reconcilia IDs/fingerprints/handles antes de la vista previa y vuelve a validar justo antes de ejecutar el trabajo; colisiones ambiguas detienen la importación antes de escribir.
- Verificación local registrada para ese HEAD: `npm run test:phase2-import` 34/34 PASS; `npm run build:pages` y auditorías de cache/versiones, Phase 8, Phase 10 y App Check PASS. PR #957 sigue draft y no está integrado.
- Sonda pública del 2026-09-29: Pages tiene health 200 y runtime/Firebase/Admin configurados; productos y colecciones públicos están vacíos, el sitemap de productos tiene 0 URLs y el monitor falla únicamente esos tres canaries dependientes del catálogo. La tasa PayPal de BCP figura habilitada en sandbox, fechada 2026-09-25; no se hizo una compra real. `tintinaccs.com`/`www` aún sirven Shopify y `api/health` da 404; no se hizo cambio de DNS.
- La mejora para identidad Firebase residual deshabilitada tras borrar una cuenta sigue en `codex/account-reentry` (`6a4e22bf`), aún sin PR/integración; sus pruebas focalizadas pasaron 18/18. No se usó una cuenta real de cliente.
- Decisión vigente: **NO-GO para migrar**. Los gates que faltan son: integrar y desplegar el importador validado; verificar su preflight autenticado en producción; cargar un catálogo real y validar medios, precios, checkout y pedido; confirmar la sincronización Google Sheets → Firestore con un canary; y completar en una misma sesión la conexión del dominio a Pages y la validación de Search Console. Mantener Shopify/DNS actuales hasta cerrar esas pruebas.
- Esta anotación toca `docs/agent/CURRENT_STATE.md`, que también aparece en el PR #938. No se editó ni integró la rama del otro PR; revisar ese solapamiento al reconciliar.
