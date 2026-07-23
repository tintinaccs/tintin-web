import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';

const projectId = 'demo-tintin-critical';
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules, host: '127.0.0.1', port: 8080 }
});

const clientClaims = { email: 'clienta@example.com', email_verified: true };

function orderPayload(uid, requestId, items, state = 'pending') {
  const reserved = state === 'reserved';
  return {
    requestId,
    source: 'spark-checkout-v1',
    shortId: requestId.slice(-8).toUpperCase(),
    userId: uid,
    userEmail: clientClaims.email,
    contactEmail: clientClaims.email,
    userName: 'Clienta Prueba',
    userPhone: '595981123456',
    items,
    subtotal: items.reduce((sum, item) => sum + item.price * item.qty, 0),
    shippingCost: 15000,
    shippingPending: false,
    total: items.reduce((sum, item) => sum + item.price * item.qty, 0) + 15000,
    storeWhatsapp: '595981299331',
    storeInstagram: '',
    shipping: {
      method: 'delivery', city: 'Asunción', rateIndex: 0,
      address: '', referencia: '', zone: 'central',
      mapLocation: { lat: -25.29, lng: -57.58, name: 'Casa', address: '' }
    },
    payment: { method: 'efectivo', status: 'pendiente' },
    paymentStatus: 'pendiente',
    status: reserved ? 'pendiente' : 'inventory_pending',
    notes: '',
    notificationStatus: 'pending',
    inventoryState: reserved ? 'reserved' : 'pending',
    inventoryRevision: reserved ? 1 : 0,
    inventoryUpdatedAt: serverTimestamp(),
    inventoryUpdatedBy: clientClaims.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

async function seedBase() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'settings', 'storeGate'), { storeOpen: true, maintenanceAccess: {} });
    await setDoc(doc(db, 'settings', 'general'), {
      storeOpen: true,
      paymentMethods: { efectivo: true, transferencia: true },
      deliveryCost: 15000,
      deliveryCities: [{ name: 'Asunción', price: 15000 }],
      encomiendaCost: 25000,
      encomiendaCities: []
    });
    await setDoc(doc(db, 'users', 'u1'), {
      email: clientClaims.email, role: 'client', blocked: false, name: 'Clienta Prueba'
    });
    await setDoc(doc(db, 'products', 'p1'), {
      name: 'Producto 1', category: 'aros', price: 50000, stock: 10, active: true
    });
    await setDoc(doc(db, 'products', 'p2'), {
      name: 'Producto 2', category: 'anillos', price: 30000, stock: 7, active: true
    });
  });
}

