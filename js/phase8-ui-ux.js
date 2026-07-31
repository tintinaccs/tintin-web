/* =============================================================
   TINTIN — Fase 8: experiencia visual y estados accesibles

   Capa progresiva para botones, formularios y estados dinámicos. No reemplaza
   los mensajes propios de cada pantalla: los vuelve coherentes, recuperables
   y comprensibles para teclado y lectores de pantalla.
   ============================================================= */

const BUSY_TIMEOUT_MS = 12_000;
const STATE_SELECTOR = [
  '[data-tt-state]',
  '.tt-loading', '.tt-loading-state', '.loading-state',
  '.tt-error', '.tt-error-state', '.error-state',
  '.tt-empty', '.tt-empty-state', '.empty-state',
  '[aria-busy="true"]'
].join(',');

const busyButtons = new WeakMap();
let liveRegion = null;
let refreshQueued = false;

function cleanText(value, maxLength = 300) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function ensureLiveRegion() {
  if (liveRegion?.isConnected) return liveRegion;
  liveRegion = document.getElementById('tt-ux-live-region');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'tt-ux-live-region';
    liveRegion.className = 'tt-ux-live-region';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body?.appendChild(liveRegion);
  }
  return liveRegion;
}

export function announce(message, options = {}) {
  const text = cleanText(message, 500);
  if (!text) return;
  const region = ensureLiveRegion();
  if (!region) return;
  region.setAttribute('aria-live', options.assertive ? 'assertive' : 'polite');
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = text; });
}

function buttonLabel(button) {
  return cleanText(
    button?.getAttribute('aria-label') ||
    button?.dataset?.ttBusyLabel ||
    button?.textContent ||
    'Procesando',
    120
  );
}

export function setButtonBusy(button, busy = true, options = {}) {
  if (!(button instanceof HTMLElement)) return;
  const current = busyButtons.get(button);

  if (!busy) {
    if (current?.timer) clearTimeout(current.timer);
    const previousDisabled = current?.previousDisabled === true;
    button.removeAttribute('aria-busy');
    button.removeAttribute('data-tt-busy');
    button.classList.remove('tt-is-busy');
    if (!previousDisabled && 'disabled' in button) button.disabled = false;
    busyButtons.delete(button);
    return;
  }

  if (current) return;
  const previousDisabled = 'disabled' in button && button.disabled === true;
  const label = cleanText(options.label || button.dataset.ttBusyLabel || 'Procesando…', 80);
  button.setAttribute('aria-busy', 'true');
  button.setAttribute('data-tt-busy', '1');
  button.classList.add('tt-is-busy');
  if ('disabled' in button) button.disabled = true;
  if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', `${buttonLabel(button)}. ${label}`);

  const timer = window.setTimeout(() => {
    setButtonBusy(button, false);
    announce('La operación está tardando más de lo esperado. Podés volver a intentarlo.');
  }, Math.max(1500, Number(options.timeout) || BUSY_TIMEOUT_MS));
  busyButtons.set(button, { previousDisabled, timer });
}

function resolveFormSubmitter(form, event) {
  if (event?.submitter instanceof HTMLElement) return event.submitter;
  return form.querySelector('button[type="submit"],input[type="submit"]');
}

function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!form.checkValidity()) return;
  const submitter = resolveFormSubmitter(form, event);
  if (!submitter || submitter.dataset.ttNoBusy === '1') return;
  queueMicrotask(() => {
    if (event.defaultPrevented && form.dataset.ttSubmitting !== '1') return;
    setButtonBusy(submitter, true, {
      label: submitter.dataset.ttBusyLabel || 'Guardando…',
      timeout: Number(form.dataset.ttBusyTimeout) || BUSY_TIMEOUT_MS
    });
  });
}

function releaseFormButtons(form) {
  if (!(form instanceof HTMLFormElement)) return;
  form.querySelectorAll('[data-tt-busy="1"]').forEach(button => setButtonBusy(button, false));
}

function inferState(element) {
  const declared = cleanText(element.dataset.ttState || '', 20).toLowerCase();
  if (['loading', 'error', 'empty', 'success', 'info'].includes(declared)) return declared;
  const classes = element.className?.toString().toLowerCase() || '';
  if (classes.includes('error')) return 'error';
  if (classes.includes('empty')) return 'empty';
  if (classes.includes('success')) return 'success';
  if (classes.includes('loading') || element.getAttribute('aria-busy') === 'true') return 'loading';
  return 'info';
}

function enhanceState(element) {
  if (!(element instanceof HTMLElement)) return;
  const state = inferState(element);
  element.dataset.ttState = state;
  element.classList.add('tt-state-surface', `tt-state-${state}`);
  if (!element.hasAttribute('role')) {
    element.setAttribute('role', state === 'error' ? 'alert' : 'status');
  }
  if (!element.hasAttribute('aria-live')) {
    element.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
  }
  if (state === 'loading') element.setAttribute('aria-busy', 'true');
  else if (element.dataset.ttKeepBusy !== '1') element.removeAttribute('aria-busy');

  element.querySelectorAll('button,a').forEach(control => {
    if (!(control instanceof HTMLElement)) return;
    if (/reintentar|intentar de nuevo|volver a intentar/i.test(control.textContent || '')) {
      control.classList.add('tt-state-action');
      if (!control.getAttribute('aria-label')) control.setAttribute('aria-label', cleanText(control.textContent, 80));
    }
  });
}

