/* ============================================================
   TINTIN ACCESORIOS — Image Management Module
   Manages configurable image slots stored in Firestore
   ============================================================ */

import { db } from "./firebase.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import './home-premium.js';

function injectTintinPalette() {
  if (document.getElementById('tt-tintin-palette-css')) return;
  const link = document.createElement('link');
  link.id = 'tt-tintin-palette-css';
  link.rel = 'stylesheet';
  link.href = new URL('../css/tintin-palette.css', import.meta.url).href;
  document.head.appendChild(link);
}

injectTintinPalette();

const CACHE_KEY = 'tt_images';
const FIRESTORE_DOC = 'settings/images';

export const IMAGE_SLOTS = [
  { id: 'hero_bg_desktop', label: 'Hero — Desktop (≥1024px)',  section: 'hero', emoji: null, desc: 'Fondo del banner en pantallas grandes (PC / laptop)' },
  { id: 'hero_bg_tablet',  label: 'Hero — Tablet (768–1023px)', section: 'hero', emoji: null, desc: 'Fondo del banner en tablets' },
  { id: 'hero_bg_mobile',  label: 'Hero — Mobile (≤767px)',     section: 'hero', emoji: null, desc: 'Fondo del banner en celulares' },
  { id: 'prod_1',               label: 'Reloj Alissia',              section: 'productos',  emoji: '⌚',  desc: 'Foto del producto Reloj Alissia' },
  { id: 'prod_2',               label: 'Reloj Allegra',              section: 'productos',  emoji: '⌚',  desc: 'Foto del producto Reloj Allegra' },
  { id: 'prod_3',               label: 'Reloj Amara',                section: 'productos',  emoji: '⌚',  desc: 'Foto del producto Reloj Amara' },
  { id: 'prod_4',               label: 'Reloj Ámbar',                section: 'productos',  emoji: '⌚',  desc: 'Foto del producto Reloj Ámbar' },
  { id: 'prod_5',               label: 'Reloj Amelia',               section: 'productos',  emoji: '⌚',  desc: 'Foto del producto Reloj Amelia' },
  { id: 'prod_6',               label: 'Reloj Ameline',              section: 'productos',  emoji: '⌚',  desc: 'Foto del producto Reloj Ameline' },
  { id: 'prod_7',               label: 'Reloj Amethys',              section: 'productos',  emoji: '⌚',  desc: 'Foto del producto Reloj Amethys' },
  { id: 'prod_8',               label: 'Reloj Anabella',             section: 'productos',  emoji: '⌚',  desc: 'Foto del producto Reloj Anabella' },
  { id: 'edit_relojes',         label: 'Editorial — Relojes',        section: 'editorial',  emoji: '⌚',  desc: 'Imagen sección editorial Relojes' },
  { id: 'edit_bolsos',          label: 'Editorial — Bolsos/Bags',    section: 'editorial',  emoji: '👜',  desc: 'Imagen sección editorial Bags' },
  { id: 'edit_collares',        label: 'Editorial — Collares',       section: 'editorial',  emoji: '📿',  desc: 'Imagen sección editorial Collares' },
  { id: 'coll_bags',            label: 'Colección — Bags',           section: 'editorial',  emoji: '👜',  desc: 'Imagen tarjeta colección Bags' },
  { id: 'coll_collares',        label: 'Colección — Collares',       section: 'editorial',  emoji: '📿',  desc: 'Imagen tarjeta colección Collares' },
  { id: 'coll_earcuff',         label: 'Colección — Earcuff',        section: 'editorial',  emoji: '✨',  desc: 'Imagen tarjeta colección Earcuff' },
  { id: 'coll_gafas',           label: 'Colección — Gafas',          section: 'editorial',  emoji: '🕶️', desc: 'Imagen tarjeta colección Gafas' },
  { id: 'coll_brazaletes',      label: 'Colección — Brazaletes',     section: 'editorial',  emoji: '💎',  desc: 'Imagen tarjeta colección Brazaletes' },
  { id: 'coll_aros',            label: 'Colección — Aros',           section: 'editorial',  emoji: '💫',  desc: 'Imagen tarjeta colección Aros' },
  { id: 'coll_armcuff',         label: 'Colección — Armcuff',        section: 'editorial',  emoji: '🌸',  desc: 'Imagen tarjeta colección Armcuff' },
  { id: 'coll_anillos',         label: 'Colección — Anillos',        section: 'editorial',  emoji: '💍',  desc: 'Imagen tarjeta colección Anillos' },
  { id: 'coll_joyeros',         label: 'Colección — Joyeros',        section: 'editorial',  emoji: '🪞',  desc: 'Imagen tarjeta colección Joyeros' },
  { id: 'coll_pulseras',        label: 'Colección — Pulseras',       section: 'editorial',  emoji: '🎀',  desc: 'Imagen tarjeta colección Pulseras' },
  { id: 'coll_relojes',         label: 'Colección — Relojes',        section: 'editorial',  emoji: '⌚',  desc: 'Imagen tarjeta colección Relojes' },
  { id: 'coll_tobilleras',      label: 'Colección — Tobilleras',     section: 'editorial',  emoji: '🦋',  desc: 'Imagen tarjeta colección Tobilleras' },
  { id: 'trust_envio',          label: 'Ícono — Envío',              section: 'iconos',     emoji: '🚀',  desc: 'Ícono de envío/delivery' },
  { id: 'trust_calidad',        label: 'Ícono — Calidad',            section: 'iconos',     emoji: '✨',  desc: 'Ícono de calidad garantizada' },
  { id: 'trust_pago',           label: 'Ícono — Pago seguro',        section: 'iconos',     emoji: '🔒',  desc: 'Ícono de pago seguro' },
  { id: 'trust_soporte',        label: 'Ícono — Soporte',            section: 'iconos',     emoji: '💬',  desc: 'Ícono de atención al cliente' },
  { id: 'about_foto',           label: 'Nosotros — Foto principal',  section: 'nosotros',   emoji: '🌸',  desc: 'Foto principal de la página Nosotros' },
  { id: 'logo_main',            label: 'Logo principal',             section: 'branding',   emoji: null,  desc: 'Logo principal del sitio' },
];

