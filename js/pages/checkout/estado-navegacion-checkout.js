const CHECKOUT_PATH = /(^|\/)checkout(?:\.html)?\/?$/i;
const DRAFT_KEY = 'tt_checkout_draft_v1';
const MAX_STEP_KEY = 'tt_checkout_max_step_v1';
const STEP_SELECTOR = '.ck-step[data-step]';
const PANEL_SELECTOR = '.ck-panel';

const DRAFT_FIELDS = Object.freeze([
  'ck-departamento',
  'ck-city',
  'ck-address',
  'ck-referencia',
  'ck-location-name',
  'ck-save-location',
  'ck-name',
  'ck-phone-number',
  'ck-email',
  'ck-notes',
  'ck-ci',
  'ck-wants-invoice',
  'ck-razon-social',
  'ck-ruc',
  'pay-efectivo',
  'pay-transferencia',
]);

let maxNavigableStep = 0;
let restoring = false;
let mutationObserver = null;

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || 'null');
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function activeStep() {
  return [...document.querySelectorAll(PANEL_SELECTOR)]
    .findIndex(panel => panel.classList.contains('active'));
}

function serializedField(element) {
  if (!element) return null;
  if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
    return { type: element.type, checked: element.checked, value: element.value };
  }
  return { type: element.tagName.toLowerCase(), value: element.value ?? '' };
}

function persistDraft() {
  if (restoring) return;
  const fields = {};
  DRAFT_FIELDS.forEach(id => {
    const state = serializedField(document.getElementById(id));
    if (state) fields[id] = state;
  });
  writeJson(DRAFT_KEY, { version: 1, fields, savedAt: Date.now() });
}

function dispatchValueEvents(element) {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function restoreSimpleField(id, saved) {
  const element = document.getElementById(id);
  if (!element || !saved) return false;

  if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
    element.checked = saved.checked === true;
    if (element.checked) dispatchValueEvents(element);
    return true;
  }

  const value = String(saved.value ?? '');
  if (!value) return true;
  if (element instanceof HTMLSelectElement) {
    const exists = [...element.options].some(option => option.value === value);
    if (!exists) return false;
  }
  element.value = value;
  dispatchValueEvents(element);
  return true;
}

function restoreDraft() {
  const draft = readJson(DRAFT_KEY, null);
  if (!draft?.fields || typeof draft.fields !== 'object') return;
  restoring = true;
  try {
    // Departamento primero: su change repuebla el selector de ciudades.
    restoreSimpleField('ck-departamento', draft.fields['ck-departamento']);
    DRAFT_FIELDS.filter(id => id !== 'ck-departamento' && id !== 'ck-city')
      .forEach(id => restoreSimpleField(id, draft.fields[id]));
    restoreSimpleField('ck-city', draft.fields['ck-city']);
  } finally {
    restoring = false;
  }
}

function scheduleRestore() {
  [0, 80, 250, 700, 1400].forEach(delay => window.setTimeout(restoreDraft, delay));
}

function rememberValidatedStep() {
  const step = activeStep();
  if (step <= maxNavigableStep) return;
  maxNavigableStep = step;
  // Confirmación depende de orderData en memoria. No se habilita como salto
  // directo después de una navegación completa o recarga.
  writeJson(MAX_STEP_KEY, Math.min(maxNavigableStep, 3));
}

