'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(path.join(root, file), content.replace(/\r\n/g, '\n'));
}

function replaceExact(source, before, after, label, expected = 1) {
  const count = source.split(before).length - 1;
  if (count !== expected) {
    throw new Error(`${label}: se esperaban ${expected} coincidencias y se encontraron ${count}.`);
  }
  return source.split(before).join(after);
}

function replaceRegex(source, regex, after, label, expected = 1) {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const global = new RegExp(regex.source, flags);
  const count = [...source.matchAll(global)].length;
  if (count !== expected) {
    throw new Error(`${label}: se esperaban ${expected} coincidencias y se encontraron ${count}.`);
  }
  return source.replace(regex, after);
}

function replaceFirstAfter(source, marker, before, after, label) {
  const markerIndex = typeof marker === 'string'
    ? source.indexOf(marker)
    : source.search(marker);
  if (markerIndex < 0) throw new Error(`${label}: no se encontró el marcador.`);
  const targetIndex = source.indexOf(before, markerIndex);
  if (targetIndex < 0) throw new Error(`${label}: no se encontró el bloque objetivo.`);
  return source.slice(0, targetIndex) + after + source.slice(targetIndex + before.length);
}

function replaceOrderUpdateInsideSave(source) {
  const markers = ['window.saveOrderEdit', 'async function saveOrderEdit', 'function saveOrderEdit'];
  const positions = markers.map(marker => source.indexOf(marker)).filter(index => index >= 0);
  if (!positions.length) throw new Error('saveOrderEdit: no se encontró la función.');
  const start = Math.min(...positions);
  const tail = source.slice(start);
  const regex = /await updateDoc\(doc\(db, 'orders', ([A-Za-z_$][\w$]*)\), \{/;
  const match = tail.match(regex);
  if (!match) throw new Error('saveOrderEdit: no se encontró la escritura del pedido.');
  const absolute = start + match.index;
  const replacement = `await window.TintinInventoryIntegrity.updateEditedOrder(${match[1]}, {`;
  return source.slice(0, absolute) + replacement + source.slice(absolute + match[0].length);
}

function patchRules() {
  let rules = read('firestore.rules');

  rules = replaceExact(
    rules,
    '      allow create, update: if isStoreOpenOrAllowed() && presenceIsValid(visitorId);',
    '      allow create, update: if false;',
    'Cerrar escrituras públicas de presencia'
  );
  rules = replaceExact(
    rules,
    '      allow create: if isStoreOpenOrAllowed() && trafficSessionIsValid(dateKey, sessionId);',
    '      allow create: if false;',
    'Cerrar escrituras públicas de tráfico'
  );

  const checkoutGuard = `
    function checkoutGuardOnlyUpdate(userId) {
      return isSignedIn() &&
        request.auth.uid == userId &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'lastCheckoutAt', 'lastCheckoutOrderId', 'updatedAt'
        ]) &&
        request.resource.data.lastCheckoutAt == request.time &&
        request.resource.data.updatedAt == request.time &&
        request.resource.data.lastCheckoutOrderId is string &&
        request.resource.data.lastCheckoutOrderId.size() >= 16 &&
        request.resource.data.lastCheckoutOrderId.size() <= 260 &&
        (
          !('lastCheckoutAt' in resource.data) ||
          request.time > resource.data.lastCheckoutAt + duration.value(90, 's')
        );
    }
`;
  rules = replaceRegex(
    rules,
    /(    function loginMetadataOnlyUpdate\(\) \{[\s\S]*?\n    \}\n)\n(    function protectedUserFieldsChanged\(\) \{)/,
    `$1${checkoutGuard}\n$2`,
    'Agregar guard atómico de checkout'
  );
  rules = replaceFirstAfter(
    rules,
    'function protectedUserFieldsChanged()',
    "        'profileStatsUpdatedAt', 'orderStats'",
    "        'profileStatsUpdatedAt', 'orderStats', 'lastCheckoutAt', 'lastCheckoutOrderId'",
    'Proteger campos del guard de checkout'
  );
  rules = replaceExact(
    rules,
    `            ) ||
            loginMetadataOnlyUpdate()
          )`,
    `            ) ||
            loginMetadataOnlyUpdate() ||
            checkoutGuardOnlyUpdate(userId)
          )`,
    'Autorizar solamente la actualización controlada del guard'
  );

  const quantityHelpers = `

    function sparkItemQtyForProduct(items, index, productId) {
      return items.size() > index && items[index].id == productId
        ? items[index].qty
        : 0;
    }

    function sparkOrderQtyForProduct(data, productId) {
      let items = data.items;
      return
        sparkItemQtyForProduct(items, 0, productId) +
        sparkItemQtyForProduct(items, 1, productId) +
        sparkItemQtyForProduct(items, 2, productId) +
        sparkItemQtyForProduct(items, 3, productId);
    }`;
  rules = replaceExact(
    rules,
    `    function sparkOrderPath(orderId) {
      return /databases/$(database)/documents/orders/$(orderId);
    }`,
    `    function sparkOrderPath(orderId) {
      return /databases/$(database)/documents/orders/$(orderId);
    }${quantityHelpers}`,
    'Agregar cálculo fijo de cantidad por producto'
  );
  rules = replaceExact(
    rules,
    `      let product = exists(sparkProductPath(productId))
        ? get(sparkProductPath(productId)).data
        : null;`,
    `      let product = exists(sparkProductPath(productId))
        ? get(sparkProductPath(productId)).data
        : null;
      let productAfter = existsAfter(sparkProductPath(productId))
        ? getAfter(sparkProductPath(productId)).data
        : null;`,
    'Leer estado posterior del producto'
  );
  rules = replaceExact(
    rules,
    `        // No se usa getAfter(sparkProductPath(...)) acá: leer el estado
        // posterior de un documento que la MISMA transacción también está
        // escribiendo (transaction.update() del stock) crea una dependencia
        // circular entre esta regla y la de products/{productId} dentro de
        // un mismo commit, y las escrituras terminan siendo rechazadas. El
        // descuento exacto de stock ya lo exige sparkStockUpdateValid del
        // lado del producto; acá alcanza con confirmar que había stock
        // suficiente antes de descontar.
        (
          !('stock' in product) ||
          product.stock == null ||
          (
            product.stock is number &&
            product.stock >= item.qty
          )
        );`,
    `        (
          !('stock' in product) ||
          product.stock == null ||
          (
            product.stock is number &&
            product.stock >= item.qty &&
            productAfter != null &&
            productAfter.stock is number &&
            productAfter.stock == product.stock - item.qty &&
            productAfter.lastStockOrderId == orderId
          )
        );`,
    'Amarrar cada ítem al stock posterior exacto'
  );

  rules = replaceExact(
    rules,
    `      let userData = userDocExists()
        ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data
        : null;`,
    `      let userPath = /databases/$(database)/documents/users/$(request.auth.uid);
      let userData = existsAfter(userPath)
        ? getAfter(userPath).data
        : null;`,
    'Leer el perfil posterior con el guard de checkout'
  );
  rules = replaceExact(
    rules,
    `          'status', 'notes', 'notificationStatus', 'createdAt', 'updatedAt'
        ])`,
    `          'status', 'notes', 'notificationStatus',
          'inventoryState', 'inventoryRevision', 'inventoryUpdatedAt',
          'inventoryUpdatedBy', 'createdAt', 'updatedAt'
        ])`,
    'Permitir metadatos de integridad de inventario en pedidos nuevos'
  );
  rules = replaceFirstAfter(
    rules,
    'function sparkOrderCreateValid(orderId)',
    `        ) &&
        orderId == request.auth.uid + '_' + data.requestId &&`,
    `        ) &&
        (
          isSuperAdmin() ||
          (
            userData != null &&
            userData.get('blocked', false) != true &&
            userData.lastCheckoutOrderId == orderId &&
            userData.lastCheckoutAt == request.time
          )
        ) &&
        orderId == request.auth.uid + '_' + data.requestId &&`,
    'Exigir guard atómico al crear el pedido'
  );
  rules = replaceExact(
    rules,
    `        data.notificationStatus == 'pending' &&
        data.createdAt == request.time &&`,
    `        data.notificationStatus == 'pending' &&
        data.inventoryState == 'reserved' &&
        data.inventoryRevision == 1 &&
        data.inventoryUpdatedAt == request.time &&
        data.inventoryUpdatedBy == request.auth.token.email &&
        data.createdAt == request.time &&`,
    'Exigir inventario reservado al crear el pedido'
  );

  const stockAndAdminHelpers = `    function sparkStockUpdateValid(productId) {
      let orderId = request.resource.data.lastStockOrderId;
      let orderPath = sparkOrderPath(orderId);
      let orderData = existsAfter(orderPath) ? getAfter(orderPath).data : null;
      let orderedQty = orderData != null
        ? sparkOrderQtyForProduct(orderData, productId)
        : 0;
      return isSignedIn() &&
        orderId is string &&
        orderId.size() > 0 &&
        !exists(orderPath) &&
        existsAfter(orderPath) &&
        orderData != null &&
        orderData.source == 'spark-checkout-v1' &&
        orderData.userId == request.auth.uid &&
        orderId == request.auth.uid + '_' + orderData.requestId &&
        orderedQty > 0 &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'stock', 'lastStockOrderId', 'updatedAt'
        ]) &&
        resource.data.stock is number &&
        request.resource.data.stock is number &&
        request.resource.data.stock == resource.data.stock - orderedQty &&
        request.resource.data.stock >= 0 &&
        request.resource.data.updatedAt == request.time;
    }

    function orderStateReservesInventory(data) {
      let state = data.get('inventoryState', '');
      return state == 'reserved' ||
        (
          state == '' &&
          data.status != 'cancelado' &&
          data.status != 'rechazado'
        );
    }

    function staffOrderProductInventoryValid(beforeOrder, afterOrder, productId, orderId) {
      let beforeQty = orderStateReservesInventory(beforeOrder)
        ? sparkOrderQtyForProduct(beforeOrder, productId)
        : 0;
      let afterQty = orderStateReservesInventory(afterOrder)
        ? sparkOrderQtyForProduct(afterOrder, productId)
        : 0;
      let productPath = sparkProductPath(productId);
      let beforeProduct = exists(productPath) ? get(productPath).data : null;
      let afterProduct = existsAfter(productPath) ? getAfter(productPath).data : null;
      return beforeQty == afterQty ||
        (
          beforeProduct != null &&
          afterProduct != null &&
          (
            (
              beforeProduct.get('stock', null) == null &&
              afterProduct.get('stock', null) == null
            ) ||
            (
              beforeProduct.stock is number &&
              afterProduct.stock is number &&
              afterProduct.stock == beforeProduct.stock + beforeQty - afterQty &&
              afterProduct.lastInventoryOrderId == orderId &&
              (
                (afterQty > beforeQty && afterProduct.lastInventoryAction == 'reserve') ||
                (afterQty < beforeQty && afterProduct.lastInventoryAction == 'release')
              )
            )
          )
        );
    }

    function staffOrderItemInventoryAtValid(beforeOrder, afterOrder, index, orderId) {
      return beforeOrder.items.size() <= index ||
        staffOrderProductInventoryValid(
          beforeOrder,
          afterOrder,
          beforeOrder.items[index].id,
          orderId
        );
    }

    function staffOrderInventoryTransitionValid(orderId) {
      let beforeOrder = resource.data;
      let afterOrder = request.resource.data;
      let statusChanged = afterOrder.status != beforeOrder.status;
      return !statusChanged ||
        (
          afterOrder.inventoryState == (
            afterOrder.status == 'cancelado' || afterOrder.status == 'rechazado'
              ? 'released'
              : 'reserved'
          ) &&
          afterOrder.inventoryRevision is int &&
          afterOrder.inventoryRevision == beforeOrder.get('inventoryRevision', 0) + 1 &&
          afterOrder.inventoryUpdatedAt == request.time &&
          afterOrder.inventoryUpdatedBy == request.auth.token.email &&
          staffOrderItemInventoryAtValid(beforeOrder, afterOrder, 0, orderId) &&
          staffOrderItemInventoryAtValid(beforeOrder, afterOrder, 1, orderId) &&
          staffOrderItemInventoryAtValid(beforeOrder, afterOrder, 2, orderId) &&
          staffOrderItemInventoryAtValid(beforeOrder, afterOrder, 3, orderId)
        );
    }

    function adminInventoryStockUpdateValid(productId) {
      let orderId = request.resource.data.lastInventoryOrderId;
      let orderPath = sparkOrderPath(orderId);
      let beforeOrder = exists(orderPath) ? get(orderPath).data : null;
      let afterOrder = existsAfter(orderPath) ? getAfter(orderPath).data : null;
      let beforeQty = beforeOrder != null && orderStateReservesInventory(beforeOrder)
        ? sparkOrderQtyForProduct(beforeOrder, productId)
        : 0;
      let afterQty = afterOrder != null && orderStateReservesInventory(afterOrder)
        ? sparkOrderQtyForProduct(afterOrder, productId)
        : 0;
      return isSignedIn() &&
        (hasRole('admin') || hasRole('agent')) &&
        currentRolePermAllows('pedidos', 'cambiarEstado') &&
        orderId is string &&
        beforeOrder != null &&
        afterOrder != null &&
        beforeQty != afterQty &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'stock', 'lastInventoryOrderId', 'lastInventoryAction', 'updatedAt'
        ]) &&
        resource.data.stock is number &&
        request.resource.data.stock is number &&
        request.resource.data.stock == resource.data.stock + beforeQty - afterQty &&
        request.resource.data.stock >= 0 &&
        (
          (afterQty > beforeQty && request.resource.data.lastInventoryAction == 'reserve') ||
          (afterQty < beforeQty && request.resource.data.lastInventoryAction == 'release')
        ) &&
        request.resource.data.updatedAt == request.time;
    }

`;
  rules = replaceRegex(
    rules,
    /    function sparkStockUpdateValid\(productId\) \{[\s\S]*?\n    \}\n\n(?=    \/\* ============================================================\n       SETTINGS)/,
    stockAndAdminHelpers,
    'Reemplazar validación débil de stock y agregar reconciliación administrativa'
  );

  rules = replaceFirstAfter(
    rules,
    'match /products/{productId}',
    '      allow read: if isStoreOpenOrAllowed();',
    `      allow get: if isStoreOpenOrAllowed();
      allow list: if isSuperAdmin() ||
        (
          isStoreOpenOrAllowed() &&
          request.query.limit != null &&
          request.query.limit <= 1000
        );`,
    'Limitar enumeración pública de productos'
  );
  rules = replaceFirstAfter(
    rules,
    'match /products/{productId}',
    `      allow update: if isSuperAdmin() ||
        sparkStockUpdateValid(productId) ||`,
    `      allow update: if isSuperAdmin() ||
        sparkStockUpdateValid(productId) ||
        adminInventoryStockUpdateValid(productId) ||`,
    'Permitir reconciliación de inventario ligada a estados'
  );
  rules = replaceFirstAfter(
    rules,
    'match /collections/{collectionId}',
    '      allow read: if isStoreOpenOrAllowed();',
    `      allow get: if isStoreOpenOrAllowed();
      allow list: if isSuperAdmin() ||
        (
          isStoreOpenOrAllowed() &&
          request.query.limit != null &&
          request.query.limit <= 200
        );`,
    'Limitar enumeración pública de colecciones'
  );
  rules = replaceFirstAfter(
    rules,
    'match /site_content/{pageId}',
    '      allow read: if isStoreOpenOrAllowed();',
    `      allow get: if isStoreOpenOrAllowed();
      allow list: if isSuperAdmin();`,
    'Impedir enumeración pública de contenido'
  );

  rules = replaceRegex(
  rules,
  /(currentRolePermAllows\('pedidos', 'cambiarEstado'\)\s+\)\s+&&)\s+(\()/,
  `$1\n              staffOrderInventoryTransitionValid(orderId) &&\n              $2`,
  'Exigir reconciliación al cambiar el estado del pedido'
);

  write('firestore.rules', rules);
}

function patchCheckout() {
  let source = read('js/secure-checkout-order.js');
  source = replaceExact(
    source,
    "  const DEFAULT_STORE_WHATSAPP = '595981299331';",
    "  const DEFAULT_STORE_WHATSAPP = '595981299331';\n  const CHECKOUT_COOLDOWN_MS = 90 * 1000;",
    'Agregar intervalo de seguridad del checkout'
  );
  source = replaceExact(
    source,
    `      const settings = settingsSnap.data() || {};
      const userData = userSnap.exists() ? userSnap.data() || {} : {};`,
    `      const settings = settingsSnap.data() || {};
      if (!userSnap.exists()) {
        throw appError('profile_missing', 'No pudimos comprobar tu perfil. Cerrá sesión y volvé a ingresar.');
      }
      const userData = userSnap.data() || {};
      const lastCheckoutAt = userData.lastCheckoutAt;
      const lastCheckoutMs = typeof lastCheckoutAt?.toMillis === 'function'
        ? lastCheckoutAt.toMillis()
        : Number(new Date(lastCheckoutAt || 0));
      if (
        email !== SUPER_ADMIN_EMAIL &&
        Number.isFinite(lastCheckoutMs) &&
        Date.now() - lastCheckoutMs < CHECKOUT_COOLDOWN_MS
      ) {
        const remaining = Math.max(1, Math.ceil((CHECKOUT_COOLDOWN_MS - (Date.now() - lastCheckoutMs)) / 1000));
        throw appError('checkout_cooldown', 'Esperá un momento antes de crear otro pedido.', { remaining });
      }`,
    'Validar perfil y frecuencia antes del pedido'
  );
  source = replaceExact(
    source,
    `        notificationStatus: 'pending',
        createdAt: serverTimestamp(),`,
    `        notificationStatus: 'pending',
        inventoryState: 'reserved',
        inventoryRevision: 1,
        inventoryUpdatedAt: serverTimestamp(),
        inventoryUpdatedBy: email,
        createdAt: serverTimestamp(),`,
    'Marcar inventario reservado en pedidos nuevos'
  );
  source = replaceExact(
    source,
    `      transaction.set(orderRef, orderData);`,
    `      transaction.update(userRef, {
        lastCheckoutAt: serverTimestamp(),
        lastCheckoutOrderId: orderId,
        updatedAt: serverTimestamp()
      });
      transaction.set(orderRef, orderData);`,
    'Actualizar guard del usuario en la misma transacción'
  );
  source = replaceExact(
    source,
    `    });
  }

  function buildWhatsAppMessage`,
    `    }, { maxAttempts: 2 });
  }

  function buildWhatsAppMessage`,
    'Reducir reintentos internos de la transacción'
  );
  source = replaceExact(
    source,
    `      settings_missing: 'No pudimos comprobar la configuración de la tienda.',
      login_required: 'Necesitás iniciar sesión con un correo verificado.',`,
    `      settings_missing: 'No pudimos comprobar la configuración de la tienda.',
      profile_missing: 'No pudimos comprobar tu perfil. Cerrá sesión y volvé a ingresar.',
      checkout_cooldown: error?.details?.remaining
        ? \`Esperá \${error.details.remaining} segundos antes de crear otro pedido.\`
        : 'Esperá un momento antes de crear otro pedido.',
      login_required: 'Necesitás iniciar sesión con un correo verificado.',`,
    'Mostrar mensaje claro del guard de frecuencia'
  );
  write('js/secure-checkout-order.js', source);
}

function patchAdmin() {
  let source = read('js/admin-app.js');
  source = replaceExact(
    source,
    `import { attachColorPicker } from "./color-picker-widget.js?v=tintin-20260716-cloudinary-fix-1";`,
    `import { attachColorPicker } from "./color-picker-widget.js?v=tintin-20260716-cloudinary-fix-1";
import './admin-inventory-integrity.js?v=tintin-20260720-critical-healing-1';`,
    'Cargar reconciliador de inventario en el panel'
  );
  source = replaceFirstAfter(
  source,
  'window.saveOrderEdit',
  "    await updateDoc(doc(db, 'orders', orderId), updateData);",
  "    await window.TintinInventoryIntegrity.updateEditedOrder(orderId, updateData);",
  'Reconciliar inventario en la edición completa del pedido'
);
  source = replaceFirstAfter(
    source,
    'window.updateOrderStatus',
    `    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp()
    });`,
    `    await window.TintinInventoryIntegrity.transitionStatus(orderId, status);`,
    'Reconciliar stock al cambiar estado'
  );
  source = replaceFirstAfter(
    source,
    'window.deleteOrder',
    `    await deleteDoc(doc(db, 'orders', orderId));`,
    `    await window.TintinInventoryIntegrity.deleteOrder(orderId);`,
    'Restaurar stock antes de eliminar pedido'
  );
  source = replaceFirstAfter(
    source,
    'window.bulkChangeOrderStatus',
    `    await batchUpdateChunked(ids, () => ({ status, updatedAt: serverTimestamp() }), 'orders');`,
    `    for (const id of ids) {
      await window.TintinInventoryIntegrity.transitionStatus(id, status);
    }`,
    'Reconciliar stock en cambios masivos de estado'
  );
  source = replaceFirstAfter(
    source,
    'window.bulkDeleteOrders',
    `    const CHUNK = 450;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = writeBatch(db);
      ids.slice(i, i + CHUNK).forEach(id => batch.delete(doc(db, 'orders', id)));
      await batch.commit();
    }`,
    `    for (const id of ids) {
      await window.TintinInventoryIntegrity.deleteOrder(id);
    }`,
    'Restaurar stock en eliminaciones masivas'
  );
  write('js/admin-app.js', source);
}

function patchActivityAndReadCaps() {
  let activity = read('js/site-activity.js');
  activity = replaceExact(
    activity,
    `if (!window.TintinSiteActivityBooted) {
  window.TintinSiteActivityBooted = true;`,
    `if (window.TINTIN_ENABLE_PUBLIC_ACTIVITY !== true) {
  document.documentElement.dataset.ttActivityState = 'disabled-quota-protection';
  window.TintinSiteActivity = Object.freeze({ status: 'disabled-quota-protection' });
}

if (!window.TintinSiteActivityBooted && window.TINTIN_ENABLE_PUBLIC_ACTIVITY === true) {
  window.TintinSiteActivityBooted = true;`,
    'Desactivar analítica Firestore pública por defecto'
  );
  write('js/site-activity.js', activity);

  let products = read('js/products-store.js');
  products = replaceExact(products, "limit(10000)", "limit(1000)", 'Reducir máximo público de productos');
  write('js/products-store.js', products);

  let collections = read('js/collections-store.js');
  collections = replaceExact(collections, "limit(5000)", "limit(200)", 'Reducir máximos de colecciones', 2);
  write('js/collections-store.js', collections);
}

function patchAppCheckReadiness() {
  let firebase = read('js/firebase.js');
  firebase = replaceExact(
    firebase,
    `import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";`,
    `import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js";`,
    'Importar soporte de Firebase App Check'
  );
  firebase = replaceExact(
    firebase,
    `const app = getApps().length ? getApp() : initializeApp(firebaseConfig);`,
    `const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Clave pública de reCAPTCHA v3 creada desde Firebase Console → App Check.
// Al cargarla y activar Enforcement en Firestore, las llamadas que no provengan
// de la web legítima quedan rechazadas antes de consumir la API normalmente.
const FIREBASE_APP_CHECK_SITE_KEY = '';
if (FIREBASE_APP_CHECK_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(FIREBASE_APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
  window.TintinAppCheckStatus = 'enabled';
} else {
  window.TintinAppCheckStatus = 'configuration-required';
}`,
    'Preparar inicialización real de App Check'
  );
  write('js/firebase.js', firebase);
}

function patchLegacyAudits() {
  let audit = read('scripts/audit-secure-orders.js');
  audit = replaceRegex(
    audit,
    /check\(\n  'Las reglas exigen el descuento de stock',[\s\S]*?\n\);\ncheck\(\n  'Las reglas validan subtotal y total'/,
    `check(
  'Las reglas exigen el descuento exacto y vinculado al pedido',
  rules.includes('productAfter.stock == product.stock - item.qty') &&
    rules.includes('sparkOrderQtyForProduct(orderData, productId)') &&
    rules.includes('request.resource.data.stock == resource.data.stock - orderedQty'),
  'Un pedido debe descontar exactamente su cantidad y no puede tocar productos ajenos.'
);
check(
  'Las reglas validan subtotal y total'`,
    'Actualizar auditoría histórica de stock'
  );
  write('scripts/audit-secure-orders.js', audit);
}

function patchPackageAndWorkflow() {
  const packagePath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  pkg.scripts['audit:critical-healing'] = 'node scripts/audit-critical-healing.js && node scripts/test-inventory-model.mjs';
  pkg.scripts['test:rules-critical'] = 'firebase emulators:exec --only firestore --project demo-tintin-critical "node scripts/test-firestore-critical.mjs"';
  if (!pkg.scripts['audit:final'].includes('audit:critical-healing')) {
    pkg.scripts['audit:final'] += ' && npm run audit:critical-healing';
  }
  pkg.devDependencies = {
    ...(pkg.devDependencies || {}),
    '@firebase/rules-unit-testing': '3.0.3',
    firebase: '10.12.0',
    'firebase-tools': '13.15.0'
  };
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

  let workflow = read('.github/workflows/tintin-audit.yml');
  workflow = replaceExact(
    workflow,
    `      - name: Firestore read budget audit
        run: node scripts/audit-firestore-read-budget.js

      - name: Post-optimization regression tripwire`,
    `      - name: Firestore read budget audit
        run: node scripts/audit-firestore-read-budget.js

      - name: Audit critical inventory and quota healing
        run: npm run audit:critical-healing

      - name: Install Firestore rules test dependencies
        run: npm install --no-save --package-lock=false @firebase/rules-unit-testing@3.0.3 firebase@10.12.0 firebase-tools@13.15.0

      - name: Run adversarial Firestore emulator tests
        run: npm run test:rules-critical

      - name: Post-optimization regression tripwire`,
    'Integrar pruebas críticas al workflow'
  );
  write('.github/workflows/tintin-audit.yml', workflow);
}

function removeOneTimeFiles() {
  for (const file of [
    'scripts/apply-critical-healing-once.cjs',
    '.github/workflows/critical-healing-apply.yml'
  ]) {
    const target = path.join(root, file);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}

patchRules();
patchCheckout();
patchAdmin();
patchActivityAndReadCaps();
patchAppCheckReadiness();
patchLegacyAudits();
patchPackageAndWorkflow();
// La limpieza temporal se realiza después del push validado.

console.log('Parche crítico aplicado y verificado sobre los archivos actuales.');
