const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const cart = read('js/cart-sync.js');
const quality = read('js/ui-quality.js');
const checkout = read('js/secure-checkout-order.js');
const rules = read('firestore.rules');
const pkg = read('package.json');

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`OK — ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ''}`);
}

check(
  'El carrito usa un singleton para evitar listeners duplicados',
  cart.includes('window.__TintinCartSyncV2') &&
    cart.includes('const runtime = existingRuntime || createRuntime()'),
  'Dos imports con distinta versión no deben iniciar dos sincronizadores'
);

check(
  'La identidad del carrito separa invitada y cuenta',
  cart.includes("const GUEST_CART_KEY = 'tt_cart_guest'") &&
    cart.includes("const USER_CART_PREFIX = 'tt_cart_user_'") &&
    cart.includes('cartKeyForUser(user)'),
  'Cada cuenta necesita su propia clave local'
);

check(
  'Las variantes crean líneas diferentes',
  cart.includes('function lineIdFor') &&
    cart.includes("hashLine(`${id}\\u241f${variant}`)") &&
    cart.includes('item.lineId === wanted'),
  'El documento remoto no puede usar solamente product.id'
);

check(
  'El carrito escucha cambios remotos en tiempo real',
  cart.includes('onSnapshot(') &&
    cart.includes("collection(db, 'users', user.uid, 'cart')") &&
    cart.includes('handleLaterRemote(snapshot, generation)'),
  'getDocs al iniciar sesión no alcanza para sincronizar dispositivos'
);

check(
  'Las escrituras remotas están serializadas y agrupadas',
  cart.includes('let writeChain = Promise.resolve()') &&
    cart.includes('writeChain = writeChain.then') &&
    cart.includes('window.setTimeout(() =>') &&
    cart.includes('flushDebouncedSync'),
  'Cambios rápidos de cantidad no deben llegar fuera de orden'
);

check(
  'Una edición local pendiente no es pisada por otro snapshot',
  cart.includes('pendingRemoteWrite && remoteProjection !== desiredProjection') &&
    cart.includes("setStatus(navigator.onLine === false ? 'offline' : 'saving')"),
  'El listener remoto debe respetar el estado optimista local'
);

check(
  'El carrito de invitada se combina al iniciar sesión',
  cart.includes('guestAtLogin = normalizeCart(rawGet(GUEST_CART_KEY))') &&
    cart.includes('addGuestQuantities(base, guestAtLogin)') &&
    cart.includes('rawSet(GUEST_CART_KEY, [])'),
  'Los productos elegidos antes del login no deben desaparecer'
);

check(
  'La migración anterior conserva cantidades sin duplicarlas',
  cart.includes('mergeMax(remoteItems, localItems)') &&
    cart.includes('MIGRATED_PREFIX') &&
    cart.includes('DIRTY_PREFIX'),
  'La transición a V2 debe ser de una sola vez'
);

check(
  'El código clásico solo redirige localStorage y no sessionStorage',
  cart.includes('this === window.localStorage && key === PUBLIC_CART_KEY') &&
    !cart.includes('this === window.sessionStorage && key === PUBLIC_CART_KEY'),
  'El parche global de Storage debe estar limitado'
);

check(
  'Los botones viejos se corrigen por línea y variante',
  cart.includes('interceptLegacyCartButtons') &&
    cart.includes("document.addEventListener('click', interceptLegacyCartButtons, true)") &&
    cart.includes("row.dataset.lineId = item.lineId"),
  'Los onclick antiguos usan product.id y no distinguen variantes'
);

check(
  'El checkout limpia también el carrito remoto',
  cart.includes('async function clearCart()') &&
    cart.includes('await flushCartSync()') &&
    checkout.includes('clearCart'),
  'Después de un pedido exitoso no debe reaparecer el carrito en otro dispositivo'
);

check(
  'Precio y stock siguen validados por el checkout seguro',
  checkout.includes('expectedSubtotal') &&
    checkout.includes('transaction.get(productRef)') &&
    checkout.includes("throw appError('quote_changed'") &&
    checkout.includes("throw appError('insufficient_stock'"),
  'La sincronización del carrito no reemplaza la validación del servidor'
);

check(
  'El carrito se carga en todas las páginas públicas',
  quality.includes('function bootCartPhase7()') &&
    quality.includes("import(versioned('./cart-sync.js'))") &&
    quality.includes('bootCartPhase7();'),
  'No debe depender de que cada HTML recuerde importar el módulo'
);

check(
  'Firestore mantiene el carrito privado por UID',
  rules.includes('match /cart/{itemId}') &&
    rules.includes('request.auth.uid == userId') &&
    rules.includes('!isBlockedUser()'),
  'Una cuenta nunca debe leer el carrito de otra'
);

check(
  'Existe un comando de auditoría dedicado',
  pkg.includes('"audit:cart": "node scripts/audit-cart-phase7.js"'),
  'Falta npm run audit:cart'
);

if (failures) {
  console.error(`\nAuditoría Fase 7: ${failures} fallo(s).`);
  process.exit(1);
}

console.log('\nAuditoría Fase 7: todo correcto.');
