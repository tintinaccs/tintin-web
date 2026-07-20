import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import {
  doc,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  normalizePaymentCatalog,
  paymentMethodLabel,
} from './payment-methods-core.js?v=tintin-20260720-payment-crud-1';

const CHECKOUT_PATH = /(^|\/)checkout(?:\.html)?$/i;
const VIEWPORTS = [1920, 1440, 1280, 1024, 768, 390, 320];

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureStyle() {
  if (document.getElementById('tt-payment-methods-style')) return;
  const link = document.createElement('link');
  link.id = 'tt-payment-methods-style';
  link.rel = 'stylesheet';
  link.href = 'css/payment-methods.css?v=tintin-20260720-payment-crud-1';
  document.head.appendChild(link);
}

function paymentDetailsHtml(method) {
  const instructions = method.instructions
    ? `<p class="ck-payment-runtime-instructions">${escapeHtml(method.instructions)}</p>`
    : '';
  const details = method.details.map(detail => `
    <div class="ck-payment-runtime-detail">
      <strong>${escapeHtml(detail.label || 'Dato')}</strong>
      <span>${escapeHtml(detail.value)}</span>
    </div>
  `).join('');
  if (!instructions && !details) return '';
  return `<div class="ck-payment-runtime-details" id="ck-payment-details-${escapeHtml(method.id)}">${instructions}${details}</div>`;
}

function methodHtml(method) {
  const inputId = `pay-runtime-${method.id}`;
  const detailsId = `ck-payment-details-${method.id}`;
  const hasDetails = Boolean(method.instructions || method.details.length);
  return `
    <div class="ck-payment-runtime-item" data-payment-method-id="${escapeHtml(method.id)}">
      <input
        type="radio"
        name="ck-pay"
        id="${escapeHtml(inputId)}"
        value="${escapeHtml(method.kind)}"
        data-payment-method-id="${escapeHtml(method.id)}"
        data-payment-method-title="${escapeHtml(paymentMethodLabel(method))}"
        class="ck-pay-option"
        ${hasDetails ? `aria-describedby="${escapeHtml(detailsId)}"` : ''}
      />
      <label for="${escapeHtml(inputId)}" class="ck-pay-label">
        <div class="ck-pay-icon" aria-hidden="true">${escapeHtml(method.icon)}</div>
        <div class="ck-payment-runtime-copy">
          <div class="ck-pay-title">${escapeHtml(method.title)}</div>
          ${method.description ? `<div class="ck-pay-desc">${escapeHtml(method.description)}</div>` : ''}
        </div>
      </label>
      ${paymentDetailsHtml(method)}
    </div>
  `;
}

function boot() {
  if (!CHECKOUT_PATH.test(location.pathname) && !document.getElementById('panel-3')) return;
  ensureStyle();

  const efectivo = document.getElementById('pay-option-efectivo');
  const transferencia = document.getElementById('pay-option-transferencia');
  const anchor = efectivo || transferencia;
  if (!anchor?.parentElement) return;

  const root = document.createElement('div');
  root.id = 'ck-payment-methods-runtime';
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', 'Métodos de pago disponibles');
  anchor.parentElement.insertBefore(root, anchor);

  let methods = [];
  let selectedMethodId = '';

  function selectedMethod() {
    const checked = root.querySelector('input[name="ck-pay"]:checked');
    if (!checked) return null;
    return methods.find(method => method.id === checked.dataset.paymentMethodId) || null;
  }

  function syncSelection() {
    root.querySelectorAll('.ck-payment-runtime-item').forEach(item => {
      const input = item.querySelector('input[name="ck-pay"]');
      const selected = Boolean(input?.checked);
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-selected', String(selected));
    });
    const selected = selectedMethod();
    selectedMethodId = selected?.id || '';
    window.dispatchEvent(new CustomEvent('tintin:payment-method-selected', {
      detail: selected ? { id: selected.id, kind: selected.kind, title: selected.title } : null,
    }));
  }

  function render(nextMethods) {
    methods = nextMethods.filter(method => method.enabled);
    const previous = selectedMethodId;
    root.innerHTML = methods.map(methodHtml).join('');
    if (efectivo) efectivo.style.display = 'none';
    if (transferencia) transferencia.style.display = 'none';

    const none = document.getElementById('error-3-none');
    const next = document.getElementById('btn-step4-next');
    if (!methods.length) {
      if (none) none.style.display = 'block';
      if (next) next.disabled = true;
      selectedMethodId = '';
      return;
    }

    if (none) none.style.display = 'none';
    if (next) next.disabled = false;
    const preferred = methods.find(method => method.id === previous);
    if (preferred) {
      const input = root.querySelector(`input[data-payment-method-id="${CSS.escape(preferred.id)}"]`);
      if (input instanceof HTMLInputElement) input.checked = true;
    }
    syncSelection();
  }

  root.addEventListener('change', event => {
    const input = event.target.closest('input[name="ck-pay"]');
    if (!input) return;
    syncSelection();
    const error = document.getElementById('error-3');
    if (error) error.classList.remove('show');
  });

  root.addEventListener('click', event => {
    const item = event.target.closest('.ck-payment-runtime-item');
    if (!item) return;
    const input = item.querySelector('input[name="ck-pay"]');
    if (input && event.target !== input && !event.target.closest('label')) {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  function patchConfirmationLabel() {
    const selected = selectedMethod();
    if (!selected) return;
    document.querySelectorAll('#ck-confirm-summary .ck-summary-row').forEach(row => {
      const label = row.querySelector('.ck-summary-label');
      const value = row.querySelector('.ck-summary-val');
      if (label?.textContent.includes('Pago') && value) value.textContent = `${selected.icon} ${selected.title}`.trim();
    });
  }

  document.getElementById('btn-step4-next')?.addEventListener('click', () => {
    window.setTimeout(patchConfirmationLabel, 0);
    window.setTimeout(patchConfirmationLabel, 80);
  }, true);

  window.TintinPaymentMethods = {
    getAll: () => methods.map(method => ({ ...method, details: method.details.map(detail => ({ ...detail })) })),
    getSelected: () => {
      const method = selectedMethod();
      return method ? { ...method, details: method.details.map(detail => ({ ...detail })) } : null;
    },
    getLabel: id => paymentMethodLabel(methods.find(method => method.id === id)),
    viewports: VIEWPORTS.slice(),
  };

  onSnapshot(doc(db, 'settings', 'general'), snapshot => {
    if (!snapshot.exists()) return;
    render(normalizePaymentCatalog(snapshot.data() || {}));
  }, error => {
    console.error('[payment-methods] No se pudieron cargar los métodos de pago:', error);
  });
}

if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot, { once: true });
