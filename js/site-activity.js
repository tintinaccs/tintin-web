/**
 * Métricas anónimas y livianas para el panel de Super Admin.
 *
 * - Una sesión se cuenta una sola vez por pestaña, aunque se navegue por
 *   distintas páginas o se recargue.
 * - La presencia se renueva solamente mientras la página está visible.
 * - No se guardan IP, navegador, ubicación, referidor, nombre ni correo.
 */
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

if (!window.TintinSiteActivityBooted) {
  window.TintinSiteActivityBooted = true;

  const VISITOR_KEY = 'tt_activity_visitor_v1';
  const SESSION_KEY = 'tt_activity_session_v1';
  const SESSION_RECORDED_PREFIX = 'tt_activity_recorded_';
  const HEARTBEAT_MS = 120000;
  let currentUserId = '';
  let heartbeatTimer = 0;

  function randomId(prefix) {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return prefix + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 14);
    }
  }

  function storedId(storage, key, prefix) {
    try {
      let value = storage.getItem(key) || '';
      if (!/^[a-z0-9_-]{8,80}$/i.test(value)) {
        value = randomId(prefix);
        storage.setItem(key, value);
      }
      return value;
    } catch {
      return randomId(prefix);
    }
  }

  const visitorId = storedId(window.localStorage, VISITOR_KEY, 'v_');
  const sessionId = storedId(window.sessionStorage, SESSION_KEY, 's_');

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

  function safePage() {
    const page = (window.location.pathname || '/').replace(/[^a-z0-9/_\-.]/gi, '').slice(0, 160);
    return page || '/';
  }

  async function recordSessionOnce() {
    const dayKey = paraguayDayKey();
    const recordedKey = SESSION_RECORDED_PREFIX + dayKey;
    try {
      if (window.sessionStorage.getItem(recordedKey) === sessionId) return;
    } catch {}

    try {
      await setDoc(doc(db, 'siteTraffic', dayKey, 'sessions', sessionId), {
        dayKey,
        sessionId,
        visitorId,
        userId: currentUserId,
        landingPage: safePage(),
        startedAt: serverTimestamp()
      });
      try {
        window.sessionStorage.setItem(recordedKey, sessionId);
      } catch {}
    } catch (error) {
      console.warn('[SiteActivity] No se pudo registrar la sesión:', error?.code || error);
    }
  }

  async function sendHeartbeat() {
    if (document.visibilityState === 'hidden') return;
    try {
      const presenceRef = doc(db, 'sitePresence', visitorId);
      await setDoc(presenceRef, {
        visitorId,
        sessionId,
        userId: currentUserId,
        page: safePage(),
        lastSeen: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn('[SiteActivity] No se pudo actualizar la presencia:', error?.code || error);
    }
  }

  function scheduleHeartbeat() {
    window.clearInterval(heartbeatTimer);
    sendHeartbeat();
    heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleHeartbeat();
    else window.clearInterval(heartbeatTimer);
  });

  window.addEventListener('pagehide', () => window.clearInterval(heartbeatTimer), { once: true });

  onAuthStateChanged(auth, user => {
    currentUserId = user?.uid || '';
    recordSessionOnce();
    scheduleHeartbeat();
  });
}
