# Evidencia operativa de producción — 2026-09-28

**Última observación:** 2026-09-28, aproximadamente 19:05 UTC. **Commit evaluado:** `1961362afff29210b807f4a7feb370ce3247eb0c` (`main`). Esta captura describe el estado observado; los servicios externos pueden cambiar después.

## Estado observado

| Área | Evidencia en vivo | Resultado |
| --- | --- | --- |
| Cloudflare Pages Functions / Firebase | `GET https://tintinaccesorios.pages.dev/api/health` respondió HTTP 200 con `ok=true`; runtime, configuración, Firebase y runtime Admin aparecen en `true`. | Salud técnica observada. No prueba una compra ni escrituras de negocio. |
| Catálogo | `GET /api/public-catalog?resource=products` respondió HTTP 200 con `items=[]`, `count=0`. `sitemap-products.xml` contiene cero `<loc>`. | Bloquea la prueba de producto, pedido y compra; no hacer el cutover todavía. |
| Colecciones | El recurso público depende del mismo catálogo; en el chequeo de cutover devolvió cero colecciones. | Falta importar o crear colecciones de negocio. |
| Dominio comercial | Los NS públicos son `gemma.ns.cloudflare.com` y `leo.ns.cloudflare.com`; el apex conserva A `23.227.38.65` y AAAA `2620:127:f00f:5::`; `www` apunta a `shops.myshopify.com`. `https://tintinaccs.com/` respondió HTTP 200 con HTML de Shopify. | La zona ya usa nameservers de Cloudflare, pero el tráfico web sigue en Shopify. No es el cutover a Pages. |
| SEO técnico de Pages | `robots.txt`, `sitemap.xml` y `sitemap-pages.xml` responden. El índice contiene páginas, productos y colecciones. `robots.txt` declara el sitemap de `pages.dev`. | SEO está publicado para el host técnico actual. Aún falta cambiar y validar el host canónico definitivo durante el cutover. |
| SEO de productos | `sitemap-products.xml` está vacío; `/products/anillo-liso-dorado` respondió 404 en seis intentos durante la auditoría de redirects. | Faltan datos para verificar la cobertura de handles Shopify. |
| PayPal / tasa | `GET /api/paypal-config` respondió con PayPal deshabilitado, `rateSource=manual`, tasa guardada el 2026-09-10 y motivo `stale_exchange_rate`. | La automatización desde BCP está en `main`; el dato de producción aún no se ha refrescado. El refresco programado corre días hábiles a las 17:00 UTC. No se ejecutó una transacción. |
| Sincronización Sheets | PR #941 integra que una falla de sincronización de catálogo con Sheets haga fallar GitHub Actions; PR #943 pasó el contrato operativo/de sincronización. La aplicación mantiene Firestore como destino del sitio. | Evidencia de código y CI, no una escritura reciente verificada de punta a punta en la cuenta de producción. |
| Baja y bloqueo de cuentas | PR #942 está en `main`; CI pasó contratos de cuenta, perfil y reglas de identidad de Firestore. Cuenta eliminada puede reingresar tras verificar correo; cuenta bloqueada sigue bloqueada. | Contrato automatizado verificado. No se inició sesión con cuentas personales reales para esta captura. |

## Validaciones ejecutadas

- GitHub Actions para PR #943 terminó correctamente en todos los gates, incluidos contratos de cuenta/sincronización, reglas de identidad de Firestore, navegador, accesibilidad, SEO y rendimiento.
- `GET /api/health`: HTTP 200 y checks técnicos verdes.
- La auditoría `scripts/auditar-cutover-live.mjs` se ejecutó contra `https://tintinaccesorios.pages.dev`. No se toma como aprobado: sus controles de canonical esperan que el host ya sea el dominio definitivo y por eso reportan como error que el origen actual `pages.dev` aparece en HTML. Sus hallazgos válidos para esta captura son catálogo vacío, falta de producto canary y 404 de `/products/anillo-liso-dorado`.
- `https://tintinaccs.com/` se verificó por separado y sigue sirviendo Shopify.

## Pendientes para autorizar el cutover

1. Importar catálogo/colecciones en Firestore desde el flujo de importación del Admin, conservando `shopifyHandle` para redirects y asegurando que las imágenes ya no dependan de Shopify CDN.
2. Verificar la sincronización Sheets → Firestore con una corrida real y revisar pendientes/dead-letter en el panel protegido; Sheets no debe volver a Shopify.
3. Esperar la siguiente corrida hábil de tasa BCP y comprobar que Firestore guarda `paymentFx` reciente y `/api/paypal-config` deja de indicar `stale_exchange_rate`. PayPal continúa desactivado hasta configurar credenciales válidas y completar pruebas de pago en sandbox.
4. Con un canary real del catálogo, ejecutar auditorías de producto, colecciones y redirects Shopify desde un preview que sirva el build de cutover.
5. Confirmar que el custom domain está vinculado al proyecto Pages y el TLS está activo antes de cambiar los registros web; verificar por separado que MX, SPF, DKIM y DMARC de correo sigan presentes.
6. Completar en navegador una prueba autenticada de login, perfil, favoritos, carrito y persistencia entre cuenta/dispositivo; luego una compra controlada en entorno seguro que compruebe pedido, inventario, correo y sincronizaciones.
7. Tras esos pasos, cambiar `config/public-site.json`, desplegar la preparación de cutover, comprobar OAuth, App Check, canonical, robots/sitemap, redirects y Google Search Console para `tintinaccs.com`.

**Decisión de esta captura: NO-GO para cambiar el dominio.** Se puede continuar con la importación del catálogo sobre Pages sin modificar el tráfico web actual.
