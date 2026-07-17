/* ============================================================
   TINTIN ACCESORIOS — Image Management Module (Fase 5)

   Única fuente para imágenes globales/editoriales: settings/images.
   Productos usan products/{id}.imageUrl y colecciones usan
   collections/{slug}.image; esos dos sistemas ya no se duplican acá.
   ============================================================ */

import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { sanitizeImageUrl } from './image-utils.js?v=tintin-20260716-cloudinary-fix-1';
import { resolveDeviceImage } from './image-resolver.js?v=tintin-20260716-cloudinary-fix-1';

// Se mantienen estas inicializaciones porque históricamente dependían de la
// primera importación de images.js. Ambas son idempotentes.
import './home-premium.js';
import './welcome-tutorial-runtime.js';

const CACHE_KEY = 'tt_images';
const FIRESTORE_DOC = 'settings/images';

export const HERO_FIT_VALUES = Object.freeze([
  'cover', 'contain', 'auto'
]);
export const HERO_ZOOM_VALUES = Object.freeze([
  '40%', '50%', '60%', '80%', '100%',
  '110%', '125%', '140%', '160%', '180%', '200%'
]);
// Alias conservado para cualquier módulo antiguo que todavía importe este nombre.
export const HERO_SIZE_VALUES = HERO_FIT_VALUES;
export const HERO_POSITION_VALUES = Object.freeze([
  'center center', 'center top', 'center bottom',
  'left center', 'right center', 'left top', 'right top',
  'left bottom', 'right bottom'
]);

// Solo aparecen slots que tienen un destino visual real. Las fotos de producto
// se editan en Productos y las portadas de colección en Colecciones.
export const IMAGE_SLOTS = Object.freeze([
  { id: 'hero_bg_desktop', label: 'Hero — Desktop (≥1024px)', section: 'hero', emoji: null, desc: 'Fondo del banner en pantallas grandes (PC / laptop)' },
  { id: 'hero_bg_tablet',  label: 'Hero — Tablet (768–1023px)', section: 'hero', emoji: null, desc: 'Fondo del banner en tablets' },
  { id: 'hero_bg_mobile',  label: 'Hero — Mobile (≤767px)', section: 'hero', emoji: null, desc: 'Fondo del banner en celulares' },
  { id: 'edit_bolsos',     label: 'Editorial — Bolsos/Bags', section: 'editorial', emoji: '👜', desc: 'Imagen de la sección editorial Bags en la portada' },
  { id: 'edit_relojes',    label: 'Editorial — Relojes', section: 'editorial', emoji: '⌚', desc: 'Imagen de la sección editorial Relojes en la portada' },
  { id: 'about_foto',      label: 'Nosotros — Foto principal', section: 'nosotros', emoji: '🌸', desc: 'Foto principal de la página Nosotros' },
  { id: 'logo_main',       label: 'Logo principal', section: 'branding', emoji: null, desc: 'Logo utilizado en encabezados, pie y pantalla de carga' },
]);

export const IMAGE_SLOT_IDS = Object.freeze(IMAGE_SLOTS.map(slot => slot.id));
const IMAGE_SLOT_SET = new Set(IMAGE_SLOT_IDS);
const HERO_SLOT_SET = new Set(IMAGE_SLOT_IDS.filter(id => id.startsWith('hero_bg_')));

// Slots que además de su valor "desktop" (el id de siempre) admiten
// variantes por dispositivo con reutilización automática — todo lo que no
// sea el trío hero (que ya son 3 slots independientes desktop/tablet/mobile).
// Cada uno gana ${id}_tablet, ${id}_mobile y ${id}_autoReuseDesktop.
export const DEVICE_VARIANT_SLOT_IDS = Object.freeze(
  IMAGE_SLOT_IDS.filter(id => !id.startsWith('hero_bg_'))
);
const DEVICE_VARIANT_SLOT_SET = new Set(DEVICE_VARIANT_SLOT_IDS);
const HERO_GROUP_AUTOREUSE_KEY = 'hero_bg_autoReuseDesktop';

function normalizeHeroFit(value) {
  const raw = String(value || '').trim();
  if (HERO_FIT_VALUES.includes(raw)) return raw;
  // Compatibilidad con el panel antiguo, que mezclaba zoom y ajuste.
  if (/^(?:40|50|60|80|100|110|125|140|160|180|200)%$/.test(raw)) return 'contain';
  return 'cover';
}

