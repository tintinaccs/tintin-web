import { safeVisualColor, safeVisualHref, safeVisualImage } from './visual-builder-core.js';

export const GLOBAL_STUDIO_LIMITS = Object.freeze({ bodyBytes: 192_000, maxPopups: 12, maxCampaigns: 12, maxHistory: 80, maxTargets: 32 });
export const GLOBAL_PAGE_IDS = Object.freeze([
  'index', 'nosotros', 'catalogo', 'collections', 'product', 'checkout', 'login', 'perfil',
  'contact', 'envios', 'faq', 'cambios', 'terminos', 'privacidad', '404',
]);
const DEVICES = ['desktop', 'tablet', 'mobile'];
const PAGE_IDS = new Set(GLOBAL_PAGE_IDS);
const POPUP_KINDS = ['center', 'bottom-sheet', 'top-bar', 'bottom-bar', 'floating'];
const TRIGGERS = ['immediate', 'delay', 'scroll', 'exit'];
const FREQUENCIES = ['always', 'session', 'daily', 'once'];
const ANIMATIONS = ['fade', 'slide-up', 'slide-down', 'zoom', 'pop'];
const EFFECTS = ['none', 'hearts', 'snow', 'sparkles', 'confetti'];
const INTENSITIES = ['low', 'medium', 'high'];

function text(value, max = 1200) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function boolean(value) { return value === true; }
function option(values, value, fallback) { return values.includes(value) ? value : fallback; }
function clamp(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function id(value, fallback) { return text(value || fallback, 64).toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || fallback; }
function safeDate(value) {
  const raw = String(value || '').trim(); if (!raw) return '';
  const date = new Date(raw); return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}
function safePages(raw) {
  if (!Array.isArray(raw) || raw.includes('*')) return ['*'];
  const seen = new Set(); const pages = raw.filter(page => PAGE_IDS.has(page) && !seen.has(page) && seen.add(page)); return pages.length ? pages : ['*'];
}
function safeDevices(raw) {
  if (!Array.isArray(raw)) return [...DEVICES];
  const set = new Set(raw.filter(device => DEVICES.includes(device))); return set.size ? DEVICES.filter(device => set.has(device)) : [...DEVICES];
}
function safeTargetList(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).slice(0, GLOBAL_STUDIO_LIMITS.maxTargets)
    .map(value => text(value, 120).toLowerCase())
    .filter(value => value && /^[a-z0-9áéíóúüñ _.-]+$/i.test(value) && !seen.has(value) && seen.add(value));
}

export function sanitizeGlobalPopup(raw = {}, index = 0) {
  const trigger = option(TRIGGERS, raw.trigger, 'immediate');
  return {
    id: id(raw.id, `popup-${index + 1}`),
    name: text(raw.name || `Pop-up ${index + 1}`, 100),
    enabled: boolean(raw.enabled),
    priority: Math.round(clamp(raw.priority, 0, 100, 50)),
    kind: option(POPUP_KINDS, raw.kind, 'center'),
    title: text(raw.title, 180),
    text: text(raw.text, 1200),
    image: safeVisualImage(raw.image),
    imageAlt: text(raw.imageAlt, 140),
    buttonLabel: text(raw.buttonLabel, 80),
    href: safeVisualHref(raw.href, ''),
    trigger,
    triggerValue: trigger === 'scroll' ? clamp(raw.triggerValue, 5, 95, 40) : trigger === 'delay' ? clamp(raw.triggerValue, 0, 120, 3) : 0,
    frequency: option(FREQUENCIES, raw.frequency, 'session'),
    pages: safePages(raw.pages),
    devices: safeDevices(raw.devices),
    productIds: safeTargetList(raw.productIds),
    categories: safeTargetList(raw.categories),
    startAt: safeDate(raw.startAt),
    endAt: safeDate(raw.endAt),
    background: safeVisualColor(raw.background),
    textColor: safeVisualColor(raw.textColor),
    accentColor: safeVisualColor(raw.accentColor),
    animation: option(ANIMATIONS, raw.animation, 'fade'),
  };
}

export function sanitizeGlobalCampaign(raw = {}, index = 0) {
  return {
    id: id(raw.id, `campaign-${index + 1}`),
    name: text(raw.name || `Campaña ${index + 1}`, 100),
    enabled: boolean(raw.enabled),
    priority: Math.round(clamp(raw.priority, 0, 100, 50)),
    startAt: safeDate(raw.startAt),
    endAt: safeDate(raw.endAt),
    effect: option(EFFECTS, raw.effect, 'none'),
    intensity: option(INTENSITIES, raw.intensity, 'medium'),
    announcement: text(raw.announcement, 220),
    href: safeVisualHref(raw.href, ''),
    closable: raw.closable !== false,
    background: safeVisualColor(raw.background),
    textColor: safeVisualColor(raw.textColor),
    accentColor: safeVisualColor(raw.accentColor),
  };
}

export function sanitizeGlobalStudioConfig(raw = {}) {
  const popupSeen = new Set(); const campaignSeen = new Set();
  const popups = (Array.isArray(raw.popups) ? raw.popups : []).slice(0, GLOBAL_STUDIO_LIMITS.maxPopups)
    .map(sanitizeGlobalPopup).filter(item => !popupSeen.has(item.id) && popupSeen.add(item.id));
  const campaigns = (Array.isArray(raw.campaigns) ? raw.campaigns : []).slice(0, GLOBAL_STUDIO_LIMITS.maxCampaigns)
    .map(sanitizeGlobalCampaign).filter(item => !campaignSeen.has(item.id) && campaignSeen.add(item.id));
  return { popups, campaigns };
}

export function isGlobalStudioActiveWindow(item, now = Date.now()) {
  if (!item?.enabled) return false;
  const start = item.startAt ? new Date(item.startAt).getTime() : -Infinity;
  const end = item.endAt ? new Date(item.endAt).getTime() : Infinity;
  if ((!Number.isFinite(start) && start !== -Infinity) || (!Number.isFinite(end) && end !== Infinity)) return false;
  return now >= start && now <= end;
}

export function pickHighestPriority(items = [], now = Date.now()) {
  return items.filter(item => isGlobalStudioActiveWindow(item, now)).sort((a, b) => {
    const priority = Number(b.priority || 0) - Number(a.priority || 0);
    if (priority) return priority;
    const startA = a.startAt ? new Date(a.startAt).getTime() : 0;
    const startB = b.startAt ? new Date(b.startAt).getTime() : 0;
    return startB - startA;
  })[0] || null;
}

export function isRestorableGlobalHistory(entry) {
  return Boolean(entry) && ['publish', 'restore'].includes(entry.action) && Number(entry.version) > 0 && entry.snapshot && typeof entry.snapshot === 'object';
}