let _cache = null;
function _fromLocalStorage() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; } }
function _toLocalStorage(data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {} }

export async function loadImages() {
  const cached = _fromLocalStorage();
  if (cached) { _cache = cached; return _cache; }
  try {
    const snap = await getDoc(doc(db, FIRESTORE_DOC));
    const data = snap.exists() ? snap.data() : {};
    _cache = data;
    _toLocalStorage(data);
  } catch (e) {
    console.warn('[images] Firestore load failed:', e);
    _cache = {};
  }
  return _cache;
}

export async function saveImages(data) {
  await setDoc(doc(db, FIRESTORE_DOC), data, { merge: true });
  _cache = { ...(_cache || {}), ...data };
  _toLocalStorage(_cache);
}

export function getImg(id) {
  if (!_cache) _cache = _fromLocalStorage() || {};
  return (_cache && _cache[id]) ? _cache[id] : null;
}

export function setImgCache(id, url) {
  if (!_cache) _cache = _fromLocalStorage() || {};
  if (url) _cache[id] = url;
  else delete _cache[id];
  _toLocalStorage(_cache);
}

let _listenerStarted = false;
const _subscribers = new Set();

export function onImagesUpdate(cb) {
  _subscribers.add(cb);
  if (_cache) cb(_cache);
  if (_listenerStarted) return;
  _listenerStarted = true;
  onSnapshot(doc(db, FIRESTORE_DOC), snap => {
    _cache = snap.exists() ? snap.data() : {};
    _toLocalStorage(_cache);
    _subscribers.forEach(fn => { try { fn(_cache); } catch (e) { console.warn('[images] subscriber error:', e); } });
  }, e => console.warn('[images] realtime listener failed:', e));
}
