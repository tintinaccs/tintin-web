# Contratos comerciales de Tintin Web

Este documento fija las reglas que deben conservar carrito, checkout, pedidos, inventario, pagos, promociones y correos. No describe solo la interfaz: define integridad de datos y comportamiento ante reintentos, concurrencia y fallos parciales.

## 1. Carrito

- Una línea se identifica por producto y variante mediante `lineId` estable.
- La cantidad es un entero entre 1 y 99.
- El carrito local mantiene compatibilidad con `tt_cart`, pero una cuenta autenticada sincroniza `users/{uid}/cart/{lineId}`.
- Las escrituras se serializan y una respuesta remota nunca pisa una edición local todavía pendiente.
- El carrito de invitado se combina una sola vez al iniciar sesión.
- Nombre, imagen y precio guardados en el carrito son únicamente una representación visual. No son autoridad para cobrar.
- El checkout vuelve a leer producto, precio, disponibilidad y configuración.

## 2. Identidad de la operación

- Cada intento de checkout utiliza un `requestId` estable durante la sesión.
- El documento se identifica como `${uid}_${requestId}`.
- Repetir la misma solicitud debe reanudar el mismo pedido, nunca crear otro.
- `checkoutGuards/{uid}` limita pedidos distintos en una ventana corta, sin impedir reanudar el mismo.
- Los botones permanecen bloqueados mientras una escritura está en curso.

## 3. Cotización autoritativa

Antes de crear el pedido se vuelven a leer:

- `settings/general`;
- perfil del usuario;
- cada producto solicitado;
- precio actual;
- estado activo;
- stock disponible;
- método de pago habilitado;
- ciudad y costo de envío.

Si el subtotal, el envío o el total difieren de lo mostrado, el pedido no se confirma silenciosamente. El carrito recibe la cotización actual y la clienta debe revisarla.

Los importes en guaraníes se guardan como números enteros. El texto `Gs.` y los separadores pertenecen únicamente al formato visual.

## 4. Pedido autocontenido

El pedido conserva una fotografía histórica de la compra:

- identificadores y número corto;
- usuario, nombre, correo y teléfono;
- productos, variantes, cantidades, nombre, categoría, imagen y precio unitario;
- subtotal, envío y total;
- método y datos de entrega;
- método y estado de pago;
- notas;
- estado operativo;
- estado y revisión de inventario;
- timestamps y responsable de la última operación de inventario.

El historial nunca debe reconstruirse usando el catálogo actual. Cambiar o eliminar un producto no cambia un pedido existente.

## 5. Inventario

Los nuevos pedidos del checkout apartan inventario al tocar **Confirmar pedido**, aunque el pago siga pendiente. El servidor asigna `inventoryPolicy: reserve-on-checkout`; el navegador no puede escoger ni desactivar esta política.

```text
Nuevo checkout: reserved → released al cancelar/rechazar
Pedido manual o anterior sin reserva: unreserved → reserved al confirmar/pagar → released
```

- Registrar el pedido público, reservar la variante exacta y descontar el agregado es una sola operación atómica con precondiciones de versión. No queda creado un segundo pedido si otra clienta tomó la última unidad.
- `status: pendiente` y `paymentStatus: pendiente` se conservan: apartar no equivale a pagar.
- Reintentar el mismo `requestId`, confirmar el pedido en el panel o registrar su pago no descuenta de nuevo lo ya reservado.
- Cancelar/rechazar libera lo reservado exactamente una vez. Reabrir un pedido nuevo conserva su política y vuelve a validar stock antes de apartar.
- No hay vencimiento automático nuevo. El equipo gestiona los pedidos pendientes y libera mediante el flujo canónico de cancelación/rechazo.
- Los pedidos previos y manuales conservan su política; no se migran reservas históricas ni se descuentan pedidos pendientes existentes en lote.
- Eliminar/archivar y restaurar conserva el modelo canónico y la huella de cantidades/variantes para no devolver más de lo reservado.
- Un fallo parcial comunica los pedidos procesados y los pendientes; ajustes manuales no se confunden con una devolución automática.

## 6. Estados de pedido y pago

Los estados elegibles del panel proceden de una única definición administrativa. Los alias antiguos se muestran para compatibilidad, pero no se ofrecen como opciones nuevas.

Estados operativos actuales:

```text
pendiente
confirmado
preparando
listo_retiro
en_camino
entregado
cancelado
rechazado
```

Estados de pago actuales:

```text
pendiente
pagado
rechazado
cancelado
reembolsado
```

Cambiar un estado exige permiso, actualización recuperable y registro de auditoría. Los valores de un `<select>` no sustituyen las reglas de autorización.

La integración futura de una pasarela deberá confirmar pagos mediante webhook validado en servidor. El navegador nunca puede marcar un pedido como pagado por sí solo.

## 7. Edición administrativa

- Nombre, teléfono, cantidades y total se validan.
- No se permite dejar el pedido sin productos.
- El total se deriva del precio histórico de las líneas y el costo de envío guardado.
- El botón de guardar se bloquea durante la escritura.
- `updatedAt` se compara antes de guardar para no pisar cambios de otro administrador.
- Las acciones sensibles dejan auditoría.

## 8. Promociones

Actualmente el checkout toma como precio autoritativo el valor vigente del documento del producto. No existe un motor independiente que permita al navegador inventar descuentos.

Una promoción futura solo se considera terminada cuando:

- tiene identificador, tipo, alcance, prioridad, inicio y fin;
- define compatibilidad con otras promociones y cupones;
- calcula el mismo resultado en producto, carrito, checkout, pedido, correo, panel y analítica;
- el servidor o las reglas validan el descuento aplicado;
- el pedido guarda la promoción y el ahorro históricos;
- los reintentos producen exactamente el mismo resultado;
- una promoción vencida no puede aplicarse usando datos antiguos del navegador.

Hasta que ese contrato exista, los precios promocionales se publican como precio vigente del producto y se validan nuevamente en checkout.

## 9. Correos de pedido

- El frontend envía únicamente `orderId` y acción; el endpoint vuelve a leer el pedido real.
- La sesión, propiedad del pedido y permisos de reenvío se comprueban en servidor.
- Resend usa claves de idempotencia estables para el envío automático.
- El cliente reintenta automáticamente errores transitorios, límites temporales, respuestas 5xx y resultados parciales.
- Un token vencido se renueva una sola vez.
- Cada solicitud tiene timeout y un máximo de intentos.
- El resultado final se registra una sola vez en `emailLogs`, con cantidad de intentos.
- Los reenvíos manuales usan claves nuevas y tienen cooldown y permisos propios.
- Las claves privadas permanecen en el entorno servidor.

## 10. Reintentos y fallos

Un reintento nunca debe:

- crear otro pedido;
- descontar stock otra vez;
- devolver stock otra vez;
- enviar dos veces al destinatario que ya recibió el correo automático;
- alterar un precio histórico;
- esconder un resultado parcial.

Los errores recuperables se reintentan de forma acotada. Los errores de validación, permiso o datos incorrectos no se repiten indefinidamente.

## 11. Pruebas obligatorias

Cada cambio comercial revisa:

- invitado, cliente verificado, cuenta bloqueada, admin y Super Admin;
- doble clic y doble pestaña;
- producto desactivado, eliminado, sin stock y con precio cambiado;
- tienda cerrada;
- método de pago o ciudad deshabilitados;
- pérdida temporal de conexión;
- respuesta parcial del correo;
- reintento de creación, reserva, eliminación y notificación;
- las siete resoluciones del proyecto;
- reglas de Firestore con accesos permitidos y denegados.
