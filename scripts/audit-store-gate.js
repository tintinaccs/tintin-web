#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n?/g, '\n');

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
const adminApp = read('js/admin-app.js');
const authNav = read('js/auth-nav.js');
const uiQuality = read('js/ui-quality.js');
const pageAudit = read('js/page-audit-fix.js');
const rules = read('firestore.rules');
const checkout = read('checkout.html');

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
  'Runtime diferido hasta permitir acceso',
  pageLoader.includes("if (state === 'allowed')") &&
    pageLoader.includes('function bootPublicRuntime()') &&
    pageLoader.includes('function bootPageRuntime()') &&
    pageLoader.includes('if (!storeGateRequired) bootPageRuntime();'),
  'las páginas públicas no deben iniciar módulos visuales antes de resolver el gate'
);
check(
  'Runtime público sin observadores globales duplicados',
  /function bootPublicRuntime\(\) \{[\s\S]*?window\.setTimeout\(bootPublicRuntime, 0\)/.test(pageLoader) &&
    !/function bootPublicRuntime\(\) \{[\s\S]*?bootGlobalQuality\(\)[\s\S]*?\n  \}/.test(pageLoader) &&
    /function bootPublicRuntime\(\) \{[\s\S]*?bootScrollReveal\(\)[\s\S]*?bootImagePerformance\(\)[\s\S]*?\n  \}/.test(pageLoader),
  'page-loader debe ser el único dueño del reveal y la optimización de imágenes'
);
check(
  'Loader se retira ante cierre o indisponibilidad',
  pageLoader.includes("const state = event?.detail?.state || 'unavailable'") &&
    pageLoader.includes('contentReady = true;\n        logoReady = true;\n        hideNow();'),
  'el aviso final no puede quedar tapado esperando page-ready'
);
check(
  'Auth nav no duplica módulos globales',
  !/import\s+['"].*(?:ui-quality|header-dropdown-fix|header-account-mobile-fix|header-scroll-hide|scroll-reveal-global)/.test(authNav),
  'page-loader.js debe ser el único dueño del arranque global'
);
check(
  'Sin observadores globales de interfaz',
  !uiQuality.includes('MutationObserver') && !pageAudit.includes('MutationObserver'),
  'la interfaz debe refrescarse por eventos finitos, no vigilar todo el documento'
);
check(
  'Guard del overlay observa solo hijos directos',
  gateCore.includes("guardObserver.observe(document.body, { childList: true });") &&
    !gateCore.includes('subtree: true'),
  'el guard no debe observar los atributos que él mismo modifica'
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
  'Botón de iniciar sesión identificable',
  gateCore.includes("const LOGIN_CONTROL_ID = 'tt-store-gate-login'") &&
    gateCore.includes('id="${LOGIN_CONTROL_ID}"'),
  'el aviso cerrado debe incluir un control exclusivo para iniciar sesión'
);
check(
  'Botón de iniciar sesión fuerza navegación en captura',
  gateCore.includes('window.location.assign(destination)') &&
    gateCore.includes('node?.id === LOGIN_CONTROL_ID') &&
    gateCore.includes('goToLogin(event, control.href || buildLoginUrl())') &&
    gateCore.includes("window.addEventListener(\n    'click'"),
  'el acceso debe interceptarse antes de los manejadores generales de la página'
);
check(
  'URL de login conserva la carpeta del sitio',
  gateCore.includes("new URL(`${appDirectory}login.html`, window.location.origin)") &&
    gateCore.includes("loginUrl.searchParams.set('from', currentRelativeLocation())"),
  'debe funcionar dentro de /tintin-web/ y en dominio propio'
);
check(
  'Overlay conserva interacción',
  gateCore.includes('overlay.inert = false') &&
    gateCore.includes("overlay.style.pointerEvents = 'auto'"),
  'el bloqueo del fondo no debe bloquear los botones del aviso'
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
  'Checkout comparte el formato validado del control global',
  checkout.includes('normalizeStoreAccessConfig') &&
    checkout.includes("storeCfg = normalizeStoreAccessConfig(cfg, 'ok')") &&
    checkout.includes('renderStoreClosedOverlay(storeCfg)'),
  'settings/general no debe confundirse con una lectura fallida ni crear un aviso falso'
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
  'Sin cierre temporal al abrir el panel',
  adminSync.includes('generalResolved') &&
    adminSync.includes('gateResolved') &&
    adminSync.includes('if (!generalResolved || !gateResolved || !latestGeneral.exists) return;'),
  'el panel no debe publicar storeOpen:false mientras Firestore todavía está cargando'
);
check(
  'Guardado atómico del estado de tienda',
  adminApp.includes('settingsBatch.set(generalRef') &&
    adminApp.includes('settingsBatch.set(storeGateRef') &&
    adminApp.includes('await settingsBatch.commit();'),
  'settings/general y settings/storeGate deben cambiar juntos para no bloquear productos por una sincronización incompleta'
);
check(
  'Estado administrativo coherente con las reglas',
  adminApp.includes('const storeOpen = d.storeOpen === true;') &&
    adminApp.includes('tiendaActiva:    willBeOpen'),
  'el panel debe exigir true explícito y mantener consistente el campo legado'
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
  'Pedidos cerrados mediante el validador Spark',
  rules.includes('allow create: if sparkOrderCreateValid(orderId);') &&
    rules.includes("settings.get('storeOpen', false) == true") &&
    rules.includes("userData.get('blocked', false) != true"),
  'el validador seguro debe rechazar tienda cerrada y cuentas bloqueadas'
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
