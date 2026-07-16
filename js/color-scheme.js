/**
 * TINTIN — Motor de esquema de colores GLOBAL (Super Admin → Apariencia →
 * Esquema global), en vivo.
 *
 * Se suscribe al esquema activo publicado en Firestore y reescribe las
 * variables --color-* sobre <html> (inline, gana por especificidad a
 * cualquier regla de hoja de estilos sin necesitar !important en cada
 * consumidor) — como todo el CSS del sitio ya lee var(--color-*) a través
 * de los alias --tt-*, un solo cambio acá se propaga a toda página,
 * componente y estado sin tocar código.
 *
 * Solo consume campos PUBLICADOS (tokens/deviceOverrides/deviceOverrideEnabled)
 * — nunca el borrador (draftTokens/...), así lo que un Super Admin está
 * editando no se filtra al sitio público hasta que aprieta "Publicar".
 *
 * Complementa (no reemplaza) js/color-scheme-instant.js: ese script pinta
 * con el último valor cacheado antes de que cargue nada más; este motor
 * trae el valor real desde Firestore, lo aplica, y re-cachea para la
 * próxima visita.
 */
import { db } from './firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { GLOBAL_TOKENS, DEVICE_BREAKPOINTS, buildDefaultTokenMap } from './color-scheme-catalog.js';

const CACHE_KEY = 'tt_color_scheme_global';
const APPEARANCE_DOC = { col: 'settings', id: 'appearance' };
const DEFAULT_SCHEME_ID = 'default-global';

let unsubScheme = null;
let lastCssVarMap = null;
let lastDeviceOverrideMaps = null;
let lastDeviceOverrideEnabled = false;

function keyMapToCssVarMap(tokensByKey) {
  const out = {};
  if (!tokensByKey) return out;
  GLOBAL_TOKENS.forEach(t => {
    if (tokensByKey[t.key] != null && tokensByKey[t.key] !== '') out[t.cssVar] = tokensByKey[t.key];
  });
  return out;
}

function currentBreakpointKey() {
  const w = window.innerWidth;
  const found = DEVICE_BREAKPOINTS.find(b => w >= b.min && (b.max == null || w <= b.max));
  return found ? found.key : 'desktop';
}

function applyCssVarMap(map) {
  const root = document.documentElement;
  Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
}

function applyForCurrentBreakpoint() {
  if (!lastCssVarMap) return;
  applyCssVarMap(lastCssVarMap);
  if (lastDeviceOverrideEnabled && lastDeviceOverrideMaps) {
    const over = lastDeviceOverrideMaps[currentBreakpointKey()];
    if (over) applyCssVarMap(over);
  }
}

function cacheToLocalStorage() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      tokens: lastCssVarMap || {},
      deviceOverrideEnabled: !!lastDeviceOverrideEnabled,
      deviceOverrides: lastDeviceOverrideMaps || null,
    }));
  } catch (e) { /* almacenamiento lleno o bloqueado: no crítico, solo se pierde el "sin parpadeo" en la próxima carga */ }
}

function applyScheme(schemeData) {
  const defaults = buildDefaultTokenMap(GLOBAL_TOKENS);
  const merged = Object.assign({}, defaults, schemeData.tokens || {});
  lastCssVarMap = keyMapToCssVarMap(merged);
  lastDeviceOverrideEnabled = !!schemeData.deviceOverrideEnabled;
  lastDeviceOverrideMaps = null;
  if (lastDeviceOverrideEnabled && schemeData.deviceOverrides) {
    lastDeviceOverrideMaps = {};
    DEVICE_BREAKPOINTS.forEach(bp => {
      const over = schemeData.deviceOverrides[bp.key];
      if (over) lastDeviceOverrideMaps[bp.key] = keyMapToCssVarMap(over);
    });
  }
  applyForCurrentBreakpoint();
  cacheToLocalStorage();
}

function subscribeToScheme(schemeId) {
  if (unsubScheme) { unsubScheme(); unsubScheme = null; }
  unsubScheme = onSnapshot(
    doc(db, 'colorSchemes', schemeId || DEFAULT_SCHEME_ID),
    snap => { if (snap.exists()) applyScheme(snap.data()); },
    err => console.warn('[color-scheme] No se pudo cargar el esquema activo, se mantiene el último aplicado/cacheado:', err)
  );
}

onSnapshot(
  doc(db, APPEARANCE_DOC.col, APPEARANCE_DOC.id),
  snap => {
    const cfg = snap.exists() ? snap.data() : {};
    subscribeToScheme(cfg.activeGlobalSchemeId || DEFAULT_SCHEME_ID);
  },
  err => {
    console.warn('[color-scheme] settings/appearance no disponible, se usa el esquema por defecto:', err);
    subscribeToScheme(DEFAULT_SCHEME_ID);
  }
);

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applyForCurrentBreakpoint, 150);
});
