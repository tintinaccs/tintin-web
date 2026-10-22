/* =============================================================
   TINTIN — Aviso de versión nueva del sitio.
   El HTML se sirve sin caché y los JS/CSS con ?v= inmutables: una pestaña
   que quedó abierta mientras se publicaba sigue ejecutando la versión
   anterior hasta que el usuario navega. Este módulo compara el marcador
   de la página abierta sin caché; conserva el HTML actual como
   fallback para detectar referencias versionadas que la pestaña nunca cargó.
   Actualizar es una recarga normal: no toca localStorage, sessionStorage,
   cookies, IndexedDB ni cachés, así que la sesión, el carrito, el perfil y
   las preferencias se conservan. Nunca recarga por su cuenta.
   ============================================================= */

import { visualSource, clientResourcePath } from './revision-visual.mjs?v=tintin-20261021-visual-scope-1';

// El primer snapshot establece la referencia de esta pestaña. Una aparición
// posterior a un documento inicialmente ausente también es una actualización.
export function createSiteRevisionObserver(onChange) {
  let initialized = false, revision = '';
  return data => {
    const next = typeof data?.revision === 'string' ? data.revision : '';
    if (!initialized) { initialized = true; revision = next; return; }
    if (!next || next === revision) return;
    revision = next;
    onChange();
  };
}

const CHECK_INTERVAL_MS = 60 * 1000;
const MIN_GAP_MS = 15 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const NOTICE_ID = 'tt-version-notice';
const STYLE_ID = 'tt-version-notice-css';
// Avisos que ya ocupan la esquina inferior derecha: conexión inestable de la
// tienda (z-index altísimo), banner de cookies y avisos del panel admin.
const CORNER_NEIGHBOURS = ['#tt-store-gate-network-notice', '#tt-privacy-consent', '#tt-ops-toasts', '#adm-mobile-tabs', '#tt-tabbar', '.tt-wa-float'];

export function pageRevision(data, pathname) {
  const path = String(pathname || '/').replace(/^\/+|\/+$/g, '');
  const file = path ? `${path.replace(/\.html$/i, '')}.html` : 'index.html';
  const revision = data?.pages?.[file];
  return typeof revision === 'string' && /^[a-f0-9]{64}$/.test(revision) ? revision : '';
}

async function fetchSiteVersion() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch('/site-version.json', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
    if (!response.ok || response.redirected || !/application\/json/i.test(response.headers.get('content-type') || '')) return null;
    return await response.json();
  } catch { return null; }
  finally { clearTimeout(timer); }
}

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