export function renderState(container, options = {}) {
  if (!(container instanceof HTMLElement)) return null;
  const state = ['loading', 'error', 'empty', 'success', 'info'].includes(options.state)
    ? options.state
    : 'info';
  const title = cleanText(options.title || ({
    loading: 'Cargando…',
    error: 'No pudimos completar esta acción',
    empty: 'Todavía no hay contenido',
    success: 'Listo',
    info: 'Información'
  })[state], 120);
  const message = cleanText(options.message || '', 500);

  container.replaceChildren();
  container.dataset.ttState = state;
  const icon = document.createElement('span');
  icon.className = 'tt-state-icon';
  icon.setAttribute('aria-hidden', 'true');

  const heading = document.createElement('strong');
  heading.className = 'tt-state-title';
  heading.textContent = title;
  container.append(icon, heading);

  if (message) {
    const paragraph = document.createElement('p');
    paragraph.className = 'tt-state-message';
    paragraph.textContent = message;
    container.appendChild(paragraph);
  }

  if (options.actionLabel && typeof options.onAction === 'function') {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'tt-state-action';
    action.textContent = cleanText(options.actionLabel, 80);
    action.addEventListener('click', () => options.onAction(action));
    container.appendChild(action);
  }

  enhanceState(container);
  return container;
}

function enhanceInteractive(root = document) {
  root.querySelectorAll?.('button,a[href],[role="button"],input[type="button"],input[type="submit"]').forEach(control => {
    if (!(control instanceof HTMLElement) || control.dataset.ttInteractive === '1') return;
    control.dataset.ttInteractive = '1';
    if (control.matches('button,[role="button"],input[type="button"],input[type="submit"]')) {
      control.classList.add('tt-interactive-control');
    }
  });
}

function enhanceImages(root = document) {
  root.querySelectorAll?.('img').forEach(image => {
    if (!(image instanceof HTMLImageElement) || image.dataset.ttUxImage === '1') return;
    image.dataset.ttUxImage = '1';
    image.addEventListener('error', () => {
      image.classList.add('tt-img-error');
      const alt = cleanText(image.alt, 120);
      if (alt && !image.nextElementSibling?.classList.contains('tt-img-error-label')) {
        const label = document.createElement('span');
        label.className = 'tt-img-error-label';
        label.setAttribute('role', 'status');
        label.textContent = `No pudimos cargar la imagen de ${alt}.`;
        image.insertAdjacentElement('afterend', label);
      }
    }, { once: true });
  });
}

function refresh(root = document) {
  enhanceInteractive(root);
  enhanceImages(root);
  root.querySelectorAll?.(STATE_SELECTOR).forEach(enhanceState);
}

function scheduleRefresh(root = document) {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    refresh(root);
  });
}

function bindInteractionFeedback() {
  document.addEventListener('pointerdown', event => {
    const control = event.target.closest?.('[data-tt-interactive="1"]');
    control?.classList.add('tt-is-pressed');
  }, { passive: true });
  ['pointerup', 'pointercancel', 'dragstart'].forEach(name => {
    document.addEventListener(name, event => {
      event.target.closest?.('[data-tt-interactive="1"]')?.classList.remove('tt-is-pressed');
    }, { passive: true });
  });
  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.target.closest?.('[data-tt-interactive="1"]')?.classList.add('tt-is-pressed');
  });
  document.addEventListener('keyup', event => {
    event.target.closest?.('[data-tt-interactive="1"]')?.classList.remove('tt-is-pressed');
  });
  document.addEventListener('submit', handleSubmit, true);
  document.addEventListener('invalid', event => releaseFormButtons(event.target?.form), true);
}

function bindSettledEvents() {
  ['tintin:async-settled', 'tintin:form-settled', 'tintin:products-error', 'unhandledrejection'].forEach(name => {
    window.addEventListener(name, event => {
      const target = event.detail?.button || event.detail?.form || null;
      if (target instanceof HTMLFormElement) releaseFormButtons(target);
      else if (target instanceof HTMLElement) setButtonBusy(target, false);
      else document.querySelectorAll('[data-tt-busy="1"]').forEach(button => setButtonBusy(button, false));
    });
  });
  window.addEventListener('pageshow', () => {
    document.querySelectorAll('[data-tt-busy="1"]').forEach(button => setButtonBusy(button, false));
  });
}

function observeDynamicUi() {
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof HTMLElement) scheduleRefresh(node);
    }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

function boot() {
  if (window.TintinUX?.booted) return;
  ensureLiveRegion();
  refresh();
  bindInteractionFeedback();
  bindSettledEvents();
  observeDynamicUi();
  document.documentElement.classList.add('tt-phase8-ux-ready');
  window.TintinUX = {
    booted: true,
    announce,
    setBusy: setButtonBusy,
    renderState,
    enhance: refresh
  };
  window.dispatchEvent(new CustomEvent('tintin:phase8-ui-ready'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();


// Fase 10 se monta sobre la instancia única y ya estabilizada de Fase 8.
if (!window.__TintinPhase10ImportStarted) {
  window.__TintinPhase10ImportStarted = true;
  import('./phase10-accessibility.js?v=tintin-20260731-phase10-a11y-1').catch(error => {
    console.error('[phase10-accessibility] No se pudo iniciar la capa accesible:', error);
  });
}
