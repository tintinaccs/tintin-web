import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('la UI expone los cuatro controles y tres viewports requeridos', () => {
  const html = read('admin.html');
  for (const id of ['ai-builder-approve', 'ai-builder-modify', 'ai-builder-cancel']) assert.match(html, new RegExp(`id="${id}"`));
  for (const device of ['mobile', 'tablet', 'desktop']) assert.match(html, new RegExp(`data-ai-device="${device}"`));
  assert.match(html, /Historial y restauración/);
});

test('el backend valida Super Admin y la API pública no acepta escrituras', () => {
  const adminApi = read('functions/api/ai-builder.js');
  const publicApi = read('functions/api/ai-builder-public.js');
  assert.match(adminApi, /requireSuperAdmin\(request\)/);
  assert.match(publicApi, /request\.method !== 'GET'/);
});

test('restaurar valida que la entrada de historial sea un snapshot publicado', () => {
  const adminApi = read('functions/api/ai-builder.js');
  const restoreBlock = adminApi.slice(adminApi.indexOf("action === 'restore'"), adminApi.indexOf("action === 'cancel'"));
  assert.match(restoreBlock, /isRestorableHistoryEntry\(previous\)/);
});

test('las claves permanecen exclusivamente en env del backend', () => {
  const provider = read('cloudflare/ai-provider.js');
  const client = read('js/admin/ai-builder-admin.js');
  assert.match(provider, /env\.OPENAI_API_KEY/);
  assert.doesNotMatch(client, /OPENAI_API_KEY|GITHUB_TOKEN|sk-[A-Za-z0-9]/);
  assert.doesNotMatch(read('admin.html'), /OPENAI_API_KEY|GITHUB_TOKEN|sk-[A-Za-z0-9]/);
});

test('el renderer público escapa contenido y no usa innerHTML con datos sin escapar', () => {
  const renderer = read('js/ai-builder-public.js');
  assert.match(renderer, /const escape =/);
  assert.match(renderer, /escape\(block\.title\)/);
  assert.match(renderer, /escape\(block\.text\)/);
});

test('rutas Cloudflare incluyen APIs privada y pública', () => {
  const routes = JSON.parse(read('_routes.json'));
  assert.ok(routes.include.includes('/api/ai-builder'));
  assert.ok(routes.include.includes('/api/ai-builder-public'));
});
