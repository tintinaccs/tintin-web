# Instagram de Tintin

Inicio consulta `/api/instagram-feed` al acercarse a la sección y actualiza cada minuto mientras está visible. El servidor sirve los últimos ocho videos del conjunto reciente de 50 publicaciones; caché compartida de hasta dos minutos. No requiere volver a publicar el sitio por cada reel. No se presenta como un stream instantáneo ni conserva una lista manual como sustituto del feed.

La cuenta profesional `@tintinaccs` debe conectarse mediante **Instagram API con Instagram Login**, con una aplicación de Meta autorizada y permiso de lectura `instagram_business_basic`. Configurar en los secretos/variables del entorno de Cloudflare Pages:

- `INSTAGRAM_USER_ID`: identificador de la cuenta profesional conectada.
- `INSTAGRAM_ACCESS_TOKEN`: token de larga duración, sólo como secreto de servidor. No pegarlo en el chat, JavaScript, Git ni contenido público.
- `INSTAGRAM_GRAPH_VERSION`: versión compatible de Graph; predeterminada `v24.0`.

El token necesita renovación y puede revocarse desde Meta. La vigencia y autorización de una cuenta real requieren comprobación al conectar el servicio. El endpoint nunca devuelve el token ni errores privados de Meta. Sin conexión, Inicio muestra el perfil con su enlace; no inventa publicaciones ni dice que está actualizado. No se añaden dependencias de scraping.

Quiénes somos usa el reel fijo `https://www.instagram.com/reel/DekE_RMBPjv/`, transcrito del enlace de la captura del titular. Al pulsarlo, se carga el reproductor oficial en un diálogo; Escape, botón de cerrar y clic fuera lo cierran y descargan el iframe. El enlace “Ir a Instagram” permanece disponible. La reproducción automática y la disponibilidad del embed dependen de Instagram, del navegador y de las opciones de la publicación. El reproductor externo sólo se carga al pulsar un video; el feed puede cargar miniaturas públicas desde el CDN de Instagram.

Referencias de plataforma: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/> y <https://help.instagram.com/620154495870484>.