function normalizeHeroZoom(value, legacySize = '') {
  const raw = String(value || '').trim();
  if (HERO_ZOOM_VALUES.includes(raw)) return raw;
  const legacy = String(legacySize || '').trim();
  if (HERO_ZOOM_VALUES.includes(legacy)) return legacy;
  return '100%';
}

function zoomToScale(zoom) {
  const numeric = Number(String(zoom || '100%').replace('%', ''));
  if (!Number.isFinite(numeric)) return '1';
  return String(Math.min(200, Math.max(40, numeric)) / 100);
}

export function resolveHeroDisplaySettings(images, device = 'desktop') {
  const safeDevice = ['desktop', 'tablet', 'mobile'].includes(device) ? device : 'desktop';
  const data = images && typeof images === 'object' ? images : {};
  const prefix = `hero_bg_${safeDevice}`;
  const rawSize = data[`${prefix}_size`];
  const mode = normalizeHeroFit(rawSize);
  const zoom = normalizeHeroZoom(data[`${prefix}_zoom`], rawSize);
  const position = HERO_POSITION_VALUES.includes(data[`${prefix}_pos`])
    ? data[`${prefix}_pos`]
    : 'center center';

  return {
    mode,
    fit: mode === 'auto' ? 'none' : mode,
    zoom,
    scale: zoomToScale(zoom),
    position,
  };
}

function isHeroMetaKey(key) {
  return /^(hero_bg_(?:desktop|tablet|mobile))_(?:size|zoom|pos)$/.test(key);
}

function deviceVariantKeyInfo(key) {
  const match = /^(.+)_(tablet|mobile|autoReuseDesktop)$/.exec(key);
  if (!match || !DEVICE_VARIANT_SLOT_SET.has(match[1])) return null;
  return { baseId: match[1], suffix: match[2] };
}

function allowedSettingKey(key) {
  if (IMAGE_SLOT_SET.has(key)) return true;
  if (isHeroMetaKey(key)) return true;
  if (key === HERO_GROUP_AUTOREUSE_KEY) return true;
  return Boolean(deviceVariantKeyInfo(key));
}

function normalizeMetaValue(key, value) {
  if (key.endsWith('_size')) {
    return normalizeHeroFit(value);
  }
  if (key.endsWith('_zoom')) {
    return normalizeHeroZoom(value);
  }
  if (key.endsWith('_pos')) {
    return HERO_POSITION_VALUES.includes(value) ? value : 'center center';
  }
  return '';
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === 'false') return false;
  if (value === 'true') return true;
  return fallback;
}

export function normalizeImagesData(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const normalized = {};

  IMAGE_SLOT_IDS.forEach(id => {
    const safe = sanitizeImageUrl(source[id]);
    if (safe) normalized[id] = safe;
  });

  HERO_SLOT_SET.forEach(id => {
    const sizeKey = `${id}_size`;
    const zoomKey = `${id}_zoom`;
    const posKey = `${id}_pos`;
    const rawSize = source[sizeKey];
    normalized[sizeKey] = normalizeHeroFit(rawSize);
    normalized[zoomKey] = normalizeHeroZoom(source[zoomKey], rawSize);
    normalized[posKey] = normalizeMetaValue(posKey, source[posKey]);
  });
  normalized[HERO_GROUP_AUTOREUSE_KEY] = normalizeBoolean(source[HERO_GROUP_AUTOREUSE_KEY]);

  DEVICE_VARIANT_SLOT_IDS.forEach(id => {
    const tabletKey = `${id}_tablet`;
    const mobileKey = `${id}_mobile`;
    const autoKey = `${id}_autoReuseDesktop`;
    const tablet = sanitizeImageUrl(source[tabletKey]);
    const mobile = sanitizeImageUrl(source[mobileKey]);
    if (tablet) normalized[tabletKey] = tablet;
    if (mobile) normalized[mobileKey] = mobile;
    normalized[autoKey] = normalizeBoolean(source[autoKey]);
  });

  return normalized;
}

export function normalizeImagePatch(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Los datos de imagen no son válidos.');
  }

  const patch = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!allowedSettingKey(key)) return;

    if (key === HERO_GROUP_AUTOREUSE_KEY || deviceVariantKeyInfo(key)?.suffix === 'autoReuseDesktop') {
      patch[key] = normalizeBoolean(value);
      return;
    }

    if (value == null || value === '') {
      patch[key] = null;
      return;
    }

    if (IMAGE_SLOT_SET.has(key) || deviceVariantKeyInfo(key)) {
      const safe = sanitizeImageUrl(value);
      if (!safe) throw new Error(`La URL de “${key}” no es válida o no es segura.`);
      patch[key] = safe;
      return;
    }

    patch[key] = normalizeMetaValue(key, String(value));
  });

  return patch;
}

