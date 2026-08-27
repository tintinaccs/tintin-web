# Estado integral del ecosistema

La superficie **Superadmin → Diagnóstico** contiene dos capas distintas:

- **Diagnóstico Maestro**: evidencia de código, CI, navegador, seguridad y producción.
- **Estado del ecosistema**: disponibilidad operativa de las autoridades e integraciones reales.

El estado operativo se consulta únicamente con sesión de Super Admin mediante `/api/system-health`. El endpoint público `/api/health` permanece liviano y no depende de Google Sheets ni de Apps Script.

## Autoridades

- Productos: Firestore `products`; espejo bidireccional `Productos`.
- Inventario: Firestore `productInventory`; espejo bidireccional `Productos`.
- Colecciones: Firestore `collections`.
- Usuarios: Firebase Auth + Firestore `users`; `Usuarios web` es espejo administrativo.
- Pedidos: Firestore `orders` + dominio canónico de pedidos; Superadmin y `Pedidos web` son superficies administrativas equivalentes para las operaciones permitidas. Precios, TINPED, totales, stock, concurrencia y auditoría se resuelven en el servidor.
- Auditoría: Firestore `auditLog`; `Auditoría web` es solo lectura.
- Contenido: Firestore `site_content`.
- Visual Builder: Firestore `visualBuilderPages` y su historial/borradores.
- Configuración: Firestore `settings`.

## Seguridad y costo

Los probes de Firestore leen como máximo un documento por colección/superficie. El probe a Apps Script llama a la ruta `syncProducts` sin token: un despliegue canónico debe rechazarla como no autorizada antes de cualquier escritura. El panel nunca devuelve documentos, datos de clientas ni secretos.

Resend y Cloudinary se marcan según presencia de configuración privada; no se realizan envíos ni cargas de prueba. El commit de Cloudflare Pages se expone únicamente dentro de la respuesta autenticada del Superadmin.
