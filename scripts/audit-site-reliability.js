#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
const failures = [];

function check(label, ok) {
  console.log(`${ok ? 'OK' : 'FALTA'} — ${label}`);
  if (!ok) failures.push(label);
}

const loader = read('js/page-loader.js');
const parity = read('css/tintin-parity-safe.css');
const accountFix = read('js/header-account-mobile-fix.js');
const activity = read('js/site-activity.js');
const rules = read('firestore.rules');
const admin = read('admin.html');
const theme = read('css/tintin-unified-theme.css');
const main = read('script.js');
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));

check('El menú de cuenta arranca también en el runtime público',
  loader.includes('bootHeaderAccountFix();'));
check('La capa visual oculta el panel según el contenedor y permite abrirlo',
  parity.includes('#account-dropdown:not(.open):not(.tt-account-open)>.tt-account-panel') &&
  !parity.includes('.tt-account-panel:not(.open):not(.tt-account-open)'));
check('El click de cuenta no se duplica con el manejador antiguo',
  accountFix.includes('stopImmediatePropagation()'));

check('La actividad cuenta una sola sesión por pestaña y día',
  activity.includes('SESSION_RECORDED_PREFIX') && activity.includes('window.sessionStorage.setItem'));
check('La presencia usa latidos espaciados y solo mientras la página es visible',
  activity.includes('const HEARTBEAT_MS = 120000') && activity.includes("document.visibilityState === 'hidden'"));
check('Las reglas limitan la escritura de sesiones y presencia',
  rules.includes('presenceIsValid(visitorId)') &&
  rules.includes('trafficSessionIsValid(dateKey, sessionId)') &&
  rules.includes('allow update: if false;'));
check('Solamente Super Admin puede leer las métricas',
  /match \/sitePresence\/\{visitorId\}[\s\S]*?allow read, delete: if isSuperAdmin\(\)/.test(rules) &&
  /match \/siteTraffic\/\{dateKey\}\/sessions\/\{sessionId\}[\s\S]*?allow read, delete: if isSuperAdmin\(\)/.test(rules));
check('El dashboard muestra sesiones de hoy y personas en línea',
  admin.includes('id="stat-visits-today"') &&
  admin.includes('id="stat-online-now"') &&
  admin.includes('getCountFromServer'));

check('El rosa principal cumple contraste AA sobre blanco',
  theme.includes('--tt-accent:#AD3F67') && theme.includes('--tt-accent-hover:#8B2642'));
check('Los renderers principales escapan texto almacenado',
  main.includes('function escapeHtml(value)') &&
  admin.includes('function escapeHtmlAdmin(value)'));
check('Todas las páginas declaran el tipo de sus botones estáticos',
  htmlFiles.every(file => !/<button\b(?![^>]*\btype\s*=)[^>]*>/i.test(
    read(file).replace(/<script\b[\s\S]*?<\/script>/gi, '')
  )));
check('Todos los controles de la barra móvil tienen nombre accesible',
  htmlFiles.every(file => {
    const html = read(file);
    return ['tabbar-tienda', 'tabbar-search', 'tabbar-cart', 'tabbar-cuenta']
      .every(id => !html.includes(`id="${id}"`) || new RegExp(`id="${id}"[^>]*aria-label=`).test(html));
  }));

const staleVersions = [];
for (const file of htmlFiles.concat(['script.js', 'js/page-loader.js'])) {
  if (/tintin-20260715-[234]/.test(read(file))) staleVersions.push(file);
}
check('Los recursos críticos usan una sola versión de caché', staleVersions.length === 0);

if (failures.length) {
  console.error(`\nAuditoría de confiabilidad: ${failures.length} falla(s).`);
  process.exit(1);
}

console.log('\nAuditoría de confiabilidad completada correctamente.');
