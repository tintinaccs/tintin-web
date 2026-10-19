// =============================================================
// TINTIN — Enlace directo desde la notificación al pedido
// =============================================================
// La notificación abre /admin.html?section=pedidos&order=<orderId>.
// La sección la resuelve el deep-link que ya tiene js/admin/admin-app.js
// (?section=…), con todos sus chequeos de permisos. Este módulo se ocupa
// sólo del parámetro `order`: espera a que los pedidos estén cargados y
// abre el pedido con el mismo openOrderEdit() del panel.
//
// El parámetro no ejecuta ninguna acción administrativa: como máximo abre
// un editor que el propio panel ya restringe por rol, y sólo después de
// que la sesión esté autenticada y los pedidos leídos desde Firestore.

const PENDING_KEY = 'tt_push_pending_order';
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{12,220}$/;
const POLL_INTERVAL_MS = 400;
const MAX_POLLS = 60; // 24 s de sondeo: la suscripción sigue esperando datos tardíos.

function readPending() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.at || 0) > PENDING_MAX_AGE_MS) return '';
    return ORDER_ID_PATTERN.test(String(parsed.orderId || '')) ? parsed.orderId : '';
  } catch {
    return '';
  }
}

function savePending(orderId) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ orderId, at: Date.now() })); } catch {}
}

function clearPending() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch {}
}

function requestedOrderId() {
  const fromUrl = new URLSearchParams(location.search).get('order') || '';
  if (ORDER_ID_PATTERN.test(fromUrl)) return fromUrl;
  return readPending();
}

function notify(message, retry) {
  let detail = document.getElementById('push-order-status');
  if (!detail) {
    detail = document.createElement('div');
    detail.id = 'push-order-status';
    detail.className = 'tt-push-order-status';
    detail.setAttribute('role', 'status');
    const root = document.getElementById('section-pedidos');
    if (!root) return;
    root.prepend(detail);
  }
  detail.replaceChildren(document.createTextNode(message));
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'adm-btn adm-btn-outline';
    button.textContent = 'Reintentar abrir pedido';
    button.addEventListener('click', retry, { once: true });
    detail.append(button);
  }
}

function openWhenReady(orderId) {
  let unsubscribe, settled = false, source;
  const cleanup = () => {
    unsubscribe?.();
    unsubscribe = null;
    window.clearInterval(timer);
    window.removeEventListener('tintin:admin-orders-source', attach);
    window.removeEventListener('pagehide', cleanup);
  };
  const retry = () => {
    cleanup();
    window.TintinAdminOrders?.retry?.();
    openWhenReady(orderId);
  };
  const consume = snapshot => {
    if (settled) return;
    if (snapshot?.error) {
      notify('No pudimos cargar el pedido. Tu enlace sigue guardado.', retry);
      return;
    }
    const orders = window.TintinAdminOrders;
    if (!snapshot?.uid || !snapshot.ready || typeof window.openOrderEdit !== 'function') return;
    settled = true;
    cleanup();
    if (!orders?.get(orderId)) {
      clearPending();
      notify('Este pedido no está disponible para tu cuenta. Revisá la lista de Pedidos.');
      return;
    }
    clearPending();
    // Consumir la URL evita volver a abrir el editor después de cerrarlo y recargar.
    const url = new URL(location.href);
    url.searchParams.delete('order');
    history.replaceState(history.state, '', url);
    document.getElementById('push-order-status')?.remove();
    window.openOrderEdit(orderId);
  };
  function attach() {
    if (settled || !window.TintinAdminOrders?.subscribe || source === window.TintinAdminOrders) return;
    unsubscribe?.();
    source = window.TintinAdminOrders;
    const stop = source.subscribe(consume);
    // subscribe publica el snapshot inicial de forma síncrona.
    if (settled) stop(); else unsubscribe = stop;
  }
  let polls = 0;
  const timer = window.setInterval(() => {
    attach();
    if (++polls >= MAX_POLLS) {
      window.clearInterval(timer);
      if (!settled) notify('El pedido todavía está cargando. Se abrirá cuando la conexión esté lista.', retry);
      // La suscripción sigue viva: una sesión o snapshot tardío no pierde el destino.
    }
  }, POLL_INTERVAL_MS);
  window.addEventListener('tintin:admin-orders-source', attach);
  window.addEventListener('pagehide', cleanup, { once: true });
  attach();
}

function boot() {
  const orderId = requestedOrderId();
  if (!orderId) return;
  // Se guarda antes de esperar: si la sesión venció y el panel manda a
  // login.html, al volver se retoma el mismo destino.
  savePending(orderId);
  openWhenReady(orderId);
}

// El service worker puede pedirle a una ventana ya abierta que navegue al
// pedido cuando el navegador no admite client.navigate().
navigator.serviceWorker?.addEventListener?.('message', event => {
  const data = event?.data;
  if (data?.type !== 'tintin-push-navigate' || typeof data.url !== 'string') return;
  if (!data.url.startsWith('/admin.html?')) return;
  location.href = data.url;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
