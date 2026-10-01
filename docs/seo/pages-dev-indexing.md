# Política de indexación del host técnico de Pages

`*.pages.dev` se usa como origen técnico y para previews. Sus respuestas públicas incluyen `X-Robots-Tag: noindex` para que los buscadores no lo mantengan como versión indexada de la tienda. La ruta `/__/auth/*` conserva el proxy transparente de Firebase y permanece bloqueada en `robots.txt`. El `robots.txt` de Pages.dev sigue permitiendo el rastreo de páginas públicas para que Google pueda leer el `noindex`, conserva los bloqueos de rutas privadas y omite el sitemap del host técnico.

`/robots.txt` debe aparecer en `include` de `_routes.json`; de lo contrario Pages lo entrega como asset estático y no ejecuta el middleware que adapta el cuerpo y los encabezados por hostname.

Los dominios comerciales no reciben esta cabecera ni la reescritura de `robots.txt`. Al completar el cutover, la configuración pública central debe apuntar los canonicals y el sitemap al dominio comercial; el dominio conectado a Pages queda entonces indexable.

## Verificación

- `node --test tests/seo/pages-dev-indexing-middleware.test.mjs` valida `pages.dev`, un alias de preview, el dominio comercial, `robots.txt`, el paso transparente de Firebase Auth y solicitudes `HEAD`.
- `npm run audit:phase11` valida los canonicals, sitemap y reglas estáticas de rutas privadas.
- Después del despliegue, confirmar en HTTP que páginas y recursos de `*.pages.dev` reciben `X-Robots-Tag: noindex`, que el `robots.txt` de ese host no anuncia sitemap y que el dominio comercial no recibe `noindex`. Usar Search Console URL Inspection para comprobar lo que Googlebot recibió.

La política de código no equivale a una solicitud de retirada instantánea en Google: el buscador debe volver a rastrear las URLs. El host técnico permanece accesible para pruebas manuales.