/**
 * Resuelve la imagen efectiva de un slot para un dispositivo dado, aplicando
 * la cascada de reutilización automática (image-resolver.js). Para el trío
 * hero usa hero_bg_desktop/tablet/mobile + hero_bg_autoReuseDesktop; para el
 * resto usa ${id} (desktop) + ${id}_tablet + ${id}_mobile + ${id}_autoReuseDesktop.
 */
export function resolveSlotImage(images, slotId, device = 'desktop') {
  const data = images || {};
  if (slotId === 'hero_bg') {
    return resolveDeviceImage({
      desktop: data.hero_bg_desktop,
      tablet: data.hero_bg_tablet,
      mobile: data.hero_bg_mobile,
      autoReuseDesktop: data[HERO_GROUP_AUTOREUSE_KEY] !== false,
    }, device);
  }
  return resolveDeviceImage({
    desktop: data[slotId],
    tablet: data[`${slotId}_tablet`],
    mobile: data[`${slotId}_mobile`],
    autoReuseDesktop: data[`${slotId}_autoReuseDesktop`] !== false,
  }, device);
}

let _cache = null;
let _listenerStarted = false;
const _subscribers = new Set();
const _errorSubscribers = new Set();
let _heroApplyToken = 0;

function fromLocalStorage() {
  try {
    return normalizeImagesData(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'));
  } catch {
    return {};
  }
}

function toLocalStorage(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(normalizeImagesData(data)));
  } catch {}
}

function applyHeroDisplayVariables(data) {
  if (typeof document === 'undefined') return;
  const image = document.getElementById('tt-hero-img');
  if (!(image instanceof HTMLImageElement)) return;

  ['desktop', 'tablet', 'mobile'].forEach(device => {
    const display = resolveHeroDisplaySettings(data, device);
    image.style.setProperty(`--tt-hero-fit-${device}`, display.fit);
    image.style.setProperty(`--tt-hero-scale-${device}`, display.scale);
    image.style.setProperty(`--tt-hero-pos-${device}`, display.position);
  });
}

function scheduleHeroDisplayVariables(data = _cache || fromLocalStorage()) {
  if (typeof window === 'undefined') return;
  const token = ++_heroApplyToken;
  const run = () => {
    if (token !== _heroApplyToken) return;
    applyHeroDisplayVariables(_cache || data);
  };

  // Doble frame: images-phase5 aplica primero URLs y estilos base; este puente
  // aplica después el ajuste/zoom/posición final, sin que otro CSS lo anule.
  requestAnimationFrame(() => requestAnimationFrame(run));
}

function publish(data) {
  const snapshot = normalizeImagesData(data);
  _cache = snapshot;
  toLocalStorage(snapshot);
  _subscribers.forEach(fn => {
    try { fn({ ...snapshot }); }
    catch (error) { console.warn('[images] subscriber error:', error); }
  });
  scheduleHeroDisplayVariables(snapshot);
  return snapshot;
}

function publishError(error) {
  _errorSubscribers.forEach(fn => {
    try { fn(error); }
    catch (callbackError) { console.warn('[images] error subscriber failed:', callbackError); }
  });
}

export async function loadImages(options = {}) {
  const { force = false } = options;

  if (!_cache) {
    _cache = fromLocalStorage();
  }
  if (!force && _cache && Object.keys(_cache).length && _listenerStarted) {
    scheduleHeroDisplayVariables(_cache);
    return { ..._cache };
  }

  try {
    const snap = await getDoc(doc(db, FIRESTORE_DOC));
    return publish(snap.exists() ? snap.data() : {});
  } catch (error) {
    console.warn('[images] Firestore load failed:', error);
    publishError(error);
    scheduleHeroDisplayVariables(_cache || {});
    return { ...(_cache || {}) };
  }
}

export async function saveImages(data) {
  const patch = normalizeImagePatch(data);
  if (!Object.keys(patch).length) return { ...(_cache || {}) };

  await setDoc(
    doc(db, FIRESTORE_DOC),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true }
  );

  const next = { ...(_cache || fromLocalStorage()) };
  Object.entries(patch).forEach(([key, value]) => {
    if (value == null || value === '') delete next[key];
    else next[key] = value;
  });
  return publish(next);
}

