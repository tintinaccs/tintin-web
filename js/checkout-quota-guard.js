const COOLDOWN_KEY = 'tt_checkout_quota_cooldown_until';
const COOLDOWN_MS = 60 * 1000;
let timer = 0;

function cooldownUntil() {
  try {
    return Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
  } catch {
    return 0;
  }
}

function saveCooldown(until) {
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(until));
  } catch {}
}

function isQuotaError(error) {
  const code = String(error?.code || error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code.includes('resource-exhausted') || message.includes('quota exceeded') || message.includes('resource-exhausted');
}

function errorBox() {
  return document.getElementById('error-4');
}

function button() {
  return document.getElementById('ck-confirm-btn');
}

function renderCooldown() {
  clearTimeout(timer);
  const remaining = Math.max(0, cooldownUntil() - Date.now());
  const control = button();
  const box = errorBox();
  if (!remaining) {
    if (control) {
      control.disabled = false;
      control.textContent = '✓ Confirmar pedido';
    }
    return;
  }

  const seconds = Math.ceil(remaining / 1000);
  if (control) {
    control.disabled = true;
    control.textContent = `Esperá ${seconds} s para reintentar`;
  }
  if (box) {
    box.textContent = 'Firestore alcanzó temporalmente el límite de lecturas. Tu pedido no fue creado ni se descontó stock. Conservamos todos tus datos y tu carrito.';
    box.classList.add('show');
    box.setAttribute('role', 'alert');
  }
  timer = window.setTimeout(renderCooldown, 1000);
}

function activateCooldown() {
  saveCooldown(Date.now() + COOLDOWN_MS);
  window.setTimeout(renderCooldown, 0);
}

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  originalConsoleError(...args);
  if (args[0] === '[spark-checkout]' && args.some(isQuotaError)) activateCooldown();
};

window.addEventListener('click', event => {
  const control = event.target?.closest?.('#ck-confirm-btn');
  if (!control || cooldownUntil() <= Date.now()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  event.stopPropagation();
  renderCooldown();
}, true);

window.addEventListener('unhandledrejection', event => {
  if (isQuotaError(event.reason)) activateCooldown();
});

if (cooldownUntil() > Date.now()) renderCooldown();

window.TintinCheckoutQuotaGuard = {
  getRemaining: () => Math.max(0, cooldownUntil() - Date.now()),
  activate: activateCooldown
};
