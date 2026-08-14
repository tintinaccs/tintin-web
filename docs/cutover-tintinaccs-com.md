# Cutover de `tintinaccs.com` hacia la nueva Tintin

## Estado actual

- Desarrollo y producción técnica nueva: `https://tintinaccesorios.pages.dev`.
- Dominio comercial actual: `https://tintinaccs.com`, todavía atendido por Shopify.
- No deben apuntar al mismo sitio hasta completar esta lista.
- La fuente versionada de orígenes es `config/origenes-tintin.json`.

## Regla de cambio

No cambiar DNS primero. El orden correcto es preparar proveedores, validar la web nueva y hacer el corte al final.

## Preflight obligatorio

### Cloudflare

- [ ] Agregar `tintinaccs.com` y `www.tintinaccs.com` como custom domains del proyecto Pages.
- [ ] Confirmar certificado TLS activo antes de mover tráfico.
- [ ] Confirmar que Pages Functions funcionan desde el dominio custom.
- [ ] Mantener `tintinaccesorios.pages.dev` disponible como origen técnico/rollback.

### Firebase Authentication / Google OAuth

- [ ] Agregar `tintinaccs.com` a dominios autorizados de Firebase Authentication.
- [ ] Agregar la URI `https://tintinaccs.com/__/auth/handler` al cliente OAuth web.
- [ ] Probar Google sign-in y retorno a la misma pestaña.
- [ ] Solo después cambiar `authDomain` en `config/origenes-tintin.json`.

### Firebase App Check / reCAPTCHA Enterprise

- [ ] Autorizar `tintinaccs.com` en la clave/sitios admitidos.
- [ ] Probar token App Check desde el dominio custom.
- [ ] Confirmar que Firestore no rechaza tráfico legítimo del dominio nuevo.

### DNS y correo

- [ ] Exportar/capturar el DNS actual antes de tocarlo.
- [ ] Identificar qué registros pertenecen a Shopify y cuáles a correo/servicios.
- [ ] Preservar MX, SPF, DKIM y DMARC.
- [ ] Preservar cualquier TXT de verificación todavía necesario.
- [ ] Confirmar renovación automática y contacto del registrador.

### SEO

- [ ] Inventariar URLs públicas de Shopify que tengan tráfico o enlaces externos.
- [ ] Crear tabla de 301 Shopify → nueva Tintin para cada URL relevante.
- [ ] Cambiar `publicOrigin` a `https://tintinaccs.com`.
- [ ] Ejecutar `npm run sync:public-origin`.
- [ ] Ejecutar `npm run build:pages`.
- [ ] Confirmar canonical, Open Graph, JSON-LD, robots y ambos sitemaps.
- [ ] Verificar propiedad de dominio en Google Search Console.
- [ ] Enviar `https://tintinaccs.com/sitemap.xml` y `https://tintinaccs.com/sitemap-products.xml`.

## Matriz comercial antes del anuncio

- [ ] Inicio, catálogo, colecciones y producto en desktop, tablet y móvil real.
- [ ] Registro por correo.
- [ ] Login por correo.
- [ ] Login con Google.
- [ ] Recuperación/sesión vencida.
- [ ] Favoritos.
- [ ] Reseñas, likes, respuestas y notificaciones.
- [ ] Carrito anónimo.
- [ ] Carrito con sesión.
- [ ] Variantes y stock.
- [ ] Checkout Central.
- [ ] Checkout interior/encomienda.
- [ ] Pedido real controlado.
- [ ] Descuento real de stock.
- [ ] Pedido visible en Perfil y Admin.
- [ ] Cambio de estado de pedido.
- [ ] Notificación al cliente.
- [ ] Correo real de pedido recibido.
- [ ] Cloudinary: imágenes cargan y administración puede subir/borrar una prueba controlada.
- [ ] `/api/health` responde `ok:true`.
- [ ] `/api/public-catalog?resource=collections` responde.
- [ ] `sitemap-products.xml` contiene productos reales.
- [ ] Un producto compartido por WhatsApp/Facebook obtiene nombre, imagen y canonical específicos desde el edge.

## Corte

1. Reducir TTL DNS con anticipación si el proveedor lo permite.
2. Hacer una última copia de configuración Shopify y DNS.
3. Confirmar CI verde en el commit exacto que se va a publicar.
4. Cambiar el custom domain/DNS hacia Cloudflare Pages.
5. Esperar certificado/propagación y probar HTTPS.
6. Cambiar `publicOrigin` y `authDomain` únicamente cuando Firebase/OAuth/App Check ya estén preparados.
7. Publicar el commit de cutover.
8. Ejecutar manualmente `Fase 11 — SEO, publicación y producción`.
9. Ejecutar pedido real controlado.
10. Revisar Search Console, logs y correo.

## Rollback

Si fallan autenticación, App Check, checkout, pedidos o DNS:

1. No seguir anunciando el dominio nuevo.
2. Volver el DNS al destino anterior conservando todos los registros de correo.
3. Restaurar `publicOrigin`/`authDomain` al valor anterior si ya fueron cambiados.
4. Desplegar el último commit estable.
5. Confirmar nuevamente login, catálogo y checkout.
6. Registrar la causa antes de intentar otro corte.

## Después del lanzamiento

- Mantener `pages.dev` como origen técnico, pero evitar dos copias indexables de la tienda.
- Si Cloudflare lo permite sin afectar Functions/Auth, redirigir navegación pública de `pages.dev` al dominio oficial.
- Cambiar el monitor horario para usar `tintinaccs.com` como origen por defecto.
- Mantener una prueba de rollback trimestral junto con la prueba de recuperación.