export function getImg(id) {
  if (!_cache) _cache = fromLocalStorage();
  return _cache[id] || null;
}

export function getAllImages() {
  if (!_cache) _cache = fromLocalStorage();
  return { ..._cache };
}

export function setImgCache(id, value) {
  if (!allowedSettingKey(id)) return;
  if (!_cache) _cache = fromLocalStorage();

  if (value == null || value === '') {
    delete _cache[id];
  } else if (IMAGE_SLOT_SET.has(id)) {
    const safe = sanitizeImageUrl(value);
    if (!safe) return;
    _cache[id] = safe;
  } else if (deviceVariantKeyInfo(id)) {
    const info = deviceVariantKeyInfo(id);
    if (info?.suffix === 'autoReuseDesktop') {
      _cache[id] = normalizeBoolean(value);
    } else {
      const safe = sanitizeImageUrl(value);
      if (!safe) return;
      _cache[id] = safe;
    }
  } else if (id === HERO_GROUP_AUTOREUSE_KEY) {
    _cache[id] = normalizeBoolean(value);
  } else {
    _cache[id] = normalizeMetaValue(id, String(value));
  }
  toLocalStorage(_cache);
  scheduleHeroDisplayVariables(_cache);
}

export function onImagesUpdate(callback, onError) {
  if (typeof callback === 'function') {
    _subscribers.add(callback);
    if (!_cache) _cache = fromLocalStorage();
    callback({ ..._cache });
    scheduleHeroDisplayVariables(_cache);
  }
  if (typeof onError === 'function') _errorSubscribers.add(onError);

  if (!_listenerStarted) {
    _listenerStarted = true;
    onSnapshot(
      doc(db, FIRESTORE_DOC),
      snap => publish(snap.exists() ? snap.data() : {}),
      error => {
        console.warn('[images] realtime listener failed:', error);
        publishError(error);
      }
    );
  }

  return () => {
    if (typeof callback === 'function') _subscribers.delete(callback);
    if (typeof onError === 'function') _errorSubscribers.delete(onError);
  };
}

