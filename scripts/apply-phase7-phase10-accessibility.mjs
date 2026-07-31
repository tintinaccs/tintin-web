import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = path.relative(ROOT, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const OLD_VERSION = 'tintin-20260730-phase8-ui-1';
const NEW_VERSION = 'tintin-20260731-phase10-a11y-1';

function absolute(relative) {
  return path.join(ROOT, relative);
}

function read(relative) {
  return fs.readFileSync(absolute(relative), 'utf8');
}

function write(relative, content) {
  const target = absolute(relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.replace(/\r\n?/g, '\n'), 'utf8');
}

function walk(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'node_modules', 'artifacts', 'public'].includes(entry.name)) return [];
    const abs = path.join(directory, entry.name);
    const rel = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? walk(abs, rel) : [rel];
  });
}

const runtime = `/* =============================================================
   TINTIN — Fase 10: accesibilidad y experiencia inclusiva
   ============================================================= */

const DIALOG_SELECTOR = 'dialog[open],[role="dialog"][aria-modal="true"]';
const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

let activeDialog = null;
let returnFocus = null;
let scanQueued = false;

function cleanText(value, maxLength = 180) {
  return String(value == null ? '' : value)
    .replace(/[\\u0000-\\u001f\\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function injectStyles() {
  if (document.getElementById('tt-phase10-accessibility-css')) return;
  const link = document.createElement('link');
  link.id = 'tt-phase10-accessibility-css';
  link.rel = 'stylesheet';
  link.href = new URL('../css/phase10-accessibility.css?v=${NEW_VERSION}', import.meta.url).href;
  document.head?.appendChild(link);
}

function isVisible(element) {
  if (!(element instanceof HTMLElement) || element.hidden || element.inert) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

function focusables(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
}

function ensureMainTarget() {
  const main = document.querySelector('main,[role="main"]');
  if (!(main instanceof HTMLElement)) return null;
  if (!main.id) main.id = 'contenido-principal';
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  return main;
}

function ensureSkipLink() {
  const main = ensureMainTarget();
  if (!main || document.getElementById('tt-skip-link')) return;
  const link = document.createElement('a');
  link.id = 'tt-skip-link';
  link.className = 'tt-skip-link';
  link.href = '#' + main.id;
  link.textContent = 'Saltar al contenido principal';
  link.addEventListener('click', () => requestAnimationFrame(() => main.focus({ preventScroll: true })));
  document.body?.insertBefore(link, document.body.firstChild);
}

function hasAccessibleName(control) {
  if (!(control instanceof HTMLElement)) return true;
  const labelledBy = cleanText(control.getAttribute('aria-labelledby'));
  if (labelledBy && labelledBy.split(/\\s+/).some(id => cleanText(document.getElementById(id)?.textContent))) return true;
  if (cleanText(control.getAttribute('aria-label'))) return true;
  if (cleanText(control.textContent)) return true;
  if (control instanceof HTMLInputElement && cleanText(control.value)) return true;
  return Boolean(cleanText(control.querySelector('img[alt]')?.getAttribute('alt')));
}

function inferControlLabel(control) {
  const explicit = cleanText(
    control.getAttribute('title') ||
    control.getAttribute('data-label') ||
    control.getAttribute('data-tooltip') ||
    control.querySelector('img[alt]')?.getAttribute('alt')
  );
  if (explicit) return explicit;
  const signature = [control.id, control.className, control.getAttribute('href')].join(' ').toLowerCase();
  if (/whatsapp|wa-float|wa\\.me/.test(signature)) return 'Abrir WhatsApp de Tintin';
  if (/cart|carrito/.test(signature)) return 'Abrir carrito';
  if (/search|buscar/.test(signature)) return 'Buscar';
  if (/menu|nav-toggle|hamburger/.test(signature)) return 'Abrir menú';
  if (/close|cerrar|dismiss/.test(signature)) return 'Cerrar';
  return '';
}

function enhanceControl(control) {
  if (!(control instanceof HTMLElement) || control.dataset.ttA11yControl === '1') return;
  control.dataset.ttA11yControl = '1';

  if (!hasAccessibleName(control)) {
    const label = inferControlLabel(control);
    if (label) control.setAttribute('aria-label', label);
  }

  const iconOnly = !cleanText(control.textContent) || /icon|action|toggle|close|menu|cart|search/i.test(control.className || '');
  if (iconOnly) control.dataset.ttA11yTouch = '1';

  if (control.getAttribute('role') === 'button' && !control.matches('button,input,a[href]')) {
    if (!control.hasAttribute('tabindex')) control.tabIndex = 0;
    control.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (event.repeat) return;
      control.click();
    });
  }
}

function enhanceField(field) {
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
  if (field.type === 'hidden' || field.dataset.ttA11yField === '1') return;
  field.dataset.ttA11yField = '1';
  const hasName = cleanText(field.getAttribute('aria-label')) || cleanText(field.getAttribute('aria-labelledby')) ||
    (field.id && document.querySelector('label[for="' + CSS.escape(field.id) + '"]')) || field.closest('label');
  if (!hasName && cleanText(field.getAttribute('placeholder'))) {
    field.setAttribute('aria-label', cleanText(field.getAttribute('placeholder')));
  }
  field.addEventListener('input', () => {
    if (field.validity.valid) field.removeAttribute('aria-invalid');
  });
}

function labelDialog(dialog) {
  if (!(dialog instanceof HTMLElement)) return;
  if (!dialog.hasAttribute('aria-modal')) dialog.setAttribute('aria-modal', 'true');
  if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
  if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
    const heading = dialog.querySelector('h1,h2,h3,[data-dialog-title],.modal-title');
    if (heading instanceof HTMLElement) {
      if (!heading.id) heading.id = 'tt-dialog-title-' + Math.random().toString(36).slice(2, 9);
      dialog.setAttribute('aria-labelledby', heading.id);
    } else {
      dialog.setAttribute('aria-label', 'Ventana de diálogo');
    }
  }
}

function activateDialog(dialog) {
  if (!(dialog instanceof HTMLElement) || activeDialog === dialog || !isVisible(dialog)) return;
  if (activeDialog?.isConnected && isVisible(activeDialog)) return;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeDialog = dialog;
  labelDialog(dialog);
  requestAnimationFrame(() => {
    const target = focusables(dialog)[0] || dialog;
    target.focus({ preventScroll: true });
  });
}

function releaseDialogIfNeeded() {
  if (!activeDialog) return;
  if (activeDialog.isConnected && isVisible(activeDialog)) return;
  activeDialog = null;
  const target = returnFocus;
  returnFocus = null;
  if (target?.isConnected && !target.inert) requestAnimationFrame(() => target.focus({ preventScroll: true }));
}

function scanDialogs() {
  releaseDialogIfNeeded();
  if (activeDialog) return;
  const dialogs = Array.from(document.querySelectorAll(DIALOG_SELECTOR)).filter(isVisible);
  if (dialogs.length) activateDialog(dialogs.at(-1));
}

function scheduleDialogScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scanDialogs();
  });
}

function bindDialogFocus() {
  document.addEventListener('keydown', event => {
    releaseDialogIfNeeded();
    if (!activeDialog || event.key !== 'Tab') return;
    const items = focusables(activeDialog);
    if (!items.length) {
      event.preventDefault();
      activeDialog.focus();
      return;
    }
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  document.addEventListener('focusin', event => {
    releaseDialogIfNeeded();
    if (!activeDialog || activeDialog.contains(event.target)) return;
    (focusables(activeDialog)[0] || activeDialog).focus({ preventScroll: true });
  }, true);
}

function ensureConnectivityStatus() {
  let status = document.getElementById('tt-connectivity-status');
  if (status) return status;
  status = document.createElement('aside');
  status.id = 'tt-connectivity-status';
  status.className = 'tt-connectivity-status';
  status.hidden = true;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const text = document.createElement('span');
  text.className = 'tt-connectivity-status-text';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'tt-connectivity-retry';
  retry.textContent = 'Reintentar';
  retry.addEventListener('click', () => window.location.reload());
  status.append(text, retry);
  document.body?.appendChild(status);
  return status;
}

function updateConnectivity() {
  const online = navigator.onLine !== false;
  const status = ensureConnectivityStatus();
  if (!status) return;
  if (online) {
    if (!status.hidden) window.TintinUX?.announce?.('La conexión volvió a estar disponible.');
    status.hidden = true;
    document.documentElement.classList.remove('tt-is-offline');
    return;
  }
  document.documentElement.classList.add('tt-is-offline');
  const text = status.querySelector('.tt-connectivity-status-text');
  if (text) text.textContent = 'Estás sin conexión. Podés seguir revisando la página; las acciones en línea se reanudan al reconectar.';
  status.hidden = Boolean(document.getElementById('tt-store-gate-network-notice'));
}

function enhance(root = document) {
  ensureSkipLink();
  root.querySelectorAll?.('button,a[href],[role="button"],input[type="button"],input[type="submit"]').forEach(enhanceControl);
  root.querySelectorAll?.('input,select,textarea').forEach(enhanceField);
  root.querySelectorAll?.('[role="alert"],[aria-live]').forEach(region => {
    if (region instanceof HTMLElement && !region.hasAttribute('aria-atomic')) region.setAttribute('aria-atomic', 'true');
  });
  const whatsapp = document.getElementById('wa-float') || document.querySelector('a[href*="wa.me"]');
  if (whatsapp instanceof HTMLElement && !hasAccessibleName(whatsapp)) whatsapp.setAttribute('aria-label', 'Abrir WhatsApp de Tintin');
  scheduleDialogScan();
}

function bindInvalidFeedback() {
  document.addEventListener('invalid', event => {
    const field = event.target;
    if (!(field instanceof HTMLElement)) return;
    field.setAttribute('aria-invalid', 'true');
    const label = cleanText(field.getAttribute('aria-label') || field.getAttribute('name') || 'Campo');
    window.TintinUX?.announce?.(label + ': revisá este dato antes de continuar.', { assertive: true });
    requestAnimationFrame(() => field.focus({ preventScroll: false }));
  }, true);
}

function observe() {
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof HTMLElement) enhance(node);
    }));
    scheduleDialogScan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'class', 'aria-hidden'] });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

function boot() {
  if (window.TintinAccessibility?.booted) return;
  injectStyles();
  enhance();
  bindDialogFocus();
  bindInvalidFeedback();
  observe();
  window.addEventListener('online', updateConnectivity);
  window.addEventListener('offline', updateConnectivity);
  updateConnectivity();
  document.documentElement.classList.add('tt-phase10-a11y-ready');
  window.TintinAccessibility = { booted: true, enhance, scanDialogs, updateConnectivity };
  window.dispatchEvent(new CustomEvent('tintin:phase10-accessibility-ready'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
`;

