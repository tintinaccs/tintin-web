/* =============================================================
   TINTIN — Aviso de versión nueva del sitio.
   El HTML se sirve sin caché y los JS/CSS con ?v= inmutables: una pestaña
   que quedó abierta mientras se publicaba sigue ejecutando la versión
   anterior hasta que el usuario navega. Este módulo pide el HTML actual de
   la misma página (sin caché) y, si referencia archivos versionados que esta
   pestaña nunca cargó, ofrece "Actualizar".
   Actualizar es una recarga normal: no toca localStorage, sessionStorage,
   cookies, IndexedDB ni cachés, así que la sesión, el carrito, el perfil y
   las preferencias se conservan. Nunca recarga por su cuenta.
   ============================================================= */

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const NOTICE_ID = 'tt-version-notice';
const STYLE_ID = 'tt-version-notice-css';
// Avisos que ya ocupan la esquina inferior derecha: conexión inestable de la
// tienda (z-index altísimo), banner de cookies y avisos del panel admin.
const CORNER_NEIGHBOURS = ['tt-store-gate-network-notice', 'tt-privacy-consent', 'tt-ops-toasts'];

// Referencias same-origin con ?v= declaradas en el HTML (script[src] y
// link[href]); lo que está dentro de <noscript> o <template> no se ejecuta.
export function versionedRefs(doc, baseHref) {
  const base = new URL(baseHref);
  const out = [];
  for (const el of doc.querySelectorAll('script[src], link[href]')) {
    if (el.closest('noscript, template')) continue;
    const raw = el.getAttribute(el.tagName === 'SCRIPT' ? 'src' : 'href') || '';
    let url;
    try { url = new URL(raw, base); } catch { continue; }
    if (url.origin !== base.origin || !url.searchParams.get('v')) continue;
    out.push({ raw, href: url.href });
  }
  return out;
}

export function unknownRefs(fresh, known) {
  return fresh.filter(ref => !known.has(ref.raw) && !known.has(ref.href));
}

function collectKnown(into) {
  for (const ref of versionedRefs(document, location.href)) {
    into.add(ref.raw);
    into.add(ref.href);
  }
  try {
    for (const entry of performance.getEntriesByType('resource')) into.add(entry.name);
  } catch {}
  return into;
}

async function fetchCurrentHtml() {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : 0;
  try {
    const url = new URL(location.href);
    url.hash = '';
    const response = await fetch(url.href, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
      signal: controller?.signal,
    });
    if (!response.ok || response.redirected) return null;
    if (!/text\/html/i.test(response.headers.get('content-type') || '')) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${NOTICE_ID}{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));z-index:10020;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;box-sizing:border-box;max-width:min(360px,calc(100vw - 32px));padding:12px 14px;border:1px solid #d9d2d5;border-radius:12px;background:#fff;color:#2b2b2b;box-shadow:0 8px 24px rgba(0,0,0,.14);font:500 14px/1.4 Montserrat,sans-serif}