function setAdminToast(message, isError = false) {
  const toast = document.getElementById('adm-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.background = isError ? '#c0392b' : '#1a1a1a';
  toast.classList.add('show');
  window.clearTimeout(toast._ttHideTimer);
  toast._ttHideTimer = window.setTimeout(() => toast.classList.remove('show'), isError ? 5500 : 2800);
}

function applyAdminHeroPreview(card) {
  const slotId = card?.dataset?.slotId;
  if (!slotId) return;

  const mode = document.getElementById(`size-${slotId}`)?.value || 'cover';
  const zoom = document.getElementById(`zoom-${slotId}`)?.value || '100%';
  const position = document.getElementById(`pos-${slotId}`)?.value || 'center center';
  const preview = card.querySelector('.adm-preview');
  const image = preview?.querySelector('img');

  if (preview) {
    preview.style.background = '#FFF6FA';
    preview.style.backgroundImage = 'none';
  }
  if (!(image instanceof HTMLImageElement)) return;

  image.style.objectFit = mode === 'auto' ? 'none' : mode;
  image.style.objectPosition = position;
  image.style.transform = `scale(${zoomToScale(zoom)})`;
  image.style.transformOrigin = position;
  image.style.maxWidth = 'none';
  image.style.maxHeight = 'none';
}

function installAdminHeroControls() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!/(?:^|\/)admin-images\.html$/.test(window.location.pathname)) return;
  if (window.TintinAdminHeroControlsV2Booted) return;
  window.TintinAdminHeroControlsV2Booted = true;

  const addStyles = () => {
    if (document.getElementById('tt-admin-hero-controls-v2-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-admin-hero-controls-v2-style';
    style.textContent = `
      .adm-hero-help{
        margin:2px 0 4px;
        padding:10px 12px;
        border-radius:8px;
        background:#fff6fa;
        color:#6f5b63;
        font-size:.72rem;
        line-height:1.45;
      }
      .adm-hero-help strong{color:#9f2d57}
      .adm-hero-controls-v2 .adm-hero-ctrl-row{align-items:center}
    `;
    document.head.appendChild(style);
  };

  const enhance = () => {
    document.querySelectorAll('.adm-img-card[data-slot-id^="hero_bg_"]').forEach(card => {
      const slotId = card.dataset.slotId;
      const controls = card.querySelector('.adm-hero-controls');
      if (!controls) return;

      if (controls.dataset.ttHeroControlsV2 === '1') {
        applyAdminHeroPreview(card);
        return;
      }

      const sizeSelect = document.getElementById(`size-${slotId}`);
      const posSelect = document.getElementById(`pos-${slotId}`);
      const oldButton = controls.querySelector(`[data-hero-save="${slotId}"]`);
      if (!(sizeSelect instanceof HTMLSelectElement) ||
          !(posSelect instanceof HTMLSelectElement) ||
          !(oldButton instanceof HTMLButtonElement)) return;

      const rawSize = getImg(`${slotId}_size`) || sizeSelect.value || 'cover';
      const fit = normalizeHeroFit(rawSize);
      const zoom = normalizeHeroZoom(getImg(`${slotId}_zoom`), rawSize);

      sizeSelect.innerHTML = `
        <option value="cover">Cubrir contenedor (cover)</option>
        <option value="contain">Mostrar completa (contain)</option>
        <option value="auto">Tamaño original (auto)</option>
      `;
      sizeSelect.value = fit;
      sizeSelect.closest('.adm-hero-ctrl-row')?.querySelector('label')?.replaceChildren('Ajuste');

      const zoomRow = document.createElement('div');
      zoomRow.className = 'adm-hero-ctrl-row';
      zoomRow.innerHTML = `
        <label>Zoom</label>
        <select id="zoom-${slotId}" class="adm-hero-select">
          ${HERO_ZOOM_VALUES.map(value =>
            `<option value="${value}" ${value === zoom ? 'selected' : ''}>${value}</option>`
          ).join('')}
        </select>
      `;

      const posRow = posSelect.closest('.adm-hero-ctrl-row');
      controls.insertBefore(zoomRow, posRow || oldButton);

      const help = document.createElement('p');
      help.className = 'adm-hero-help';
      help.innerHTML = '<strong>Cover</strong> llena el bloque. Si la imagen ya trae espacio vacío dentro del archivo, aumentá el <strong>Zoom</strong> y ajustá la <strong>Posición</strong>.';
      controls.insertBefore(help, oldButton);

      const saveButton = oldButton.cloneNode(true);
      saveButton.textContent = 'Guardar ajuste, zoom y posición';
      oldButton.replaceWith(saveButton);

      const zoomSelect = document.getElementById(`zoom-${slotId}`);
      [sizeSelect, zoomSelect, posSelect].forEach(select => {
        select?.addEventListener('change', () => applyAdminHeroPreview(card));
      });

      saveButton.addEventListener('click', async () => {
        const nextFit = sizeSelect.value || 'cover';
        const nextZoom = zoomSelect?.value || '100%';
        const nextPos = posSelect.value || 'center center';

        saveButton.disabled = true;
        try {
          await saveImages({
            [`${slotId}_size`]: nextFit,
            [`${slotId}_zoom`]: nextZoom,
            [`${slotId}_pos`]: nextPos,
          });
          setAdminToast('✅ Ajuste, zoom y posición guardados');
          applyAdminHeroPreview(card);
        } catch (error) {
          console.error('[images] No se pudo guardar el hero:', error);
          setAdminToast(`❌ No se pudo guardar: ${error?.message || 'error desconocido'}`, true);
        } finally {
          saveButton.disabled = false;
        }
      });

      controls.classList.add('adm-hero-controls-v2');
      controls.dataset.ttHeroControlsV2 = '1';
      applyAdminHeroPreview(card);
    });
  };

  const boot = () => {
    addStyles();
    const grid = document.getElementById('adm-cards-grid');
    if (!grid) {
      window.setTimeout(boot, 80);
      return;
    }
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(grid, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}

function installHeroDisplayBridge() {
  if (typeof window === 'undefined') return;
  const reapply = () => scheduleHeroDisplayVariables(_cache || fromLocalStorage());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reapply, { once: true });
  } else {
    reapply();
  }
  window.addEventListener('load', reapply, { once: true });
  window.addEventListener('tintin:images-phase5-ready', reapply);

  ['(max-width: 767px)', '(max-width: 1023px)'].forEach(query => {
    const mql = window.matchMedia(query);
    if (mql.addEventListener) mql.addEventListener('change', reapply);
    else if (mql.addListener) mql.addListener(reapply);
  });
}

installHeroDisplayBridge();
installAdminHeroControls();
