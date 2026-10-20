// =============================================================
// TINTIN — Enlace directo desde la notificación a su ficha
// =============================================================
// La notificación abre /admin.html?section=pedidos&order=<orderId>.
// La sección la resuelve el deep-link que ya tiene js/admin/admin-app.js
// (?section=…), con todos sus chequeos de permisos. Este módulo se ocupa
// del parámetro `order` y de las fichas de usuarios, participación y mayoristas:
// espera sesión, permisos y controladores antes de abrir la ficha solicitada.
//
// El parámetro no ejecuta ninguna acción administrativa: como máximo abre
// un editor que el propio panel ya restringe por rol, y sólo después de
// que la sesión esté autenticada y los pedidos leídos desde Firestore.

import { adminReturnStorage, adminTargetId, normalizeAdminDestination, rememberAdminDestination, consumeAdminDestination } from '../../core/auth/destino-admin.mjs?v=tintin-20261020-push-return-1';

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
  const params = new URLSearchParams(location.search);
  if (params.has('section') && params.get('section') !== 'pedidos') return '';
  const fromUrl = params.get('order') || '';
  if (ORDER_ID_PATTERN.test(fromUrl)) return fromUrl;
  return readPending();
}

function notify(message, retry, section = 'pedidos') {
  let detail = document.getElementById('push-order-status');
  if (!detail) {
    detail = document.createElement('div');
    detail.id = 'push-order-status';
    detail.className = 'tt-push-order-status';
    detail.setAttribute('role', 'status');
    const root = document.getElementById(`section-${section}`);
    if (!root) return;
    root.prepend(detail);
  }
  detail.replaceChildren(document.createTextNode(message));
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'adm-btn adm-btn-outline';
    button.textContent = section === 'pedidos' ? 'Reintentar abrir pedido' : 'Reintentar abrir ficha';
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
    consumeAdminDestination(location.href, adminReturnStorage(window), location.origin);
    // Consumir la URL evita volver a abrir el editor después de cerrarlo y recargar.
    const url = new URL(location.href);
    url.searchParams.delete('order');
    url.searchParams.delete('section');
    url.hash = 'pedidos';
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

function openRecordWhenReady(section, key, id) {
  const destination = location.href;
  let busy = false, done = false, polls = 0;
  const stop = () => {
    window.clearInterval(timer); observer.disconnect();
    window.removeEventListener('tintin:admin-ficha-source', sourceReady);
  };
  const retry = () => { stop(); openRecordWhenReady(section, key, id); };
  const attempt = async () => {
    if (done || busy || !document.documentElement.classList.contains('adm-auth-ready')) return;
    const active = document.querySelector('.adm-section.active');
    if (active?.id !== `section-${section}`) return; // switchSection mantiene la autoridad del rol.
    const open = key === 'user' ? window.openClientFichaByUid : key === 'quote' ? window.TintinWholesaleOpenQuote : window.TintinAdminEngagement?.openNotificationTarget;
    if (typeof open !== 'function') return;
    busy = true;
    try {
      const opened = key === 'user' || key === 'quote' ? await open(id) : await open(key, id, adminTargetId(new URLSearchParams(location.search).get('reply')));
      stop();
      if (!opened) { notify('No pudimos abrir esta ficha. El destino sigue guardado.', retry, section); return; }
      done = true;
      consumeAdminDestination(destination, adminReturnStorage(window), location.origin);
      const url = new URL(location.href);
      url.searchParams.delete(key);
      url.searchParams.delete('reply');
      url.searchParams.delete('section');
      url.hash = section;
      history.replaceState(history.state, '', url);
      document.getElementById('push-order-status')?.remove();
    } catch {
      stop();
      notify('No pudimos cargar esta ficha. Tu enlace sigue guardado.', retry, section);
    } finally { busy = false; }
  };
  const observer = new MutationObserver(() => { void attempt(); });
  const sourceReady = () => { void attempt(); };
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  const timer = window.setInterval(() => {
    void attempt();
    if (++polls >= MAX_POLLS) {
      window.clearInterval(timer);
      if (!done) notify('La ficha todavía no está lista. Tu enlace sigue guardado.', retry, section);
    }
  }, POLL_INTERVAL_MS);
  window.addEventListener('pagehide', stop, { once: true });
  window.addEventListener('tintin:admin-ficha-source', sourceReady);
  void attempt();
}

function boot() {
  const normalized = normalizeAdminDestination(location.href, location.origin);
  if (normalized && location.hash.includes('?')) history.replaceState(history.state, '', normalized);
  rememberAdminDestination(location.href, adminReturnStorage(window), location.origin);
  const params = new URLSearchParams(location.search);
  const section = params.get('section');
  const key = { usuarios: 'user', 'me-gusta': 'like', resenas: params.has('report') ? 'report' : 'review', mayoristas: 'quote' }[section];
  const id = key && adminTargetId(params.get(key));
  if (id) {
    clearPending();
    openRecordWhenReady(section, key, id);
    return;
  }
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
  const target = normalizeAdminDestination(data.url, location.origin);
  if (target) location.href = target;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
