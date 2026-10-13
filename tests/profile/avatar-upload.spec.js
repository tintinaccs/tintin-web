const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../js/quality/estabilidad-final-publica.js'), 'utf8');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxioAAAAASUVORK5CYII=', 'base64');
const photoURL = 'https://res.cloudinary.com/avatar-test/image/upload/v1/tintin_profile_test.png';
const origin = 'http://127.0.0.1:4173';

async function fixture(page, { width = 390, status = 200 } = {}) {
  await page.setViewportSize({ width, height: 844 });
  const uploads = [];
  const unexpected = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.authWrites = [];
    window.profileWrites = [];
    window.alerts = [];
    window.alert = message => window.alerts.push(message);
  });
  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const javascript = body => route.fulfill({ contentType: 'text/javascript', body });
    if (url.origin === origin && url.pathname === '/perfil') {
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body>
        <div class="perfil-wrap"><div class="tt-profile-hero"><div id="perfil-avatar"></div>
        <button class="tt-profile-photo-btn">Cambiar foto</button><input id="perfil-photo-input" type="file" accept="image/jpeg,image/png,image/webp"></div>
        <nav class="tt-profile-tabs"><button data-profile-tab="datos">Datos</button></nav><div data-profile-panel="datos">Tu perfil</div></div>
        <script type="module" src="/js/quality/estabilidad-final-publica.js"></script></body></html>` });
    }
    if (url.origin === origin && url.pathname === '/js/quality/estabilidad-final-publica.js') return javascript(source);
    if (url.origin === origin && url.pathname === '/js/core/firebase/firebase.js') return javascript('export const db = {};');
    if (url.hostname === 'www.gstatic.com' && url.pathname.endsWith('/firebase-auth.js')) return javascript('export async function updateProfile(user, fields) { window.authWrites.push({ uid: user.uid, fields }); }');
    if (url.hostname === 'www.gstatic.com' && url.pathname.endsWith('/firebase-firestore.js')) return javascript(`
      export const doc = (_db, collection, uid) => ({ collection, uid });
      export const serverTimestamp = () => 'test-server-time';
      export async function setDoc(ref, fields, options) { window.profileWrites.push({ ref, fields, options }); }`);
    if (url.origin === origin && url.pathname === '/js/core/auth/coordinador-sesion.js') return javascript(`
      export const AUTH_STATES = { UNKNOWN: 'unknown' };
      export async function waitForSession() { return { status: 'authenticated', user: { uid: 'client-uid', getIdToken: async () => 'test-token' } }; }`);
    if (url.origin === origin && url.pathname === '/js/pages/profile/estado-pedidos-perfil.js') return javascript('');
    if (url.origin === origin && url.pathname === '/api/profile-avatar-upload') {
      uploads.push({ method: req.method(), headers: req.headers(), bytes: req.postDataBuffer() });
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { ok: true, secure_url: photoURL } : { error: 'La foto debe pesar como máximo 5 MB' }) });
    }
    if (req.url() === photoURL && req.method() === 'GET') return route.fulfill({ contentType: 'image/png', body: png });
    unexpected.push(`${req.method()} ${req.url()}`);
    return route.abort();
  });
  await page.goto(`${origin}/perfil`);
  await expect(page.locator('body')).toHaveAttribute('data-tt-profile-bound', '1');
  return { uploads, unexpected, errors };
}

for (const width of [390, 1440]) {
  test(`avatar envía archivo real una vez y confirma perfil en ${width}px`, async ({ page }) => {
    const state = await fixture(page, { width });
    await page.locator('#perfil-photo-input').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('#perfil-avatar img')).toHaveAttribute('src', photoURL);
    await expect(page.locator('.tt-profile-photo-btn')).toBeEnabled();
    expect(state.uploads).toHaveLength(1);
    expect(state.uploads[0].method).toBe('POST');
    expect(state.uploads[0].headers.authorization).toBe('Bearer test-token');
    expect(state.uploads[0].headers['content-type']).toBe('image/png');
    expect(state.uploads[0].bytes.equals(png)).toBe(true);
    const writes = await page.evaluate(() => ({ auth: window.authWrites, profile: window.profileWrites, alerts: window.alerts }));
    expect(writes.auth).toEqual([{ uid: 'client-uid', fields: { photoURL } }]);
    expect(writes.profile).toEqual([{ ref: { collection: 'users', uid: 'client-uid' }, fields: { avatarURL: photoURL, photoURL, updatedAt: 'test-server-time' }, options: { merge: true } }]);
    expect(writes.alerts).toEqual([]);
    expect(await page.locator('#perfil-photo-input').inputValue()).toBe('');
    expect(state.unexpected).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

test('rechazo servidor conserva perfil y deja reintentar la foto', async ({ page }) => {
  const state = await fixture(page, { status: 413 });
  await page.locator('#perfil-photo-input').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png });
  await expect.poll(() => page.evaluate(() => window.alerts)).toEqual(['La foto debe pesar como máximo 5 MB']);
  await expect(page.locator('.tt-profile-photo-btn')).toBeEnabled();
  expect(state.uploads).toHaveLength(1);
  expect(await page.evaluate(() => window.authWrites)).toEqual([]);
  expect(await page.evaluate(() => window.profileWrites)).toEqual([]);
  await expect(page.locator('#perfil-avatar img')).toHaveCount(0);
  expect(await page.locator('#perfil-photo-input').inputValue()).toBe('');
  expect(state.unexpected).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('archivo cliente mayor a 5 MiB se rechaza antes de pedir sesión o subir', async ({ page }) => {
  const state = await fixture(page);
  await page.locator('#perfil-photo-input').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect.poll(() => page.evaluate(() => window.alerts)).toEqual(['Elegí una imagen JPG, PNG o WEBP de hasta 5 MB.']);
  await expect(page.locator('.tt-profile-photo-btn')).toBeEnabled();
  expect(state.uploads).toEqual([]);
  expect(await page.evaluate(() => window.authWrites)).toEqual([]);
  expect(await page.evaluate(() => window.profileWrites)).toEqual([]);
  expect(state.unexpected).toEqual([]);
  expect(state.errors).toEqual([]);
});