const styles = `/* TINTIN — Fase 10: accesibilidad y experiencia inclusiva */

.tt-skip-link {
  position: fixed;
  z-index: 2147483647;
  top: max(8px, env(safe-area-inset-top));
  left: max(8px, env(safe-area-inset-left));
  max-width: calc(100vw - 16px);
  padding: 12px 18px;
  border: 2px solid #8b2642;
  border-radius: 999px;
  background: #fff;
  color: #8b2642 !important;
  font: 800 14px/1.2 Montserrat, sans-serif;
  text-decoration: none;
  box-shadow: 0 10px 34px rgba(58, 20, 35, .22);
  transform: translateY(calc(-100% - 24px));
  transition: transform 160ms ease;
}

.tt-skip-link:focus-visible {
  transform: translateY(0);
}

:where(a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 3px solid #8b2642 !important;
  outline-offset: 3px !important;
  box-shadow: 0 0 0 5px rgba(173, 63, 103, .16) !important;
}

[data-tt-a11y-touch="1"],
#wa-float,
.tt-cart-btn,
.tt-menu-toggle,
.tt-search-toggle,
.tt-modal-close {
  min-inline-size: 44px !important;
  min-block-size: 44px !important;
}

.tt-connectivity-status {
  position: fixed;
  z-index: 2147482987;
  right: max(14px, env(safe-area-inset-right));
  bottom: max(14px, env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(470px, calc(100vw - 28px));
  padding: 12px 14px 12px 18px;
  border: 1px solid rgba(139, 38, 66, .24);
  border-radius: 18px;
  background: #fff;
  color: #34272d;
  box-shadow: 0 14px 42px rgba(58, 20, 35, .18);
  font: 600 12px/1.45 Montserrat, sans-serif;
}

.tt-connectivity-status[hidden] { display: none !important; }
.tt-connectivity-status-text { min-width: 0; flex: 1 1 auto; overflow-wrap: anywhere; }
.tt-connectivity-retry {
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 44px;
  padding: 10px 14px;
  border: 0;
  border-radius: 999px;
  background: #8b2642;
  color: #fff;
  font: 800 12px/1 Montserrat, sans-serif;
  cursor: pointer;
}

[aria-invalid="true"] {
  border-color: #9f1239 !important;
  box-shadow: 0 0 0 3px rgba(159, 18, 57, .14) !important;
}

:where(main, [role="main"], p, li, dd, td, th, label, .tt-state-message) {
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .tt-connectivity-status {
    right: max(12px, env(safe-area-inset-right));
    bottom: calc(92px + env(safe-area-inset-bottom));
    left: max(12px, env(safe-area-inset-left));
    width: auto;
  }
}

@media (prefers-contrast: more) {
  :where(a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])):focus-visible {
    outline-width: 4px !important;
    box-shadow: none !important;
  }
  .tt-connectivity-status { border-width: 2px; }
}

@media (forced-colors: active) {
  .tt-skip-link,
  .tt-connectivity-status,
  .tt-connectivity-retry { forced-color-adjust: auto; border: 2px solid ButtonText; }
}

@media (prefers-reduced-motion: reduce) {
  .tt-skip-link { transition: none !important; }
  :where([role="dialog"], dialog, .tt-connectivity-status) { scroll-behavior: auto !important; }
}
`;

