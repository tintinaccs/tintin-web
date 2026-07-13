# Pedido seguro

`main.js` publica las funciones existentes y `createOrder`.

`createOrder` es la única entrada autorizada para crear pedidos. El navegador envía identificación de productos, cantidades y datos de entrega; el servidor obtiene precios, stock y configuración directamente desde Firestore.

La transacción crea el pedido, descuenta stock y actualiza estadísticas como una sola operación. El identificador derivado de `uid + requestId` evita pedidos duplicados durante reintentos.
