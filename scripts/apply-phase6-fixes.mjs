import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(source, oldValue, newValue, label) {
  const first = source.indexOf(oldValue);
  if (first === -1) throw new Error(`No se encontró el bloque: ${label}`);
  if (source.indexOf(oldValue, first + oldValue.length) !== -1) {
    throw new Error(`El bloque aparece más de una vez: ${label}`);
  }
  return source.replace(oldValue, newValue);
}

// ---------------------------------------------------------------------------
// Firestore Rules: eliminar la vía heredada de pedidos directos desde browser.
// El checkout vigente usa Apps Script con OAuth del propietario y no depende
// de estas escrituras del cliente.
// ---------------------------------------------------------------------------
{
  const path = 'firestore.rules';
  let source = read(path);

  source = replaceOnce(
    source,
    `          (isAdmin() || isAgent() || isViewer()) &&
          currentRolePermAllows('productos', 'crear')`,
    `          (isAdmin() || isAgent()) &&
          currentRolePermAllows('productos', 'crear')`,
    'viewer no crea productos'
  );

  source = replaceOnce(
    source,
    `      allow update: if sparkStockUpdateValid(productId);
      allow update: if adminInventoryStockUpdateValid(productId);`,
    `      // El checkout actual reserva stock desde Apps Script con OAuth del
      // propietario. El navegador ya no puede descontar inventario usando la
      // ruta heredada sparkStockUpdateValid().
      allow update: if adminInventoryStockUpdateValid(productId);`,
    'retirar stock directo del cliente'
  );

  source = replaceOnce(
    source,
    `      allow create: if sparkOrderCreateValid(orderId);`,
    `      // Los pedidos se crean exclusivamente en apps-script/Phase4CreateOrder.gs.
      // Ese proceso verifica el idToken, vuelve a leer precio/stock y usa una
      // transacción privilegiada. Ningún SDK del navegador puede crear pedidos.
      allow create: if false;`,
    'pedidos solo servidor'
  );

  source = replaceOnce(
    source,
    `      allow update: if sparkInventoryReserveValid(orderId) ||
        isSuperAdmin() ||`,
    `      allow update: if isSuperAdmin() ||`,
    'retirar reserva heredada desde cliente'
  );

  source = replaceOnce(
    source,
    `      allow delete: if isSuperAdmin() || sparkPendingOrderDeleteValid();`,
    `      allow delete: if isSuperAdmin();`,
    'cliente no borra pedidos'
  );

  source = replaceOnce(
    source,
    `          (
            !('role' in request.resource.data) ||
            request.resource.data.role != 'superadmin' ||
            request.auth.token.email == "tintinaccs@gmail.com"
          )`,
    `          (
            !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']) ||
            (
              !isSuperAdminAccount(resource.data) &&
              request.resource.data.role in ['client', 'admin', 'agent', 'viewer']
            )
          )`,
    'rol superadmin no asignable'
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// Endpoint server-side: allowlists, límites y errores sanitizados.
// ---------------------------------------------------------------------------
{
  const path = 'apps-script/Phase4CreateOrder.gs';
  let source = read(path);

  source = replaceOnce(
    source,
    `  if (code < 200 || code >= 300) {
    return { ok: false, error: 'batch_get_failed', status: code, detail: response.getContentText() };
  }`,
    `  if (code < 200 || code >= 300) {
    console.error('[Phase4CreateOrder] batchGet falló. HTTP ' + code);
    return { ok: false, error: 'batch_get_failed', status: code };
  }`,
    'sanitizar batchGet'
  );

  source = replaceOnce(
    source,
    `  if (code < 200 || code >= 300) {
    return { ok: false, error: 'commit_failed', status: code, detail: response.getContentText() };
  }`,
    `  if (code < 200 || code >= 300) {
    console.error('[Phase4CreateOrder] commit falló. HTTP ' + code);
    return { ok: false, error: 'commit_failed', status: code };
  }`,
    'sanitizar commit'
  );

  source = replaceOnce(
    source,
    `function phase4ParseMoney_(value) {`,
    `function phase4HasOnlyKeys_(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  var keys = Object.keys(value);
  for (var i = 0; i < keys.length; i++) {
    if (allowed.indexOf(keys[i]) === -1) return false;
  }
  return true;
}

function phase4EmailValid_(value) {
  return typeof value === 'string' &&
    value.length <= 254 &&
    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
}

function phase4ExpectedMoneyValid_(value) {
  return typeof value === 'number' &&
    isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 1000000000;
}

function phase4ParseMoney_(value) {`,
    'helpers de validación server-side'
  );

  source = replaceOnce(
    source,
    `  payload = payload && typeof payload === 'object' ? payload : {};
  var requestId = phase4CleanText_(payload.requestId, 100);`,
    `  payload = payload && typeof payload === 'object' ? payload : {};
  if (!phase4HasOnlyKeys_(payload, [
    'action', 'idToken', 'requestId', 'cartLines', 'name', 'phone',
    'contactEmail', 'notes', 'selectedCity', 'departamento', 'address',
    'referencia', 'mapLocation', 'paymentMethod', 'expectedSubtotal',
    'expectedShippingCost', 'expectedShippingPending', 'expectedTotal'
  ])) {
    return { ok: false, error: 'invalid_payload' };
  }

  var requestId = phase4CleanText_(payload.requestId, 100);`,
    'allowlist del payload'
  );

  source = replaceOnce(
    source,
    `  for (var i = 0; i < cartLines.length; i++) {
    var rawQty = Number(cartLines[i] && cartLines[i].qty);
    var rawId = phase4CleanText_(cartLines[i] && cartLines[i].id, 180);
    if (!rawId || !isFinite(rawQty) || rawQty < 1 || rawQty > 99) return { ok: false, error: 'invalid_cart' };
  }`,
    `  for (var i = 0; i < cartLines.length; i++) {
    var rawLine = cartLines[i];
    if (!phase4HasOnlyKeys_(rawLine, ['id', 'qty', 'variants', 'variant'])) {
      return { ok: false, error: 'invalid_cart' };
    }
    var rawQty = Number(rawLine && rawLine.qty);
    var rawId = phase4CleanText_(rawLine && rawLine.id, 180);
    var rawVariants = Array.isArray(rawLine && rawLine.variants)
      ? rawLine.variants
      : (rawLine && rawLine.variant ? [rawLine.variant] : []);
    if (
      !rawId ||
      !isFinite(rawQty) ||
      !Number.isInteger(rawQty) ||
      rawQty < 1 ||
      rawQty > 99 ||
      rawVariants.length > 10 ||
      rawVariants.some(function (variant) {
        return typeof variant !== 'string' || variant.length > 120;
      })
    ) {
      return { ok: false, error: 'invalid_cart' };
    }
  }`,
    'validar líneas del carrito'
  );

  source = replaceOnce(
    source,
    `  var phone = phase4CleanText_(payload.phone, 40);
  var contactEmail = phase4CleanText_(payload.contactEmail, 254).toLowerCase() || email;
  var notes = phase4CleanText_(payload.notes, 1000);
  var departamento = phase4CleanText_(payload.departamento, 80);
  var address = phase4CleanText_(payload.address, 300);
  var referencia = phase4CleanText_(payload.referencia, 300);
  var mapLocation = payload.mapLocation && typeof payload.mapLocation === 'object'
    ? {
        lat: Number(payload.mapLocation.lat),
        lng: Number(payload.mapLocation.lng),
        name: phase4CleanText_(payload.mapLocation.name, 120),
        address: phase4CleanText_(payload.mapLocation.address, 240)
      }
    : null;`,
    `  var phone = phase4CleanText_(payload.phone, 40);
  var contactEmail = phase4CleanText_(payload.contactEmail, 254).toLowerCase() || email;
  var notes = phase4CleanText_(payload.notes, 1000);
  var selectedCity = phase4CleanText_(payload.selectedCity, 120);
  var departamento = phase4CleanText_(payload.departamento, 80);
  var address = phase4CleanText_(payload.address, 300);
  var referencia = phase4CleanText_(payload.referencia, 300);

  if (!/^\\d{8,20}$/.test(phone)) return { ok: false, error: 'phone_invalid' };
  if (!phase4EmailValid_(contactEmail)) return { ok: false, error: 'email_invalid' };
  if (!selectedCity) return { ok: false, error: 'shipping_invalid' };
  if (
    !phase4ExpectedMoneyValid_(payload.expectedSubtotal) ||
    !phase4ExpectedMoneyValid_(payload.expectedShippingCost) ||
    typeof payload.expectedShippingPending !== 'boolean' ||
    !phase4ExpectedMoneyValid_(payload.expectedTotal)
  ) {
    return { ok: false, error: 'invalid_quote' };
  }

  var mapLocation = null;
  if (payload.mapLocation !== null && payload.mapLocation !== undefined) {
    if (!phase4HasOnlyKeys_(payload.mapLocation, ['lat', 'lng', 'name', 'address'])) {
      return { ok: false, error: 'map_invalid' };
    }
    var latitude = Number(payload.mapLocation.lat);
    var longitude = Number(payload.mapLocation.lng);
    if (
      !isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !isFinite(longitude) || longitude < -180 || longitude > 180
    ) {
      return { ok: false, error: 'map_invalid' };
    }
    mapLocation = {
      lat: latitude,
      lng: longitude,
      name: phase4CleanText_(payload.mapLocation.name, 120),
      address: phase4CleanText_(payload.mapLocation.address, 240)
    };
  }`,
    'validar contacto, importes y mapa'
  );

  source = replaceOnce(
    source,
    `    var shipping = phase4ResolveShipping_(shippingRatesMerged, payload.selectedCity);`,
    `    var shipping = phase4ResolveShipping_(shippingRatesMerged, selectedCity);`,
    'usar ciudad sanitizada'
  );

  source = replaceOnce(
    source,
    `  } catch (error) {
    phase4Rollback_(transactionId);
    return { ok: false, error: 'create_order_failed', detail: String(error) };
  }`,
    `  } catch (error) {
    phase4Rollback_(transactionId);
    console.error('[Phase4CreateOrder] Error inesperado:', error);
    return { ok: false, error: 'create_order_failed' };
  }`,
    'sanitizar excepción'
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// Encabezados Cloudflare: seguridad compatible con popup de Google.
// ---------------------------------------------------------------------------
write('_headers', `# TINTIN — seguridad y caché para Cloudflare Pages
# La CSP conserva unsafe-inline mientras el HTML siga usando scripts/estilos
# inline. frame-ancestors y X-Frame-Options bloquean clickjacking.

/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.google.com https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://securetoken.google.com https://www.google.com https://www.gstatic.com https://apis.google.com https://res.cloudinary.com https://api.imgbb.com; frame-src 'self' https://www.google.com https://www.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; worker-src 'self' blob:; upgrade-insecure-requests
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self), usb=(), browsing-topics=()
  Cross-Origin-Opener-Policy: same-origin-allow-popups
  X-Permitted-Cross-Domain-Policies: none

/
  Cache-Control: no-cache, no-store, must-revalidate

/*.html
  Cache-Control: no-cache, no-store, must-revalidate

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.mjs
  Cache-Control: public, max-age=31536000, immutable

/assets-tintin/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`);

// ---------------------------------------------------------------------------
// Auditoría estática específica de la Fase 6.
// ---------------------------------------------------------------------------
write('scripts/audit-phase6-security.js', `'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const rules = read('firestore.rules');
const headers = read('_headers');
const server = read('apps-script/Phase4CreateOrder.gs');
const pkg = read('package.json');

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) console.log('OK — ' + label);
  else {
    failures += 1;
    console.error('FAIL — ' + label + (detail ? ': ' + detail : ''));
  }
}

check(
  'Los pedidos no se crean desde el SDK del navegador',
  /match \/orders\/\{orderId\}[\s\S]*?allow create: if false;/.test(rules),
  'La creación vigente es server-side'
);
check(
  'El cliente no reserva stock por reglas heredadas',
  !rules.includes('allow update: if sparkStockUpdateValid(productId);') &&
    !rules.includes('allow update: if sparkInventoryReserveValid(orderId) ||'),
  'No debe quedar una ruta browser que altere dinero o inventario'
);
check(
  'Solo Super Admin elimina pedidos',
  /match \/orders\/\{orderId\}[\s\S]*?allow delete: if isSuperAdmin\(\);/.test(rules),
  'El cliente no puede borrar evidencia ni saltar cooldowns'
);
check(
  'Viewer no puede crear productos',
  !rules.includes("(isAdmin() || isAgent() || isViewer()) &&\n          currentRolePermAllows('productos', 'crear')"),
  'Se aplica mínimo privilegio'
);
check(
  'El rol superadmin no es asignable a otra cuenta',
  rules.includes("request.resource.data.role in ['client', 'admin', 'agent', 'viewer']") &&
    rules.includes('!isSuperAdminAccount(resource.data)'),
  'La identidad privilegiada depende del correo oficial verificado'
);

[
  "'action', 'idToken', 'requestId', 'cartLines'",
  "phase4HasOnlyKeys_(rawLine, ['id', 'qty', 'variants', 'variant'])",
  "phase4HasOnlyKeys_(payload.mapLocation, ['lat', 'lng', 'name', 'address'])",
  "phase4EmailValid_(contactEmail)",
  "phase4ExpectedMoneyValid_(payload.expectedTotal)"
].forEach(token => check('El endpoint valida ' + token, server.includes(token)));

check(
  'El endpoint no devuelve cuerpos internos de Firestore',
  !server.includes("detail: response.getContentText()") &&
    !server.includes("detail: String(error)"),
  'Los detalles quedan solo en logs del servidor'
);

[
  'Content-Security-Policy:',
  'Strict-Transport-Security:',
  'Permissions-Policy:',
  'Referrer-Policy:',
  'X-Content-Type-Options:',
  'X-Frame-Options: DENY',
  "frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy: same-origin-allow-popups'
].forEach(header => check('Encabezado presente: ' + header, headers.includes(header)));

check(
  'HTML no se almacena como versión inmutable',
  headers.includes('/*.html\n  Cache-Control: no-cache, no-store, must-revalidate')
);
check(
  'CSS y JavaScript versionados conservan caché inmutable',
  headers.includes('/*.css\n  Cache-Control: public, max-age=31536000, immutable') &&
    headers.includes('/*.js\n  Cache-Control: public, max-age=31536000, immutable')
);

const privateKeyPatterns = [
  /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
  /"private_key"\s*:/,
  /"client_email"\s*:\s*"[^"]+\.iam\.gserviceaccount\.com"/
];
const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:js|mjs|cjs|gs|json|html|txt|md|yml|yaml|rules)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(root);
const secretHits = [];
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (privateKeyPatterns.some(pattern => pattern.test(content))) {
    secretHits.push(path.relative(root, file));
  }
}
check('No hay claves privadas o service accounts en el repositorio', secretHits.length === 0, secretHits.join(', '));

check(
  'La Fase 6 forma parte de audit:final',
  pkg.includes('"audit:phase6": "node scripts/audit-phase6-security.js"') &&
    pkg.includes('npm run audit:phase6')
);

if (failures) {
  console.error('\nAuditoría Fase 6: ' + failures + ' fallo(s).');
  process.exit(1);
}
console.log('\nAuditoría Fase 6: todo correcto.');
`);

// ---------------------------------------------------------------------------
// Suite adversarial de reglas: matriz anónimo/cliente/admin/viewer/Super Admin.
// ---------------------------------------------------------------------------
write('scripts/test-firestore-critical.mjs', `import fs from 'node:fs';
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
  await fails(setDoc(doc(superDb, 'orders', 'manual_order'), directOrderPayload));
  await succeeds(deleteDoc(doc(superDb, 'orders', 'client2_order1')));
  await fails(deleteDoc(doc(superDb, 'users', 'super1')));

  console.log('Reglas Fase 6: ' + checks + ' ataques/controles verificados.');
} finally {
  await testEnv.cleanup();
}
`);

// ---------------------------------------------------------------------------
// package.json: auditoría dedicada y suite adversarial.
// ---------------------------------------------------------------------------
{
  const path = 'package.json';
  let source = read(path);
  source = replaceOnce(
    source,
    `    "audit:phase5": "node scripts/audit-phase5-performance.js"`,
    `    "audit:phase5": "node scripts/audit-phase5-performance.js",
    "audit:phase6": "node scripts/audit-phase6-security.js",
    "test:rules-phase6": "npm run test:rules-critical"`,
    'scripts fase6'
  );
  source = replaceOnce(
    source,
    `npm run audit:part2h && npm run audit:phase5"`,
    `npm run audit:part2h && npm run audit:phase5 && npm run audit:phase6"`,
    'audit final incluye fase6'
  );
  write(path, source);
}

console.log('Correcciones de Fase 6 aplicadas.');