function setVisualStep(target) {
  document.querySelectorAll(PANEL_SELECTOR).forEach((panel, index) => {
    panel.classList.toggle('active', index === target);
  });
  document.querySelectorAll(STEP_SELECTOR).forEach((step, index) => {
    step.classList.remove('active', 'done');
    if (index === target) step.classList.add('active');
    if (index < target) step.classList.add('done');
  });
  if (target === 2) {
    // El checkout canónico decide si CI corresponde según el envío. Si volvemos
    // desde Confirmación, conservamos el estado visual ya calculado.
    const ci = document.getElementById('ck-ci-field');
    if (ci && ci.dataset.ttPreviousDisplay) ci.style.display = ci.dataset.ttPreviousDisplay;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nativeBackButtonFor(step) {
  if (step === 3) return document.getElementById('btn-step4-back');
  if (step === 2) return document.getElementById('btn-step3-back');
  if (step === 1) return document.getElementById('btn-step2-back');
  return null;
}

function nativeNextButtonFor(step) {
  if (step === 0) return document.getElementById('btn-step1-next');
  if (step === 1) return document.getElementById('btn-step2-next');
  if (step === 2) return document.getElementById('btn-step3-next');
  if (step === 3) return document.getElementById('btn-step4-next');
  return null;
}

async function navigateBackward(target) {
  let current = activeStep();
  if (current === 4 && target <= 3) {
    // El HTML original no tiene botón "Volver al pago" en Confirmación.
    // Sólo retrocedemos visualmente un paso; el siguiente avance vuelve a pasar
    // por btn-step4-next, que reconstruye el resumen y sincroniza el estado
    // interno canónico antes de regresar a Confirmación.
    setVisualStep(3);
    current = 3;
  }
  while (current > target) {
    const back = nativeBackButtonFor(current);
    if (!back) break;
    back.click();
    await new Promise(resolve => requestAnimationFrame(resolve));
    current = activeStep();
  }
}

async function navigateForward(target) {
  let current = activeStep();
  while (current < target) {
    const next = nativeNextButtonFor(current);
    if (!next || next.disabled) return;
    next.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const nextActive = activeStep();
    if (nextActive <= current) return; // validación nativa frenó el avance
    current = nextActive;
    rememberValidatedStep();
  }
}

async function navigateTo(target) {
  const current = activeStep();
  if (!Number.isInteger(target) || target < 0 || target > 4 || target === current) return;
  if (target > maxNavigableStep) return;
  if (target < current) await navigateBackward(target);
  else await navigateForward(target);
}

function makeStepsInteractive() {
  document.querySelectorAll(STEP_SELECTOR).forEach(step => {
    const target = Number(step.dataset.step);
    step.setAttribute('role', 'button');
    step.setAttribute('tabindex', '0');
    step.setAttribute('aria-label', `Ir al paso ${target + 1}`);
    step.addEventListener('click', () => void navigateTo(target));
    step.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      void navigateTo(target);
    });
  });
}

function syncStepAccessibility() {
  const current = activeStep();
  document.querySelectorAll(STEP_SELECTOR).forEach(step => {
    const target = Number(step.dataset.step);
    const allowed = target <= maxNavigableStep;
    step.setAttribute('aria-current', target === current ? 'step' : 'false');
    step.setAttribute('aria-disabled', String(!allowed));
    step.classList.toggle('tt-step-navigable', allowed && target !== current);
  });
}

function clearCheckoutState() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(MAX_STEP_KEY);
  } catch {}
  maxNavigableStep = 0;
}

function observeSuccess() {
  const postConfirm = document.getElementById('ck-post-confirm');
  if (!postConfirm) return;
  const maybeClear = () => {
    if (postConfirm.style.display !== 'none' && !postConfirm.hidden) clearCheckoutState();
  };
  new MutationObserver(maybeClear).observe(postConfirm, {
    attributes: true,
    attributeFilter: ['style', 'hidden', 'class'],
  });
  maybeClear();
}

function bindDraftPersistence() {
  document.addEventListener('input', event => {
    if (DRAFT_FIELDS.includes(event.target?.id)) persistDraft();
  }, true);
  document.addEventListener('change', event => {
    if (DRAFT_FIELDS.includes(event.target?.id)) persistDraft();
  }, true);

  document.addEventListener('click', event => {
    const forward = event.target?.closest?.('#btn-step1-next,#btn-step2-next,#btn-step3-next,#btn-step4-next');
    if (!forward) return;
    persistDraft();
    window.setTimeout(() => {
      rememberValidatedStep();
      syncStepAccessibility();
      persistDraft();
    }, 0);
  }, false);
}

function boot() {
  if (!CHECKOUT_PATH.test(location.pathname)) return;
  maxNavigableStep = Math.max(0, Math.min(3, Number(readJson(MAX_STEP_KEY, 0)) || 0));
  rememberValidatedStep();
  makeStepsInteractive();
  bindDraftPersistence();
  scheduleRestore();
  observeSuccess();
  syncStepAccessibility();

  const stepsRoot = document.getElementById('ck-steps');
  if (stepsRoot) {
    mutationObserver = new MutationObserver(() => {
      rememberValidatedStep();
      syncStepAccessibility();
    });
    mutationObserver.observe(document.querySelector('.ck-body') || document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  window.addEventListener('pagehide', persistDraft);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

window.TintinCheckoutState = {
  clear: clearCheckoutState,
  persist: persistDraft,
  restore: restoreDraft,
  get maxNavigableStep() { return maxNavigableStep; },
};
