# Fase 3 — Publicación de correos en Spark

Esta fase sigue usando Google Apps Script y Gmail. No requiere Blaze.

## Archivos

- `apps-script/Phase3Security.gs`: funciones que autentican a la persona, leen el pedido real desde Firestore y verifican permisos de reenvío.
- `js/email-notify.js`: envía el identificador del pedido y una sesión válida.
- `js/pages/checkout/checkout-email-bridge.js`: inicia el correo después de que la transacción Spark termina.

## Actualización manual de Apps Script

1. Entrar a Google Apps Script con la cuenta que administra el proyecto de correos.
2. Abrir el proyecto existente `Tintin - Emails de pedidos`.
3. Crear un archivo de secuencia de comandos llamado `Phase3Security`.
4. Copiar dentro todo el contenido de `apps-script/Phase3Security.gs`.
5. En `doPost(e)`, después de validar que existe un `idToken`, cargar el pedido mediante `phase3LoadOrderContext_(orderId, data.idToken, isResend)`.
6. Usar `secureContext.order` en lugar de `data.order`.
7. Mantener los límites diarios y el cooldown existentes; la identidad, el rol y el permiso de reenvío ya quedan comprobados por `phase3LoadOrderContext_`.
8. Leer los interruptores con `phase3LoadEmailAccess_(data.idToken)` en lugar de confiar en `data.sendAdmin` y `data.sendCustomer`.
9. Después de intentar los envíos, calcular `sent`, `partial` o `failed` y ejecutar `phase3UpdateOrderNotificationStatus_(orderId, status)`.
10. Cuando `checkOrderEmailNotDuplicate_` detecte un duplicado, devolver `duplicate: true` y conservar `order.notificationStatus` como `previousStatus`.
11. Eliminar del `doPost(e)` la exigencia del secreto enviado por el navegador; la autorización real es el `idToken` verificado.
12. Guardar y editar la implementación activa eligiendo `Nueva versión`. No crear otra implementación, para conservar la misma URL `/exec`.

## Prueba

1. Entrar primero a Super Admin para sincronizar los interruptores de correo.
2. Crear un pedido real con una cuenta verificada.
3. Comprobar el correo interno y, cuando exista correo de contacto, la confirmación de la clienta.
4. Revisar que `notificationStatus` cambie de `pending` a `sent`, `partial` o `failed`.
5. Revisar el registro `pedido_nuevo` en `emailLogs`.
6. Recargar la pantalla de éxito: no debe llegar un segundo correo del mismo pedido.

La implementación anterior puede seleccionarse nuevamente desde Administrar implementaciones si aparece un error. Esto no elimina pedidos ni modifica stock.


## Permiso de Firestore para Apps Script

La cuenta propietaria del Apps Script debe tener acceso al proyecto `tintin-accesorios`. La función de estado usa `ScriptApp.getOAuthToken()` y la API oficial de Firestore; no usa permisos de la clienta.
