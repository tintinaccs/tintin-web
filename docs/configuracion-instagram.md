# Instagram de Tintin

Inicio consulta `/api/instagram-feed` al acercarse a la sección y actualiza cada minuto mientras está visible. El servidor devuelve las últimas 12 publicaciones (fotos, carruseles y videos, de más reciente a más antigua) tomadas del conjunto reciente de 24; caché compartida de hasta dos minutos. No requiere volver a publicar el sitio por cada publicación. No se presenta como un stream instantáneo ni conserva una lista manual como sustituto del feed.

- Foto y carrusel: la miniatura es `media_url` y la tarjeta abre la publicación en Instagram en una pestaña nueva (`rel="noopener noreferrer"`).
- Video: la miniatura es `thumbnail_url` (nunca el archivo de video) y la tarjeta abre el reproductor en un diálogo con el embed oficial `/embed/`.
- Las miniaturas sólo se aceptan si son `https` y de `cdninstagram.com`, `fbcdn.net` o `instagram.com`; el enlace sólo si es una publicación `https://www.instagram.com/p/…` o `/reel/…`. Sin miniatura válida la tarjeta conserva su fondo de marca y su texto.
- Si el feed no está disponible (sin conexión de cuenta, error de Instagram, tiempo agotado o respuesta inválida) y no hay tarjetas en pantalla, Inicio muestra un mensaje y el botón “Ir a Instagram”. Si ya había tarjetas, se conservan.
- Un fallo de Instagram se registra sólo como estado HTTP o tipo de error (`instagram-feed: …`); el token y el cuerpo de la respuesta nunca se registran ni se devuelven.

La cuenta profesional `@tintinaccs` debe conectarse mediante **Instagram API con Instagram Login**, con una aplicación de Meta autorizada y permiso de lectura `instagram_business_basic`. Configurar en los secretos/variables del entorno de Cloudflare Pages:

- `INSTAGRAM_USER_ID`: identificador de la cuenta profesional conectada.
- `INSTAGRAM_ACCESS_TOKEN`: token de larga duración, sólo como secreto de servidor. No pegarlo en el chat, JavaScript, Git ni contenido público.
- `INSTAGRAM_GRAPH_VERSION`: versión compatible de Graph; predeterminada `v24.0`.

## Renovación del token (manual, cada 30–45 días)

Un token de larga duración de Instagram vale 60 días y se renueva con `refresh_access_token` (documentación oficial de Meta: <https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token>). Requisitos: tener al menos 24 horas, no haber expirado y conservar el permiso `instagram_business_basic`. Un token expirado ya no se puede renovar: hay que repetir el inicio de sesión de Instagram y generar uno nuevo. Cada renovación devuelve el mismo token con 60 días más de vigencia (`expires_in`, en segundos).

**Decisión: renovación manual documentada, no automática.** Una renovación automática desde la Function obligaría a guardar el token nuevo en un lugar escribible: los secretos de Pages no se pueden modificar en tiempo de ejecución, así que haría falta un almacén nuevo (KV/D1) o un token de API de Cloudflare con permiso para cambiar secretos. Ambos agregan un servicio o un privilegio sensible que este sitio no tiene hoy, para ahorrar una tarea de un minuto cada mes y medio. Se prefiere el cambio mínimo y seguro.

Pasos (en su propio terminal; no pegar el token en el chat, Git ni capturas):

1. Con el token vigente en la variable de entorno `IG_TOKEN`, ejecutar `curl -s "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=$IG_TOKEN"`.
2. Copiar el `access_token` de la respuesta y reemplazar el secreto `INSTAGRAM_ACCESS_TOKEN` en Cloudflare Pages (Settings → Variables and Secrets, entorno Production). En Cloudflare Pages los cambios de variables o secretos se aplican a partir del siguiente despliegue: hay que volver a desplegar (o reintentar el último despliegue) para que el token nuevo se use.
3. Repetir antes de 60 días. Si el feed muestra el mensaje de respaldo con el sitio sano, revisar primero los registros de la Function (`instagram-feed: Instagram respondió con estado 401`/`400` indica token expirado o revocado).

El token necesita renovación y puede revocarse desde Meta. La vigencia y autorización de una cuenta real requieren comprobación al conectar el servicio. El endpoint nunca devuelve el token ni errores privados de Meta. Sin conexión, Inicio muestra el perfil con su enlace; no inventa publicaciones ni dice que está actualizado. No se añaden dependencias de scraping.

Quiénes somos usa el reel fijo `https://www.instagram.com/reel/DekE_RMBPjv/`, transcrito del enlace de la captura del titular. Al pulsarlo, se carga el reproductor oficial en un diálogo; Escape, botón de cerrar y clic fuera lo cierran y descargan el iframe. El enlace “Ir a Instagram” permanece disponible. La reproducción automática y la disponibilidad del embed dependen de Instagram, del navegador y de las opciones de la publicación. El reproductor externo sólo se carga al pulsar un video; el feed puede cargar miniaturas públicas desde el CDN de Instagram.

Referencias de plataforma: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/> y <https://help.instagram.com/620154495870484>.
