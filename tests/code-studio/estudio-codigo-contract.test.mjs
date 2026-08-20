import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('el Admin carga el Estudio solo desde la superficie privada', async () => {
  const admin = await read('functions/admin.js');
  const injector = await read('cloudflare/inyectar-estudio-codigo-admin.js');
  assert.match(admin, /injectCodeStudioRuntime/);
  assert.match(injector, /\/js\/admin\/estudio-codigo\/estudio-codigo-admin\.js/);
  assert.match(injector, /\/css\/admin\/estudio-codigo\.css/);
});

test('la API code-studio está incluida en Pages Functions', async () => {
  const routes = JSON.parse(await read('_routes.json'));
  assert.ok(routes.include.includes('/api/code-studio/*'));
});

test('el navegador nunca contiene secretos de GitHub App ni PAT', async () => {
  const ui = await read('js/admin/estudio-codigo/estudio-codigo-admin.js');
  const restore = await read('js/admin/estudio-codigo/restaurar-estudio-codigo-admin.js');
  for (const source of [ui, restore]) {
    assert.doesNotMatch(source, /CODE_STUDIO_GITHUB_APP_PRIVATE_KEY/);
    assert.doesNotMatch(source, /CODE_STUDIO_GITHUB_INSTALLATION_ID/);
    assert.doesNotMatch(source, /GITHUB_TOKEN|GH_TOKEN/);
    assert.doesNotMatch(source, /api\.github\.com/);
  }
});

test('las escrituras usan rama aislada, SHA esperado y ref no forzado', async () => {
  const github = await read('cloudflare/estudio-codigo-github.js');
  const core = await read('cloudflare/estudio-codigo-core.js');
  assert.match(core, /\(\?!main\$\)/);
  assert.match(github, /expectedHeadSha/);
  assert.match(github, /verifyBaseFileShas/);
  assert.match(github, /force:\s*false/);
  assert.match(github, /no se sobrescribió nada/);
});

test('la fusión desde el panel está bloqueada y exige revisión humana', async () => {
  const merge = await read('functions/api/code-studio/merge.js');
  const ui = await read('js/admin/estudio-codigo/estudio-codigo-admin.js');
  assert.match(merge, /human_merge_required/);
  assert.match(merge, /403/);
  assert.match(merge, /revisión humana/i);
  assert.doesNotMatch(ui, /api\(['"]merge/);
});

test('preview abre un deployment externo y no inyecta el código modificado en Admin', async () => {
  const ui = await read('js/admin/estudio-codigo/estudio-codigo-admin.js');
  assert.match(ui, /window\.open\(ready\.environmentUrl/);
  assert.doesNotMatch(ui, /eval\s*\(|new Function\s*\(/);
  assert.doesNotMatch(ui, /srcdoc\s*=/);
});

test('webhook verifica HMAC y deduplica X-GitHub-Delivery', async () => {
  const api = await read('functions/api/code-studio/[[path]].js');
  assert.match(api, /x-hub-signature-256/i);
  assert.match(api, /HMAC/);
  assert.match(api, /x-github-delivery/i);
  assert.match(api, /codeStudioEvents/);
});

test('restaurar crea un commit nuevo en una rama y nunca resetea main', async () => {
  const restore = await read('functions/api/code-studio/restore.js');
  assert.match(restore, /commitWorkspaceChanges/);
  assert.match(restore, /restore\(code-studio\)/);
  assert.doesNotMatch(restore, /force:\s*true|reset --hard|refs\/heads\/main/);
});

test('el asistente IA está aislado de commit, merge y deploy', async () => {
  const ai = await read('cloudflare/estudio-codigo-ia.js');
  assert.match(ai, /No podés aprobar, fusionar, desplegar ni publicar/);
  assert.doesNotMatch(ai, /commitWorkspaceChanges|openPullRequest|mergePullRequest|git\/refs/);
});
