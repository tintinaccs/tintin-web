import { authenticatedFetch } from '../../core/auth/cliente-api-autenticado.js?v=tintin-20260910-auth-api-1';

const state = { config: null, pending: null, sdkPromise: null, providerOrderId: '' };
const $ = id => document.getElementById(id);
const status = value => { if ($('tt-paypal-status')) $('tt-paypal-status').textContent = value; };

async function api(path, body) {
  const response = await authenticatedFetch(path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true) throw new Error(data.error || 'PayPal no pudo completar la operación.');
  return data;
}

function loadSdk(clientId, environment) {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (state.sdkPromise) return state.sdkPromise;
  const base = environment === 'live' ? 'www.paypal.com' : 'www.paypal.com';
  state.sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${base}/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    script.async = true;
    script.onload = () => window.paypal ? resolve(window.paypal) : reject(new Error('PayPal SDK no disponible.'));
    script.onerror = () => reject(new Error('No se pudo cargar PayPal. Revisá tu conexión.'));
    document.head.appendChild(script);
  });
  return state.sdkPromise;
}

async function render() {
  if (!state.pending) return;
  const container = $('tt-paypal-buttons');
  if (!container) return;
  container.replaceChildren();
  try {
    state.config ||= await (async () => {
      const response = await fetch('/api/paypal-config', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.enabled || !data.clientId) throw new Error('PayPal no está disponible todavía.');
      return data;
    })();
    status('Elegí PayPal para abrir el pago seguro.');
    const paypal = await loadSdk(state.config.clientId, state.config.environment);
    paypal.Buttons({
      style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
      createOrder: async () => {
        status('Preparando el importe verificado…');
        const data = await api('/api/paypal-create-order', { orderId: state.pending.orderId });
        state.providerOrderId = data.providerOrderId;
        status('Continuá el pago dentro de PayPal.');
        return data.providerOrderId;
      },
      onApprove: async data => {
        status('Confirmando el pago con PayPal…');
        const result = await api('/api/paypal-capture-order', { providerOrderId: data.orderID });
        status('Pago confirmado. Finalizando tu pedido…');
        window.dispatchEvent(new CustomEvent('tintin:paypal-payment-completed', { detail: result }));
      },
      onCancel: () => status('Pago cancelado. Podés intentarlo nuevamente.'),
      onError: error => { console.error('[paypal-checkout]', error); status('No se pudo completar PayPal. Podés intentarlo nuevamente.'); }
    }).render(container);
  } catch (error) {
    console.error('[paypal-checkout]', error);
    status(error.message || 'PayPal no está disponible.');
  }
}

window.addEventListener('tintin:paypal-order-ready', event => {
  state.pending = event.detail;
  $('tt-paypal-checkout')?.style.setProperty('display', 'block');
  render();
});
