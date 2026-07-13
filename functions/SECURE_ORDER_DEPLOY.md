# Paso 2 — Pedidos, precios reales y stock en plan gratuito

## Cómo funciona

Esta versión no usa Cloud Functions ni exige el plan Blaze.

Al confirmar un pedido, el navegador inicia una transacción de Firestore que:

- vuelve a leer los productos desde Firebase;
- toma el precio y el nombre actuales;
- comprueba que el producto siga activo;
- verifica el stock disponible;
- vuelve a comprobar la ciudad, el costo de envío y el método de pago;
- crea el pedido y descuenta el stock en la misma operación.

Las reglas de Firestore repiten las validaciones importantes. Por eso cambiar el precio solamente en el navegador no alcanza para crear un pedido falso.

## Límite del plan gratuito

Cada pedido puede contener hasta **4 productos diferentes**. Se pueden comprar varias unidades de cada uno.

El límite permite validar precio y stock dentro del máximo de lecturas aceptado por las reglas de Firestore. Cuando una compra tenga más de cuatro productos diferentes, debe dividirse en dos pedidos.

Esta protección es la mejor alternativa disponible sin un servidor privado. Sigue siendo menos fuerte que una Cloud Function, porque la transacción se inicia desde el navegador, pero las reglas comprueban nuevamente los datos antes de aceptar el pedido.

## Publicación

Solo se publican las reglas. No hace falta instalar las dependencias de `functions` ni activar Blaze.

Desde Cloud Shell:

```bash
cd ~/tintin-web
git pull origin main
nvm use 20
npm install
npm run audit:secure-orders
npm run deploy:rules
```

El resultado correcto debe incluir:

```text
Auditoría de pedidos gratuitos completada correctamente.
firestore: released rules firestore.rules to cloud.firestore
Deploy complete!
```

## Pruebas

1. **Pedido normal**
   - Abrí la tienda con una cuenta verificada.
   - Agregá uno o varios productos con stock.
   - Confirmá el pedido.
   - Debe aparecer un solo número de pedido.
   - El stock debe bajar exactamente la cantidad comprada.

2. **Doble clic o reintento**
   - Tocá Confirmar varias veces rápidamente.
   - Debe existir un solo pedido y un solo descuento de stock.

3. **Cambio de precio**
   - Dejá abierto el resumen.
   - Cambiá el precio desde Super Admin.
   - Confirmá.
   - Debe actualizar el resumen y pedir una segunda confirmación.

4. **Cambio de stock**
   - Bajá el stock desde Super Admin antes de confirmar.
   - El checkout debe ajustar la cantidad disponible o retirar el producto agotado.

5. **Producto desactivado**
   - Desactivá el producto antes de confirmar.
   - No debe crearse ningún pedido.

6. **Tienda cerrada o cuenta bloqueada**
   - No debe crearse el pedido ni modificarse el stock.

7. **Más de cuatro productos diferentes**
   - El checkout debe pedir dividir la compra en dos pedidos.

## Importante

Las estadísticas acumuladas del perfil no se modifican desde el navegador en esta modalidad. Los pedidos reales siguen guardándose y pueden calcularse directamente desde la colección `orders` en una reparación posterior del perfil.
