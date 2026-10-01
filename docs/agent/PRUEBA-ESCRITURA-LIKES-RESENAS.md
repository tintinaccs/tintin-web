# Prueba de escritura real: Likes y Reseñas (PREPARADA, NO EJECUTADA)

Estado: **no ejecutada**. Hoy el panel Flujo/Conexiones solo prueba *lectura* (`GET /api/engagement`), por eso Likes y Comentarios salen amarillos. Esta prueba demuestra la *escritura* de extremo a extremo. No se ejecuta sin autorización del dueño: crea datos reales en producción.

## Efectos reales (qué se escribe)
- `toggleFavorite` / like: documento de like en Firestore + estadística pública + evento a Google Sheets (`syncEngagementToSheets`).
- `createReview`: reseña en Firestore + recálculo de `reviewStats` + evento a Sheets.
- No envía correos ni toca pedidos, pagos ni stock.

## Prerrequisitos
1. Un producto real **existente y activo**. A 2026-09-29 el catálogo público estaba vacío (`count: 0`); sin producto no hay prueba posible. Confirmar con `GET /api/public-catalog?resource=products`.
2. Una cuenta de prueba dedicada (no la del dueño ni la de un cliente), con perfil completo, sesión iniciada en el sitio (App Check activo).
3. Una sesión de superadmin para la limpieza.

## Pasos (en el sitio, con la cuenta de prueba)
1. Anotar antes: `GET /api/engagement?action=productLikes&productId=<ID>` y `...action=reviewStats&productId=<ID>`.
2. Dar like (corazón) al producto. Esperado: la UI marca el like; `productLikes` sube en 1; `ownFavorite` devuelve el favorito; en Admin → Me gusta aparece el registro.
3. Dejar una reseña con texto que empiece por `PRUEBA QA ·`. Esperado: `reviewStats` refleja +1; la reseña aparece en la ficha y en Admin → Reseñas.
4. Confirmar en Google Sheets (pestaña de Likes/Reseñas) que llegó el evento de sincronización.

## Limpieza (superadmin)
- Quitar el like: volver a pulsar el corazón con la misma cuenta (alterna), o `likeDelete` en `/api/admin-engagement`.
- Borrar la reseña: `reviewPurge` en `/api/admin-engagement` (Admin → Reseñas).
- Volver a leer `productLikes` y `reviewStats` y comprobar que regresaron a los valores del paso 1.
- Borrar las filas de prueba en Sheets si quedaron.

## Cómo registrar el resultado (solo con evidencia real)
Si los pasos 2-4 y la limpieza se cumplieron, anotar fecha, producto, cuenta usada y resultados en `docs/agent/CURRENT_STATE.md`. Solo entonces cambiar `likes` y `comentarios` en `js/admin/flujo-conexiones/datos-flujo-conexiones.js` (la nota actual dice "sin verificación específica separada"), y decidir si la prueba en vivo del panel debe seguir mostrando amarillo (`partial: true` en `live-checks.js`) porque su sonda sigue siendo solo de lectura. No cambiar colores sin esa evidencia.

## Fuera de alcance de esta prueba
Servicios externos (rojo): no depende de esto; exige PayPal en Live y Resend/Cloudinary respondiendo en `GET /api/system-health`.
