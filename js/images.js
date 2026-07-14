/* ============================================================
   TINTIN ACCESORIOS — Image Management Module (Fase 5)

   Única fuente para imágenes globales/editoriales: settings/images.
   Productos usan products/{id}.imageUrl y colecciones usan
   collections/{slug}.image; esos dos sistemas ya no se duplican acá.
   ============================================================ */

import { db } from './firebase.js';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { sanitizeImageUrl } from './image-utils.js';

// Se mantienen estas inicializaciones porque históricamente dependían de la
// primera importación de images.js. Ambas son idempotentes.
import './home-premium.js';
import './welcome-tutorial-runtime.js';

const CACHE_KEY = 'tt_images';
const FIRESTORE_DOC = 'settings/images';

export const HERO_SIZE_VALUES = Object.freeze([
  'cover', 'contain', 'auto', '80%', '60%', '50%', '40%'
]);
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

function isHeroMetaKey(key) {
  return /^(hero_bg_(?:desktop|tablet|mobile))_(?:size|pos)$/.test(key);
}

function allowedSettingKey(key) {
  return IMAGE_SLOT_SET.has(key) || isHeroMetaKey(key);
}

function normalizeMetaValue(key, value) {
  if (key.endsWith('_size')) {
    return HERO_SIZE_VALUES.includes(value) ? value : 'cover';
  }
  if (key.endsWith('_pos')) {
    return HERO_POSITION_VALUES.includes(value) ? value : 'center center';
  }
  return '';
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
    const posKey = `${id}_pos`;
    normalized[sizeKey] = normalizeMetaValue(sizeKey, source[sizeKey]);
    normalized[posKey] = normalizeMetaValue(posKey, source[posKey]);
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

    if (value == null || value === '') {
      patch[key] = null;
      return;
    }

    if (IMAGE_SLOT_SET.has(key)) {
      const safe = sanitizeImageUrl(value);
      if (!safe) throw new Error(`La URL de “${key}” no es válida o no es segura.`);
      patch[key] = safe;
      return;
    }

    patch[key] = normalizeMetaValue(key, String(value));
  });

  return patch;
}

let _cache = null;
let _listenerStarted = false;
const _subscribers = new Set();
const _errorSubscribers = new Set();

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

function publish(data) {
  const snapshot = normalizeImagesData(data);
  _cache = snapshot;
  toLocalStorage(snapshot);
  _subscribers.forEach(fn => {
    try { fn({ ...snapshot }); }
    catch (error) { console.warn('[images] subscriber error:', error); }
  });
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
    return { ..._cache };
  }

  try {
    const snap = await getDoc(doc(db, FIRESTORE_DOC));
    return publish(snap.exists() ? snap.data() : {});
  } catch (error) {
    console.warn('[images] Firestore load failed:', error);
    publishError(error);
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
  } else {
    _cache[id] = normalizeMetaValue(id, String(value));
  }
  toLocalStorage(_cache);
}

export function onImagesUpdate(callback, onError) {
  if (typeof callback === 'function') {
    _subscribers.add(callback);
    if (!_cache) _cache = fromLocalStorage();
    callback({ ..._cache });
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
