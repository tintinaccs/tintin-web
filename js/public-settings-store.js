import { db, appCheckReady } from './firebase.js?v=tintin-20260730-appcheck-stable-4';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { readStaleCached, recordFirestoreRead, writeCached } from './firestore-read-cache.js?v=tintin-20260720-read-budget-1';

const CACHE_KEY = 'settings:general';
const subscribers = new Set();
let current = readStaleCached(CACHE_KEY);
let unsubscribe = null;
let startPending = false;
let lastError = null;

function publish(data, meta) {
  current = data && typeof data === 'object' ? data : {};
  subscribers.forEach(callback => {
    try {
      callback(current, meta);
    } catch (error) {
      console.warn('[public-settings-store] subscriber error:', error);
    }
  });
}

function start() {
  if (unsubscribe || startPending) return;
  startPending = true;
  appCheckReady.then(ready => {
    startPending = false;
    if (!ready) {
      publish(current || {}, { source: current ? 'stale-cache' : 'offline-safe' });
      return;
    }
    unsubscribe = onSnapshot(doc(db, 'settings', 'general'), snapshot => {
      recordFirestoreRead('settings:general', 1);
      lastError = null;
      const data = snapshot.exists() ? snapshot.data() || {} : {};
      writeCached(CACHE_KEY, data);
      publish(data, { source: 'server', exists: snapshot.exists() });
    }, error => {
      lastError = error;
      subscribers.forEach(callback => {
        try {
          callback(current || {}, { source: current ? 'stale-cache' : 'error', error });
        } catch {}
      });
    });
  });
}

export function onPublicSettings(callback) {
  subscribers.add(callback);
  if (current) callback(current, { source: 'cache', error: lastError });
  start();
  return () => {
    subscribers.delete(callback);
    if (!subscribers.size && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

export function getPublicSettingsSnapshot() {
  return current ? { ...current } : null;
}

window.TintinPublicSettings = {
  subscribe: onPublicSettings,
  get: getPublicSettingsSnapshot
};
