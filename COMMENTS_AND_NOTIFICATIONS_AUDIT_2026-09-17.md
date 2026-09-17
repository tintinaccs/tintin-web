# Auditoría previa — comentarios, likes, denuncias y notificaciones

Fecha: 2026-09-17
Base auditada: `main` / `006395216f2f8fd72f88c17adec789569035e293`
Rama de trabajo: `comments-reports-notifications-20260917`

## Inventario vigente

| Área | Fuente/ruta vigente | Hallazgo |
| --- | --- | --- |
| Reseña raíz | `reviewRecords/{reviewId}` | Fuente privada escrita exclusivamente por Pages Functions; contiene identidad privada, estado de moderación, métricas y `conversation`. |
| Proyección pública | `products/{productId}/reviews/{reviewId}` | Proyección anonimizada leída por la ficha de producto; mantiene el mismo `reviewId`. |
| Proyección de autora | `users/{uid}/reviews/{reviewId}` | Vista privada de la cuenta; no es autoridad de publicación. |
| Respuestas | `reviewRecords.conversation[]` | Respuestas embebidas, limitadas a 80; no tienen colección/ID de entidad independiente aunque sí `replyId`. |
| Likes | `likeRecords/{likeId}` + contador en raíz/proyección | Idempotencia por hash de `uid + target`; escritura transaccional con precondiciones y mapping por producto. |
| Notificaciones | `adminNotifications/{id}` y `users/{uid}/notifications/{id}` | Router existente, dedupe por hash, persistencia antes del push; el push es secundario. |
| Push | `adminPushDevices` / `pushEvents` | Restringido a dispositivos administrativos; reutilizable. |
| Moderación | `participacion-admin.js` y módulo admin de participación | Edición/visibilidad/archivo/borrado suave de reseñas; no hay denuncias ni bandeja agrupada. |
| Realtime | Listeners limitados en ficha de producto y Super Admin | La ficha escucha hasta 100 reseñas; el admin escucha hasta 500 registros en memoria y pagina localmente. |

## Riesgos y brechas frente al brief

1. No existe un modelo de denuncia con deduplicación por `reporterUid + commentId`, estados de revisión ni acciones administrativas.
2. La taxonomía de eventos está implícita en varios handlers (`review_created`, `review_reply`, `review_like`, etc.) y no hay un contrato único que incluya comentarios/denuncias ni exclusión centralizada del actor.
3. La respuesta cliente sólo permite agregar mensajes al `conversation` de una reseña. Hay `replyId`, pero faltan explícitamente `parentCommentId`, `threadRootId` y `replyToUserId` en el contrato público.
4. La UI de producto presenta la conversación completa de cada reseña y sólo una acción de like; requiere carga diferida de respuestas, estado idempotente y menú de denuncia sin bloquear LCP.
5. El módulo administrativo no tiene vista “Todos/Denunciados”, agrupación por denuncia, búsqueda/filtros/paginación de denuncias ni acción de resolución.
6. Las reglas dejan las escrituras sociales del cliente y admin en servidor, lo cual debe conservarse; no se deben habilitar escrituras directas para corregir la brecha.

## Decisiones de consolidación

- Se conserva `reviewRecords` como autoridad vigente de publicaciones raíz para no romper reseñas, estadísticas ni proyecciones existentes.
- Las nuevas capacidades se agregan al mismo flujo Pages Functions y a las mismas proyecciones; no se crea un segundo router de notificaciones ni un segundo sistema de likes.
- Las denuncias tendrán una colección administrativa separada porque contienen identidad del denunciante y nunca pueden ser una proyección pública del comentario.
- El push seguirá siendo best-effort y posterior a la persistencia de la notificación web.
- No se modifica Auth, App Check, reglas de checkout/stock/precio, ni el camino de carga del producto antes de que exista intención de abrir la comunidad.

## Baseline reproducible antes de cambios funcionales

- Git: rama creada desde `main` limpio en `006395216f2f8fd72f88c17adec789569035e293`.
- Scripts disponibles: `test:engagement`, `test:web-push`, `audit:architecture-contracts`, `audit:admin-foundation`, `audit:cache-versioning`, `test:performance`.
- Métricas de producto: se medirá antes/después con los mismos escenarios y viewport; no se declara mejora sin ejecución comparable.
