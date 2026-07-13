#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const pageLoader = read('js/page-loader.js');
const gateCore = read('js/store-gate-core.js');
const gateRuntime = read('js/store-gate.js');
const adminSync = read('js/admin-store-control.js');
const rules = read('firestore.rules');

check(
  'Bloqueo síncrono antes del body',
  pageLoader.includes("classList.add('tt-store-gate-pending')"),
  'page-loader.js debe ocultar páginas públicas antes de cargar Firebase'
);
check(
  'Fallback si falla el módulo',
  pageLoader.includes('showEmergencyStoreGate') &&
    pageLoader.includes('STORE_GATE_TIMEOUT_MS'),
  'debe quedar bloqueado incluso si el módulo o Firebase no responden'
);
check(
  'Bypass limitado a localhost',
  pageLoader.includes('isLocalDevelopment') &&
    pageLoader.includes('window.TT_DISABLE_STORE_GATE === true'),
  'producción no debe aceptar un bypass desde la consola'
);
check(
  'Login y admin tienen guard propio',
  pageLoader.includes("path.endsWith('/login.html')") &&
    pageLoader.includes("path.endsWith('/admin.html')"),
  'solo esas páginas se excluyen del guard automático'
);
check(
  'Antimanipulación visual',
  gateCore.includes('MutationObserver') &&
    gateCore.includes('node.inert = true') &&
    gateCore.includes('tt-store-gate-blocked'),
  'quitar el aviso no debe habilitar el contenido de abajo'
);
check(
  'Documento público mínimo',
  gateCore.includes("doc(db, 'settings', 'storeGate')") &&
    gateRuntime.includes("doc(db, 'settings', 'storeGate')"),
  'el gate debe usar settings/storeGate como fuente principal'
);
check(
  'Sin apertura por error',
  gateCore.includes('raw.storeOpen === true') &&
    gateCore.includes("__storeConfigStatus !== 'ok'"),
  'solo true explícito y una lectura válida pueden abrir la tienda'
);
check(
  'Super Admin por correo real',
  gateCore.includes('SUPER_ADMIN.toLowerCase()') &&
    !gateCore.includes("role === 'superadmin'"),
  'no se debe confiar únicamente en un rol guardado'
);
check(
  'Sincronización del panel',
  adminSync.includes("doc(db, 'settings', 'storeGate')") &&
    adminSync.includes('setDoc(STORE_GATE_REF'),
  'el switch debe publicar el documento mínimo'
);

check(
  'Regla pública mínima',
  /match\s+\/settings\/storeGate\s*\{[\s\S]*?allow read:\s*if true;/.test(rules),
  'solo storeGate puede leerse para decidir el acceso'
);
check(
  'Configuración completa cerrada',
  /match\s+\/settings\/general\s*\{[\s\S]*?allow read:\s*if isStoreOpenOrAllowed\(\);/.test(rules),
  'settings/general no debe seguir público cuando la tienda cierra'
);
check(
  'Productos cerrados',
  /match\s+\/products\/\{productId\}\s*\{[\s\S]*?allow read:\s*if isStoreOpenOrAllowed\(\);/.test(rules),
  'productos no deben leerse con la tienda cerrada'
);
check(
  'Colecciones cerradas',
  /match\s+\/collections\/\{collectionId\}\s*\{[\s\S]*?allow read:\s*if isStoreOpenOrAllowed\(\);/.test(rules),
  'colecciones no deben leerse con la tienda cerrada'
);
check(
  'Contenido cerrado',
  /match\s+\/site_content\/\{pageId\}\s*\{[\s\S]*?allow read:\s*if isStoreOpenOrAllowed\(\);/.test(rules),
  'contenido administrable no debe leerse con la tienda cerrada'
);
check(
  'Carrito cerrado',
  /match\s+\/cart\/\{itemId\}\s*\{[\s\S]*?isStoreOpenOrAllowed\(\);/.test(rules),
  'el carrito remoto debe quedar bloqueado'
);
check(
  'Pedidos cerrados',
  /match\s+\/orders\/\{orderId\}\s*\{\s*allow create:\s*if isStoreOpenOrAllowed\(\)/.test(rules),
  'no se deben crear pedidos durante el cierre'
);
check(
  'Sin lectura pública vieja',
  !/match\s+\/(?:products|collections)\/\{[^}]+\}\s*\{\s*allow read:\s*if true;/.test(rules),
  'no debe quedar allow read: if true en productos/colecciones'
);

const htmlFiles = fs
  .readdirSync(ROOT)
  .filter(file => file.toLowerCase().endsWith('.html'));

htmlFiles.forEach(file => {
  const html = read(file);
  const loaderIndex = html.indexOf('js/page-loader.js');
  const headEndIndex = html.toLowerCase().indexOf('</head>');
  check(
    `Loader global en ${file}`,
    loaderIndex >= 0 && headEndIndex >= 0 && loaderIndex < headEndIndex,
    'toda ruta HTML debe iniciar el control desde el head'
  );
  check(
    `Sin bypass en ${file}`,
    !/TT_DISABLE_STORE_GATE\s*=\s*true/.test(html),
    'ninguna página publicada debe apagar el cierre global'
  );
});

checks.forEach(item => {
  console.log(`${item.ok ? '✓' : '✗'} ${item.name}`);
});

console.log(`\nResultado: ${checks.length - failures.length}/${checks.length} comprobaciones correctas.`);

if (failures.length) {
  console.error('\nFALLAS:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Paso 1: cierre total verificado a nivel de archivos.');
