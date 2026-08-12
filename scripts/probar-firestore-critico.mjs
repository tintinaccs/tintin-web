import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';

const projectId = 'demo-tintin-critical';
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules, host: '127.0.0.1', port: 8080 }
});

const claims = {
  client1: { email: 'clienta1@example.com', email_verified: true },
  client2: { email: 'clienta2@example.com', email_verified: true },
  admin1: { email: 'admin@example.com', email_verified: true },
  agent1: { email: 'agent@example.com', email_verified: true },
  viewer1: { email: 'viewer@example.com', email_verified: true },
  super1: { email: 'tintinaccs@gmail.com', email_verified: true }
};

async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'settings', 'storeGate'), { storeOpen: true, maintenanceAccess: {} });
    await setDoc(doc(db, 'settings', 'general'), {
      storeOpen: true,
      paymentMethods: { efectivo: true, transferencia: true },
      whatsappNumber: '595981299331'
    });
    await setDoc(doc(db, 'settings', 'shippingRates'), {
      deliveryCost: 15000,
      deliveryCities: [{ name: 'Asunción', price: 15000 }],
      encomiendaCost: 25000,
      encomiendaCities: []
    });
    await setDoc(doc(db, 'settings', 'privateSecrets'), { internal: 'solo-servidor' });
    await setDoc(doc(db, 'users', 'client1'), {
      email: claims.client1.email, role: 'client', blocked: false, name: 'Clienta Uno'
    });
    await setDoc(doc(db, 'users', 'client2'), {
      email: claims.client2.email, role: 'client', blocked: false, name: 'Clienta Dos'
    });
    await setDoc(doc(db, 'users', 'admin1'), {
      email: claims.admin1.email, role: 'admin', blocked: false, name: 'Admin'
    });
    await setDoc(doc(db, 'users', 'agent1'), {
      email: claims.agent1.email, role: 'agent', blocked: false, name: 'Agente'
    });
    await setDoc(doc(db, 'users', 'viewer1'), {
      email: claims.viewer1.email, role: 'viewer', blocked: false, name: 'Viewer'
    });
    await setDoc(doc(db, 'users', 'super1'), {
      email: claims.super1.email, role: 'superadmin', blocked: false, name: 'Super Admin'
    });
    await setDoc(doc(db, 'rolePermissions', 'main'), {
      admin: {
        productos: { crear: true, editar: true },
        pedidos: { ver: true, cambiarEstado: true, cambiarPago: true, reenviarCorreo: true }
      },
      agent: {
        productos: { crear: true, editar: true },
        pedidos: { ver: true, cambiarEstado: true }
      },
      viewer: {
        productos: { crear: true },
        pedidos: { ver: true }
      }
    });
    await setDoc(doc(db, 'products', 'p1'), {
      name: 'Producto 1', category: 'aros', price: 50000, stock: 10, active: true
    });
    await setDoc(doc(db, 'orders', 'client1_order1'), {
      requestId: 'order1',
      source: 'spark-checkout-v1',
      userId: 'client1',
      userEmail: claims.client1.email,
      contactEmail: claims.client1.email,
      userName: 'Clienta Uno',
      userPhone: '595981123456',
      items: [{ id: 'p1', name: 'Producto 1', price: 50000, qty: 1 }],
      subtotal: 50000,
      shippingCost: 0,
      total: 50000,
      shipping: { method: 'retiro', city: 'San Lorenzo (retiro)' },
      payment: { method: 'efectivo', status: 'pendiente' },
      paymentStatus: 'pendiente',
      status: 'pendiente',
      notificationStatus: 'pending',
      inventoryState: 'reserved',
      inventoryRevision: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await setDoc(doc(db, 'orders', 'client2_order1'), {
      userId: 'client2',
      userEmail: claims.client2.email,
      status: 'pendiente',
      paymentStatus: 'pendiente',
      inventoryState: 'reserved',
      inventoryRevision: 1,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await setDoc(doc(db, 'auditLog', 'audit1'), {
      action: 'seed', createdAt: new Date(), actorEmail: claims.super1.email
    });
  });
}

function ctx(uid) {
  return testEnv.authenticatedContext(uid, claims[uid]).firestore();
}

const directOrderPayload = {
  requestId: 'req_direct_123456',
  userId: 'client1',
  userEmail: claims.client1.email,
  source: 'spark-checkout-v1',
  items: [{ id: 'p1', name: 'Producto 1', price: 1, qty: 1 }],
  subtotal: 1,
  shippingCost: 0,
  total: 1,
  status: 'inventory_pending',
  inventoryState: 'pending',
  inventoryRevision: 0,
  notificationStatus: 'pending',
  payment: { method: 'efectivo', status: 'pendiente' },
  paymentStatus: 'pendiente',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
};

let checks = 0;
async function succeeds(promise) {
  checks += 1;
  return assertSucceeds(promise);
}
async function fails(promise) {
  checks += 1;
  return assertFails(promise);
}

try {
  await seed();

  const anon = testEnv.unauthenticatedContext().firestore();
  await succeeds(getDoc(doc(anon, 'settings', 'general')));
  await succeeds(getDoc(doc(anon, 'products', 'p1')));
  await fails(getDoc(doc(anon, 'settings', 'privateSecrets')));
  await fails(getDoc(doc(anon, 'users', 'client1')));
  await fails(getDoc(doc(anon, 'orders', 'client1_order1')));
  await fails(setDoc(doc(anon, 'orders', 'anon_order'), directOrderPayload));
  await succeeds(setDoc(doc(anon, 'sitePresence', 'visitor_123456'), {
    visitorId: 'visitor_123456',
    sessionId: 'session_123456',
    userId: '',
    page: '/',
    lastSeen: serverTimestamp(),
    city: '',
    region: '',
    country: '',
    countryCode: '',
    geoSource: 'unavailable'
  }));
  await fails(setDoc(doc(anon, 'sitePresence', 'visitor_extra'), {
    visitorId: 'visitor_extra',
    sessionId: 'session_123456',
    userId: '',
    page: '/',
    lastSeen: serverTimestamp(),
    city: '',
    region: '',
    country: '',
    countryCode: '',
    geoSource: 'unavailable',
    ip: '127.0.0.1'
  }));
  await fails(updateDoc(doc(anon, 'sitePresence', 'visitor_123456'), {
    lastSeen: serverTimestamp()
  }));

  const client1 = ctx('client1');
  await succeeds(getDoc(doc(client1, 'users', 'client1')));
  await fails(getDoc(doc(client1, 'users', 'client2')));
  await succeeds(getDoc(doc(client1, 'orders', 'client1_order1')));
  await fails(getDoc(doc(client1, 'orders', 'client2_order1')));
  await succeeds(updateDoc(doc(client1, 'users', 'client1'), { name: 'Nombre válido' }));
  await fails(updateDoc(doc(client1, 'users', 'client1'), { role: 'admin' }));
  await fails(updateDoc(doc(client1, 'users', 'client1'), { blocked: true }));
  await fails(updateDoc(doc(client1, 'products', 'p1'), { price: 1 }));
  await fails(updateDoc(doc(client1, 'products', 'p1'), { stock: 999 }));
  await fails(setDoc(doc(client1, 'orders', 'client1_req_direct_123456'), directOrderPayload));
  await fails(updateDoc(doc(client1, 'orders', 'client1_order1'), { status: 'entregado' }));
  await fails(deleteDoc(doc(client1, 'orders', 'client1_order1')));
  await fails(getDoc(doc(client1, 'settings', 'privateSecrets')));
  await fails(getDoc(doc(client1, 'auditLog', 'audit1')));
  await fails(getDoc(doc(client1, 'emailSettings', 'main')));
  await succeeds(setDoc(doc(client1, 'checkoutGuards', 'client1'), {
    userId: 'client1',
    lastCheckoutAt: serverTimestamp(),
    lastCheckoutOrderId: 'client1_request_123456789',
    updatedAt: serverTimestamp()
  }));
  await fails(setDoc(doc(client1, 'checkoutGuards', 'client1bad'), {
    userId: 'client1bad',
    lastCheckoutAt: serverTimestamp(),
    lastCheckoutOrderId: 'client1bad_request_123456789',
    updatedAt: serverTimestamp(),
    role: 'admin'
  }));

  const admin = ctx('admin1');
  await succeeds(getDoc(doc(admin, 'rolePermissions', 'main')));
  await succeeds(getDoc(doc(admin, 'orders', 'client1_order1')));
  await fails(getDoc(doc(admin, 'users', 'client1')));
  await fails(getDoc(doc(admin, 'settings', 'privateSecrets')));
  await fails(updateDoc(doc(admin, 'users', 'client1'), { role: 'admin' }));
  await succeeds(updateDoc(doc(admin, 'products', 'p1'), {
    price: 51000,
    updatedAt: serverTimestamp()
  }));

  const viewer = ctx('viewer1');
  await succeeds(getDoc(doc(viewer, 'orders', 'client1_order1')));
  await fails(setDoc(doc(viewer, 'products', 'viewer_product'), {
    name: 'No permitido', price: 1, active: true
  }));

  const superDb = ctx('super1');
  await succeeds(getDoc(doc(superDb, 'settings', 'privateSecrets')));
  await succeeds(getDoc(doc(superDb, 'users', 'client1')));
  await succeeds(getDoc(doc(superDb, 'auditLog', 'audit1')));
  await succeeds(updateDoc(doc(superDb, 'users', 'client1'), { role: 'admin' }));
  await fails(updateDoc(doc(superDb, 'users', 'client1'), { role: 'superadmin' }));
  await fails(updateDoc(doc(superDb, 'users', 'super1'), { role: 'client' }));
  await succeeds(setDoc(doc(superDb, 'orders', 'manual_order'), { ...directOrderPayload, source: 'superadmin-manual-v1' }));
  await fails(setDoc(doc(admin, 'orders', 'manual_admin_denied'), directOrderPayload));
  await fails(setDoc(doc(admin, 'orderTrash', 'admin_denied'), { orderNumber: 'TINPED99' }));
  await fails(getDoc(doc(admin, 'orderTrash', 'super_trash_test')));
  await succeeds(setDoc(doc(superDb, 'orderTrash', 'super_trash_test'), { orderNumber: 'TINPED99', status: 'cancelado' }));
  await succeeds(getDoc(doc(superDb, 'orderTrash', 'super_trash_test')));
  await succeeds(deleteDoc(doc(superDb, 'orderTrash', 'super_trash_test')));
  await succeeds(deleteDoc(doc(superDb, 'orders', 'client2_order1')));
  await fails(deleteDoc(doc(superDb, 'users', 'super1')));

  console.log('Reglas Fase 6: ' + checks + ' ataques/controles verificados.');
} finally {
  await testEnv.cleanup();
}
