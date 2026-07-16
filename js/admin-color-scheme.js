/**
 * TINTIN — Motor de esquema de colores del SUPER ADMIN (Super Admin →
 * Apariencia → Esquema de Super Admin), en vivo.
 *
 * Misma mecánica que js/color-scheme.js pero para las variables
 * --admin-color-* y el esquema con scope:'admin' — se carga SOLO en
 * admin.html y admin-images.html. Un esquema del panel nunca toca
 * --color-* (el esquema público), así que jamás se "filtra" hacia afuera.
 */
import { db } from './firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { ADMIN_TOKENS, buildDefaultTokenMap } from './color-scheme-catalog.js';

const CACHE_KEY = 'tt_color_scheme_admin';
const APPEARANCE_DOC = { col: 'settings', id: 'appearance' };
const DEFAULT_SCHEME_ID = 'default-admin';

let unsubScheme = null;
let lastCssVarMap = null;

function keyMapToCssVarMap(tokensByKey) {
  const out = {};
  if (!tokensByKey) return out;
  ADMIN_TOKENS.forEach(t => {
    if (tokensByKey[t.key] != null && tokensByKey[t.key] !== '') out[t.cssVar] = tokensByKey[t.key];
  });
  return out;
}

function applyCssVarMap(map) {
  const root = document.documentElement;
  Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
}

function cacheToLocalStorage() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ tokens: lastCssVarMap || {} }));
  } catch (e) { /* no crítico */ }
}

function applyScheme(schemeData) {
  const defaults = buildDefaultTokenMap(ADMIN_TOKENS);
  const merged = Object.assign({}, defaults, schemeData.tokens || {});
  lastCssVarMap = keyMapToCssVarMap(merged);
  applyCssVarMap(lastCssVarMap);
  cacheToLocalStorage();
}

function subscribeToScheme(schemeId) {
  if (unsubScheme) { unsubScheme(); unsubScheme = null; }
  unsubScheme = onSnapshot(
    doc(db, 'colorSchemes', schemeId || DEFAULT_SCHEME_ID),
    snap => { if (snap.exists()) applyScheme(snap.data()); },
    err => console.warn('[admin-color-scheme] No se pudo cargar el esquema del panel, se mantiene el último aplicado/cacheado:', err)
  );
}

onSnapshot(
  doc(db, APPEARANCE_DOC.col, APPEARANCE_DOC.id),
  snap => {
    const cfg = snap.exists() ? snap.data() : {};
    subscribeToScheme(cfg.activeAdminSchemeId || DEFAULT_SCHEME_ID);
  },
  err => {
    console.warn('[admin-color-scheme] settings/appearance no disponible, se usa el esquema del panel por defecto:', err);
    subscribeToScheme(DEFAULT_SCHEME_ID);
  }
);
