import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const api = read('functions/api/visual-builder.js');
const publicApi = read('functions/api/visual-builder-public.js');
const runtime = read('js/core/store/editor-visual-runtime.js');
const content = read('js/core/store/contenido-sitio.js');
const admin = read('js/admin/appearance/editor-visual-admin.js');
const rules = read('firestore.rules');
const coreServer = read('cloudflare/visual-builder-core.js');
const bootstrap = read('js/visual-builder-bootstrap.js');
const lightweightPages = read('functions/[page].js');

test('whitelist de tipos de bloque y opciones de estilo tiene una única fuente compartida', () => {
  assert.ok(coreServer.includes('contratos-visual-builder.js'), 'el servidor debe importar el contrato compartido');
  assert.ok(runtime.includes('contratos-visual-builder.js'), 'el runtime debe importar el contrato compartido');
  assert.doesNotMatch(coreServer, /VISUAL_BLOCK_TYPES = Object\.freeze\(\[\s*\n\s*'banner'/);
  assert.doesNotMatch(runtime, /BLOCK_TYPES = new Set\(\[\s*\n\s*'banner'/);
});

test('backend exige Super Admin, origen y tope de body', () => {
  assert.match(api, /originIsAllowed/); assert.match(api, /requireSuperAdmin/); assert.match(api, /VISUAL_BUILDER_LIMITS\.bodyBytes/);
});

test('publicación y restore son commits atómicos versionados', () => {
  assert.match(api, /firestoreAdminCommit/); assert.match(api, /expectedVersion/); assert.match(api, /version_conflict/);
  assert.match(api, /expectedContentRevision/); assert.match(api, /currentDocument/);
  assert.match(api, /isRestorableVisualHistory/); assert.match(api, /visualBuilderHistory/); assert.match(api, /site_content/);
});

test('colecciones privadas quedan denegadas a navegadores', () => {
  for (const name of ['visualBuilderPages', 'visualBuilderDrafts', 'visualBuilderHistory']) {
    assert.match(rules, new RegExp(`match \\/${name}\\/\\{[^}]+\\}[\\s\\S]{0,80}allow read, write: if false`));
  }
});

test('runtime usa DOM seguro y el contenido mantiene nodos de texto', () => {
  assert.doesNotMatch(runtime, /innerHTML\s*=/); assert.match(runtime, /document\.createElement/); assert.match(runtime, /textContent/);
  assert.match(content, /document\.createTextNode/); assert.match(runtime, /applyVisualContentPreview/);
});

test('el primer frame espera la configuración visual para evitar saltos de geometría', () => {
  assert.match(bootstrap, /await initVisualBuilderRuntime\(pageId\)/);
  assert.match(bootstrap, /loader\.beginWait\(\)/);
  assert.match(bootstrap, /loader\.endWait/);
  assert.match(bootstrap, /classList\.remove\('tt-vb-layout-pending'\)/);
  assert.match(lightweightPages, /tt-vb-layout-pending/);
  assert.match(lightweightPages, /tt-vb-layout-guard/);
  assert.match(lightweightPages, /markVisualLayoutPending/);
});

test('preview solo acepta postMessage same-origin del padre', () => {
  assert.match(runtime, /event\.origin !== location\.origin/); assert.match(runtime, /event\.source !== window\.parent/);
  assert.match(runtime, /event\.source !== window\.parent/); assert.match(admin, /postMessage\([\s\S]*location\.origin/);
});

test('preview de Producto resuelve una sola muestra real antes de cargar el iframe', () => {
  assert.match(admin, /previewProductSample=chooseRandomPreviewProduct/);
  assert.match(admin, /productPreviewTarget\(basePath,previewProductSample\)/);
  assert.match(admin, /await loadPreview\(\)/);
  assert.match(admin, /Muestra:/);
});

test('inspector ignora selecciones atrasadas o inexistentes de la vista previa', () => {
  assert.match(runtime, /type: 'tintin:visual-select', pageId/);
  assert.match(admin, /event\.source!==\$\('visual-preview-frame'\)\?\.contentWindow/);
  assert.match(admin, /event\.data\.pageId!==pageId/);
  assert.match(admin, /if\(!selectionExists\(next\)\)return/);
  assert.match(admin, /schema\?\.fields\|\|\[\]/);
});

test('API pública devuelve configuración nuevamente saneada y sin secretos', () => {
  assert.match(publicApi, /sanitizeVisualConfig/); assert.match(publicApi, /cache-control/);
  assert.doesNotMatch(publicApi + runtime + admin, /OPENAI_API_KEY|FIREBASE_SERVICE_ACCOUNT_KEY\s*=/);
});
