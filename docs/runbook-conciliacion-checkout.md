# Runbook de conciliación de Checkout

Este procedimiento cubre pagos, pedidos, inventario, correo y el espejo `Pedidos web` sin convertir un fallo secundario en una segunda venta. Firestore `orders` y el dominio transaccional de inventario siguen siendo la autoridad comercial.

## Regla principal

Una intención de compra se identifica por su `requestId`/clave idempotente. **Nunca crear otro pedido para “arreglar” un timeout** hasta comprobar si la primera intención ya fue confirmada. Un reintento legítimo debe conservar la misma clave y el servidor debe devolver el mismo pedido.

## Señales que se revisan

- Pedido: `orderId`, `orderNumber`/TINPED, `requestId`, `status`, `inventoryState`.
- Pago: `paymentStatus` o `payment.status`.
- Correo: `notificationStatus`; `sent` significa envío confirmado. `pending`, `partial` y `failed` requieren revisión.
- Sheets: disponibilidad del bridge y presencia del TINPED en `Pedidos web`. El reconciliador de Apps Script vuelve a copiar Firestore periódicamente si el push inmediato falla.
- Push: revisar el centro de notificaciones/registro operativo; una falla de Push nunca revierte el pedido.

No copiar a tickets, logs o capturas nombre, teléfono, email, dirección ni contenido completo del pedido si no es estrictamente necesario.

## Pago aprobado y pedido existente

1. Buscar el TINPED/orderId en Firestore `orders`.
2. Confirmar que `paymentStatus` sea `pagado`/estado equivalente y que `inventoryState` represente el stock ya comprometido.
3. No ejecutar nuevamente la creación del pedido.
4. Si `notificationStatus != sent`, usar el reenvío administrativo existente y comprobar que el estado cambie a `sent` o quede `partial/failed` con error visible.
5. Abrir `Pedidos web` y localizar el mismo TINPED. Si no aparece, revisar Estado del ecosistema → Google Sheets/Apps Script y ejecutar/revisar el reconciliador administrativo. Firestore no se modifica para “igualar” manualmente una fila de Sheets.
6. Confirmar que la notificación Push, si está habilitada, corresponda al mismo orderId. Si Push falla, registrar la incidencia; no duplicar el pedido.

## Pago aprobado sin pedido visible

1. Buscar primero por la clave idempotente/requestId y no solo por TINPED.
2. Revisar si hubo timeout del cliente después del commit. Un timeout no demuestra que el servidor haya fallado.
3. Si aparece un pedido para ese requestId, tratarlo como el caso anterior.
4. Si no existe pedido y el proveedor de pago confirma captura real, **no crear manualmente otro pedido desde el navegador**. Escalar como pago huérfano: conservar ID del proveedor, importe, hora y requestId; verificar inventario antes de cualquier compensación.
5. La resolución debe ser una operación administrativa auditada: vincular/crear mediante el dominio canónico o reembolsar, según corresponda. Nunca descontar stock con una edición manual paralela.

## Pedido sin pago confirmado

- `pendiente`: no marcar pagado por inferencia. Conciliar contra el proveedor/medio real.
- `rechazado/cancelado`: no descontar stock nuevamente ni reintentar con un requestId nuevo de forma automática.
- Si el pedido reservó inventario y la operación se abandona, usar el flujo canónico de cancelación/restauración; no editar contadores de stock a mano.

## Fallo de correo

Un pedido confirmado sigue siendo válido aunque Resend/Apps Script falle. El centro **Estado del ecosistema** inspecciona una muestra acotada de pedidos y alerta cuando encuentra pagos aprobados cuyo `notificationStatus` no es `sent`. El reenvío debe ser idempotente y mantener el mismo orderId.

## Fallo de Sheets

Sheets es espejo administrativo, no autoridad comercial. Cuando el bridge está caído, Estado del ecosistema marca los pagos aprobados como “en riesgo de espejo”. Tras recuperar Apps Script:

1. Ejecutar/verificar el reconciliador de paridad.
2. Confirmar el TINPED en `Pedidos web`.
3. Confirmar que Firestore conserva los mismos estado, total y pago.
4. No copiar valores desde Sheets hacia Firestore para corregir una discrepancia de un pedido confirmado salvo mediante las mutaciones canónicas soportadas.

## Casos obligatorios antes de cierre

- doble clic / doble submit con la misma intención;
- refresh después de enviar;
- timeout y reintento;
- token inválido/expirado;
- stock insuficiente y producto repetido en el payload;
- correo fallido después del commit;
- Sheets temporalmente inaccesible;
- pago rechazado;
- pago aprobado con fallo secundario de correo/Push/Sheets.

La aceptación es: una intención produce como máximo un pedido, el stock no se descuenta dos veces y cualquier fallo posterior al commit queda visible y conciliable sin recrear la venta.