const audit = `'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
function check(name, condition, problem) { checks.push({ name, ok: Boolean(condition), problem }); }

const runtime = read('js/phase10-accessibility.js');
const css = read('css/phase10-accessibility.css');
const loader = read('js/phase8-ui-ux.js');
const gate = read('js/store-gate-core.js');
const page404 = read('404.html');
const privacy = read('privacidad.html');
const pkg = JSON.parse(read('package.json'));
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));

check('La Fase 10 se inicia desde el runtime compartido', /phase10-accessibility\\.js/.test(loader) && /TintinPhase10ImportStarted/.test(loader), 'Debe cargarse una sola vez en todas las páginas que usan page-loader.');
check('Todas las páginas usan la versión de caché de Fase 10', htmlFiles.every(file => !read(file).includes('js/page-loader.js') || read(file).includes('js/page-loader.js?v=${NEW_VERSION}')), 'No debe quedar una página con el loader anterior.');
check('Existe enlace para saltar al contenido', /ensureSkipLink/.test(runtime) && /Saltar al contenido principal/.test(runtime) && /tt-skip-link/.test(css), 'La navegación por teclado debe poder evitar cabeceras repetidas.');
check('Los controles personalizados funcionan con teclado', /getAttribute\\('role'\\) === 'button'/.test(runtime) && /event\\.key !== 'Enter'/.test(runtime) && /control\\.click\\(\\)/.test(runtime), 'Un role=button debe responder a Enter y Espacio.');
check('Los diálogos atrapan y restauran el foco', /FOCUSABLE_SELECTOR/.test(runtime) && /event\\.key !== 'Tab'/.test(runtime) && /returnFocus/.test(runtime) && /focusin/.test(runtime), 'Ningún modal debe dejar que el foco escape o perder el punto de retorno.');
check('Los formularios anuncian errores sin bloquearse', /bindInvalidFeedback/.test(runtime) && /aria-invalid/.test(runtime) && /revisá este dato/.test(runtime), 'El primer campo inválido debe recibir foco y un aviso accesible.');
check('El estado sin conexión es informativo y recuperable', /tt-connectivity-status/.test(runtime) && /window\\.addEventListener\\('offline'/.test(runtime) && /Reintentar/.test(runtime) && !/aria-modal[^\\n]+tt-connectivity/.test(runtime), 'La pérdida temporal de red no debe crear un bloqueo permanente.');
check('WhatsApp e iconos pueden recibir nombre accesible', /Abrir WhatsApp de Tintin/.test(runtime) && /inferControlLabel/.test(runtime), 'Los controles sin texto no deben quedar anónimos para lectores de pantalla.');
check('Foco, contraste, tacto y movimiento tienen estilos inclusivos', /:focus-visible/.test(css) && /44px/.test(css) && /prefers-contrast: more/.test(css) && /forced-colors: active/.test(css) && /prefers-reduced-motion: reduce/.test(css), 'Debe existir una capa visible para teclado, alto contraste y áreas táctiles.');
check('La tienda cerrada conserva diálogo modal e inert', /role="dialog" aria-modal="true"/.test(gate) && /node\\.inert = true/.test(gate) && /aria-hidden/.test(gate), 'El overlay de tienda cerrada debe aislar semánticamente el contenido de fondo.');
check('404 y privacidad siguen disponibles', /<h1\\b/i.test(page404) && /(?:index\\.html|href="\\/")/.test(page404) && /<h1\\b/i.test(privacy), 'La recuperación de 404 y la información de privacidad deben tener estructura visible.');
check('La auditoría y la prueba de navegador son permanentes', pkg.scripts['audit:phase10'] === 'node scripts/audit-phase10-accessibility.js' && pkg.scripts['test:phase10-a11y'] === 'playwright test tests/ui-ux/phase10-accessibility.spec.js --project=chromium' && pkg.scripts['audit:final'].includes('audit:phase10') && pkg.scripts['test:phase8-ui'] === 'playwright test tests/ui-ux --project=chromium', 'Fase 10 debe ejecutarse en la batería integral y en Nivel 3.');

const failed = checks.filter(item => !item.ok);
checks.forEach(item => { console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.name); if (!item.ok) console.log('  ' + item.problem); });
if (failed.length) { console.error('\\nAuditoría Fase 10 fallida: ' + failed.length + ' problema(s).'); process.exit(1); }
console.log('\\nAuditoría Fase 10: accesibilidad y experiencia correctas (' + checks.length + ' comprobaciones).');
`;

