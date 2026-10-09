const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const withoutImports = code => code.replace(/^import\s[\s\S]*?;\s*$/gm, '').replace(/^export /gm, '');
const profile = read('perfil.html');
const code = withoutImports(profile.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
const identity = withoutImports(read('js/pages/profile/estado-canonico-perfil.mjs'));

async function fixture(page, width) {
  const height = { 320: 568, 390: 844, 768: 1024, 1024: 768, 1280: 720, 1440: 900, 1920: 1080 }[width];
  await page.setViewportSize({ width, height });
  await page.route('**/*.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.route('**/perfil.html', route => route.fulfill({
    contentType: 'text/html',
    body: profile.replace(/<script\b[\s\S]*?<\/script>/gi, ''),
  }));
  await page.goto('/perfil.html');
  await page.addScriptTag({ content: identity + `
    const auth = { currentUser: null }, db = {};
    const subscribeAuthState = callback => { window.changeUser = user => { auth.currentUser = user; callback(user); }; };
    const readAuthHandoff = () => window.handoff;
    const createAuthHandoff = () => {};
    const logoutSession = async () => {};
    const doc = (_db, _collection, uid) => uid;
    const getDoc = uid => new Promise((resolve, reject) => { (window.profileReads ||= {})[uid] = {resolve, reject}; });
    const getUserRole = () => new Promise(() => {});
    const ROLE_LABELS = {}, SUPER_ADMIN = 'owner@example.com';
    const syncCartToFirestore = async () => {};
    const sanitizeImageUrl = value => value;
    const createLocationMap = async () => ({}), renderSavedMapPreviews = () => {};
    const MAX_SAVED_LOCATIONS = 5, readAddressBook = () => [];
    const accountAccessSummary = () => ({ current: 'Google', methods: 'Google' });
    const DEFAULT_COUNTRY = 'PY', phoneKey = value => String(value);
    const showBlockedModal = () => { window.blocked = true; };
    const setDoc = async () => { window.writes = (window.writes || 0) + 1; };
    const serverTimestamp = () => ({});
    window.profileUser = uid => ({ uid, email: uid + '@example.com', displayName: 'Auth ' + uid, getIdTokenResult: () => new Promise(() => {}) });
    window.resolveProfile = (uid, data) => window.profileReads[uid].resolve({ exists: () => true, data: () => data });
  ` + code });
}

for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
  test(`perfil conserva geometría y datos disponibles mientras actualiza · ${width}`, async ({ page }) => {
    await fixture(page, width);
    const initial = await page.locator('.perfil-wrap').boundingBox();
    await expect(page.locator('.tt-profile-hero')).toBeVisible();
    await expect(page.locator('[data-profile-tab]')).toHaveCount(6);
    await expect(page.locator('[data-profile-panel="datos"]')).toBeVisible();
    await page.evaluate(() => {
      window.handoff = { uid: 'client', profile: { name: 'Ana Ruiz', phone: '595912345678', username: 'ana' } };
      window.changeUser(window.profileUser('client'));
    });
    await expect(page.locator('#perfil-nombre')).toHaveValue('Ana Ruiz');
    await expect(page.locator('#perfil-tel')).toHaveValue('912345678');
    await expect(page.locator('#btn-guardar-perfil')).toBeDisabled();
    await page.locator('#perfil-nombre').fill('Ana editando');
    await page.evaluate(() => window.resolveProfile('client', { name: 'Ana confirmada', phone: '595912345678', username: 'ana', role: 'client' }));
    await expect(page.locator('#perfil-nombre-display')).toHaveText('Ana confirmada');
    await expect(page.locator('#perfil-nombre')).toHaveValue('Ana editando');
    // Neither a slow role lookup nor slow token claims hold up the form.
    await expect(page.locator('#btn-guardar-perfil')).toBeEnabled();
    await expect(page.locator('#btn-reintentar-perfil')).toBeHidden();
    await expect(page.locator('[data-profile-orders-badge]')).toBeHidden();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('tintin:profile-data', { detail: { uid: 'client', profile: { name: 'Ana en vivo', phone: '595911111111', username: 'ana' } } })));
    await expect(page.locator('#perfil-nombre')).toHaveValue('Ana editando');
    await expect(page.locator('#perfil-tel')).toHaveValue('911111111');
    const final = await page.locator('.perfil-wrap').boundingBox();
    expect(final.x).toBeCloseTo(initial.x, 0);
    expect(final.width).toBeCloseTo(initial.width, 0);
    const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, top: document.querySelector('.perfil-back').getBoundingClientRect().top }));
    expect(geometry.overflow).toBe(false);
    expect(geometry.top).toBeGreaterThanOrEqual(width >= 768 ? 112 : 32);
  });
}

test('cambiar de cuenta descarta caché, lecturas tardías y permisos anteriores', async ({ page }) => {
  await fixture(page, 1440);
  await page.evaluate(() => {
    window.handoff = { uid: 'old', profile: { name: 'Cuenta anterior', phone: '595911111111' } };
    window.changeUser(window.profileUser('old'));
    window.changeUser(window.profileUser('new'));
    window.resolveProfile('old', { name: 'No debe aparecer', role: 'admin' });
  });
  await expect(page.locator('#perfil-nombre')).toHaveValue('Auth new');
  await expect(page.locator('#perfil-tel')).toHaveValue('');
  await expect(page.locator('#btn-guardar-perfil')).toBeDisabled();
  await page.evaluate(() => window.resolveProfile('new', { name: 'Cuenta nueva', blocked: true }));
  await expect.poll(() => page.evaluate(() => window.blocked)).toBe(true);
  await expect(page.locator('#btn-guardar-perfil')).toBeDisabled();
  expect(await page.evaluate(() => window.writes || 0)).toBe(0);
});

test('error conserva datos, impide guardar y permite reintentar', async ({ page }) => {
  await fixture(page, 390);
  await page.evaluate(() => {
    window.handoff = { uid: 'client', profile: { name: 'Ana guardada' } };
    window.changeUser(window.profileUser('client'));
    window.profileReads.client.reject({ code: 'permission-denied' });
  });
  await expect(page.locator('#perfil-nombre')).toHaveValue('Ana guardada');
  await expect(page.locator('#btn-guardar-perfil')).toBeDisabled();
  await expect(page.locator('#btn-reintentar-perfil')).toBeVisible();
  await page.locator('#btn-reintentar-perfil').click();
  await page.evaluate(() => window.resolveProfile('client', { name: 'Ana recuperada' }));
  await expect(page.locator('#perfil-nombre-display')).toHaveText('Ana recuperada');
  await expect(page.locator('#btn-guardar-perfil')).toBeEnabled();
});
