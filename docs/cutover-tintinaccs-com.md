# Cutover Shopify → nueva Tintin (`tintinaccs.com`)

Este procedimiento es el único orden aprobado para mover la tienda desde Shopify a Cloudflare Pages. **No se cambia solamente DNS.** El dominio se anuncia como migrado únicamente cuando infraestructura, autenticación, App Check, SEO, correo y compra real pasaron sus verificaciones.

## Estado previo

- Origen activo de desarrollo/producción técnica: `https://tintinaccesorios.pages.dev`.
- Dominio comercial actual: `https://tintinaccs.com` en Shopify hasta el corte.
- Fuente de verdad del dominio en código: `config/public-site.json`.
- Destino declarado en `config.public-site.cutover`: `https://tintinaccs.com`.
- Redirect OAuth esperado: `https://tintinaccs.com/__/auth/handler`.
- El monitor horario debe seguir apuntando a `pages.dev` hasta terminar el corte.

## A. Preflight obligatorio antes del cambio de tráfico

### Traslado del DNS a Cloudflare

Cloudflare Pages exige que el dominio apex sea una zona de la misma cuenta de Cloudflare que el proyecto Pages y use nameservers de Cloudflare ([documentación oficial](https://developers.cloudflare.com/pages/configuration/custom-domains/)). Trasladar el DNS conservando los registros de Shopify no cambia la tienda que ven los clientes.

Estado verificado al 26/09/2026: nameservers `ns-cloud-d1.googledomains.com`, `ns-cloud-d2.googledomains.com`, `ns-cloud-d3.googledomains.com` y `ns-cloud-d4.googledomains.com`; registrador Tucows; estados `clientTransferProhibited` y `clientUpdateProhibited`; vencimiento `2027-02-24`. Esto es compatible con un dominio comprado en Shopify, pero debe confirmarse en la cuenta del dueño. Si Shopify no permite cambiar los nameservers, hay que transferir el dominio fuera de Shopify antes del traslado DNS.

Antes de cambiar los NS, guardar el export completo y replicar exactamente estos registros en la nueva zona de Cloudflare:

| Tipo | Nombre | Valor | Proxy / prioridad |
| --- | --- | --- | --- |
| A | `@` | `23.227.38.65` | DNS only |
| AAAA | `@` | `2620:127:f00f:5::` | DNS only |
| CNAME | `www` | `shops.myshopify.com` | DNS only |
| TXT | `resend._domainkey` | Copiar el valor exacto de Resend y contrastarlo con el export DNS; no inventarlo ni sustituirlo por este texto | No aplica |
| MX | `send` | `feedback-smtp.sa-east-1.amazonses.com` | Prioridad 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | No aplica |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | No aplica |

El apex no tiene MX. Conservar también cualquier registro adicional del export; la importación automática debe contrastarse con la zona original.

Orden operativo, a cargo del dueño:

1. Crear la zona de Cloudflare, replicar los registros y cambiar los NS. Con los registros web de Shopify intactos y en DNS only, este paso es invisible para los clientes.
2. Completar las autorizaciones de Firebase Authentication, OAuth, reCAPTCHA Enterprise/App Check y Search Console indicadas abajo.
3. Preparar y aprobar el commit exclusivo de cutover de C.
4. Con ese commit desplegado y verde, agregar `tintinaccs.com` como Custom Domain de Pages (D): **este es el cambio de tráfico**, no el traslado previo de NS.
5. Configurar `www` → apex mediante una Redirect Rule 301, conservando path y query. Activar el proxy de `www` al habilitar la regla para que Cloudflare pueda ejecutarla.

No cancelar Shopify hasta que el dominio esté fuera de Shopify y el sitio nuevo esté estable. Las verificaciones de navegador, TLS y SEO del dominio nuevo se completan después del cambio de tráfico, antes del anuncio.

### Cloudflare Pages

- [ ] Preparar el Custom Domain `tintinaccs.com`; agregarlo recién en D, después del commit de cutover.
- [ ] Decidir el host canónico: `tintinaccs.com`.
- [ ] Preparar la Redirect Rule 301 de `www.tintinaccs.com` al host canónico para activarla en D.
- [ ] Confirmar certificado TLS válido antes de anunciar la migración.
- [ ] Guardar captura/export de los registros DNS actuales antes de que Cloudflare modifique los registros web.

### DNS y correo — no borrar al migrar Shopify

Antes del cambio, exportar o capturar **todos** los registros actuales y clasificarlos en:

1. **Web Shopify**: A/AAAA/CNAME que sirven la tienda actual. Solo estos pueden reemplazarse durante el cutover.
2. **Correo**: MX. Se conservan intactos.
3. **SPF**: TXT que contiene `v=spf1`. Se conserva y solo se modifica si el proveedor de correo lo exige.
4. **DKIM**: CNAME/TXT de selectores DKIM. Se conservan intactos.
5. **DMARC**: TXT de `_dmarc`. Se conserva intacto.
6. **Verificaciones**: Google, Meta, proveedores y otros TXT/CNAME. Se conservan salvo que exista evidencia de que son exclusivamente de Shopify.

Regla: **no usar “reset DNS”, no borrar la zona completa y no recrear desde cero**. El rollback también modifica únicamente registros web.

### Firebase Authentication / Google OAuth

- [ ] Agregar `tintinaccs.com` a los dominios autorizados de Firebase Authentication.
- [ ] Agregar `www.tintinaccs.com` si el host responderá públicamente antes de redirigir.
- [ ] Registrar exactamente `https://tintinaccs.com/__/auth/handler` como redirect OAuth autorizado donde corresponda.
- [ ] No eliminar `tintinaccesorios.pages.dev` durante la transición; sigue siendo el origen técnico y de rollback.

El proxy `/__/auth/*` ya está versionado en `functions/__/auth/[[path]].js` y debe permanecer incluido en `_routes.json`.

### App Check / reCAPTCHA Enterprise

- [ ] Autorizar `tintinaccs.com` en la clave de sitio usada por App Check.
- [ ] Autorizar `www.tintinaccs.com` mientras exista como host público.
- [ ] Confirmar en navegador real que `window.TintinAppCheckStatus` termina en estado habilitado y que Firestore no responde bloqueado.

### SEO y Search Console

- [ ] Crear/verificar una propiedad de dominio para `tintinaccs.com` en Google Search Console; preferir verificación DNS porque cubre HTTPS y subdominios.
- [ ] Después del corte, enviar `https://tintinaccs.com/sitemap.xml`.
- [ ] Confirmar que canonical, Open Graph, Twitter y JSON-LD usan `https://tintinaccs.com`.
- [ ] Confirmar que `robots.txt` anuncia el sitemap del dominio definitivo.
- [ ] No mantener dos tiendas indexables con canonical diferentes.

## B. Migración de URLs antiguas de Shopify

Cloudflare Pages Functions conserva enlaces históricos sin una tabla manual de cientos de URLs:

- `/products/<handle>` → `301 /product?id=<id Firestore>`.
- `/collections/all` → `301 /catalogo`.
- `/collections/<handle>` → `301 /catalogo?cat=<handle>`.
- `/pages/contact` y aliases conocidos → su URL limpia equivalente.
- `/policies/privacy-policy` → `/privacidad`.
- `/policies/terms-of-service` → `/terminos`.
- `/policies/refund-policy` / `return-policy` → `/cambios-devoluciones`.
- `/policies/shipping-policy` → `/envios`.

Los productos se resuelven por ID/handle/slug Shopify y, como compatibilidad final, por slug del nombre. Una URL de producto que no tenga equivalente real devuelve 404; **no se redirige todo al Inicio**, para evitar soft-404 y asociaciones SEO falsas.

`scripts/auditar-shopify-redirects.mjs` prueba estas reglas sobre un origen indicado, pero ningún workflow lo ejecuta directamente como gate antes del merge. Lo invocan `auditar-cloudflare-entrega-real.mjs` y `auditar-cutover-live.mjs`. Ejecutarlo manualmente y adjuntar el resultado cuando haya un producto real cargado:

```sh
TINTIN_MIGRATION_ORIGIN=https://tintinaccs.com TINTIN_SHOPIFY_PRODUCT_CANARY=<handle-real-existente> node scripts/auditar-shopify-redirects.mjs
```

Para una comprobación previa, usar como origen el preview que se esté verificando. Con el catálogo vacío intencional, el canary por defecto `anillo-liso-dorado` devuelve 404 y el gate falla; no restaurar productos para forzarlo a pasar.

## C. Preparar el commit de cutover

Solo cuando el dueño confirme el traslado DNS y las autorizaciones de A; las comprobaciones del dominio servido por Pages quedan para D/E:

1. Cambiar en `config/public-site.json`:
   - `origin` → `https://tintinaccs.com`.
   - `firebaseAuthDomain` → `tintinaccs.com`.
   - Sumar `tintinaccs.com` y `www.tintinaccs.com` a `appCheckDomains`, conservando `tintinaccesorios.pages.dev`, `localhost` y `127.0.0.1`. Sin el dominio activo en esa lista falla el check «App Check incluye dominio activo» de `node scripts/auditar-preparacion-dominio.mjs`.
2. Mantener `cutover` como referencia del destino aprobado.
3. Ejecutar el build normal. `scripts/sincronizar-origen-publico.js` propaga la fuente única a canonical, OG, JSON-LD, robots, sitemaps, Firebase Auth, Functions y auditorías.
4. Regenerar CSP. `scripts/generar-csp-cloudflare.js` incorpora el origen público activo antes de calcular hashes.
5. No mezclar este commit con cambios visuales o comerciales no relacionados.

## D. Cambio de tráfico

1. Confirmar que el último commit de cutover está desplegado y verde en Cloudflare Pages.
2. Agregar `tintinaccs.com` como Custom Domain de Pages y reemplazar **solo** los registros DNS web de Shopify por los necesarios para Pages en la zona de Cloudflare. Activar la Redirect Rule 301 de `www` al apex, con proxy habilitado para `www`.
3. Confirmar que MX/SPF/DKIM/DMARC permanecieron iguales a la captura previa.
4. Esperar resolución DNS y certificado TLS válido observando el dominio definitivo, sin anunciar todavía.
5. Ejecutar la matriz de aceptación del punto E.
6. Solo si toda la matriz crítica está verde: anunciar la nueva web y enviar sitemap en Search Console.

## E. Matriz de aceptación del dominio definitivo

### Navegación / SEO

- [ ] Inicio, Catálogo, Colecciones, Producto, Nosotros, Contacto, Envíos, FAQ, Cambios, Términos y Privacidad responden 200 por HTTPS.
- [ ] No hay redirecciones internas `.html`.
- [ ] canonical/OG/Twitter/JSON-LD apuntan a `tintinaccs.com`.
- [ ] `robots.txt`, sitemap index, sitemap de productos y sitemap de colecciones responden correctamente.
- [ ] URL Shopify de producto canary redirige 301 a una ficha real.
- [ ] URLs Shopify de colección/página/policy redirigen 301 al equivalente.

### Cuenta / seguridad

- [ ] Registro con email.
- [ ] Login con email.
- [ ] Login con Google desde escritorio.
- [ ] Login con Google desde móvil real.
- [ ] Perfil y pedidos del usuario.
- [ ] App Check habilitado y Firestore operativo.
- [ ] CSP real del dominio definitivo coincide con la generada.

### Compra real — obligatorio antes del anuncio

Realizar **una compra controlada real**, con producto de prueba o importe/control operativo definido:

1. Abrir producto real.
2. Agregar al carrito.
3. Completar checkout.
4. Confirmar creación del pedido en Firestore.
5. Confirmar descuento de stock exactamente una vez.
6. Confirmar notificación al cliente.
7. Confirmar notificación en Admin.
8. Confirmar correo real de pedido.
9. Cambiar estado del pedido desde Admin.
10. Confirmar tracking/estado visible para cliente.
11. Si corresponde, cancelar/reponer stock siguiendo el flujo real y verificar que no haya doble compensación.

No reemplazar esta prueba con mocks. El pedido de prueba debe quedar claramente identificado para auditoría y luego gestionarse con el mismo flujo que un pedido real.

### Otros flujos

- [ ] Imágenes Cloudinary.
- [ ] Mapas/ubicación de checkout.
- [ ] Likes/favoritos.
- [ ] Reseñas.
- [ ] Notificaciones.
- [ ] Admin en desktop y móvil/tablet donde aplique.
- [ ] Envío de correo desde las funciones no destructivas que correspondan.

## F. Política de `tintinaccesorios.pages.dev` después del lanzamiento

Después de que `tintinaccs.com` esté estable:

- `tintinaccs.com` es el único dominio público/canónico.
- `pages.dev` se conserva como origen técnico y herramienta de diagnóstico/rollback.
- La navegación pública de `pages.dev` debe redirigirse al dominio oficial mediante una regla de host en Cloudflare, preservando path y query cuando exista equivalente.
- No redirigir ni romper endpoints técnicos que se necesiten explícitamente para diagnóstico hasta haber validado la regla.
- `pages.dev` no debe permanecer como segunda copia indexable de la tienda.
- El monitor cambia a `tintinaccs.com` **solo cuando la matriz E esté verde**; esto ocurre al cambiar `config.public-site.origin` en el commit de cutover.

La redirección por host se configura en Cloudflare después del corte, no antes, porque hoy `pages.dev` es justamente el entorno que se audita para aprobar la migración.

## G. Rollback preparado

Disparadores de rollback inmediato:

- Google login/registro roto.
- App Check bloqueando llamadas válidas.
- Checkout o creación de pedidos roto.
- Stock inconsistente.
- Correos críticos no salen.
- Error TLS/DNS generalizado.
- CSP bloquea el runtime comercial.

Procedimiento:

1. **No borrar datos ni “arreglar” pedidos manualmente durante el rollback.** Registrar qué pedidos entraron durante la ventana.
2. Con los NS ya en Cloudflare, restaurar **en el DNS de Cloudflare** solo los A/AAAA/CNAME web de Shopify de la captura previa (`A @ 23.227.38.65`, `AAAA @ 2620:127:f00f:5::`, `CNAME www shops.myshopify.com`, DNS only). No volver a cambiar los NS ni tocar MX/SPF/DKIM/DMARC.
3. Revertir el commit de `config/public-site.json` a `https://tintinaccesorios.pages.dev` y desplegar nuevamente el origen técnico si fue necesario.
4. Verificar Shopify/origen anterior antes de redirigir tráfico de vuelta.
5. Mantener el nuevo deployment de Cloudflare accesible por su preview/pages.dev para diagnosticar sin afectar clientes.
6. Revisar pedidos/stock creados durante la ventana y reconciliarlos antes de un segundo intento.
7. Repetir completamente A–E; no retomar desde el paso que falló.

## H. Evidencia mínima del corte

Guardar en el issue/PR de lanzamiento:

- SHA del commit desplegado.
- Captura/export DNS antes y después.
- Resultado del gate Cloudflare.
- Resultado de `/api/health`.
- Pedido de prueba identificado y sus verificaciones de stock/notificaciones/correo.
- Resultado de login Google/App Check.
- Resultado de redirects Shopify canary.
- Confirmación de MX/SPF/DKIM/DMARC.
- URL de propiedad/sitemap enviado en Search Console o registro de la acción.
- Decisión final: lanzamiento aprobado o rollback ejecutado.
