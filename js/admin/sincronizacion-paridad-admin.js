import { db } from '../core/firebase/firebase.js?v=tintin-20260903-auth-persistence-1';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { SUPER_ADMIN } from '../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';

const USER_LIMIT = 500;
const AUDIT_LIMIT = 250;
const USER_STORAGE_PREFIX = 'tt_admin_user_mirror_';
const AUDIT_STORAGE_PREFIX = 'tt_admin_audit_mirror_';
let stopUsers = null;
let stopAudit = null;
let activeUid = '';

function stableValue(value) {
  if (value?.toMillis && typeof value.toMillis === 'function') return value.toMillis();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableValue(value[key]);
      return out;
    }, {});
  }
  return value;
}

function fingerprint(data) {
  const serialized = JSON.stringify(stableValue(data || {}));
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i += 1) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function remembered(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function remember(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

async function postCanonical(user, path, body) {
  try {
    const token = await user.getIdToken();
    const response = await fetch(path, {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok !== true) throw new Error(result?.error || `HTTP ${response.status}`);
    return result;
  } catch (error) {
    // Firestore ya confirmó la mutación. El reconciliador de un minuto sigue
    // siendo red de seguridad si este aviso inmediato no llega a Google.
    console.warn('[admin-parity] Push inmediato diferido:', path, error);
    return { ok: false, deferred: true };
  }
}

function stopAll() {
  try { stopUsers?.(); } catch {}
  try { stopAudit?.(); } catch {}
  stopUsers = null;
  stopAudit = null;
  activeUid = '';
}

export function stopAdminParityObservers() {
  stopAll();
}

export function startAdminParityObservers(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!user || user.isAnonymous || email !== SUPER_ADMIN.toLowerCase()) {
    stopAll();
    return false;
  }
  if (activeUid === user.uid && stopUsers && stopAudit) return true;
  stopAll();
  activeUid = user.uid;

  let usersReady = false;
  const userFingerprints = new Map();
  const usersQuery = query(collection(db, 'users'), orderBy('updatedAt', 'desc'), limit(USER_LIMIT));
  stopUsers = onSnapshot(usersQuery, { includeMetadataChanges: true }, snapshot => {
    if (!usersReady) {
      snapshot.docs.forEach(document => userFingerprints.set(document.id, fingerprint(document.data())));
      usersReady = true;
      return;
    }
    snapshot.docChanges({ includeMetadataChanges: true }).forEach(change => {
      if (change.type === 'removed' || change.doc.metadata.hasPendingWrites) return;
      const uid = change.doc.id;
      const next = fingerprint(change.doc.data());
      if (userFingerprints.get(uid) === next) return;
      userFingerprints.set(uid, next);
      const storageKey = USER_STORAGE_PREFIX + uid;
      if (remembered(storageKey) === next) return;
      remember(storageKey, next);
      void postCanonical(user, '/api/user-sync-push', { targetUid: uid });
    });
  }, error => console.warn('[admin-parity] No se pudo observar Usuarios:', error));

  let auditReady = false;
  const knownAuditIds = new Set();
  const auditQuery = query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(AUDIT_LIMIT));
  stopAudit = onSnapshot(auditQuery, { includeMetadataChanges: true }, snapshot => {
    if (!auditReady) {
      snapshot.docs.forEach(document => knownAuditIds.add(document.id));
      auditReady = true;
      return;
    }
    snapshot.docChanges({ includeMetadataChanges: true }).forEach(change => {
      if (change.type !== 'added' || change.doc.metadata.hasPendingWrites) return;
      const eventId = change.doc.id;
      if (knownAuditIds.has(eventId)) return;
      knownAuditIds.add(eventId);
      const storageKey = AUDIT_STORAGE_PREFIX + eventId;
      if (remembered(storageKey) === '1') return;
      remember(storageKey, '1');
      void postCanonical(user, '/api/audit-sync-push', { eventId });
    });
  }, error => console.warn('[admin-parity] No se pudo observar Auditoría:', error));

  return true;
}
