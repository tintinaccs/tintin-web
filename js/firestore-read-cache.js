const memory = new Map();
const flights = new Map();
const PREFIX = 'tt_read_cache_v1:';

function now() {
  return Date.now();
}

function storage() {
  try {
    const key = `${PREFIX}probe`;
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return localStorage;
  } catch {
    return null;
  }
}

function normalizeEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const savedAt = Number(value.savedAt);
  if (!Number.isFinite(savedAt) || !Object.hasOwn(value, 'data')) return null;
  return { savedAt, data: value.data };
}

export function readCached(key, ttlMs) {
  const cached = normalizeEntry(memory.get(key));
  if (cached && now() - cached.savedAt <= ttlMs) return cached.data;
  const target = storage();
  if (!target) return null;
  try {
    const entry = normalizeEntry(JSON.parse(target.getItem(PREFIX + key) || 'null'));
    if (!entry || now() - entry.savedAt > ttlMs) {
      target.removeItem(PREFIX + key);
      return null;
    }
    memory.set(key, entry);
    return entry.data;
  } catch {
    return null;
  }
}

export function readStaleCached(key) {
  const cached = normalizeEntry(memory.get(key));
  if (cached) return cached.data;
  const target = storage();
  if (!target) return null;
  try {
    const entry = normalizeEntry(JSON.parse(target.getItem(PREFIX + key) || 'null'));
    if (!entry) return null;
    memory.set(key, entry);
    return entry.data;
  } catch {
    return null;
  }
}

export function writeCached(key, data) {
  const entry = { savedAt: now(), data };
  memory.set(key, entry);
  const target = storage();
  if (!target) return;
  try {
    target.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {}
}

export function clearCached(key) {
  memory.delete(key);
  const target = storage();
  if (!target) return;
  try {
    target.removeItem(PREFIX + key);
  } catch {}
}

export function runSingleFlight(key, factory) {
  if (flights.has(key)) return flights.get(key);
  const task = Promise.resolve().then(factory).finally(() => flights.delete(key));
  flights.set(key, task);
  return task;
}

export function recordFirestoreRead(source, documents = 1) {
  const root = window.TintinReadBudget || {
    startedAt: new Date().toISOString(),
    estimatedDocuments: 0,
    sources: {}
  };
  const amount = Math.max(0, Number(documents) || 0);
  root.estimatedDocuments += amount;
  root.sources[source] = (root.sources[source] || 0) + amount;
  window.TintinReadBudget = root;
}

export function getReadBudgetSnapshot() {
  return JSON.parse(JSON.stringify(window.TintinReadBudget || {
    startedAt: new Date().toISOString(),
    estimatedDocuments: 0,
    sources: {}
  }));
}
