# Estado actual de reparación — independencia de Shopify

> Registro actualizado para esta tarea y rama. La evidencia de cada estado corresponde al commit indicado y no se hereda de auditorías históricas.

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
