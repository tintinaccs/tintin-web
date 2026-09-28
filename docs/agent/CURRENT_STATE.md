# Estado actual de reparación — independencia de Shopify

> Registro actualizado para esta tarea y rama. La evidencia de cada estado corresponde al commit indicado y no se hereda de auditorías históricas.

## Baseline

- Rama de trabajo: `codex/shopify-independence-audit`
- Último commit de código verificado localmente: `12895b0c` (`build: refresh diagnostic manifest after media hardening`); build y pruebas focalizadas completados.
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
- Search Console solo tiene conectada la propiedad `https://tintinaccesorios.pages.dev/`; no aparece una propiedad para `tintinaccs.com`. Se reenvió `https://tintinaccesorios.pages.dev/sitemap.xml` el 2026-09-28 01:58 UTC: aceptado, `pending`, 0 errores y 0 advertencias. Los datos asentados hasta el 2026-09-25 muestran 1 impresión y 0 clics.
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
- Feedback CRUD central: los CRUD individuales y masivos de productos, colecciones, clientes y pedidos usan el cargador central centrado, etapas de progreso y diálogo de resultado de éxito o error. Dos pruebas Playwright cubren resultado y centrado. El cambio está publicado en el HEAD del PR #937 (`5bd5431fe661826459bd659034541c5bc9852b34`), pero todavía no integrado en `main` ni en producción.

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
