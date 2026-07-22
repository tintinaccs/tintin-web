import { db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  hasStatisticsConsent,
  onPrivacyConsentChange
} from './privacy-consent.js?v=tintin-20260716-cloudinary-fix-1';

const ADMIN_PATHS = /\/(?:admin|admin-images)\.html$/i;
const MEASUREMENT_ID_RE = /^G-[A-Z0-9]{6,20}$/i;
const CONFIG_TTL_MS = 5 * 60 * 1000;
const MAX_QUEUE = 50;
const MAX_DEDUPE_KEYS = 200;
const DEDUPE_PREFIX = 'tt_analytics_once_';
const FORBIDDEN_PARAM = /(?:email|phone|telefono|nombre|name|address|direccion|document|cedula|password|token|user(?:id)?|order(?:id)?|session(?:id)?|visitor(?:id)?|ip|lat|lng|postal|referrer)/i;
const ALLOWED_EVENTS = new Set([
  'view_item',
  'view_item_list',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'purchase',
  'restore_cart'
]);

let state = 'idle';
let configuredMeasurementId = '';
let configCache = { value: '', expiresAt: 0 };
let configPromise = null;
let scriptPromise = null;
let pendingEvents = [];
let previousCart = null;
let consentUnsubscribe = null;

function isTrackablePage() {
  return !ADMIN_PATHS.test(window.location.pathname || '');
}

