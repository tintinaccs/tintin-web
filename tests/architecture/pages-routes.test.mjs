import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { functionRoutes, documentRoutes } = require('../../scripts/lib/rutas-pages.js');

function fixture(t, pages = ['index.html', 'admin.html', '404.html', 'nosotros.html']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tintin-routes-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'functions/api'), { recursive: true });
  for (const page of pages) fs.writeFileSync(path.join(root, page), '');
  return root;
}

test('una API nueva entra al build sin mantener una segunda lista manual', t => {
  const root = fixture(t);
  assert.ok(!functionRoutes(root).include.includes('/api/instagram-feed'));
  fs.writeFileSync(path.join(root, 'functions/api/instagram-feed.js'), '');
  const routes = functionRoutes(root);
  assert.ok(routes.include.includes('/api/instagram-feed'));
  assert.ok(!routes.include.includes('/api/*'));
  assert.ok(!routes.include.includes('/*'));
  assert.deepEqual(routes.exclude, []);
});

test('HTML administrativo y nuevos documentos conservan middleware en ambas URLs', t => {
  const root = fixture(t, ['index.html', 'admin.html', 'nueva.html', 'googleabcdef123.html']);
  const routes = functionRoutes(root).include;
  for (const expected of ['/', '/index.html', '/admin', '/admin.html', '/nueva', '/nueva.html', '/__/auth/*']) assert.ok(routes.includes(expected), expected);
  assert.ok(!routes.includes('/googleabcdef123.html'));
  assert.deepEqual(documentRoutes('admin.html'), ['/admin', '/admin.html']);
});

test('aliases conocidos se compactan sin duplicar reglas ni ampliar APIs', t => {
  const routes = functionRoutes(fixture(t)).include;
  for (const expected of ['/404*', '/nosotros*']) assert.ok(routes.includes(expected));
  for (const removed of ['/404', '/404.html', '/nosotros', '/nosotros.html']) assert.ok(!routes.includes(removed));
  assert.equal(new Set(routes).size, routes.length);
});

test('exceder el límite bloquea el build en lugar de publicar sin protección', t => {
  const root = fixture(t);
  for (let i = 0; i < 100; i++) fs.writeFileSync(path.join(root, `functions/api/action-${i}.js`), '');
  assert.throws(() => functionRoutes(root), /límite de 100 reglas/);
});

test('repositorio real: todas las APIs y los documentos protegidos quedan cubiertos', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const routes = functionRoutes(root).include;
  for (const file of fs.readdirSync(path.join(root, 'functions/api')).filter(file => file.endsWith('.js'))) assert.ok(routes.includes(`/api/${file.slice(0, -3)}`));
  assert.ok(routes.includes('/checkout') && routes.includes('/checkout.html'));
  assert.ok(routes.length <= 100);
});
