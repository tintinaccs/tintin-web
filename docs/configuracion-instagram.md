# Instagram de Tintin

Inicio consulta `/api/instagram-feed` al acercarse a la sección y actualiza cada minuto mientras está visible. El servidor devuelve las últimas 12 publicaciones (fotos, carruseles y videos, de más reciente a más antigua) tomadas del conjunto reciente de 24; caché compartida de hasta dos minutos. No requiere volver a publicar el sitio por cada publicación. No se presenta como un stream instantáneo ni conserva una lista manual como sustituto del feed.

- Foto y carrusel: la miniatura es `media_url` y la tarjeta abre la publicación en Instagram en una pestaña nueva (`rel="noopener noreferrer"`).
- Video: la miniatura es `thumbnail_url` (nunca el archivo de video) y la tarjeta abre el reproductor en un diálogo con el embed oficial `/embed/`.
- Las miniaturas sólo se aceptan si son `https` y de `cdninstagram.com`, `fbcdn.net` o `instagram.com`; el enlace sólo si es una publicación `https://www.instagram.com/p/…` o `/reel/…`. Sin miniatura válida la tarjeta conserva su fondo de marca y su texto.
- Si el feed no está disponible (sin conexión de cuenta, error de Instagram, tiempo agotado o respuesta inválida) y no hay tarjetas en pantalla, Inicio muestra un mensaje y el botón “Ir a Instagram”. Si ya había tarjetas, se conservan.
- Un fallo de Instagram se registra sólo como estado HTTP o tipo de error (`instagram-feed: …`); el token y el cuerpo de la respuesta nunca se registran ni se devuelven.

La cuenta profesional `@tintinaccs` se conecta mediante la **API de Instagram con inicio de sesión unificado** (la única configuración disponible en las apps nuevas de Meta; la de "inicio de sesión de Instagram" no se ofrece en apps recientes). Requiere una app de Meta con el caso de uso "Administrar mensajes y contenido en Instagram" conectada a un portfolio comercial, y una configuración de inicio de sesión con el permiso de lectura `instagram_basic`. Referencia: <https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started>.

El servidor lee `GET https://graph.facebook.com/v27.0/<ID de la cuenta>/media` con el token en el encabezado `Authorization`. Configurar en los secretos del entorno **Production** de Cloudflare Pages (los cambios se aplican en la siguiente implementación):

- `INSTAGRAM_USER_ID`: ID numérico de la cuenta profesional de Instagram (el que muestra el panel de la app en "Generar tokens de acceso").
- `INSTAGRAM_ACCESS_TOKEN`: token de la app, sólo como secreto de servidor. No pegarlo en el chat, JavaScript, Git ni contenido público.
- `INSTAGRAM_GRAPH_VERSION`: opcional; versión de Graph, predeterminada `v27.0`.

## Token

El token de esta configuración es un token de usuario del sistema de la integración comercial. Su caducidad se define en la configuración de inicio de sesión (la predeterminada indica "Nunca"); `refresh_access_token` y la renovación a 60 días pertenecen a la API anterior y **no aplican aquí**. Si el token caduca, se revoca o la cuenta se mueve a otro portfolio, el feed deja de cargar y el endpoint registra `instagram-feed: Instagram respondió con estado 400/401/403` (nunca el token ni el cuerpo de la respuesta). Para generar otro: panel de la app de Meta, Casos de uso, Personalizar, "API setup with Unified login", sección "2. Generar tokens de acceso", "Generar token" (se muestra una sola vez), y reemplazar el secreto `INSTAGRAM_ACCESS_TOKEN` en Cloudflare Pages y volver a desplegar. Si el token de prueba generado en el panel tuviera vencimiento, se verá en el panel y se repite el mismo procedimiento. La vigencia y autorización de una cuenta real requieren comprobación al conectar el servicio. El endpoint nunca devuelve el token ni errores privados de Meta. Sin conexión, Inicio muestra el mensaje de respaldo con el botón "Ir a Instagram"; no inventa publicaciones ni dice que está actualizado. No se añaden dependencias de scraping.

Quiénes somos usa el reel fijo `https://www.instagram.com/reel/DekE_RMBPjv/`, transcrito del enlace de la captura del titular. Al pulsarlo, se carga el reproductor oficial en un diálogo; Escape, botón de cerrar y clic fuera lo cierran y descargan el iframe. El enlace “Ir a Instagram” permanece disponible. La reproducción automática y la disponibilidad del embed dependen de Instagram, del navegador y de las opciones de la publicación. El reproductor externo sólo se carga al pulsar un video; el feed puede cargar miniaturas públicas desde el CDN de Instagram.

Referencias de plataforma: <https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login> y <https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media>.