const spec = `'use strict';

const { test, expect } = require('@playwright/test');

async function openHome(page) {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.classList.contains('tt-phase10-a11y-ready'));
}

test('el enlace de salto aparece con teclado y enfoca el contenido', async ({ page }) => {
  await openHome(page);
  await page.keyboard.press('Tab');
  const skip = page.locator('#tt-skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('main,[role="main"]').first()).toBeFocused();
});

test('un control role button responde a Enter y Espacio', async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => {
    const control = document.createElement('div');
    control.id = 'tt-test-role-button';
    control.setAttribute('role', 'button');
    control.textContent = 'Acción de prueba';
    control.addEventListener('click', () => { control.dataset.clicks = String(Number(control.dataset.clicks || 0) + 1); });
    document.body.appendChild(control);
    window.TintinAccessibility.enhance(control);
  });
  const control = page.locator('#tt-test-role-button');
  await control.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(control).toHaveAttribute('data-clicks', '2');
});

test('el diálogo atrapa el foco y lo devuelve al cerrar', async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => {
    const trigger = document.createElement('button');
    trigger.id = 'tt-test-trigger';
    trigger.textContent = 'Abrir prueba';
    document.body.appendChild(trigger);
    trigger.focus();
    const dialog = document.createElement('section');
    dialog.id = 'tt-test-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = '<h2>Diálogo accesible</h2><button id="tt-first">Primero</button><button id="tt-last">Último</button>';
    document.body.appendChild(dialog);
  });
  await expect(page.locator('#tt-first')).toBeFocused();
  await page.locator('#tt-last').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#tt-first')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#tt-last')).toBeFocused();
  await page.evaluate(() => document.getElementById('tt-test-dialog').remove());
  await expect(page.locator('#tt-test-trigger')).toBeFocused();
});

test('un campo inválido recibe foco y aria-invalid', async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.innerHTML = '<label for="tt-required">Dato requerido</label><input id="tt-required" required><button type="submit">Enviar</button>';
    form.addEventListener('submit', event => event.preventDefault());
    document.body.appendChild(form);
    form.requestSubmit();
  });
  const field = page.locator('#tt-required');
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
});

test('la pérdida de conexión informa sin abrir un modal', async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  });
  const status = page.locator('#tt-connectivity-status');
  await expect(status).toBeVisible();
  await expect(status).toContainText('sin conexión');
  await expect(status).not.toHaveAttribute('aria-modal', 'true');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
  });
  await expect(status).toBeHidden();
});
`;

