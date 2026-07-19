/**
 * TINTIN — Motor de esquema de colores GLOBAL (Super Admin → Apariencia →
 * Esquema global), en vivo.
 *
 * Se suscribe al esquema activo publicado en Firestore y reescribe las
 * variables --color-* sobre <html>. Además confirma explícitamente cuándo
 * terminó la primera resolución del esquema para que el loader no revele una
 * página con un fondo cacheado y lo cambie un instante después.
 */
import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { GLOBAL_TOKENS, DEVICE_BREAKPOINTS, buildDefaultTokenMap } from './color-scheme-catalog.js?v=tintin-20260716-cloudinary-fix-1';

const CACHE_KEY = 'tt_color_scheme_global';
const APPEARANCE_DOC = { col: 'settings', id: 'appearance' };
const DEFAULT_SCHEME_ID = 'default-global';

let unsubScheme = null;
let lastCssVarMap = null;
let lastDeviceOverrideMaps = null;
let lastDeviceOverrideEnabled = false;
let firstResolutionFinished = false;

// Enforcement final: un token solo se aplica al sitio público si su valor es un
// color estricto (HEX / rgb(a) / hsl(a)). Aunque solo el Super Admin puede
// escribir esquemas (firestore.rules) y el editor ya valida la entrada, este es
// el punto donde un valor de Firestore/caché se vuelve CSS en vivo — validarlo
// acá garantiza que NUNCA se aplique una URL peligrosa, un url(...) ni CSS
// arbitrario, sin importar cómo haya llegado el valor. Un valor inválido se
// omite y el token cae a su default de color-tokens.css.
function isSafeColorValue(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || v.length > 64) return false;
  return /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ||
    /^rgba?\(\s*[0-9.\s,%/]+\)$/i.test(v) ||
    /^hsla?\(\s*[0-9.\s,%/deg]+\)$/i.test(v);
}

function keyMapToCssVarMap(tokensByKey) {
  const out = {};
  if (!tokensByKey) return out;
  GLOBAL_TOKENS.forEach(token => {
    const value = tokensByKey[token.key];
    if (value != null && value !== '' && isSafeColorValue(value)) {
      out[token.cssVar] = value;
    }
  });
  return out;
}

function currentBreakpointKey() {
  const width = window.innerWidth;
  const found = DEVICE_BREAKPOINTS.find(bp => (
    width >= bp.min && (bp.max == null || width <= bp.max)
  ));
  return found ? found.key : 'desktop';
}

function applyCssVarMap(map) {
  const root = document.documentElement;
  Object.entries(map).forEach(([key, value]) => root.style.setProperty(key, value));
}

function applyForCurrentBreakpoint() {
  if (!lastCssVarMap) return;
  applyCssVarMap(lastCssVarMap);
  if (lastDeviceOverrideEnabled && lastDeviceOverrideMaps) {
    const override = lastDeviceOverrideMaps[currentBreakpointKey()];
    if (override) applyCssVarMap(override);
  }
}

function cacheToLocalStorage() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      tokens: lastCssVarMap || {},
      deviceOverrideEnabled: !!lastDeviceOverrideEnabled,
      deviceOverrides: lastDeviceOverrideMaps || null,
    }));
  } catch (error) {
    /* Almacenamiento bloqueado: no rompe la página. */
  }
}

function markColorSchemeReady(source) {
  if (firstResolutionFinished) return;
  firstResolutionFinished = true;

  const bridge = window.TintinColorSchemeFirstPaint;
  if (bridge && typeof bridge.release === 'function') {
    bridge.release(source || 'firestore');
    return;
  }

  const root = document.documentElement;
  root.classList.remove('tt-color-scheme-pending');
  root.classList.add('tt-color-scheme-ready');
}

function applyScheme(schemeData = {}) {
  const defaults = buildDefaultTokenMap(GLOBAL_TOKENS);
  const merged = Object.assign({}, defaults, schemeData.tokens || {});
  lastCssVarMap = keyMapToCssVarMap(merged);
  lastDeviceOverrideEnabled = !!schemeData.deviceOverrideEnabled;
  lastDeviceOverrideMaps = null;

  if (lastDeviceOverrideEnabled && schemeData.deviceOverrides) {
    lastDeviceOverrideMaps = {};
    DEVICE_BREAKPOINTS.forEach(bp => {
      const override = schemeData.deviceOverrides[bp.key];
      if (override) lastDeviceOverrideMaps[bp.key] = keyMapToCssVarMap(override);
    });
  }

  applyForCurrentBreakpoint();
  cacheToLocalStorage();
  markColorSchemeReady('firestore');
}

function subscribeToScheme(schemeId) {
  if (unsubScheme) {
    unsubScheme();
    unsubScheme = null;
  }

  unsubScheme = onSnapshot(
    doc(db, 'colorSchemes', schemeId || DEFAULT_SCHEME_ID),
    snapshot => {
      if (snapshot.exists()) applyScheme(snapshot.data());
      else applyScheme({});
    },
    error => {
      console.warn('[color-scheme] No se pudo cargar el esquema activo; se mantiene el último aplicado/cacheado:', error);
      markColorSchemeReady('scheme-read-error');
    }
  );
}

onSnapshot(
  doc(db, APPEARANCE_DOC.col, APPEARANCE_DOC.id),
  snapshot => {
    const config = snapshot.exists() ? snapshot.data() : {};
    subscribeToScheme(config.activeGlobalSchemeId || DEFAULT_SCHEME_ID);
  },
  error => {
    console.warn('[color-scheme] settings/appearance no disponible; se usa el esquema por defecto:', error);
    subscribeToScheme(DEFAULT_SCHEME_ID);
  }
);

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applyForCurrentBreakpoint, 150);
});
