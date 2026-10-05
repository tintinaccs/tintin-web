# Tintin — arquitectura de comentarios y notificaciones

Fecha: 2026-09-17
Fuente de verdad: `reviewRecords/{reviewId}` para el comentario raíz y su hilo vigente; `likeRecords/{likeId}` para likes; `commentReports/{reportId}` para denuncias; `adminNotifications/{notificationId}` y `users/{uid}/notifications/{notificationId}` para notificaciones persistidas.

## 1. Entidad y proyecciones

Una publicación raíz existente es también un comentario: `entityType: comment`, `commentId === reviewId` y `threadRootId === commentId`. El mismo ID se conserva en `reviewRecords`, en la proyección pública `products/{productId}/reviews/{commentId}` y en la vista privada de la autora. La proyección pública sólo contiene nombre anonimizado, avatar seguro, texto y métricas; correo, UID real e historial interno quedan en la fuente privada.

Las respuestas del formato histórico se mantienen dentro de `conversation[]` para no romper datos ya publicados. Cada respuesta nueva porta `replyId`, `parentCommentId`, `threadRootId` y `replyToUserId`; por tanto el ID y el vínculo semántico son estables en ficha de producto, notificación y moderación. El límite de 80 mensajes evita listeners y documentos ilimitados.

Los likes se identifican por hash estable de usuario y objetivo (`review_like`, `reply_like` o `favorite`). El servidor comprueba existencia y usa precondiciones de Firestore al actualizar el contador y el mapping privado; un reintento devuelve `alreadyLiked` y no duplica el like.

## 2. Denuncias

`commentReports/{reportId}` usa `SHA-256(comment-report:${reporterUid}:${commentId})`, por lo que una cuenta sólo puede crear una denuncia para un comentario/respuesta. Campos:

`reportId`, `commentId`, `productId`, `threadRootId`, `targetType`, `reporterUid`, `reportedAuthorUid`, `reportedAuthorName`, `reason`, `details`, `commentText`, `status`, `createdAt`, `updatedAt`.

Motivos permitidos: `spam`, `offensive`, `harassment`, `inappropriate`, `misleading`, `other`. Estados: `OPEN`, `REVIEWING`, `RESOLVED`, `DISMISSED`. Denunciar no borra ni oculta automáticamente. El texto se normaliza y se escapa en las dos superficies; el sitio público nunca recibe `reporterUid`.

## 3. Permisos y seguridad

- Clientes autenticados crean likes, respuestas y denuncias únicamente mediante `/api/engagement` con ID token verificado.
- Super Admin usa `/api/admin-engagement` para moderación y lectura de denuncias.
- Las reglas de Firestore mantienen las colecciones privadas y administrativas no escribibles desde el SDK; `commentReports` sólo es legible por Super Admin.
- Se conserva App Check, validación de origen, límites de cuerpo, UID estable, control de cuenta bloqueada y sanitización XSS.
- Los handlers no cambian stock, precio, checkout, Auth ni el flujo de login.

## 4. Eventos y routing

El router vigente en `cloudflare/notificaciones-sociales.js` conserva `kind` por compatibilidad y añade `eventType` con esta taxonomía canónica:

`USER_REGISTERED`, `USER_LOGIN`, `ORDER_CREATED`, `PRODUCT_LIKED`, `COMMENT_CREATED`, `COMMENT_REPLIED`, `COMMENT_LIKED`, `COMMENT_REPORTED`, `REVIEW_CREATED`.

Cada escritura lleva `eventId`, `dedupeKey` e `idempotencyKey`. El documento de notificación se persiste antes del push. El push sólo se dirige a dispositivos autorizados de Super Admin; un fallo de push no elimina la campana web.

Routing:

- Super Admin recibe eventos relevantes en `adminNotifications` y push administrativo.
- La autora recibe aviso web por respuesta o like de otra cuenta; los participantes anteriores reciben aviso por una respuesta nueva.
- El actor nunca recibe su propia notificación; likes a producto no generan push global a clientes.
- `USER_LOGIN` sólo se registra desde un ID token con `auth_time` reciente; refresh/restauración no inventa un login.
- `ORDER_CREATED` sigue dependiendo de la confirmación existente del pedido; este cambio no mueve la autoridad de pedidos.

## 5. UI y rendimiento

La ficha mantiene su listener público acotado a 100 reseñas y carga más bajo demanda. La comunidad se crea después del shell del producto y no bloquea el LCP #831. Las respuestas se muestran como un nivel visual indentado, con avatar, autor, timestamp, texto, like y menú de denuncia. Los textos se escapan y los enlaces no aceptan destinos arbitrarios.

Super Admin conserva la bandeja de reseñas y suma “Denunciadas”, con búsqueda, filtro por estado, paginación de 20, contexto del hilo y decisión explícita. Una decisión sólo actualiza el reporte; la moderación del comentario continúa usando el handler administrativo existente.

## 6. Pruebas y gates

- Unitarias: dedupe, motivos/estados, actor exclusion, taxonomía e idempotencia.
- Contrato de API: reportar raíz/respuesta, self-report rechazado, repetir denuncia, respuesta con metadatos de hilo.
- Browser: formulario de comentario, like/reply/report con login, menú accesible, navegación de vuelta y responsive.
- Regresión: `test:engagement`, `test:web-push`, `audit:architecture-contracts`, `audit:admin-foundation`, `audit:cache-versioning`, build y `audit:final`.

No se activa una migración masiva ni se ejecuta escritura comercial. Los registros históricos se preservan y se enriquecen sólo cuando pasan por el flujo ya existente.
