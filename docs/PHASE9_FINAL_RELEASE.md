# Fase 9 — Importación, despliegue y cierre final

## Arquitectura publicada

- Sitio: GitHub Pages desde la rama `main`.
- Base de datos y autenticación: Firebase, proyecto `tintin-accesorios`.
- Plan: Spark.
- Pedidos y stock: transacción de Firestore protegida por reglas.
- Cloud Functions: no se usan en producción.
- Correos de pedido: Resend vía `functions/api/order-email.js` (Cloudflare Pages Functions). Correos de prueba/promoción/plantilla: Google Apps Script externo al repositorio.

## Nuevo importador

Super Admin → Import/Export muestra primero el panel **Fase 9 — Copias e importación segura**.

Acepta:

- CSV de Shopify.
- CSV genérico con columnas reconocibles.
- Array JSON de productos.
- Una copia operativa Tintin con `data.products`.

Antes de guardar:

1. Lee CSV con comillas escapadas y campos multilínea.
2. Limita el archivo a 5 MB y 1.000 productos.
3. Valida nombre, precio, stock, imagen y colección.
4. Usa exclusivamente las colecciones reales de Firestore.
5. Muestra productos válidos, inválidos y duplicados.
6. Permite corregir la colección desde la vista previa.
7. Importa únicamente productos nuevos y válidos.
8. Escribe en lotes de 350 productos.
9. Registra cada lote en `auditLog` dentro del mismo batch.

Los importadores anteriores de Shopify y JSON se conservan ocultos para compatibilidad del HTML, pero ya no se ofrecen en la interfaz.

## Copia operativa

La copia descargable incluye:

- Productos.
- Colecciones.
- Contenido del sitio.
- Configuración.
- Roles y permisos.

Excluye deliberadamente:

- Usuarios.
- Pedidos.
- Carritos.
- Auditoría.
- Historial de correos.

Así se puede guardar una copia útil del catálogo y la configuración sin mezclar datos personales de clientas.

## Comandos finales

Revisión completa:

```bash
npm install
npm run audit:final
```

Publicar reglas cuando `firestore.rules` haya cambiado:

```bash
npm run deploy:spark
```

`deploy:spark` ejecuta primero todas las auditorías y después publica únicamente las reglas en `tintin-accesorios`.

Ya no existen comandos activos para desplegar Cloud Functions, porque el checkout productivo está adaptado al plan Spark.

## Qué se publica automáticamente

Al fusionar cambios en `main`, GitHub Pages actualiza los archivos HTML, CSS y JavaScript. Las fases 3 a 9 no requieren Cloud Shell mientras no cambien las reglas.

## Verificación manual final

1. Abrir la tienda en incógnito y hacer una compra de prueba segura.
2. Confirmar que el stock disminuye y el pedido no se duplica.
3. Probar el carrito en dos dispositivos.
4. Revisar colecciones, imágenes y contenido.
5. Cambiar un rol de prueba y revisar Auditoría.
6. Descargar una copia operativa.
7. Cargar un CSV pequeño y comprobar que primero aparece la vista previa.
8. Confirmar el envío real de correos.

## Google Apps Script

Apps Script vive fuera de GitHub. Ya no procesa los correos de pedido (ese canal es Resend, ver arriba) — sigue activo para los correos de prueba, plantilla y promoción que dispara el panel (`js/email-notify.js`). La auditoría del repositorio confirma el puente y el archivo `apps-script/Phase3Security.gs`, pero no puede confirmar qué versión está publicada en la consola de Apps Script.

Para cerrar esa comprobación manualmente, la implementación activa debe conservar la misma URL `/exec` y contener la versión segura de Fase 3.

## Estado de cierre

Las nueve fases quedan cubiertas por `npm run audit:final` y por GitHub Actions. La revisión automática valida código, integración y compilación de reglas; las pruebas con datos reales y el Apps Script publicado deben confirmarse desde las cuentas de producción.
