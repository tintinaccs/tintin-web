# Despliegue de resenas y Me gusta

La aplicacion ya guarda la fuente de verdad en Firestore. Para activar la copia bidireccional en Google Sheets faltan estos pasos externos, que requieren acceso a las cuentas de Cloudflare y Google de Tintin.

1. Crear un secreto aleatorio largo y guardarlo en Cloudflare Pages como `SHEETS_ENGAGEMENT_SECRET`.
2. Agregar `apps-script/Participacion.gs` al proyecto de Apps Script que usa la tienda.
3. En Propiedades del script, crear `SHEETS_ENGAGEMENT_SECRET` con exactamente el mismo valor, `FIREBASE_WEB_API_KEY`, `TINTIN_STORE_URL` con la URL publica y `SUPER_ADMIN_EMAIL=tintinaccs@gmail.com`.
4. En el `doPost(e)` existente, despues de leer el JSON en `payload`, agregar:

```javascript
if (payload.action === 'syncEngagement') return tintinHandleEngagement_(payload);
```

5. Ejecutar una vez `tintinSetupEngagement()` como propietaria de la hoja y aceptar los permisos. Esto crea las pestanas `Resenas` y `Me gusta`, el selector de acciones, el disparador de edicion y el resumen diario.
6. Volver a desplegar la aplicacion web de Apps Script conservando la misma URL `/exec` usada por la tienda y desplegar Cloudflare Pages.

Firestore mantiene el dato operativo. Sheets recibe una copia inmediata; los cambios permitidos en puntuacion, comentario y la columna `Accion` vuelven a Firestore mediante el webhook firmado. No se deben habilitar escrituras publicas directas en Firestore.
