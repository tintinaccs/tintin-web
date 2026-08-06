/* =============================================================
   TINTIN — Fase 10: accesibilidad y experiencia inclusiva
   ============================================================= */

const DIALOG_SELECTOR = 'dialog[open],[role="dialog"][aria-modal="true"]';
const CONTROL_SELECTOR = 'button,a[href],[role="button"],input[type="button"],input[type="submit"]';
const FIELD_SELECTOR = 'input,select,textarea';
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
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function injectStyles() {
  if (document.getElementById('tt-phase10-accessibility-css')) return;
  const link = document.createElement('link');
  link.id = 'tt-phase10-accessibility-css';
  link.rel = 'stylesheet';
  link.href = new URL('../../css/quality/accesibilidad-global.css?v=tintin-20260731-phase10-a11y-1', import.meta.url).href;
  document.head?.appendChild(link);
}

function isVisible(element) {
  if (!(element instanceof HTMLElement) || element.hidden || element.inert) return false;
  if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none') return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
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
  link.addEventListener('click', event => {
    event.preventDefault();
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: 'start' });
  });
  document.body?.insertBefore(link, document.body.firstChild);
}

function bindSkipLinkRecovery() {
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') ensureSkipLink();
  }, true);
  window.addEventListener('pageshow', ensureSkipLink);
}

function hasAccessibleName(control) {
  if (!(control instanceof HTMLElement)) return true;
  const labelledBy = cleanText(control.getAttribute('aria-labelledby'));
  if (labelledBy && labelledBy.split(/\s+/).some(id => cleanText(document.getElementById(id)?.textContent))) return true;
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
  if (/whatsapp|wa-float|wa\.me/.test(signature)) return 'Abrir WhatsApp de Tintin';
  if (/cart|carrito/.test(signature)) return 'Abrir carrito';
  if (/search|buscar/.test(signature)) return 'Buscar';
  if (/menu|nav-toggle|hamburger/.test(signature)) return 'Abrir menú';
  if (/close|cerrar|dismiss/.test(signature)) return 'Cerrar';
  return '';
}

function isKeyboardActivation(event) {
  const key = String(event.key || '');
  return key === 'Enter' || key === ' ' || key === 'Spacebar' || event.code === 'Space' || event.keyCode === 32;
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
      if (!isKeyboardActivation(event)) return;
      event.preventDefault();
      // En entradas físicas bloquea el autorepeat. Los eventos sintéticos de
      // pruebas y tecnologías de asistencia no deben descartarse por un valor
      // de repeat inconsistente del navegador.
      if (event.isTrusted && event.repeat) return;
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
    if (activeDialog !== dialog || !isVisible(dialog)) return;
    const target = focusables(dialog)[0] || dialog;
    target.focus({ preventScroll: true });
  });
}

function releaseDialogIfNeeded() {
  if (!activeDialog) return false;
  if (activeDialog.isConnected && isVisible(activeDialog)) return false;
  activeDialog = null;
  const target = returnFocus;
  returnFocus = null;
  if (target?.isConnected && !target.inert) {
    target.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (document.activeElement !== target && target.isConnected && !activeDialog) target.focus({ preventScroll: true });
    });
  }
  return true;
}

function scanDialogs() {
  const released = releaseDialogIfNeeded();
  if (released || activeDialog) return;
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
  if (root instanceof HTMLElement && root.matches(CONTROL_SELECTOR)) enhanceControl(root);
  root.querySelectorAll?.(CONTROL_SELECTOR).forEach(enhanceControl);
  if (root instanceof HTMLElement && root.matches(FIELD_SELECTOR)) enhanceField(root);
  root.querySelectorAll?.(FIELD_SELECTOR).forEach(enhanceField);
  if (root instanceof HTMLElement && root.matches('[role="alert"],[aria-live]') && !root.hasAttribute('aria-atomic')) {
    root.setAttribute('aria-atomic', 'true');
  }
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
    const focusField = () => {
      if (field.isConnected && !field.inert && !activeDialog) field.focus({ preventScroll: false });
    };
    queueMicrotask(focusField);
    requestAnimationFrame(focusField);
    window.setTimeout(focusField, 0);
  }, true);
}

function observe() {
  const observer = new MutationObserver(records => {
    let structureChanged = false;
    records.forEach(record => {
      if (record.type === 'childList') structureChanged = true;
      record.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) enhance(node);
      });
    });
    if (structureChanged && !document.getElementById('tt-skip-link')) queueMicrotask(ensureSkipLink);
    scheduleDialogScan();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['open', 'hidden', 'class', 'style', 'aria-hidden', 'aria-modal']
  });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

function boot() {
  if (window.TintinAccessibility?.booted) return;
  injectStyles();
  enhance();
  bindSkipLinkRecovery();
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
