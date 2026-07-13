'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const backend = read('functions/create-order.js');
const frontend = read('js/secure-checkout-order.js');
const cart = read('js/cart-sync.js');
const rules = read('firestore.rules');
const functionsPackage = JSON.parse(read('functions/package.json'));
const functionsMain = read('functions/main.js');

check(
  'El servidor busca precios reales',
  backend.includes("db.collection('products').doc(id)") &&
    backend.includes('const price = parseMoney(product.price)'),
  'El pedido no debe confiar en precios enviados por el navegador.'
);
check(
  'El servidor comprueba tienda y bloqueo',
  backend.includes("gate.storeOpen === true") &&
    backend.includes("userData.blocked === true"),
  'Una cuenta bloqueada o una tienda cerrada no debe generar pedidos.'
);
check(
  'Pedido y stock cambian juntos',
  backend.includes('db.runTransaction') &&
    backend.includes('transaction.update(productRef') &&
    backend.includes('transaction.create(orderRef'),
  'No debe crearse el pedido sin descontar el stock correspondiente.'
);
check(
  'Reintentos no duplican pedidos',
  backend.includes('buildOrderId(uid, requestId)') &&
    backend.includes('if (existing.exists)'),
  'Un doble clic o reintento no debe crear dos pedidos.'
);
check(
  'Las estadísticas se actualizan en servidor',
  backend.includes('purchaseCount: FieldValue.increment(1)') &&
    backend.includes('totalSpent: FieldValue.increment(total)'),
  'El navegador no debe decidir las estadísticas de compra.'
);
check(
  'El navegador usa la función segura',
  frontend.includes("httpsCallable(getFunctions(getApp(), 'us-central1'), 'createOrder'") &&
    frontend.includes("event.target?.closest?.('#ck-confirm-btn')"),
  'Confirmar debe llamar al servidor antes de mostrar éxito.'
);
check(
  'Cambios de precio requieren nueva confirmación',
  backend.includes("fail('quote_changed'") &&
    frontend.includes("code === 'quote_changed'"),
  'No se debe cobrar silenciosamente un total distinto al mostrado.'
);
check(
  'Cambios de stock se explican al cliente',
  backend.includes("fail('insufficient_stock'") &&
    frontend.includes("code === 'insufficient_stock'"),
  'El checkout debe informar y ajustar el carrito cuando cambia el stock.'
);
check(
  'El checkout seguro se carga solo donde corresponde',
  cart.includes("checkoutPath.endsWith('/checkout.html')") &&
    cart.includes("import('./secure-checkout-order.js?v=tintin-20260713-7')"),
  'El módulo seguro debe arrancar en checkout sin afectar las demás páginas.'
);
check(
  'Firestore bloquea pedidos directos',
  /match \/orders\/\{orderId\}[\s\S]*?allow create: if false;/.test(rules),
  'Solo Firebase Admin debe poder crear documentos de pedidos.'
);
check(
  'Firebase registra la nueva función',
  functionsPackage.main === 'main.js' &&
    functionsMain.includes("require('./create-order')"),
  'La función createOrder debe formar parte del despliegue.'
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

console.log('\nAuditoría de pedidos seguros completada correctamente.');
