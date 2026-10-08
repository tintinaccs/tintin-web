function timestamp(value) {
  return value?.toMillis?.() ?? value?.toDate?.().getTime() ?? new Date(value || 0).getTime();
}

// El primer snapshot es historial, no una ráfaga de avisos. Las modificaciones
// de lectura tampoco son nueva actividad; un agregado de likes sí puede serlo.
export function createActivityTracker() {
  let scope = '', primed = false;
  const seen = new Map();
  return {
    reset() { scope = ''; primed = false; seen.clear(); },
    update(nextScope, items) {
      if (scope !== nextScope) { scope = nextScope; primed = false; seen.clear(); }
      const fresh = [];
      for (const item of items) {
        // Delivery bookkeeping/read receipts do not represent a second event.
        const signature = JSON.stringify([timestamp(item.createdAt), item.aggregateCount, item.title, item.body, item.actorUid]);
        if (primed && item.read !== true && seen.get(item.id) !== signature) fresh.push(item);
        seen.set(item.id, signature);
      }
      primed = true;
      while (seen.size > 500) seen.delete(seen.keys().next().value);
      return fresh;
    },
  };
}

let sharedNotices = null;
export function createLiveActivityNotices() {
  // Public shell and admin can both subscribe to the owner's feed. They
  // share one presenter and tracker, so one event cannot produce two toasts.
  if (sharedNotices) return sharedNotices;
  const tracker = createActivityTracker();
  const timers = new Map();
  const active = new Map();
  let root = null, scope = '', generation = 0;
  let stylesReady = null;
  function clear() {
    generation += 1;
    timers.forEach(timer => window.clearTimeout(timer));
    timers.clear();
    active.clear();
    root?.replaceChildren();
    tracker.reset();
    scope = '';
  }
  function ensureStyles() {
    if (stylesReady) return stylesReady;
    stylesReady = new Promise(resolve => {
      const existing = document.getElementById('tt-live-activity-css');
      if (existing?.sheet) return resolve(true);
      const link = existing || document.createElement('link');
      link.addEventListener('load', () => resolve(true), { once: true });
      link.addEventListener('error', () => { stylesReady = null; link.remove(); resolve(false); }, { once: true });
      if (existing) return;
      link.id = 'tt-live-activity-css';
      link.rel = 'stylesheet';
      link.href = '/css/components/notifications/avisos-en-vivo.css?v=tintin-20261005-notification-parity-1';
      document.head.appendChild(link);
    });
    return stylesReady;
  }
  function ensureRoot() {
    if (!root?.isConnected) {
      root = document.createElement('div');
      root.className = 'tt-live-activity';
      root.setAttribute('role', 'status');
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('aria-atomic', 'false');
      document.body.appendChild(root);
    }
    return root;
  }
  sharedNotices = {
    clear,
    async update(nextScope, items) {
      if (scope !== nextScope) { clear(); scope = nextScope; }
      const fresh = tracker.update(nextScope, items);
      if (!fresh.length) return;
      const pendingGeneration = generation;
      if (!await ensureStyles() || pendingGeneration !== generation) return;
      // Un máximo de tres avisos; toda la actividad permanece en la campana.
      for (const item of fresh.slice(0, 3).reverse()) {
        const host = ensureRoot();
        const key = String(item.eventId || item.id);
        const previous = active.get(key);
        if (previous) {
          window.clearTimeout(timers.get(previous));
          timers.delete(previous);
          previous.remove();
        }
        const notice = document.createElement('div');
        active.set(key, notice);
        notice.className = 'tt-live-activity-notice';
        const title = document.createElement('strong');
        title.textContent = item.title || 'Nueva actividad';
        notice.appendChild(title);
        if (item.body) {
          const body = document.createElement('p');
          body.textContent = item.body;
          notice.appendChild(body);
        }
        host.appendChild(notice);
        while (host.children.length > 3) {
          const old = host.firstElementChild;
          window.clearTimeout(timers.get(old));
          timers.delete(old);
          for (const [oldKey, node] of active) if (node === old) active.delete(oldKey);
          old.remove();
        }
        timers.set(notice, window.setTimeout(() => {
          notice.remove(); timers.delete(notice);
          if (active.get(key) === notice) active.delete(key);
        }, 3000));
      }
    },
  };
  return sharedNotices;
}
