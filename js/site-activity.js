/**
 * Analítica propia y mínima para el panel de Super Admin.
 *
 * - Solo arranca después de una elección afirmativa.
 * - Cuenta una sesión por pestaña y día de Paraguay.
 * - Guarda ciudad/región/país aproximados, nunca IP, GPS, coordenadas,
 *   código postal, navegador, nombre, correo ni referidor.
 * - El identificador aleatorio rota cada día y no se vincula con la cuenta.
 */
import { db } from './firebase.js';
import {
  doc,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  hasStatisticsConsent,
  onPrivacyConsentChange
} from './privacy-consent.js';

if (!window.TintinSiteActivityBooted) {
  window.TintinSiteActivityBooted = true;

  const VISITOR_KEY = 'tt_activity_visitor_v2';
  const SESSION_KEY = 'tt_activity_session_v2';
  const GEO_KEY = 'tt_activity_geo_v1';
  const SESSION_RECORDED_PREFIX = 'tt_activity_recorded_';
  const GEO_SERVICE_URL = 'https://tintinaccesorios.pages.dev/api/visitor-geo';
  const HEARTBEAT_MS = 60000;
  const ADMIN_PAGES = /\/(?:admin|admin-images)\.html$/i;
  let heartbeatTimer = 0;
  let activityEnabled = false;
  let analyticsWritable = false;
  let listenersBound = false;
  let identityDay = '';
  let visitorId = '';
  let sessionId = '';
  let geoPromise = null;

  function randomId(prefix) {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return prefix + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 14);
    }
  }

  function storageGet(storage, key) {
    try {
      return storage.getItem(key) || '';
    } catch {
      return '';
    }
  }

  function storageSet(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch {}
  }

  function storageRemove(storage, key) {
    try {
      storage.removeItem(key);
    } catch {}
  }

  function paraguayDayKey() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function dailyId(storage, key, prefix, dayKey) {
    try {
      const saved = JSON.parse(storageGet(storage, key) || '{}');
      if (saved.day === dayKey && /^[a-z0-9_-]{8,80}$/i.test(saved.id || '')) return saved.id;
    } catch {}
    const id = randomId(prefix);
    storageSet(storage, key, JSON.stringify({ day: dayKey, id }));
    return id;
  }

  function refreshIdentity() {
    const dayKey = paraguayDayKey();
    if (identityDay === dayKey && visitorId && sessionId) return dayKey;
    identityDay = dayKey;
    visitorId = dailyId(window.localStorage, VISITOR_KEY, 'v_', dayKey);
    sessionId = dailyId(window.sessionStorage, SESSION_KEY, 's_', dayKey);
    geoPromise = null;
    return dayKey;
  }

  function safePage() {
    const page = (window.location.pathname || '/').replace(/[^a-z0-9/_\-.]/gi, '').slice(0, 160);
    return page || '/';
  }

  function cleanGeoText(value, maxLength = 80) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[^\p{L}\p{M}\p{N} .,'’()\-]/gu, '')
      .trim()
      .slice(0, maxLength);
  }

  function normalizeGeo(value) {
    const countryCode = /^[A-Z]{2}$/i.test(value?.countryCode || '')
      ? String(value.countryCode).toUpperCase()
      : '';

    // Firestore conserva el valor histórico "netlify" para no exigir una
    // migración de reglas únicamente por el cambio de proveedor de edge.
    const provider = value?.source === 'cloudflare' || value?.source === 'netlify'
      ? 'netlify'
      : 'unavailable';

    return {
      city: cleanGeoText(value?.city),
      region: cleanGeoText(value?.region),
      country: cleanGeoText(value?.country),
      countryCode,
      geoSource: provider === 'netlify' && (countryCode || value?.city)
        ? 'netlify'
        : 'unavailable'
    };
  }

  function geoEndpoint() {
    const hostname = String(window.location.hostname || '').toLowerCase();
    if (hostname.endsWith('github.io') || hostname.endsWith('netlify.app')) {
      return GEO_SERVICE_URL;
    }
    return '/api/visitor-geo';
  }

  async function fetchApproximateGeo() {
    const dayKey = refreshIdentity();
    try {
      const cached = JSON.parse(storageGet(window.sessionStorage, GEO_KEY) || '{}');
      if (cached.day === dayKey && cached.value) return normalizeGeo(cached.value);
    } catch {}

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(geoEndpoint(), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        referrerPolicy: 'strict-origin-when-cross-origin',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = normalizeGeo(await response.json());
      storageSet(window.sessionStorage, GEO_KEY, JSON.stringify({ day: dayKey, value }));
      return value;
    } catch {
      return normalizeGeo(null);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function getGeo() {
    if (!geoPromise) geoPromise = fetchApproximateGeo();
    return geoPromise;
  }

  function hasConsent() {
    return hasStatisticsConsent();
  }

  async function recordSessionOnce() {
    if (!activityEnabled || !hasConsent()) return;
    const dayKey = refreshIdentity();
    const recordedKey = SESSION_RECORDED_PREFIX + dayKey;
    if (storageGet(window.sessionStorage, recordedKey) === sessionId) return;

    try {
      const geo = await getGeo();
      if (!activityEnabled || !hasConsent()) return;
      await setDoc(doc(db, 'siteTraffic', dayKey, 'sessions', sessionId), {
        dayKey,
        sessionId,
        visitorId,
        userId: '',
        landingPage: safePage(),
        ...geo,
        startedAt: serverTimestamp()
      });
      storageSet(window.sessionStorage, recordedKey, sessionId);
    } catch (error) {
      console.warn('[SiteActivity] No se pudo registrar la sesión:', error?.code || error);
    }
  }

  async function sendHeartbeat() {
    if (!activityEnabled || !hasConsent() || document.visibilityState === 'hidden') return;
    refreshIdentity();
    try {
      const geo = await getGeo();
      if (!activityEnabled || !hasConsent()) return;
      await setDoc(doc(db, 'sitePresence', visitorId), {
        visitorId,
        sessionId,
        userId: '',
        page: safePage(),
        ...geo,
        lastSeen: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn('[SiteActivity] No se pudo actualizar la presencia:', error?.code || error);
    }
  }

  function scheduleHeartbeat() {
    window.clearInterval(heartbeatTimer);
    if (!activityEnabled || !hasConsent()) return;
    sendHeartbeat();
    heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_MS);
  }

  function stopActivity() {
    activityEnabled = false;
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = 0;
  }

  function bindLifecycleOnce() {
    if (listenersBound) return;
    listenersBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && activityEnabled) scheduleHeartbeat();
      else window.clearInterval(heartbeatTimer);
    });
    window.addEventListener('pagehide', () => window.clearInterval(heartbeatTimer));
  }

  function startActivity() {
    if (!analyticsWritable) return;
    activityEnabled = true;
    refreshIdentity();
    bindLifecycleOnce();
    recordSessionOnce();
    scheduleHeartbeat();
  }

  function clearLocalAnalyticsIds() {
    const dayKey = paraguayDayKey();
    storageRemove(window.localStorage, VISITOR_KEY);
    storageRemove(window.sessionStorage, SESSION_KEY);
    storageRemove(window.sessionStorage, GEO_KEY);
    storageRemove(window.sessionStorage, SESSION_RECORDED_PREFIX + dayKey);
    identityDay = '';
    visitorId = '';
    sessionId = '';
    geoPromise = null;
  }

  const hostname = String(window.location.hostname || '').toLowerCase();
  const localHost = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(hostname);
  const netlifyPreview = /^deploy-preview-/i.test(hostname);
  const cloudflarePreview = /\.tintinaccesorios\.pages\.dev$/i.test(hostname);
  const trackablePage = !ADMIN_PAGES.test(window.location.pathname);
  analyticsWritable = !localHost && !netlifyPreview && !cloudflarePreview;

  if (trackablePage) {
    if (hasConsent() && analyticsWritable) startActivity();
    onPrivacyConsentChange(preferences => {
      if (preferences.statistics && analyticsWritable) startActivity();
      else {
        stopActivity();
        clearLocalAnalyticsIds();
      }
    });
  }
}
