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

## Revalidación posterior — 2026-09-28 19:30 UTC

Esta revalidación se hizo después de integrar el informe y de ejecutar manualmente el workflow de producción. Sustituye los valores antiguos solo para los puntos que se indican; no representa una aprobación de cutover.

| Área | Evidencia nueva | Resultado |
| --- | --- | --- |
| PayPal / tasa | `GET /api/paypal-config` a las 19:26 UTC: `rateSource=BCP`, `rateSourceDate=2026-09-25`, `rateUpdatedAt=2026-09-28T19:26:01Z`, `unavailableReasons=[]`, ambiente `sandbox`. El job autenticado `Actualizar tasa PayPal desde BCP` del workflow #157 terminó correctamente. | La tasa se refrescó en Firestore. No se inició checkout ni se hizo un cargo; la configuración observada es Sandbox. |
| Monitor de producción | Workflow [#157](https://github.com/tintinaccs/tintin-web/actions/runs/36472176083): tasa BCP pasó; `monitor:production` falló por sitemap de productos vacío, catálogo público sin productos y ausencia de producto para metadata. La auditoría de catálogo en navegador informó 0 productos y 0 tarjetas. El smoke de 17 rutas, auditoría de login/perfil y encabezados terminaron correctamente; el gate final permanece en rojo por el monitor y catálogo. | El bloqueo principal es la ausencia de catálogo publicado, no la infraestructura general. El navegador de CI además informó `requestStorageAccess: Permission denied`, que requiere reevaluar con un catálogo presente. |
| Canarios existentes en Admin | Sesión Super Admin: existe 1 producto `PRUEBA QA · NO VENDER`, inactivo, y 1 colección `PRUEBA QA · NO PUBLICAR`, oculta, con un producto. | Son registros de prueba aislados; no los publiqué. Por su estado inactivo/oculto, no sirven como producto público para canario SEO ni checkout. No se crearon duplicados. |
| Custom Domain de Cloudflare Pages | En **Workers & Pages → tintinaccesorios → Dominios personalizados**, la UI muestra únicamente la opción “Configurar un dominio personalizado”; el proyecto lista `tintinaccesorios.pages.dev` como dominio de producción. | `tintinaccs.com` todavía no está vinculado a Pages. No se cambió la configuración del dominio. |
| DNS y verificación de Search Console | Consulta DNS pública: `www` y `account` siguen como CNAME a Shopify; el apex conserva A `23.227.38.65`. Sigue publicado el TXT `google-site-verification`; la presencia del TXT no demuestra que la propiedad esté verificada en Search Console. | El tráfico comercial sigue en Shopify; verificación de Search Console aún debe confirmarse en la cuenta. |
| Search Console — revalidación de cuenta | Se abrió la propiedad de dominio `sc-domain:tintinaccs.com`. El informe de Sitemaps muestra `0-0 de 0` sitemaps enviados. En la vista general, el informe de indexación indica que Google aún procesa los datos y que el total de clics de búsqueda web es 0 en la ventana mostrada. | La propiedad es accesible con la cuenta conectada; no hay sitemap presentado para el dominio. Presentarlo queda para después de vincular Pages y cambiar el host, para que Google lea el sitemap del sitio correcto. |

**Estado actualizado: NO-GO para cutover.** El refresco BCP sí quedó solucionado. Siguen siendo necesarios: importar catálogo real y medios fuera de Shopify, convertir el canario actual en prueba pública controlada o crear uno dedicado para preview, verificar los recorridos con el catálogo cargado, y completar la asociación de dominio en la sesión de cutover. El pedido de prueba preexistente permanece sin cobro; no se creó otro.