function loadedResources() {
  const hrefs = [...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')]
    .filter(el => !el.closest('noscript, template'))
    .map(el => el.src || el.href);
  try {
    for (const entry of performance.getEntriesByType('resource')) {
      if (entry.initiatorType === 'script' || entry.initiatorType === 'css') hrefs.push(entry.name);
    }
  } catch {}
  return hrefs;
}

// Sólo recursos que esta pestaña ejecutó/cargó. El grafo completo del loader
// también contiene entradas de páginas que la persona todavía no abrió.
export async function changedLoadedResources(data, hrefs, baseHref, digest) {
  if (data?.schemaVersion !== 2 || !data.clientResources) return [];
  const changes = await Promise.all([...new Set(hrefs)].map(async href => {
    const path = clientResourcePath(href, baseHref);
    const current = data.clientResources[path];
    if (!current || !/^[a-f0-9]{64}$/.test(current.revision || '')) return '';
    if (new URL(href, baseHref).searchParams.get('v') === current.version) return '';
    const loaded = await digest(new URL(href, baseHref).href);
    return loaded && loaded !== current.revision ? `${path}:${current.revision}` : '';
  }));
  return [...new Set(changes.filter(Boolean))];
}

async function resourceDigest(href) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(href, { cache: 'force-cache', credentials: 'same-origin', signal: controller.signal });
    if (!response.ok || response.redirected || !/(?:javascript|text\/css)/i.test(response.headers.get('content-type') || '')) return '';
    const bytes = new TextEncoder().encode(visualSource(await response.text()));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
  finally { clearTimeout(timer); }
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
    if ((!response.ok && response.status !== 404) || response.redirected) return null;
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
#${NOTICE_ID}{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));z-index:2147483647;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;box-sizing:border-box;max-width:min(360px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;padding:12px 14px;border:1px solid #d9d2d5;border-radius:12px;background:#fff;color:#713C53;box-shadow:0 8px 24px rgba(0,0,0,.14);font:500 14px/1.4 Montserrat,sans-serif}
#${NOTICE_ID}[hidden]{display:none}
#${NOTICE_ID} p{flex:1 1 180px;margin:0}
#${NOTICE_ID} .tt-vn-actions{display:flex;gap:8px;margin-left:auto}
#${NOTICE_ID} button{min-height:44px;padding:0 14px;border-radius:8px;border:1px solid #F8AACA;font:inherit;font-weight:600;line-height:1;cursor:pointer}
#${NOTICE_ID} .tt-vn-update{background:#F8AACA;color:#713C53}
#${NOTICE_ID} .tt-vn-later{background:#fff;color:#713C53}
#${NOTICE_ID} button:focus-visible{outline:3px solid #713C53;outline-offset:2px}
@media (max-width:420px){#${NOTICE_ID}{left:max(16px,env(safe-area-inset-left));max-width:none}}
`;
  document.head.appendChild(style);
}

function showNotice(message = 'Hay una actualización para esta página.') {
  if (document.getElementById(NOTICE_ID)) return;
  ensureStyle();
  const box = document.createElement('div');
  box.id = NOTICE_ID;
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  const text = document.createElement('p');
  text.textContent = message;
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
  window.visualViewport?.addEventListener('resize', place);
  window.visualViewport?.addEventListener('scroll', place);
  place();
  later.addEventListener('click', () => {
    clearInterval(timer);
    window.removeEventListener('resize', place);
    window.visualViewport?.removeEventListener('resize', place);
    window.visualViewport?.removeEventListener('scroll', place);
    box.remove();
  });
}

function placeAboveNeighbours(box) {
  if (!box.isConnected) return;
  box.style.removeProperty('bottom');
  box.hidden = false;
  const viewport = document.documentElement.clientHeight;
  const visual = window.visualViewport;
  const viewportTop = visual?.offsetTop || 0;
  const viewportBottom = visual ? visual.offsetTop + visual.height : viewport;
  const baseBottom = Math.max(parseFloat(getComputedStyle(box).bottom) || 20, viewport - viewportBottom + 16);
  box.style.bottom = `${baseBottom}px`;
  const mine = box.getBoundingClientRect();
  const neighbours = [...document.querySelectorAll(CORNER_NEIGHBOURS.join(','))]
    .filter(other => !other.hidden && getComputedStyle(other).visibility !== 'hidden')
    .map(other => other.getBoundingClientRect())
    .filter(rect => rect.height && rect.left < mine.right && rect.right > mine.left);
  // Al subir puede chocar con otro vecino más arriba: se repite hasta quedar libre.
  let bottom = baseBottom;
  for (let round = 0; round <= neighbours.length; round += 1) {
    const top = bottom ? viewport - bottom - mine.height : mine.top;
    const next = neighbours.reduce(
      (acc, rect) => (rect.top < top + mine.height && rect.bottom > top ? Math.max(acc, Math.ceil(viewport - rect.top + 8)) : acc),
      bottom
    );
    if (next === bottom) break;
    bottom = next;
  }
  // En horizontal o con el teclado abierto puede no caber sobre cookies.
  // Se conserva visible y descartable en la esquina, nunca se pierde el aviso.
  box.style.bottom = `${bottom + mine.height + 8 > viewport - viewportTop ? baseBottom : bottom}px`;
}

function boot() {
  if (window.TintinVersionWatchBooted) return;
  window.TintinVersionWatchBooted = true;

  const initialKnown = collectKnown(new Set());
  let lastCheck = Date.now();
  let running = false;
  const notifiedRefs = new Set();
  let revision = document.querySelector('meta[name="tintin-page-revision"]')?.content || '';
  let initialResources = {};
  const hashes = new Map(), notifiedResources = new Set();
  const digest = href => {
    const path = clientResourcePath(href, location.href), initial = initialResources[path];
    if (initial?.version === new URL(href).searchParams.get('v')) return Promise.resolve(initial.revision);
    if (!hashes.has(href)) hashes.set(href, resourceDigest(href).then(value => {
      if (!value) hashes.delete(href);
      return value;
    }));
    return hashes.get(href);
  };
  // El documento moderno ya trae su referencia: no descarga el inventario
  // global durante la carga. Se consulta al comprobar actualizaciones.
  const initialVersion = revision ? Promise.resolve() : fetchSiteVersion().then(data => {
    revision ||= pageRevision(data, location.pathname);
    initialResources = data?.schemaVersion === 2 ? data.clientResources || {} : {};
  });

  async function check(force = false) {
    if (running) return 'skipped';
    if (!force) {
      if (document.visibilityState !== 'visible' || navigator.onLine === false) return 'skipped';
      if (Date.now() - lastCheck < MIN_GAP_MS) return 'skipped';
    }
    running = true;
    lastCheck = Date.now();
    try {
      await initialVersion;
      const data = await fetchSiteVersion();
      const nextRevision = pageRevision(data, location.pathname);
      const changes = await changedLoadedResources(data, loadedResources(), location.href, digest);
      const freshResources = changes.filter(key => !notifiedResources.has(key));
      changes.forEach(key => notifiedResources.add(key));
      if ((revision && nextRevision && revision !== nextRevision) || freshResources.length) {
        revision = nextRevision || revision;
        showNotice();
        return 'outdated';
      }
      if (nextRevision) {
        revision = nextRevision;
        // Con marcador válido no hace falta descargar la página completa.
        return 'current';
      }
      const html = await fetchCurrentHtml();
      if (!html) return 'inconclusive';
      const freshDocument = new DOMParser().parseFromString(html, 'text/html');
      const freshMarker = freshDocument.querySelector('meta[name="tintin-page-revision"]')?.content;
      if (revision && /^[a-f0-9]{64}$/.test(freshMarker || '')) {
        if (revision === freshMarker) return 'current';
        revision = freshMarker;
        showNotice();
        return 'outdated';
      }
      const fresh = versionedRefs(freshDocument, location.href);
      // Una respuesta sin referencias versionadas (página de error, mantenimiento,
      // respuesta cortada) no prueba nada: no se avisa.
      if (!fresh.length) return 'inconclusive';
      const missing = unknownRefs(fresh, collectKnown(new Set(initialKnown)))
        .filter(ref => !notifiedRefs.has(ref.href));
      if (!missing.length) return 'current';
      missing.forEach(ref => notifiedRefs.add(ref.href));
      showNotice();
      return 'outdated';
    } finally {
      running = false;
    }
  }

  // Los navegadores móviles suspenden temporizadores al dejar la pestaña.
  // Al retomarla comprobamos de inmediato, incluso dentro del intervalo mínimo.
  const resume = () => {
    if (document.visibilityState === 'visible' && navigator.onLine !== false) check(true);
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pageshow', event => { if (event.persisted) resume(); });
  window.addEventListener('online', resume);
  window.addEventListener('focus', () => check());
  setInterval(() => check(), CHECK_INTERVAL_MS);

  window.TintinVersionWatch = Object.freeze({ checkNow: () => check(true) });
}

export function notifySiteContentChange() {
  // Los datos se actualizan mediante sus suscripciones; esta señal permite
  // refrescar vistas administrativas sin interrumpir formularios en edición.
  // El aviso con recarga queda reservado a una nueva versión de JS/CSS.
  window.dispatchEvent(new CustomEvent('tintin:site-content-updated'));
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.top === window) boot();