async function reserveGuard(requestId) {
  const db = testEnv.authenticatedContext('u1', clientClaims).firestore();
  const orderId = `u1_${requestId}`;
  return runTransaction(db, async transaction => {
    const guardRef = doc(db, 'checkoutGuards', 'u1');
    await transaction.get(guardRef);
    transaction.set(guardRef, {
      userId: 'u1',
      lastCheckoutAt: serverTimestamp(),
      lastCheckoutOrderId: orderId,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, { maxAttempts: 1 });
}

function testItem() {
  return {
    id: 'p1', name: 'Producto 1', cat: 'aros',
    price: 50000, qty: 2, variant: '', imageUrl: ''
  };
}

async function createPendingOrder(requestId) {
  const db = testEnv.authenticatedContext('u1', clientClaims).firestore();
  const orderId = `u1_${requestId}`;
  await reserveGuard(requestId);
  return setDoc(doc(db, 'orders', orderId), orderPayload('u1', requestId, [testItem()], 'pending'));
}

async function reserveInventory({ requestId, decrement = 2, updateProduct = true, unrelated = false }) {
  const db = testEnv.authenticatedContext('u1', clientClaims).firestore();
  const orderId = `u1_${requestId}`;
  return runTransaction(db, async transaction => {
    const orderRef = doc(db, 'orders', orderId);
    const productRef = doc(db, 'products', unrelated ? 'p2' : 'p1');
    await transaction.get(orderRef);
    const productSnapshot = await transaction.get(productRef);
    if (updateProduct) {
      transaction.update(productRef, {
        stock: Number(productSnapshot.data().stock) - decrement,
        lastStockOrderId: orderId,
        updatedAt: serverTimestamp()
      });
    }
    transaction.update(orderRef, {
      status: 'pendiente',
      inventoryState: 'reserved',
      inventoryRevision: 1,
      inventoryUpdatedAt: serverTimestamp(),
      inventoryUpdatedBy: clientClaims.email,
      updatedAt: serverTimestamp()
    });
  }, { maxAttempts: 1 });
}

async function checkoutFlow(options) {
  await createPendingOrder(options.requestId);
  return reserveInventory(options);
}

try {
  await seedBase();
  await assertSucceeds(checkoutFlow({ requestId: 'req_exact_123456', decrement: 2 }));

  await seedBase();
  await assertFails(checkoutFlow({ requestId: 'req_under_123456', decrement: 1 }));

  await seedBase();
  await assertFails(checkoutFlow({ requestId: 'req_over_123456', decrement: 4 }));

  await seedBase();
  await assertFails(checkoutFlow({ requestId: 'req_none_123456', updateProduct: false }));

  await seedBase();
  await assertFails(checkoutFlow({ requestId: 'req_other_123456', decrement: 2, unrelated: true }));

  await seedBase();
  await assertSucceeds(checkoutFlow({ requestId: 'req_first_123456', decrement: 2 }));
  await assertFails(reserveGuard('req_second_123456'));

  await seedBase();
  const anonDb = testEnv.unauthenticatedContext().firestore();
  // Reactivada tras el incidente de cuota (freno de 20s + App Check en
  // producción): una escritura anónima bien formada YA debe poder crear su
  // propio documento de presencia/tráfico. Lo que sigue debiendo fallar es
  // (a) un payload mal formado y (b) reescribir el mismo doc antes de los 20s.
  await assertSucceeds(setDoc(doc(anonDb, 'sitePresence', 'visitor_123456'), {
    visitorId: 'visitor_123456', sessionId: 'session_123456', userId: '',
    page: '/', lastSeen: serverTimestamp(), city: '', region: '', country: '',
    countryCode: '', geoSource: 'unavailable'
  }));
  await assertFails(setDoc(doc(anonDb, 'sitePresence', 'visitor_123456'), {
    visitorId: 'visitor_123456', sessionId: 'session_123456', userId: '',
    page: '/', lastSeen: serverTimestamp(), city: '', region: '', country: '',
    countryCode: '', geoSource: 'unavailable'
  }));
  await assertFails(setDoc(doc(anonDb, 'sitePresence', 'visitor_malformed'), {
    visitorId: 'visitor_malformed', sessionId: 'short', userId: '',
    page: '/', lastSeen: serverTimestamp(), city: '', region: '', country: '',
    countryCode: '', geoSource: 'unavailable'
  }));
  await assertSucceeds(setDoc(doc(anonDb, 'siteTraffic', '2026-07-20', 'sessions', 'session_123456'), {
    dayKey: '2026-07-20', sessionId: 'session_123456', visitorId: 'visitor_123456',
    userId: '', landingPage: '/', startedAt: serverTimestamp(), city: '', region: '',
    country: '', countryCode: '', geoSource: 'unavailable'
  }));
  await assertFails(setDoc(doc(anonDb, 'siteTraffic', '2026-07-20', 'sessions', 'session_123456'), {
    dayKey: '2026-07-20', sessionId: 'session_123456', visitorId: 'visitor_123456',
    userId: '', landingPage: '/otra', startedAt: serverTimestamp(), city: '', region: '',
    country: '', countryCode: '', geoSource: 'unavailable'
  }));

  await seedBase();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'agent1'), {
      email: 'agent@example.com', role: 'agent', blocked: false
    });
    await setDoc(doc(db, 'rolePermissions', 'main'), {
      agent: { pedidos: { ver: true, cambiarEstado: true } }
    });
    await setDoc(doc(db, 'products', 'p1'), {
      name: 'Producto 1', category: 'aros', price: 50000, stock: 8, active: true
    });
    await setDoc(doc(db, 'orders', 'u1_existing_order'), {
      ...orderPayload('u1', 'existing_order', [testItem()], 'reserved'),
      createdAt: new Date(), updatedAt: new Date(), inventoryUpdatedAt: new Date()
    });
  });

  const agentDb = testEnv.authenticatedContext('agent1', {
    email: 'agent@example.com', email_verified: true
  }).firestore();

  await assertFails(setDoc(doc(agentDb, 'orders', 'u1_existing_order'), {
    status: 'cancelado', inventoryState: 'released', inventoryRevision: 2,
    inventoryUpdatedAt: serverTimestamp(), inventoryUpdatedBy: 'agent@example.com',
    updatedAt: serverTimestamp()
  }, { merge: true }));

  await assertSucceeds(runTransaction(agentDb, async transaction => {
    const orderRef = doc(agentDb, 'orders', 'u1_existing_order');
    const productRef = doc(agentDb, 'products', 'p1');
    await transaction.get(orderRef);
    const product = await transaction.get(productRef);
    transaction.update(productRef, {
      stock: Number(product.data().stock) + 2,
      lastInventoryOrderId: 'u1_existing_order',
      lastInventoryAction: 'release',
      updatedAt: serverTimestamp()
    });
    transaction.update(orderRef, {
      status: 'cancelado', inventoryState: 'released', inventoryRevision: 2,
      inventoryUpdatedAt: serverTimestamp(), inventoryUpdatedBy: 'agent@example.com',
      updatedAt: serverTimestamp()
    });
  }, { maxAttempts: 1 }));

  // La eliminación real de Super Admin libera primero el inventario y borra
  // después. Así, si el borrado falla o se reintenta, inventoryState=released
  // impide devolver el stock dos veces y no se necesitan reglas nuevas.
  await seedBase();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'products', 'p1'), {
      name: 'Producto 1', category: 'aros', price: 50000, stock: 8, active: true
    });
    await setDoc(doc(db, 'orders', 'u1_delete_order'), {
      ...orderPayload('u1', 'delete_order', [testItem()], 'reserved'),
      createdAt: new Date(), updatedAt: new Date(), inventoryUpdatedAt: new Date()
    });
  });

  const superDb = testEnv.authenticatedContext('superadmin1', {
    email: 'tintinaccs@gmail.com', email_verified: true
  }).firestore();

  await assertSucceeds(runTransaction(superDb, async transaction => {
    const orderRef = doc(superDb, 'orders', 'u1_delete_order');
    const productRef = doc(superDb, 'products', 'p1');
    const order = await transaction.get(orderRef);
    const product = await transaction.get(productRef);
    assert.equal(order.exists(), true);
    transaction.update(productRef, {
      stock: Number(product.data().stock) + 2,
      lastInventoryOrderId: 'u1_delete_order',
      lastInventoryAction: 'release',
      updatedAt: serverTimestamp()
    });
    transaction.update(orderRef, {
      status: 'cancelado',
      inventoryState: 'released',
      inventoryRevision: 2,
      inventoryUpdatedAt: serverTimestamp(),
      inventoryUpdatedBy: 'tintinaccs@gmail.com',
      updatedAt: serverTimestamp()
    });
  }, { maxAttempts: 1 }));

  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const releasedOrder = await getDoc(doc(db, 'orders', 'u1_delete_order'));
    const restoredProduct = await getDoc(doc(db, 'products', 'p1'));
    assert.equal(releasedOrder.exists(), true);
    assert.equal(releasedOrder.data().inventoryState, 'released');
    assert.equal(restoredProduct.data().stock, 10);
    assert.equal(restoredProduct.data().lastInventoryAction, 'release');
  });

  // Un reintento observa released y no vuelve a tocar el producto.
  await assertSucceeds(runTransaction(superDb, async transaction => {
    const orderRef = doc(superDb, 'orders', 'u1_delete_order');
    const order = await transaction.get(orderRef);
    assert.equal(order.data().inventoryState, 'released');
  }, { maxAttempts: 1 }));

  await assertSucceeds(runTransaction(superDb, async transaction => {
    const orderRef = doc(superDb, 'orders', 'u1_delete_order');
    const order = await transaction.get(orderRef);
    assert.equal(order.data().inventoryState, 'released');
    transaction.delete(orderRef);
  }, { maxAttempts: 1 }));

  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const deletedOrder = await getDoc(doc(db, 'orders', 'u1_delete_order'));
    const restoredProduct = await getDoc(doc(db, 'products', 'p1'));
    assert.equal(deletedOrder.exists(), false);
    assert.equal(restoredProduct.data().stock, 10);
  });

  console.log('Reglas críticas: 11 ataques/regresiones verificados.');
} finally {
  await testEnv.cleanup();
}
