'use strict';
// Modo edición en la página real. La sesión del Super Admin y /api/visual-builder
// se simulan: la prueba no toca Firebase ni producción.
const { test, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
let server; let baseUrl;

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root)) { response.writeHead(403); response.end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

const ADMIN_EMAIL = 'tintinaccs@gmail.com';
async function stubSession(page, user = { uid: 'u', email: ADMIN_EMAIL, isAnonymous: false }) {
  const js = body => ({ status: 200, contentType: 'text/javascript', body });
  const userJson = JSON.stringify(user);
  await page.route('**/js/core/firebase/firebase.js*', route => route.fulfill(js(
    `export const auth={currentUser:${userJson}&&{...${userJson},getIdToken:async()=>"tok"}};export const db={};export const provider={};export const appCheck=null;` +
    'export const appCheckReady=Promise.resolve(false);export const authPersistenceReady=Promise.resolve();' +
    'export const getFirebaseAuthDomain=()=>"";export const getAuthPersistenceBackend=()=>"memory";export const inspectAuthPersistenceStorage=()=>({});')));
  await page.route('**/js/core/auth/coordinador-sesion.js*', route => route.fulfill(js(
    `const U=${userJson};export const AUTH_STATES={AUTHENTICATED:"authenticated",UNAUTHENTICATED:"unauthenticated",RESTORING:"restoring",UNKNOWN:"unknown"};` +
    'export function subscribeAuthState(cb){queueMicrotask(()=>cb(U));return()=>{}}' +
    'export function subscribeSession(cb){queueMicrotask(()=>cb({status:U?"authenticated":"unauthenticated",user:U}));return()=>{}}' +
    'export const getSessionUser=()=>U;export const waitForSession=async()=>({status:U?"authenticated":"unauthenticated",user:U});' +
    'export const markExplicitLogout=()=>{};export const clearAuthHandoff=()=>{};export const createAuthHandoff=()=>null;export const readAuthHandoff=()=>null;')));
}

test('Super Admin edita texto, mueve casillas y publica; Cancelar no publica', async ({ page }) => {
  await stubSession(page);
  const posts = [];
  const content = {};
  const sectionOrder = ['hero', 'trust', 'collections_carousel', 'best_sellers', 'editorial_relojes', 'reviews', 'instagram', 'footer'];
  await page.route('**/api/visual-builder-public*', route => route.fulfill({ status: 404, body: '{}' }));
  await page.route(url => new URL(url).pathname === '/api/visual-builder', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({ json: { ok: true, state: { version: 3, config: { pageId: 'index', sections: {}, sectionOrder, customBlocks: [] } }, draft: null, content, contentRevision: 'rev1', history: [] } });
    }
    posts.push(request.postDataJSON());
    return route.fulfill({ json: { ok: true, version: 4 } });
  });
  await page.goto(`${baseUrl}/index.html?ttEdit=1&ttSection=trust`);
  const title = page.locator('.tt-hero-title');
  await expect(title).toHaveAttribute('contenteditable', /plaintext-only|true/, { timeout: 15000 });
  await expect(page.locator('.tt-edit-bar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled();

  await title.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Título nuevo desde la página');
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeEnabled();

  const trustTools = page.locator('.tt-trust-bar > .tt-edit-tools');
  await trustTools.getByRole('button', { name: /Subir/ }).click();
  const before = await page.evaluate(() => [...document.querySelectorAll('main > section, main > div')].map(n => n.dataset.ttSection || n.className.split(' ')[0]));
  expect(before.indexOf('trust') < before.indexOf('hero') || before.indexOf('tt-trust-bar') < before.indexOf('hero')).toBeTruthy();

  await page.getByRole('button', { name: 'Vista previa' }).click();
  await expect(page.locator('.tt-edit-tools').first()).toBeHidden();
  await page.getByRole('button', { name: 'Seguir editando' }).click();

  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toMatchObject({ action: 'publish', pageId: 'index', expectedVersion: 3, expectedContentRevision: 'rev1' });
  expect(posts[0].content.hero.title).toBe('Título nuevo desde la página');
  expect(posts[0].config.sectionOrder.indexOf('trust')).toBeLessThan(posts[0].config.sectionOrder.indexOf('hero'));
});

test('sin sesión de Super Admin el modo edición no se activa', async ({ page }) => {
  await stubSession(page, { uid: 'c', email: 'cliente@example.com', isAnonymous: false });
  await page.goto(`${baseUrl}/index.html?ttEdit=1`);
  await page.waitForTimeout(1500);
  await expect(page.locator('.tt-edit-bar')).toHaveCount(0);
  await expect(page.locator('.tt-hero-title')).not.toHaveAttribute('contenteditable', /.+/);
});

test('Cancelar descarta los cambios y no publica', async ({ page }) => {
  await stubSession(page);
  const posts = [];
  await page.route('**/api/visual-builder-public*', route => route.fulfill({ status: 404, body: '{}' }));
  await page.route(url => new URL(url).pathname === '/api/visual-builder', route => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({ json: { ok: true, state: { version: 3, config: { pageId: 'index', sections: {}, sectionOrder: ['hero', 'trust', 'collections_carousel', 'best_sellers', 'editorial_relojes', 'reviews', 'instagram', 'footer'], customBlocks: [] } }, draft: null, content: {}, contentRevision: 'rev1', history: [] } });
    }
    posts.push(request.postDataJSON());
    return route.fulfill({ json: { ok: true, version: 4 } });
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(`${baseUrl}/index.html?ttEdit=1`);
  const title = page.locator('.tt-hero-title');
  await expect(title).toHaveAttribute('contenteditable', /plaintext-only|true/, { timeout: 15000 });
  await title.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('No debe publicarse');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).not.toHaveURL(/ttEdit=1/);
  expect(posts).toHaveLength(0);
});
