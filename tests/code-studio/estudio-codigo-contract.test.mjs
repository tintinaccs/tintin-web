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

test('el Editor de Código ocupa el contenido del Admin con tema claro y contraste aislado', async () => {
  const ui = await read('js/admin/estudio-codigo/estudio-codigo-admin.js');
  const styles = await read('css/admin/estudio-codigo.css');
  const theme = await read('css/core/tema-unificado-tintin.css');
  assert.match(ui, /navButton\.innerHTML = '[^']*Editor de Código'/);
  assert.match(ui, /class="cs-brand">Editor de Código</);
  assert.match(ui, /querySelector\('\.adm-content'\)\?\.appendChild\(section\)/);
  assert.match(ui, /topbarTitle\.textContent = 'Editor de Código'/);
  assert.match(styles, /body\.code-studio-open \.adm-content/);
  assert.match(styles, /--cs-bg:\s*#fffafc/);
  assert.match(styles, /#section-estudio-codigo \.cs-editor[\s\S]*background:\s*#fff !important/);
  assert.match(styles, /container-name:\s*code-studio/);
  assert.match(styles, /@container code-studio \(max-width: 1180px\)/);
  assert.match(styles, /\.cs-github-center\s*\{[\s\S]*position:\s*static/);
  assert.match(ui, /theme:\s*'vs'/);
  assert.doesNotMatch(ui, /theme:\s*'vs-dark'/);
  assert.match(ui, /matchMedia\('\(max-width: 1200px\)'\)[\s\S]*classList\.add\('cs-collapsed'\)/);
  assert.match(theme, /span:not\(\.cs-shell \*\)/);
});

test('Restaurar se instala dentro de la toolbar sin bucle de MutationObserver', async () => {
  const restore = await read('js/admin/estudio-codigo/restaurar-estudio-codigo-admin.js');
  assert.match(restore, /anchor\?\.closest\('\.cs-toolbar'\)/);
  assert.match(restore, /anchor\?\.parentElement === toolbar \? anchor : null/);
  assert.match(restore, /catch \(error\) \{[\s\S]*observer\.disconnect\(\)/);
  assert.doesNotMatch(restore, /top\.insertBefore\(button, pr/);
});

test('si GitHub App no está disponible no se solicita el árbol y se muestra configuración', async () => {
  const ui = await read('js/admin/estudio-codigo/estudio-codigo-admin.js');
  assert.match(ui, /if \(!data\.github\?\.appConfigured\) \{[\s\S]*renderGithubUnavailable\(detail\);[\s\S]*return;/);
  assert.match(ui, /if \(!state\.github\?\.appConfigured\) \{[\s\S]*renderGithubUnavailable/);
  assert.match(ui, /error\.status === 503/);
  assert.match(ui, /Conexión con GitHub pendiente/);
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

test('la fusión se aprueba dentro de Tintin con autenticación reciente y confirmación exacta', async () => {
  const merge = await read('functions/api/code-studio/merge.js');
  const ui = await read('js/admin/estudio-codigo/estudio-codigo-admin.js');
  assert.match(merge, /requireRecentAuthToken/);
  assert.match(merge, /mergePullRequestWithHumanApproval/);
  assert.match(merge, /confirmation/);
  assert.match(ui, /MERGEAR #\$\{number\}/);
  assert.match(ui, /api\(['"]merge/);
  const github = await read('cloudflare/estudio-codigo-github.js');
  assert.match(github, /mergeableState/);
  assert.match(github, /falta una preview o deployment exitoso/);
  assert.doesNotMatch(merge, /approvalToken|HUMAN_APPROVAL_SECRET/);
});

test('preview abre un deployment externo y no inyecta el código modificado en Admin', async () => {
  const ui = await read('js/admin/estudio-codigo/estudio-codigo-admin.js');
  assert.match(ui, /safeExternalHref\(ready\.environmentUrl\)/);
  assert.match(ui, /window\.open\(previewUrl/);
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

test('tiempo real usa un stream SSE autenticado y conserva reconciliación periódica', async () => {
  const api = await read('functions/api/code-studio/[[path]].js');
  const ui = await read('js/admin/estudio-codigo/estudio-codigo-admin.js');
  assert.match(api, /ReadableStream/);
  assert.match(api, /text\/event-stream/);
  assert.match(ui, /response\.body\.getReader/);
  assert.match(ui, /setInterval\(\(\) => \{ if \(state\.visible\) syncState\(\)/);
  assert.doesNotMatch(ui, /eventsTimer/);
});

test('Monaco se sirve localmente y el build genera el artefacto', async () => {
  const ui = await read('js/admin/estudio-codigo/estudio-codigo-admin.js');
  const pkg = JSON.parse(await read('package.json'));
  const sync = await read('scripts/sincronizar-monaco-local.mjs');
  const diagnostics = await read('scripts/construir-manifiesto-diagnostico.js');
  const typography = await read('scripts/auditar-tipografia.js');
  assert.match(ui, /\/js\/vendor\/monaco\/vs/);
  assert.doesNotMatch(ui, /unpkg|jsdelivr|cdnjs/);
  assert.match(pkg.scripts['build:pages'], /^npm run sync:monaco/);
  assert.equal(pkg.devDependencies['monaco-editor'], '0.52.2');
  assert.match(sync, /node_modules\/monaco-editor\/min\/vs/);
  assert.match(diagnostics, /js\/vendor\/monaco/);
  assert.match(typography, /js\/vendor\/monaco/);
});

test('el mapa permite navegar a evidencia exacta y limita enlaces externos', async () => {
  const ui = await read('js/admin/estudio-codigo/estudio-codigo-admin.js');
  assert.match(ui, /revealEditorLocation/);
  assert.match(ui, /EXTERNAL_HOSTS/);
  assert.match(ui, /node\.path/);
  assert.match(ui, /node\.url/);
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
  assert.match(ai, /archivo completo/);
  assert.match(ai, /validateChanges/);
});
