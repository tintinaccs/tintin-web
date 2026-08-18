/* TINTIN — identidad y navegación segura del checkout.
   Mejora progresiva: no reemplaza la validación original; la endurece. */
(() => {
  'use strict';

  if (window.TintinCheckoutIdentityNavigationBooted) return;
  window.TintinCheckoutIdentityNavigationBooted = true;

  const digitsOnly = (value, max = 30) => String(value == null ? '' : value).replace(/\D/g, '').slice(0, max);

  function formatDocumentNumber(value) {
    return digitsOnly(value, 8).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function normalizeParaguayNational(value) {
    let raw = digitsOnly(value, 12);
    if (raw.startsWith('595')) raw = raw.slice(3);
    if (raw.length === 8) raw = `09${raw}`;
    else if (raw.length === 9 && raw.startsWith('9')) raw = `0${raw}`;
    if (raw.length > 10) raw = raw.slice(0, 10);
    return raw;
  }

  function formatParaguayPhone(value, finalize = false) {
    let raw = digitsOnly(value, 12);
    if (finalize || raw.length >= 8) raw = normalizeParaguayNational(raw);
    else if (raw.startsWith('595')) raw = raw.slice(3);

    if (!raw) return '';
    if (raw.length <= 4) return raw;
    if (raw.length <= 7) return `${raw.slice(0, 4)}-${raw.slice(4)}`;
    return `${raw.slice(0, 4)}-${raw.slice(4, 7)}-${raw.slice(7, 10)}`;
  }

  function isEncomienda() {
    const modes = document.getElementById('ck-enc-modes');
    const method = document.getElementById('ck-ship-method');
    if (modes && getComputedStyle(modes).display !== 'none') return true;
    return /encomienda/i.test(method?.textContent || '');
  }

  function showDataError(message, target) {
    const error = document.getElementById('error-2');
    if (error) {
      error.textContent = message;
      error.classList.add('show');
    }
    target?.setAttribute('aria-invalid', 'true');
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    target?.focus?.({ preventScroll: true });
  }

  function clearDataFieldError(target) {
    target?.setAttribute('aria-invalid', 'false');
  }

  function injectStyles() {
    if (document.getElementById('tt-checkout-identity-navigation-css')) return;
    const style = document.createElement('style');
    style.id = 'tt-checkout-identity-navigation-css';
    style.textContent = `
      #ck-document-field[hidden]{display:none!important}
      #ck-document-field{margin-top:16px}
      .tt-checkout-input-help{margin-top:7px;color:#8b6875;font:600 11px/1.45 Montserrat,sans-serif}
      .tt-checkout-back-review{margin-top:10px}
      .ck-step.tt-step-back-available{cursor:pointer;user-select:none}
      .ck-step.tt-step-back-available .ck-step-num{box-shadow:0 0 0 3px rgba(184,76,114,.08);transition:transform .18s ease,box-shadow .18s ease}
      .ck-step.tt-step-back-available:hover .ck-step-num,.ck-step.tt-step-back-available:focus-visible .ck-step-num{transform:translateY(-1px);box-shadow:0 0 0 4px rgba(184,76,114,.14)}
      .ck-step.tt-step-back-available:focus-visible{outline:2px solid rgba(173,63,103,.45);outline-offset:5px;border-radius:14px}
      @media(max-width:767px){
        #ck-document-field{margin-top:14px}
        .tt-checkout-back-review{width:100%;min-height:46px}
        .ck-step.tt-step-back-available{touch-action:manipulation}
      }
    `;
    document.head.appendChild(style);
  }

  function createDocumentField() {
    let field = document.getElementById('ck-document-field');
    if (field) return field;
    const phone = document.getElementById('ck-phone-number');
    const phoneField = phone?.closest('.ck-field');
    if (!phoneField) return null;

    field = document.createElement('div');
    field.className = 'ck-field';
    field.id = 'ck-document-field';
    field.hidden = true;
    field.innerHTML = `
      <label class="ck-label" for="ck-document-number">Número de cédula *</label>
      <input type="text" class="ck-input" id="ck-document-number"
        inputmode="numeric" autocomplete="off" enterkeyhint="next"
        maxlength="10" pattern="[0-9.]*" aria-describedby="ck-document-help"
        placeholder="Ej: 5.011.789" />
      <div class="tt-checkout-input-help" id="ck-document-help">Solo números · entre 6 y 8 dígitos. Los puntos se agregan automáticamente.</div>`;
    phoneField.insertAdjacentElement('afterend', field);
    return field;
  }

  function bindDigitsOnly(input, formatter, maxDigits) {
    if (!input || input.dataset.ttDigitsOnly === '1') return;
    input.dataset.ttDigitsOnly = '1';
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', input.id === 'ck-phone-number' ? 'tel' : 'off');

    input.addEventListener('beforeinput', event => {
      if (!event.inputType?.startsWith('insert') || event.inputType === 'insertFromPaste') return;
      if (event.data != null && /\D/.test(event.data)) event.preventDefault();
    });

    input.addEventListener('paste', event => {
      const pasted = event.clipboardData?.getData('text') || '';
      event.preventDefault();
      input.value = formatter(digitsOnly(pasted, maxDigits), false);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    input.addEventListener('input', () => {
      const raw = digitsOnly(input.value, maxDigits);
      const formatted = formatter(raw, false);
      if (input.value !== formatted) input.value = formatted;
      clearDataFieldError(input);
    });
  }

  function bindPhone() {
    const input = document.getElementById('ck-phone-number');
    const country = document.getElementById('ck-phone-country');
    if (!input) return;
    input.placeholder = 'Ej: 0981-336-401';
    input.maxLength = 12;

    const formatter = (value, finalize) => {
      if (country?.value && country.value !== 'PY') return digitsOnly(value, 15);
      return formatParaguayPhone(value, finalize);
    };
    bindDigitsOnly(input, formatter, 15);

    input.addEventListener('blur', () => {
      if (!country?.value || country.value === 'PY') input.value = formatParaguayPhone(input.value, true);
    });
    country?.addEventListener('change', () => {
      input.value = country.value === 'PY'
        ? formatParaguayPhone(input.value, true)
        : digitsOnly(input.value, 15);
    });
  }

  function bindDocument() {
    const field = createDocumentField();
    const input = document.getElementById('ck-document-number');
    if (!field || !input) return;
    bindDigitsOnly(input, value => formatDocumentNumber(value), 8);
    input.addEventListener('blur', () => { input.value = formatDocumentNumber(input.value); });
  }

  function syncDocumentVisibility() {
    const field = document.getElementById('ck-document-field');
    const input = document.getElementById('ck-document-number');
    if (!field || !input) return;
    const required = isEncomienda();
    field.hidden = !required;
    input.required = required;
    input.setAttribute('aria-required', String(required));
    if (!required) {
      input.value = '';
      clearDataFieldError(input);
    }
  }

  function validateIdentityBeforePayment(event) {
    const phone = document.getElementById('ck-phone-number');
    const country = document.getElementById('ck-phone-country');
    if (phone && (!country?.value || country.value === 'PY')) {
      phone.value = formatParaguayPhone(phone.value, true);
      const national = normalizeParaguayNational(phone.value);
      if (!/^09\d{8}$/.test(national)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showDataError('Ingresá un número de teléfono válido. Solo necesitás escribir los números; nosotros agregamos los guiones.', phone);
        return false;
      }
    }

    if (isEncomienda()) {
      const documentInput = document.getElementById('ck-document-number');
      const raw = digitsOnly(documentInput?.value, 8);
      if (!/^\d{6,8}$/.test(raw)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showDataError('Ingresá tu número de cédula: debe tener entre 6 y 8 dígitos numéricos.', documentInput);
        return false;
      }
      documentInput.value = formatDocumentNumber(raw);
    }
    return true;
  }

  function activeStepIndex() {
    return [...document.querySelectorAll('.ck-panel')].findIndex(panel => panel.classList.contains('active'));
  }

  function navigateBack(targetIndex) {
    const current = activeStepIndex();
    if (targetIndex < 0 || targetIndex >= current) return false;
    document.querySelectorAll('.ck-panel').forEach((panel, index) => panel.classList.toggle('active', index === targetIndex));
    document.querySelectorAll('.ck-step').forEach((step, index) => {
      step.classList.toggle('active', index === targetIndex);
      step.classList.toggle('done', index < targetIndex);
    });
    syncStepAffordances();
    syncDocumentVisibility();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.dispatchEvent(new CustomEvent('tintin:checkout-step-back', { detail: { from: current, to: targetIndex } }));
    return true;
  }

  function injectReviewBackButton() {
    if (document.getElementById('btn-step5-back')) return;
    const confirm = document.getElementById('ck-confirm-btn');
    if (!confirm) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'btn-step5-back';
    button.className = 'ck-btn-back tt-checkout-back-review';
    button.textContent = '← Volver al pago';
    button.addEventListener('click', () => navigateBack(3));
    confirm.insertAdjacentElement('afterend', button);

    window.addEventListener('tintin:order-created', () => { button.hidden = true; }, { once: true });
  }

  function syncStepAffordances() {
    const current = activeStepIndex();
    document.querySelectorAll('.ck-step').forEach((step, index) => {
      const backwards = current > 0 && index < current;
      step.classList.toggle('tt-step-back-available', backwards);
      if (backwards) {
        step.setAttribute('role', 'button');
        step.tabIndex = 0;
        step.setAttribute('aria-label', `Volver al paso ${index + 1}: ${step.querySelector('.ck-step-label')?.textContent || ''}`);
      } else {
        step.removeAttribute('role');
        step.removeAttribute('tabindex');
        step.removeAttribute('aria-label');
      }
    });
  }

  function bindStepper() {
    const steps = document.getElementById('ck-steps');
    if (!steps || steps.dataset.ttBackNavigation === '1') return;
    steps.dataset.ttBackNavigation = '1';
    const activate = event => {
      const step = event.target?.closest?.('.ck-step.tt-step-back-available');
      if (!step) return;
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      const index = [...steps.querySelectorAll('.ck-step')].indexOf(step);
      navigateBack(index);
    };
    steps.addEventListener('click', activate);
    steps.addEventListener('keydown', activate);

    const panels = document.querySelector('.ck-body');
    if (panels) new MutationObserver(() => {
      syncStepAffordances();
      syncDocumentVisibility();
      injectSummaryDocument();
    }).observe(panels, { subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }

  function injectSummaryDocument() {
    if (activeStepIndex() !== 4 || !isEncomienda()) return;
    const summary = document.getElementById('ck-confirm-summary');
    const documentInput = document.getElementById('ck-document-number');
    if (!summary || !documentInput) return;
    const value = formatDocumentNumber(documentInput.value);
    if (!value) return;
    let row = document.getElementById('ck-summary-document-number');
    if (!row) {
      row = document.createElement('div');
      row.id = 'ck-summary-document-number';
      row.className = 'ck-summary-row';
      row.innerHTML = '<span class="ck-summary-label">🪪 Cédula</span><span class="ck-summary-val"></span>';
      const shippingRow = [...summary.querySelectorAll('.ck-summary-row')].find(item => /Envío/i.test(item.querySelector('.ck-summary-label')?.textContent || ''));
      if (shippingRow) shippingRow.insertAdjacentElement('beforebegin', row);
      else summary.appendChild(row);
    }
    row.querySelector('.ck-summary-val').textContent = value;
  }

  function observeShipping() {
    ['ck-city', 'ck-departamento', 'ck-enc-agencia', 'ck-enc-puerta'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => queueMicrotask(syncDocumentVisibility));
      document.getElementById(id)?.addEventListener('click', () => queueMicrotask(syncDocumentVisibility));
    });
    const modes = document.getElementById('ck-enc-modes');
    if (modes) new MutationObserver(syncDocumentVisibility).observe(modes, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  function boot() {
    injectStyles();
    bindPhone();
    bindDocument();
    injectReviewBackButton();
    bindStepper();
    observeShipping();
    syncDocumentVisibility();
    syncStepAffordances();

    const next = document.getElementById('btn-step3-next');
    if (next && next.dataset.ttIdentityGuard !== '1') {
      next.dataset.ttIdentityGuard = '1';
      next.addEventListener('click', validateIdentityBeforePayment, true);
    }

    window.TintinCheckoutInputEnhancements = Object.freeze({
      documentNumberDigits: () => digitsOnly(document.getElementById('ck-document-number')?.value, 8),
      formatDocumentNumber,
      formatParaguayPhone,
      normalizeParaguayNational,
      isEncomienda,
      navigateBack,
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
