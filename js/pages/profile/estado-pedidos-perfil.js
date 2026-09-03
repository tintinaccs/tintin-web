/* TINTIN — Estado visual de pedidos nuevos dentro de Mi Perfil.
 * No consulta ni escribe Firestore: observa el contador canónico que ya carga
 * perfil.html y guarda únicamente el último total visto por esta sesión local. */

const STORAGE_PREFIX = 'tt_profile_orders_seen_v1_';

async function currentUserKey() {
  try {
    const { auth } = await import('../../core/firebase/firebase.js?v=tintin-20260903-app-check-singleton-2');
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    return auth.currentUser?.uid ? `${STORAGE_PREFIX}${auth.currentUser.uid}` : `${STORAGE_PREFIX}guest`;
  } catch {
    return `${STORAGE_PREFIX}guest`;
  }
}

function numericCount() {
  return Math.max(0, Number(document.getElementById('perfil-purchase-count')?.textContent?.replace(/\D/g, '') || 0));
}

async function boot() {
  if (!document.getElementById('perfil-purchase-count')) return;
  const key = await currentUserKey();
  const badge = () => document.querySelector('[data-profile-orders-badge]');

  function seenCount() {
    try { return Math.max(0, Number(localStorage.getItem(key) || 0)); } catch { return 0; }
  }

  function render() {
    const node = badge();
    if (!node) return;
    const unread = Math.max(0, numericCount() - seenCount());
    node.hidden = unread === 0;
    node.textContent = unread > 99 ? '99+' : String(unread);
    node.setAttribute('aria-label', unread === 1 ? '1 pedido nuevo' : `${unread} pedidos nuevos`);
  }

  function markSeen() {
    try { localStorage.setItem(key, String(numericCount())); } catch {}
    render();
  }

  const countNode = document.getElementById('perfil-purchase-count');
  const observer = new MutationObserver(render);
  observer.observe(countNode, { childList: true, subtree: true, characterData: true });

  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-profile-tab="pedidos"]')) {
      window.setTimeout(markSeen, 0);
    }
  });

  const badgeObserver = new MutationObserver(() => {
    if (badge()) {
      render();
      badgeObserver.disconnect();
    }
  });
  badgeObserver.observe(document.body, { childList: true, subtree: true });
  render();

  window.addEventListener('pagehide', () => {
    observer.disconnect();
    badgeObserver.disconnect();
  }, { once: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void boot(); }, { once: true });
else void boot();
