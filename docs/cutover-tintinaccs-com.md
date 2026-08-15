# Cutover Shopify → nueva Tintin (`tintinaccs.com`)

Este procedimiento es el único orden aprobado para mover la tienda desde Shopify a Cloudflare Pages. **No se cambia solamente DNS.** El dominio se anuncia como migrado únicamente cuando infraestructura, autenticación, App Check, SEO, correo y compra real pasaron sus verificaciones.

## Estado previo

- Origen activo de desarrollo/producción técnica: `https://tintinaccesorios.pages.dev`.
- Dominio comercial actual: `https://tintinaccs.com` en Shopify hasta el corte.
- Fuente de verdad del dominio en código: `config/public-site.json`.
- Destino declarado en `config.public-site.cutover`: `https://tintinaccs.com`.
- Redirect OAuth esperado: `https://tintinaccs.com/__/auth/handler`.
- El monitor horario debe seguir apuntando a `pages.dev` hasta terminar el corte.

## A. Preflight obligatorio antes de tocar DNS

### Cloudflare Pages

- [ ] Agregar `tintinaccs.com` como Custom Domain del proyecto Pages.
- [ ] Decidir el host canónico: `tintinaccs.com`.
- [ ] Agregar `www.tintinaccs.com` y redirigirlo de forma permanente al host canónico.
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

El gate `scripts/auditar-shopify-redirects.mjs` prueba estas reglas sobre el preview real de Cloudflare antes de permitir el merge.

## C. Preparar el commit de cutover

Solo después de completar A:

1. Cambiar en `config/public-site.json`:
   - `origin` → `https://tintinaccs.com`.
   - `firebaseAuthDomain` → `tintinaccs.com`.
2. Mantener `cutover` como referencia del destino aprobado.
3. Ejecutar el build normal. `scripts/sincronizar-origen-publico.js` propaga la fuente única a canonical, OG, JSON-LD, robots, sitemaps, Firebase Auth, Functions y auditorías.
4. Regenerar CSP. `scripts/generar-csp-cloudflare.js` incorpora el origen público activo antes de calcular hashes.
5. No mezclar este commit con cambios visuales o comerciales no relacionados.

## D. Cambio de tráfico

1. Confirmar que el último commit de cutover está desplegado y verde en Cloudflare Pages.
2. Reemplazar **solo** los registros DNS web de Shopify por los necesarios para Cloudflare Pages.
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
2. Restaurar únicamente los registros DNS web a la captura previa de Shopify. No tocar MX/SPF/DKIM/DMARC.
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
