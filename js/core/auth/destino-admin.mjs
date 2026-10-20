// Destinos internos, sin credenciales ni datos personales. Compartido por
// productores push, acceso y panel; no concede autorización a ninguna ficha.
export const ADMIN_RETURN_KEY = 'tt_admin_return_target';
const MAX_AGE = 30 * 60 * 1000;
export const adminTargetId = value => /^[A-Za-z0-9_-]{1,220}$/.test(String(value || '')) ? String(value) : '';
export function adminReturnStorage(host) {
  try { return host.sessionStorage; } catch { return null; }
}

export function normalizeAdminDestination(value, origin = 'https://tintin.invalid') {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 1600 || /[\\\u0000-\u0020]/.test(raw) || raw.startsWith('//')) return '';
  try {
    const url = new URL(raw, origin + '/');
    if (url.origin !== origin || !/^\/admin(?:\.html)?$/.test(url.pathname) || url.username || url.password) return '';
    const [section, legacyQuery = ''] = url.hash.replace(/^#(?:section-)?/, '').split('?');
    if (section && /^[a-z][a-z-]{0,60}$/.test(section)) {
      if (!url.searchParams.has('section')) url.searchParams.set('section', section);
      for (const [key, item] of new URLSearchParams(legacyQuery)) if (!url.searchParams.has(key)) url.searchParams.set(key, item);
    }
    return '/admin' + url.search;
  } catch { return ''; }
}

export function rememberAdminDestination(value, storage, origin, now = Date.now()) {
  const url = normalizeAdminDestination(value, origin);
  if (!url || !new URL(url, origin).searchParams.has('section')) return '';
  try { storage?.setItem(ADMIN_RETURN_KEY, JSON.stringify({ url, at: now })); } catch {}
  return url;
}

export function pendingAdminDestination(storage, origin, now = Date.now()) {
  try {
    const saved = JSON.parse(storage?.getItem(ADMIN_RETURN_KEY) || 'null');
    if (!saved || !Number.isFinite(saved.at) || now < saved.at || now - saved.at > MAX_AGE) return '';
    return normalizeAdminDestination(saved.url, origin);
  } catch { return ''; }
}

export function consumeAdminDestination(value, storage, origin) {
  if (pendingAdminDestination(storage, origin) !== normalizeAdminDestination(value, origin)) return;
  try { storage?.removeItem(ADMIN_RETURN_KEY); } catch {}
}

export function adminNotificationLink(record = {}) {
  const url = new URL(normalizeAdminDestination(record.targetUrl) || '/admin?section=notificaciones-push', 'https://tintin.invalid');
  const source = String(record.sourceType || '');
  const sourceId = adminTargetId(record.sourceId);
  let section = '', key = '', id = '';
  if (source === 'order') { section = 'pedidos'; key = 'order'; id = adminTargetId(record.orderId) || sourceId; }
  else if (source === 'wholesale_quote') { section = 'mayoristas'; key = 'quote'; id = sourceId; }
  else if (source === 'user' || source === 'auth') { section = 'usuarios'; key = 'user'; id = sourceId || adminTargetId(record.actorUid); }
  else if (source === 'favorite' || source === 'product_like') { section = 'me-gusta'; key = 'like'; id = sourceId; }
  else if (['review', 'reply', 'review_like', 'reply_like'].includes(source)) {
    section = 'resenas'; key = 'review'; id = adminTargetId(record.reviewId) || (source === 'review' ? sourceId : '');
    const reply = adminTargetId(record.replyId);
    if (reply) url.searchParams.set('reply', reply);
  } else if (source === 'comment_report') { section = 'resenas'; key = 'report'; id = sourceId; }
  if (section) url.searchParams.set('section', section);
  if (key && id) url.searchParams.set(key, id);
  return '/admin.html' + url.search;
}