write('js/phase10-accessibility.js', runtime);
write('css/phase10-accessibility.css', styles);
write('scripts/audit-phase10-accessibility.js', audit);
write('tests/ui-ux/phase10-accessibility.spec.js', spec);
write('docs/PHASE10_ACCESSIBILITY.md', `# Fase 10 — Accesibilidad y experiencia\n\nLa capa compartida agrega enlace de salto, foco visible, activación por teclado de controles personalizados, gestión de foco modal, recuperación del foco, avisos de conectividad no bloqueantes, errores de formulario anunciados y soporte para movimiento/contraste reforzado.\n\nPruebas:\n\n- \`npm run audit:phase10\`\n- \`npm run test:phase10-a11y\`\n- \`npm run audit:final\`\n`);

const phase8Path = 'js/phase8-ui-ux.js';
let phase8 = read(phase8Path);
if (!phase8.includes('TintinPhase10ImportStarted')) {
  phase8 += `\n\n// Fase 10 se monta sobre la instancia única y ya estabilizada de Fase 8.\nif (!window.__TintinPhase10ImportStarted) {\n  window.__TintinPhase10ImportStarted = true;\n  import('./phase10-accessibility.js?v=${NEW_VERSION}').catch(error => {\n    console.error('[phase10-accessibility] No se pudo iniciar la capa accesible:', error);\n  });\n}\n`;
  write(phase8Path, phase8);
}

