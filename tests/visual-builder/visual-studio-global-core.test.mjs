import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GLOBAL_PAGE_IDS,
  GLOBAL_STUDIO_LIMITS,
  isGlobalStudioActiveWindow,
  pickHighestPriority,
  sanitizeGlobalCampaign,
  sanitizeGlobalPopup,
  sanitizeGlobalStudioConfig,
} from '../../cloudflare/visual-studio-global-core.js';

test('pop-ups globales solo conservan formatos, triggers, páginas y dispositivos permitidos', () => {
  const popup = sanitizeGlobalPopup({
    id: '../evil', enabled: true, priority: 999, kind: 'script', trigger: 'javascript', frequency: 'forever',
    pages: ['product', 'checkout', 'admin', 'product'], devices: ['mobile', 'watch'], href: 'javascript:alert(1)',
    productIds: ['ABC-1', '<script>', 'abc-1'], categories: ['Relojes', '"><img>', 'relojes'],
  });
  assert.equal(popup.id, 'evil');
  assert.equal(popup.priority, 100);
  assert.equal(popup.kind, 'center');
  assert.equal(popup.trigger, 'immediate');
  assert.equal(popup.frequency, 'session');
  assert.deepEqual(popup.pages, ['product', 'checkout']);
  assert.deepEqual(popup.devices, ['mobile']);
  assert.equal(popup.href, '');
  assert.deepEqual(popup.productIds, ['abc-1']);
  assert.deepEqual(popup.categories, ['relojes']);
});

test('enlaces opcionales no inventan destinos', () => {
  assert.equal(sanitizeGlobalCampaign({ href: '' }).href, '');
  assert.equal(sanitizeGlobalPopup({ href: '' }).href, '');
  assert.equal(sanitizeGlobalCampaign({ href: 'catalogo.html' }).href, 'catalogo.html');
  assert.equal(sanitizeGlobalPopup({ href: 'https://tintinaccs.com' }).href, 'https://tintinaccs.com');
});

test('segmentación global reconoce páginas comerciales además de páginas de contenido', () => {
  for (const required of ['index', 'catalogo', 'collections', 'product', 'checkout', 'login', 'perfil']) {
    assert.ok(GLOBAL_PAGE_IDS.includes(required), `${required} debe estar registrado`);
  }
});

test('campañas saneadas no aceptan efectos ni colores arbitrarios', () => {
  const campaign = sanitizeGlobalCampaign({
    enabled: true, priority: -5, effect: 'fire', intensity: 'extreme', background: 'url(evil)', textColor: '#AABBCC',
    href: 'javascript:alert(1)', closable: false,
  });
  assert.equal(campaign.priority, 0);
  assert.equal(campaign.effect, 'none');
  assert.equal(campaign.intensity, 'medium');
  assert.equal(campaign.background, '');
  assert.equal(campaign.textColor, '#aabbcc');
  assert.equal(campaign.href, '');
  assert.equal(campaign.closable, false);
});

test('configuración global limita cantidad y deduplica ids', () => {
  const popups = Array.from({ length: GLOBAL_STUDIO_LIMITS.maxPopups + 5 }, (_, index) => ({ id: index < 2 ? 'same' : `p-${index}`, enabled: true }));
  const campaigns = Array.from({ length: GLOBAL_STUDIO_LIMITS.maxCampaigns + 5 }, (_, index) => ({ id: index < 2 ? 'same-c' : `c-${index}`, enabled: true }));
  const clean = sanitizeGlobalStudioConfig({ popups, campaigns });
  assert.ok(clean.popups.length <= GLOBAL_STUDIO_LIMITS.maxPopups);
  assert.ok(clean.campaigns.length <= GLOBAL_STUDIO_LIMITS.maxCampaigns);
  assert.equal(clean.popups.filter(item => item.id === 'same').length, 1);
  assert.equal(clean.campaigns.filter(item => item.id === 'same-c').length, 1);
});

test('ventanas temporales respetan inicio y fin', () => {
  const now = Date.parse('2026-08-10T15:00:00.000Z');
  assert.equal(isGlobalStudioActiveWindow({ enabled: true, startAt: '2026-08-10T14:00:00.000Z', endAt: '2026-08-10T16:00:00.000Z' }, now), true);
  assert.equal(isGlobalStudioActiveWindow({ enabled: true, startAt: '2026-08-10T16:01:00.000Z' }, now), false);
  assert.equal(isGlobalStudioActiveWindow({ enabled: true, endAt: '2026-08-10T14:59:00.000Z' }, now), false);
  assert.equal(isGlobalStudioActiveWindow({ enabled: false }, now), false);
});

test('si coinciden campañas gana prioridad y luego la más recientemente iniciada', () => {
  const now = Date.parse('2026-08-10T15:00:00.000Z');
  const winner = pickHighestPriority([
    { id: 'a', enabled: true, priority: 50, startAt: '2026-08-01T00:00:00.000Z' },
    { id: 'b', enabled: true, priority: 80, startAt: '2026-07-01T00:00:00.000Z' },
    { id: 'c', enabled: true, priority: 80, startAt: '2026-08-05T00:00:00.000Z' },
    { id: 'future', enabled: true, priority: 100, startAt: '2026-09-01T00:00:00.000Z' },
  ], now);
  assert.equal(winner.id, 'c');
});
