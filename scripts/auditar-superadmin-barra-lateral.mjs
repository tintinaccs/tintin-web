#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const admin = read('admin.html');
const css = read('css/admin/barra-lateral-admin.css');
const js = read('js/admin/barra-lateral-admin.js');
const pkg = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/auditar-tintin.yml');

const checks = [];
function check(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}

const globalChecks = [
  ['admin referencia CSS del rail', admin.includes('css/admin/barra-lateral-admin.css?v=tintin-20260921-superadmin-sidebar-rail-3')],
  ['admin referencia JS del rail', admin.includes('js/admin/barra-lateral-admin.js?v=tintin-20260921-superadmin-sidebar-rail-3')],
  ['script del rail carga en head', admin.indexOf('js/admin/barra-lateral-admin.js') < admin.indexOf('</head>')],
  ['toggle existe', admin.includes('id="adm-sidebar-rail-toggle"')],
  ['toggle es button', /<button[^>]+id="adm-sidebar-rail-toggle"/.test(admin)],
  ['toggle declara aria-expanded', admin.includes('aria-expanded="true"')],
  ['toggle declara aria-label', admin.includes('aria-label="Contraer barra lateral"')],
  ['sidebar canónico preservado', admin.includes('id="adm-sidebar"')],
  ['nav canónico preservado', admin.includes('id="adm-nav"')],
  ['mobile tabs preservadas', admin.includes('id="adm-mobile-tabs"')],
  ['CSS limita rail a >=541', css.includes('@media (min-width: 541px)')],
  ['CSS conserva mobile <=540', css.includes('@media (max-width: 540px)')],
  ['CSS usa 72px colapsado', css.includes('--sidebar-w: 72px')],
  ['CSS usa 260px desktop expandido', css.includes('--sidebar-w: 260px')],
  ['CSS usa 240px tablet expandido', css.includes('--sidebar-w: 240px')],
  ['CSS define item 48px', css.includes('width: 48px;')],
  ['CSS define altura item 48px', css.includes('height: 48px;')],
  ['CSS mantiene badge visible', css.includes('.adm-notification-badge')],
  ['CSS define activo colapsado', css.includes('.adm-nav-item.active')],
  ['CSS define tooltip', css.includes('.adm-sidebar-tooltip')],
  ['tooltip z-index 260', css.includes('z-index: 260')],
  ['tooltip tiene fondo sólido', css.includes('background: var(--admin-color-background-card)')],
  ['tooltip no captura puntero', css.includes('pointer-events: none')],
  ['CSS respeta reduced motion', css.includes('prefers-reduced-motion: reduce')],
  ['JS usa clave de preferencia', js.includes("tintin:admin:sidebar-state:v1")],
  ['JS usa data-adm-sidebar', js.includes('dataset.admSidebar')],
  ['JS aplica estado antes de DOMContentLoaded', js.indexOf('applyState(initialState || defaultState(), false)') < js.indexOf("document.addEventListener('DOMContentLoaded'")],
  ['JS tablet default colapsado', js.includes('? STATE_COLLAPSED : STATE_EXPANDED')],
  ['JS valida expanded', js.includes("value === STATE_EXPANDED")],
  ['JS valida collapsed', js.includes("value === STATE_COLLAPSED")],
  ['JS persiste localStorage', js.includes('localStorage.setItem(STORAGE_KEY, value)')],
  ['JS tolera storage bloqueado', js.includes('catch (_)')],
  ['JS tooltip role', js.includes("setAttribute('role', 'tooltip')")],
  ['JS tooltip a la derecha', js.includes('sideRect.right + gap')],
  ['JS limita tooltip vertical', js.includes('Math.min(Math.max(top, viewportPadding), maxTop)')],
  ['JS hover abre tooltip', js.includes("addEventListener('mouseenter'")],
  ['JS focus abre tooltip', js.includes("addEventListener('focus'")],
  ['JS Escape cierra tooltip', js.includes("event.key === 'Escape'")],
  ['JS click cierra tooltip', js.includes("addEventListener('click', hideTooltip)")],
  ['JS resize limpia tooltip', js.includes("window.addEventListener('resize'")],
  ['JS scroll limpia tooltip', js.includes("sidebar.addEventListener('scroll'")],
  ['JS no importa Firebase', !/firebase|firestore|appcheck/i.test(js)],
  ['JS no llama signOut', !js.includes('signOut(')],
  ['JS no crea observers Firebase', !js.includes('onAuthStateChanged')],
  ['JS no depende de hover para click', !js.includes('preventDefault()')],
  ['JS conserva aria label', js.includes("item.setAttribute('aria-label', label)")],
  ['JS usa un solo tooltip', js.includes("document.getElementById(TOOLTIP_ID)")],
  ['JS etiqueta tooltip ownership', js.includes('admTooltipOwned')],
  ['package expone auditoría', pkg.scripts?.['audit:admin-sidebar'] === 'node scripts/auditar-superadmin-barra-lateral.mjs'],
  ['workflow ejecuta auditoría', workflow.includes('npm run audit:admin-sidebar')],
  ['CSS no toca Auth', !/auth|firebase|firestore/i.test(css)],
  ['CSS no redefine mobile tabs', !/adm-mobile-tabs/.test(css)],
  ['JS no crea submenús', !/submenu|sub-menu|flyout/i.test(js)]
];

globalChecks.forEach(([name, ok]) => check(name, ok));

const asideMatch = admin.match(/<aside class="adm-sidebar" id="adm-sidebar">([\s\S]*?)<\/aside>/);
check('aside del sidebar se pudo analizar', Boolean(asideMatch));

const itemMatches = asideMatch
  ? [...asideMatch[1].matchAll(/<(button|a)\b[^>]*class="[^"]*\badm-nav-item\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g)]
  : [];

check('sidebar mantiene 22 accesos', itemMatches.length === 22);

for (let index = 0; index < 22; index += 1) {
  const match = itemMatches[index];
  check('acceso ' + (index + 1) + ' conserva icono', Boolean(match && /adm-nav-icon/.test(match[2])));
  const text = match
    ? match[2].replace(/<[^>]+>/g, ' ').replace(/&ntilde;/g, 'ñ').replace(/\s+/g, ' ').trim()
    : '';
  check('acceso ' + (index + 1) + ' conserva nombre', Boolean(text));
}

if (checks.length !== 99) {
  console.error('Auditoría del rail mal configurada: se esperaban 99 comprobaciones y hay ' + checks.length + '.');
  process.exit(1);
}

const failures = checks.filter(item => !item.ok);
if (failures.length) {
  console.error('Rail Super Admin: ' + failures.length + '/99 comprobaciones fallaron:');
  failures.forEach(item => console.error('  - ' + item.name));
  process.exit(1);
}

console.log('Rail Super Admin: 99/99 OK');
