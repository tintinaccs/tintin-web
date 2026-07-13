# Paso 2 — Pedidos, precios reales y stock

## Qué cambia

El botón **Confirmar pedido** ya no guarda directamente lo que dice el navegador.
Ahora llama a la función privada `createOrder`, que vuelve a comprobar en Firebase:

- que la cuenta esté iniciada, verificada y no bloqueada;
- que la tienda esté abierta o que el rol tenga acceso de mantenimiento;
- que cada producto exista y esté activo;
- el precio real de cada producto;
- el stock real disponible;
- la ciudad, el costo de envío y el método de pago habilitado;
- el subtotal y el total final.

El pedido, el descuento de stock y las estadísticas de la clienta se guardan juntos.
Si una parte falla, no se guarda ninguna de las otras.

Cada intento lleva un identificador estable. Un doble clic, una recarga o un reintento por conexión lenta devuelve el mismo pedido y no descuenta stock dos veces.

## Publicación obligatoria

Estos cambios incluyen una Cloud Function y reglas de Firestore. No alcanza con publicar GitHub Pages.
Desde la carpeta principal del repositorio:

```bash
npm install
npm --prefix functions install
npm run audit:secure-orders
npm run deploy:firebase
```

`deploy:firebase` publica **funciones y reglas juntas**. No publiques primero las reglas solas: las reglas nuevas bloquean el guardado directo antiguo y esperan que `createOrder` ya esté disponible.

## Pruebas

1. Confirmación normal
   - Abrí la tienda con una cuenta verificada.
   - Agregá un producto con stock.
   - Completá el checkout.
   - Confirmá una vez.
   - Debe aparecer un solo número de pedido.
   - El stock debe bajar exactamente la cantidad comprada.

2. Doble clic o reintento
   - Tocá Confirmar rápidamente más de una vez o reintentá después de una demora.
   - Debe existir un solo pedido y un solo descuento de stock.

3. Cambio de precio
   - Dejá el resumen del checkout abierto.
   - Cambiá el precio desde Super Admin.
   - Volvé a confirmar.
   - No debe crear el pedido todavía: debe mostrar el resumen actualizado y pedir una nueva confirmación.

4. Cambio de stock
   - Dejá una cantidad en el checkout.
   - Bajá el stock desde Super Admin antes de confirmar.
   - El checkout debe informar el cambio y ajustar o quitar el producto.

5. Producto desactivado
   - Desactivá el producto antes de confirmar.
   - No debe crearse ningún pedido.

6. Tienda cerrada o cuenta bloqueada
   - Cerrá la tienda o bloqueá la cuenta antes de confirmar.
   - No debe crearse ningún pedido ni modificarse el stock.

7. Manipulación del navegador
   - Aunque se cambien precios o totales guardados localmente, el servidor debe usar únicamente los valores actuales de Firebase.

## Recuperación

Si la función todavía no fue publicada, el checkout muestra que el sistema seguro no está disponible. No usa el camino directo antiguo una vez publicadas las reglas nuevas.