function cleanText(value, maxLength = 100) {
  return String(value == null ? '' : value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function safeNumber(value, { integer = false, min = 0, max = 999999999 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const bounded = Math.max(min, Math.min(max, parsed));
  return integer ? Math.round(bounded) : Math.round(bounded * 100) / 100;
}

function sanitizeParams(params) {
  const output = {};
  if (!params || typeof params !== 'object' || Array.isArray(params)) return output;

  for (const [rawKey, rawValue] of Object.entries(params)) {
    const key = cleanText(rawKey, 40).replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    if (!key || FORBIDDEN_PARAM.test(key)) continue;

    if (typeof rawValue === 'number') {
      const numeric = safeNumber(rawValue, { min: 0 });
      if (numeric !== undefined) output[key] = numeric;
      continue;
    }

    if (typeof rawValue === 'boolean') {
      output[key] = rawValue;
      continue;
    }

    if (typeof rawValue === 'string') {
      const text = cleanText(rawValue, 100);
      if (text) output[key] = text;
    }
  }

  return output;
}

function onceKey(eventName, dedupeKey) {
  const safeKey = cleanText(`${eventName}_${dedupeKey}`, 160).replace(/[^a-z0-9_-]/gi, '_');
  return safeKey ? `${DEDUPE_PREFIX}${safeKey}` : '';
}

function alreadySentOnce(eventName, dedupeKey) {
  if (!dedupeKey) return false;
  const key = onceKey(eventName, dedupeKey);
  if (!key) return false;
  try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
}

function markSentOnce(eventName, dedupeKey) {
  if (!dedupeKey) return;
  const key = onceKey(eventName, dedupeKey);
  if (!key) return;
  try {
    sessionStorage.setItem(key, '1');
    const analyticsKeys = Object.keys(sessionStorage).filter(item => item.startsWith(DEDUPE_PREFIX));
    analyticsKeys.slice(0, Math.max(0, analyticsKeys.length - MAX_DEDUPE_KEYS)).forEach(item => sessionStorage.removeItem(item));
  } catch {}
}

async function loadMeasurementId({ force = false } = {}) {
  const now = Date.now();
  if (!force && configCache.expiresAt > now) return configCache.value;
  if (configPromise) return configPromise;

  configPromise = getDoc(doc(db, 'settings', 'general'))
    .then(snapshot => {
      const candidate = cleanText(snapshot.exists() ? snapshot.data()?.ga4MeasurementId : '', 30).toUpperCase();
      const value = MEASUREMENT_ID_RE.test(candidate) ? candidate : '';
      configCache = { value, expiresAt: Date.now() + CONFIG_TTL_MS };
      return value;
    })
    .catch(error => {
      console.warn('[Analytics] No se pudo leer la configuración:', error?.code || error);
      configCache = { value: '', expiresAt: Date.now() + 30_000 };
      return '';
    })
    .finally(() => {
      configPromise = null;
    });

  return configPromise;
}

function ensureDataLayer() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
}

function loadGtagScript(measurementId) {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-tintin-ga4]');
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.tintinGa4 = 'true';
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  }).catch(error => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

function clearAnalyticsCookies() {
  const hostname = window.location.hostname;
  const domains = ['', hostname, `.${hostname}`].filter(Boolean);
  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0]?.trim();
    if (!/^_ga(?:_|$)/.test(name || '')) return;
    domains.forEach(domain => {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${domain ? `; domain=${domain}` : ''}`;
    });
  });
}

function disableAnalytics() {
  pendingEvents = [];
  state = 'disabled';
  if (configuredMeasurementId) window[`ga-disable-${configuredMeasurementId}`] = true;
  if (window.dataLayer && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
  }
  clearAnalyticsCookies();
}

function sendEvent(event) {
  if (state !== 'ready' || typeof window.gtag !== 'function') return false;
  window.gtag('event', event.name, event.params);
  markSentOnce(event.name, event.dedupeKey);
  return true;
}

function flushQueue() {
  const queue = pendingEvents;
  pendingEvents = [];
  queue.forEach(event => {
    if (!alreadySentOnce(event.name, event.dedupeKey)) sendEvent(event);
  });
}

async function enableAnalytics({ forceConfig = false } = {}) {
  if (!isTrackablePage() || !hasStatisticsConsent()) {
    disableAnalytics();
    return false;
  }
  if (state === 'loading' || state === 'ready') return state === 'ready';

  state = 'loading';
  const measurementId = await loadMeasurementId({ force: forceConfig });
  if (!measurementId || !hasStatisticsConsent()) {
    state = measurementId ? 'disabled' : 'configuration-required';
    return false;
  }

  configuredMeasurementId = measurementId;
  window[`ga-disable-${measurementId}`] = false;
  ensureDataLayer();
  window.gtag('consent', 'default', { analytics_storage: 'granted' });

  try {
    await loadGtagScript(measurementId);
    if (!hasStatisticsConsent()) {
      disableAnalytics();
      return false;
    }
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      send_page_view: true
    });
    state = 'ready';
    flushQueue();
    return true;
  } catch (error) {
    state = 'error';
    console.warn('[Analytics] No se pudo cargar GA4:', error);
    return false;
  }
}

function track(eventName, params = {}, options = {}) {
  const name = cleanText(eventName, 40).toLowerCase();
  if (!ALLOWED_EVENTS.has(name) || !isTrackablePage() || !hasStatisticsConsent()) return false;

  const dedupeKey = cleanText(options?.dedupeKey, 120);
  if (alreadySentOnce(name, dedupeKey)) return false;

  const event = { name, params: sanitizeParams(params), dedupeKey };
  if (state === 'ready') return sendEvent(event);
  if (pendingEvents.length >= MAX_QUEUE) pendingEvents.shift();
  pendingEvents.push(event);
  enableAnalytics();
  return true;
}

function cartSummary(items) {
  const normalized = Array.isArray(items) ? items : [];
  return normalized.reduce((summary, item) => {
    const qty = safeNumber(item?.qty, { integer: true, min: 0, max: 99 }) || 0;
    const price = safeNumber(item?.price, { min: 0 }) || 0;
    summary.quantity += qty;
    summary.value += qty * price;
    summary.lines += qty > 0 ? 1 : 0;
    return summary;
  }, { quantity: 0, value: 0, lines: 0 });
}

function bindCommerceEvents() {
  window.addEventListener('tt_cart_updated', event => {
    const next = cartSummary(event?.detail?.items);
    if (previousCart) {
      const quantityDelta = next.quantity - previousCart.quantity;
      const valueDelta = Math.max(0, Math.abs(next.value - previousCart.value));
      if (quantityDelta > 0) {
        track('add_to_cart', { currency: 'PYG', value: valueDelta, quantity: quantityDelta, line_count: next.lines });
      } else if (quantityDelta < 0) {
        track('remove_from_cart', { currency: 'PYG', value: valueDelta, quantity: Math.abs(quantityDelta), line_count: next.lines });
      }
    }
    previousCart = next;
  }, { passive: true });

  window.addEventListener('tintin:cart-restored', event => {
    const detail = event?.detail || {};
    track('restore_cart', {
      currency: 'PYG',
      value: safeNumber(detail.value, { min: 0 }) || 0,
      quantity: safeNumber(detail.quantity, { integer: true, min: 0, max: 999 }) || 0,
      line_count: safeNumber(detail.lines, { integer: true, min: 0, max: 100 }) || 0
    }, { dedupeKey: 'returning-cart' });
  }, { passive: true });

  window.addEventListener('tintin:order-created', event => {
    const detail = event?.detail || {};
    track('purchase', {
      currency: 'PYG',
      value: safeNumber(detail.value, { min: 0 }) || 0,
      quantity: safeNumber(detail.quantity, { integer: true, min: 0, max: 999 }) || 0,
      item_count: safeNumber(detail.itemCount, { integer: true, min: 0, max: 100 }) || 0
    }, { dedupeKey: cleanText(detail.dedupeKey, 120) });
  }, { passive: true });

  if (/\/checkout\.html$/i.test(window.location.pathname || '')) {
    window.setTimeout(() => {
      let items = [];
      try { items = JSON.parse(localStorage.getItem('tt_cart') || '[]'); } catch {}
      const summary = cartSummary(items);
      if (summary.quantity > 0) {
        track('begin_checkout', {
          currency: 'PYG',
          value: summary.value,
          quantity: summary.quantity,
          item_count: summary.lines
        }, { dedupeKey: 'checkout-page' });
      }
    }, 300);
  }
}

window.TintinAnalytics = Object.freeze({
  track,
  refreshConfiguration: () => enableAnalytics({ forceConfig: true }),
  get status() { return state; },
  allowedEvents: Object.freeze([...ALLOWED_EVENTS])
});

if (isTrackablePage()) {
  bindCommerceEvents();
  if (hasStatisticsConsent()) enableAnalytics();
  consentUnsubscribe = onPrivacyConsentChange(preferences => {
    if (preferences.statistics) enableAnalytics({ forceConfig: state === 'configuration-required' || state === 'error' });
    else disableAnalytics();
  });
  window.addEventListener('pagehide', () => consentUnsubscribe?.(), { once: true });
} else {
  state = 'disabled-admin';
}