#${NOTICE_ID}[hidden]{display:none}
#${NOTICE_ID} p{flex:1 1 180px;margin:0}
#${NOTICE_ID} .tt-vn-actions{display:flex;gap:8px;margin-left:auto}
#${NOTICE_ID} button{min-height:40px;padding:0 14px;border-radius:8px;border:1px solid #ad3f67;font:inherit;font-weight:600;line-height:1;cursor:pointer}
#${NOTICE_ID} .tt-vn-update{background:#ad3f67;color:#fff}
#${NOTICE_ID} .tt-vn-later{background:#fff;color:#ad3f67}
#${NOTICE_ID} button:focus-visible{outline:3px solid #2b2b2b;outline-offset:2px}
@media (max-width:767px){body:has(#tt-tabbar) #${NOTICE_ID}{bottom:calc(max(12px,env(safe-area-inset-bottom)) + 84px)}}
@media (max-width:420px){#${NOTICE_ID}{left:max(16px,env(safe-area-inset-left));max-width:none}}
`;
  document.head.appendChild(style);
}

function showNotice() {
  if (document.getElementById(NOTICE_ID)) return;
  ensureStyle();
  const box = document.createElement('div');
  box.id = NOTICE_ID;
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  const text = document.createElement('p');
  text.textContent = 'Hay una versión nueva del sitio.';
  const actions = document.createElement('div');
  actions.className = 'tt-vn-actions';
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'tt-vn-later';
  later.textContent = 'Más tarde';
  const update = document.createElement('button');
  update.type = 'button';
  update.className = 'tt-vn-update';
  update.textContent = 'Actualizar';
  update.addEventListener('click', () => location.reload());
  actions.append(later, update);
  box.append(text, actions);
  document.body.appendChild(box);

  // Se apila encima de los avisos vecinos en vez de taparlos o quedar tapado.
  // Esos avisos aparecen, cambian de alto o se ocultan por clases y animaciones
  // que ningún evento anuncia, así que la posición se recalcula cada medio
  // segundo mientras el aviso está visible (unas pocas lecturas de tamaño).
  const place = () => placeAboveNeighbours(box);
  const timer = setInterval(place, 500);
  window.addEventListener('resize', place);
  place();
  later.addEventListener('click', () => {
    clearInterval(timer);
    window.removeEventListener('resize', place);
    box.remove();
  });
}

function placeAboveNeighbours(box) {
  if (!box.isConnected) return;
  box.style.removeProperty('bottom');
  box.hidden = false;
  const mine = box.getBoundingClientRect();
  const viewport = document.documentElement.clientHeight;
  const neighbours = CORNER_NEIGHBOURS
    .map(id => document.getElementById(id))
    .filter(other => other && !other.hidden)
    .map(other => other.getBoundingClientRect())
    .filter(rect => rect.height && rect.left < mine.right && rect.right > mine.left);
  // Al subir puede chocar con otro vecino más arriba: se repite hasta quedar libre.
  let bottom = 0;
  for (let round = 0; round <= neighbours.length; round += 1) {
    const top = bottom ? viewport - bottom - mine.height : mine.top;
    const next = neighbours.reduce(
      (acc, rect) => (rect.top < top + mine.height && rect.bottom > top ? Math.max(acc, Math.ceil(viewport - rect.top + 8)) : acc),
      bottom
    );
    if (next === bottom) break;
    bottom = next;
  }
  if (!bottom) return;
  // Sin lugar arriba (por ejemplo, el banner de cookies ocupa casi toda la
  // pantalla del móvil): se espera a que ese aviso se cierre.
  if (bottom + mine.height + 8 > viewport) box.hidden = true;
  else box.style.bottom = `${bottom}px`;
}

function boot() {
  if (window.TintinVersionWatchBooted) return;
  window.TintinVersionWatchBooted = true;

  const initialKnown = collectKnown(new Set());
  let lastCheck = Date.now();
  let running = false;
  let stopped = false;

  async function check(force = false) {
    if (stopped || running) return 'skipped';
    if (!force) {
      if (document.visibilityState !== 'visible' || navigator.onLine === false) return 'skipped';
      if (Date.now() - lastCheck < MIN_GAP_MS) return 'skipped';
    }
    running = true;
    lastCheck = Date.now();
    try {
      const html = await fetchCurrentHtml();
      if (!html) return 'inconclusive';
      const fresh = versionedRefs(new DOMParser().parseFromString(html, 'text/html'), location.href);
      // Una respuesta sin referencias versionadas (página de error, mantenimiento,
      // respuesta cortada) no prueba nada: no se avisa.
      if (!fresh.length) return 'inconclusive';
      const missing = unknownRefs(fresh, collectKnown(new Set(initialKnown)));
      if (!missing.length) return 'current';
      stopped = true;
      showNotice();
      return 'outdated';
    } finally {
      running = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('online', () => check());
  setInterval(() => check(), CHECK_INTERVAL_MS);

  window.TintinVersionWatch = Object.freeze({ checkNow: () => check(true) });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') boot();
