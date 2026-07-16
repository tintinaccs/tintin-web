'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const frontend = read('js/secure-checkout-order.js');
const cart = read('js/cart-sync.js');
const rules = read('firestore.rules');

check(
  'No depende de Cloud Functions',
  !frontend.includes('httpsCallable') &&
    !frontend.includes('firebase-functions.js') &&
    frontend.includes('runTransaction'),
  'El checkout gratuito debe usar una transacción de Firestore.'
);
check(
  'La transacción vuelve a leer los productos',
  frontend.includes("doc(db, 'products', line.id)") &&
    frontend.includes('const price = parseMoney(product.price)'),
  'No debe confiar únicamente en precios guardados en el carrito.'
);
check(
  'Pedido y stock se escriben juntos',
  frontend.includes('transaction.update(productRefs[index]') &&
    frontend.includes('transaction.set(orderRef, orderData)'),
  'El descuento de stock debe estar en la misma transacción que el pedido.'
);
check(
  'Reintentos no duplican pedidos',
  frontend.includes('const existing = await transaction.get(orderRef)') &&
    frontend.includes('if (existing.exists())'),
  'La misma solicitud debe devolver el pedido existente.'
);
check(
  'El plan gratuito limita productos diferentes',
  frontend.includes('MAX_DISTINCT_PRODUCTS = 4') &&
    rules.includes('items.size() <= 4'),
  'El límite mantiene las reglas dentro del máximo de lecturas permitido.'
);
check(
  'Cambios de precio requieren nueva confirmación',
  frontend.includes("'quote_changed'") &&
    frontend.includes("code === 'quote_changed'"),
  'No debe guardar silenciosamente un total distinto al mostrado.'
);
check(
  'Cambios de stock se explican al cliente',
  frontend.includes("'insufficient_stock'") &&
    frontend.includes("code === 'insufficient_stock'"),
  'El checkout debe ajustar el carrito cuando cambia el stock.'
);
check(
  'Las reglas validan precio real',
  rules.includes('product.price == item.price') &&
    rules.includes("item.name == product.get('name'"),
  'El pedido no debe aceptar un precio o nombre inventado.'
);
check(
  'Las reglas exigen el descuento de stock',
  rules.includes('getAfter(sparkProductPath(productId)).data.stock == product.stock - item.qty') &&
    rules.includes('sparkStockUpdateValid(productId)'),
  'Un pedido con stock no debe guardarse sin descontar la cantidad.'
);
check(
  'Las reglas validan subtotal y total',
  rules.includes('data.subtotal ==') &&
    rules.includes('data.total == data.subtotal + data.shippingCost'),
  'Los totales deben derivarse de las líneas validadas.'
);
check(
  'Las reglas validan tienda, cuenta y correo',
  rules.includes("settings.get('storeOpen', false) == true") &&
    rules.includes("userData.get('blocked', false) != true") &&
    rules.includes('request.auth.token.email_verified == true'),
  'Una tienda cerrada, cuenta bloqueada o correo no verificado debe fallar.'
);
check(
  'El checkout seguro se carga solo donde corresponde',
  cart.includes("checkoutPath.endsWith('/checkout.html')") &&
    cart.includes("import('./secure-checkout-order.js?v=tintin-20260716-cloudinary-fix-1"),
  'El módulo debe arrancar únicamente en checkout.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log('\nAuditoría de pedidos gratuitos completada correctamente.');
