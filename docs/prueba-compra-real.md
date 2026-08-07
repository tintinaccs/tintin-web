# Prueba de compra real y smoke autenticado

Guion ejecutable para los dos pendientes manuales de #340: la compra controlada de punta
a punta (punto 1) y el smoke autenticado en producción (punto 2).

Está escrito para ejecutarse y anotar, no para interpretarse. Cada paso dice qué hacer y
qué tiene que pasar. Si algo no coincide, se anota y se corta.

No debe contener secretos ni credenciales.

## Antes de empezar

- Hacerlo con la tienda **abierta**, en producción, desde un dispositivo real.
- Usar una cuenta de cliente de prueba, **no** la de Super Admin: el objetivo es recorrer
  el camino de una clienta real.
- Tener el panel de Super Admin abierto en otra pestaña o dispositivo.
- Elegir un producto de bajo precio y **anotar su stock inicial**.

## Cómo funciona el pedido

Conviene saberlo para interpretar los resultados.

El pedido se crea en **una sola transacción de Firestore** que revalida precio y stock
reales, verifica tienda/cuenta/envío y descuenta el stock en el mismo acto. **No existe un
estado intermedio "pendiente" que haya que limpiar**: o el pedido queda creado con el
stock ya descontado, o no queda nada.

Implementación: `js/orders/pedido-checkout-seguro.js`.

Si la transacción rechaza, devuelve un código concreto:

| Código | Qué significa |
| --- | --- |
| `insufficient_stock` | El stock cambió; ofrece la cantidad disponible |
| `product_inactive` | El producto dejó de estar publicado |
| `product_not_found` | El producto ya no existe |
| `quote_changed` | Cambió el precio entre el carrito y la confirmación |
| `unavailable` | Tienda cerrada o condición de compra no cumplida |

El correo sale por `/api/order-email` (Resend) y cada intento queda registrado en
`emailLogs` con `type: 'pedido_nuevo'`.

Estados válidos del pedido: `pendiente`, `confirmado`, `pagado`, `enviado`, `entregado`,
`cancelado`.

## Parte 1 — Compra real de punta a punta

### 1. Catálogo

- Abrir el catálogo y buscar el producto elegido.
- **Verificar:** aparece con precio y stock correctos, y la imagen carga.

### 2. Carrito

- Agregar el producto. Cambiar la cantidad al menos una vez.
- **Verificar:** el total recalcula; el carrito sobrevive a recargar la página.

### 3. Cuenta

- Iniciar sesión con la cuenta de prueba.
- **Verificar:** el carrito **no** se pierde al iniciar sesión.

### 4. Checkout

- Completar datos de entrega y método de pago.
- **Verificar:** el resumen coincide con el carrito y el envío se calcula según la zona.

### 5. Confirmación — el paso crítico

- Confirmar el pedido y **anotar la hora exacta**.
- **Verificar:** aparece la confirmación con número de pedido.

### 6. Stock

- En el panel, abrir el producto comprado.
- **Verificar:** el stock bajó **exactamente** en la cantidad comprada. Ni más, ni menos,
  ni dos veces.

> Un descuento doble acá es un fallo grave: significa que la transacción se aplicó más de
> una vez. Anotarlo y cortar la prueba.

### 7. Correo

- Revisar la casilla de la cuenta de prueba, incluido spam.
- **Verificar:** llega el correo con el detalle correcto.
- Si no llega, revisar `emailLogs` en Firestore: si hay un registro con error, el fallo es
  del envío; si no hay ningún registro, el fallo es anterior, en la llamada a
  `/api/order-email`.

### 8. Panel

- Abrir la sección de pedidos.
- **Verificar:** el pedido aparece con el número, el detalle, el total y los datos de
  entrega correctos.

### 9. Cambio de estado

- Cambiar el estado del pedido (por ejemplo `confirmado` → `enviado`).
- **Verificar:** el cambio persiste al recargar y se refleja en la vista de la clienta.

### 10. Vista de la clienta

- Volver a la cuenta de prueba y abrir «Mis pedidos».
- **Verificar:** el pedido aparece con el estado actualizado.

### 11. Cierre

- Dejar el pedido de prueba en un estado que no confunda después: `cancelado`, o
  eliminarlo si el panel lo permite.
- Si se cancela o elimina, **verificar si el stock se repone o no**, y anotar el
  comportamiento real. Es información operativa útil independientemente del resultado.

## Parte 2 — Smoke autenticado en producción

Rápido, sobre producción, ya con sesión de Super Admin.

Recorrer cada sección del panel y confirmar que **carga con datos reales y sin errores en
consola**:

- [ ] Productos
- [ ] Colecciones
- [ ] Multimedia
- [ ] Pedidos
- [ ] Usuarios, roles y permisos
- [ ] Contenido y apariencia
- [ ] Correo y mensajería
- [ ] Estadísticas y auditoría
- [ ] Diagnóstico
- [ ] Control de apertura/cierre de la tienda

Además:

- [ ] Abrir el sitio público **sin sesión** y comprobar que nada del panel es accesible.
- [ ] Comprobar que cerrar sesión deja el sitio público funcionando con normalidad.

> El smoke automatizado ya cubre las 18 páginas públicas en CI. Lo que **no** puede cubrir
> es el panel autenticado: por eso este paso es manual.

## Planilla de resultados

| # | Paso | Esperado | Resultado | OK |
| --- | --- | --- | --- | --- |
| 1 | Catálogo | Precio, stock e imagen correctos | | |
| 2 | Carrito | Total recalcula y persiste | | |
| 3 | Cuenta | El carrito sobrevive al login | | |
| 4 | Checkout | Resumen y envío correctos | | |
| 5 | Confirmación | Número de pedido | | |
| 6 | Stock | Baja exacta, una sola vez | | |
| 7 | Correo | Llega con detalle correcto | | |
| 8 | Panel | Pedido completo y correcto | | |
| 9 | Estado | Cambio persistente | | |
| 10 | Cliente | Estado actualizado | | |
| 11 | Cierre | Pedido de prueba neutralizado | | |
| 12 | Smoke panel | 10 secciones sin errores | | |

Fecha: &nbsp;&nbsp;&nbsp;&nbsp; Ejecutado por: &nbsp;&nbsp;&nbsp;&nbsp; Versión de `main`:

## Si algo falla

Anotar el paso, el mensaje exacto y lo que se veía en consola. No seguir adelante: un
fallo en el descuento de stock o en la creación del pedido invalida los pasos siguientes.

Registrar el resultado en #340 (puntos 1 y 2) con la fecha y la versión de `main` usada.
