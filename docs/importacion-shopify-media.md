# Preparar importación Shopify y copia de imágenes

Este procedimiento aplica al importador CSV de Super Admin y a la rama desplegada que incluye `admin-import-media` y el preflight autenticado. No requiere credenciales de Shopify Admin API.

## Antes de aplicar

1. Mantener Shopify activo y exportar los productos/colecciones en CSV.
2. En **Super Admin → Import/Export**, cargar el CSV, revisar el preview, resolver errores y ambigüedades de colección y confirmar que el import job esté `READY` sin errores.
3. Descargar la copia operativa desde esa sesión antes de aplicar.
4. Si los registros contienen imágenes de Shopify CDN, la interfaz consultará `/api/admin-import-media` con autenticación de Super Admin y `action: preflight`. El endpoint solo devuelve booleanos y códigos de motivo; nunca devuelve valores de Cloudinary ni secretos.

El preflight verifica dos condiciones sin descargar ni subir archivos: que exista `SHOPIFY_PHASE2_MEDIA_WRITE=1` y que Cloudinary tenga configurados `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`. Si alguna condición falta, la aplicación se detiene antes de descargar medios o escribir productos.

## Activación temporal del copiado

Cuando el código actualizado esté desplegado y el dueño vaya a realizar la importación:

1. En Cloudflare, abrir **Workers & Pages → proyecto Pages `tintinaccesorios` → Settings → Variables and Secrets**.
2. En el entorno **Production**, comprobar que los tres valores de Cloudinary ya estén configurados como variables/secretos de runtime. No copiar sus valores al repositorio, documentación ni chat.
3. Añadir temporalmente la variable de texto `SHOPIFY_PHASE2_MEDIA_WRITE` con valor `1` para Production. No habilitarla para previews sin una razón de prueba aislada.
4. Abrir el Admin en el origen desplegado y comprobar que el preflight de la importación queda listo antes de aplicar.
5. Aplicar el CSV revisado. Las imágenes se copian a Cloudinary en lotes pequeños y solo se escriben productos después de que todas sus copias hayan sido confirmadas por HTTPS. Si falla un medio, esa aplicación no escribe el catálogo; una repetición reutiliza identidades estables de medios.
6. Cuando termine la sesión, eliminar `SHOPIFY_PHASE2_MEDIA_WRITE` o cambiarlo a `0` en Production y verificar que el preflight vuelve a indicar que la copia está deshabilitada.

Cloudflare Pages configura las variables de runtime por proyecto y entorno desde esa pantalla; la documentación oficial describe el mismo flujo en [Bindings: environment variables and secrets](https://developers.cloudflare.com/pages/functions/bindings/). Confirmar el resultado usando el preflight autenticado del despliegue, no exponiendo valores de variables.

## Aceptación tras la importación

- Revisar productos, variantes, precio, stock, colecciones, handles, descripciones e imágenes en Admin y en el storefront Pages.
- Ejecutar el monitor de producción y el escaneo de independencia de Shopify con catálogo real. El monitor antes de importar falla deliberadamente por el catálogo vacío, así que una respuesta sin referencias Shopify mientras los conteos sean cero no acredita independencia de los datos que todavía no se cargaron.
- Comprobar sitemap de productos/colecciones, metadata y redirects de handles con al menos un producto real.
- Probar sesión, carrito, checkout, medio de pago, creación de pedido, cambio de stock, correo y notificaciones con el catálogo real antes de cambiar DNS.
- Mantener Shopify accesible hasta completar la matriz de aceptación del [runbook de cutover](cutover-tintinaccs-com.md).

Este documento prepara el procedimiento; no declara que el preflight de producción esté habilitado ni que el catálogo real haya sido importado. Esos estados solo se confirman durante una sesión autenticada contra el despliegue activo.