for (const relative of walk(ROOT)) {
  if (relative === SELF || relative === 'diagnostic-manifest.json') continue;
  if (!/\\.(?:html|js|mjs|css|json|yml|yaml|md)$/.test(relative)) continue;
  const current = read(relative);
  if (current.includes(OLD_VERSION)) write(relative, current.split(OLD_VERSION).join(NEW_VERSION));
}

const packagePath = 'package.json';
const pkg = JSON.parse(read(packagePath));
pkg.scripts['audit:phase10'] = 'node scripts/audit-phase10-accessibility.js';
pkg.scripts['test:phase10-a11y'] = 'playwright test tests/ui-ux/phase10-accessibility.spec.js --project=chromium';
pkg.scripts['test:phase8-ui'] = 'playwright test tests/ui-ux --project=chromium';
if (!pkg.scripts['audit:final'].includes('audit:phase10')) {
  pkg.scripts['audit:final'] = pkg.scripts['audit:final'].replace('npm run audit:phase8-ui', 'npm run audit:phase8-ui && npm run audit:phase10');
}
write(packagePath, JSON.stringify(pkg, null, 2) + '\n');

const phase8AuditPath = 'scripts/audit-phase8-ui-ux.js';
let phase8Audit = read(phase8AuditPath);
phase8Audit = phase8Audit.replace(
  "packageJson.scripts['test:phase8-ui'] === 'playwright test tests/ui-ux/phase8-ui-ux.spec.js --project=chromium'",
  "packageJson.scripts['test:phase8-ui'] === 'playwright test tests/ui-ux --project=chromium'"
);
write(phase8AuditPath, phase8Audit);

fs.unlinkSync(absolute(SELF));
console.log('Fase 10 aplicada: runtime, estilos, auditoría, pruebas y caché consolidados.');
