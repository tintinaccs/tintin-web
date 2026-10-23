import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { assetAllowed, renderPreview, previewCSP } from '../../scripts/lib/vista-previa.mjs';
import previewWorker from '../../scripts/preview-worker.js';
const { parse } = createRequire(import.meta.url)('parse5');

test('vista previa conserva marcado y fuentes CSS sin ejecutar controladores comerciales', () => {
  const html = renderPreview(fs.readFileSync('checkout.html', 'utf8'), 'checkout');
  assert.match(html, /id="panel-4"/);
  assert.match(html, /id="tt-header-desktop-tablet"/);
  assert.doesNotMatch(html, /file:\/\/|firebasejs|src="[^" ]*pedido-checkout/);
  const scripts = [];
  function inspect(node) {
    if (node.tagName === 'script') scripts.push(node.attrs.find(a => a.name === 'src')?.value);
    for (const attr of node.attrs || []) assert.ok(!/^on/i.test(attr.name), attr.name);
    node.childNodes?.forEach(inspect); if (node.content) inspect(node.content);
  }
  inspect(parse(html));
  assert.deepEqual(scripts, ['/__preview/client.js']);
  assert.match(html, /href="styles.css"/);
});
test('vista previa usa CSS fuente de Inicio y quita handlers, redirecciones y formularios externos', () => {
  const source = fs.readFileSync('index.html', 'utf8');
  const html = renderPreview(source, 'index');
  assert.doesNotMatch(html, /tt-bundled-stylesheet|href="css\/generated\/inicio.css/);
  const malicious = renderPreview('<html><head><base href="https://example.test"><meta http-equiv="refresh" content="0;url=https://example.test"></head><body><iframe src="https://example.test"></iframe><a href="javascript:alert(1)" onclick="evil()">X</a><form action="https://example.test"><button formaction="https://example.test">Y</button></form></body></html>', 'index');
  assert.doesNotMatch(malicious, /<iframe|<base|http-equiv|\sonclick|javascript:|\sformaction|\saction="/);
  assert.match(previewCSP, /connect-src 'self'; form-action 'none'/);
  assert.match(previewCSP, /worker-src 'none'/);
});
test('ni los SDK, ni workers, ni credenciales ni APIs son assets de la vista previa', () => {
  for (const file of ['js/core/firebase/firebase.js', 'functions/api/apps-script-bridge.js', 'firebase-messaging-sw.js', '.env', 'api/public-catalog', 'config/public-site.json', 'scripts/preview-worker.js']) assert.equal(assetAllowed(file), false, file);
  assert.equal(assetAllowed('css/pages/checkout/checkout.css'), true);
  assert.equal(assetAllowed('__preview/client.js'), true);
});

test('worker publicado bloquea APIs y mutaciones antes de resolver assets y aplica la misma CSP', async () => {
  let accesses = 0;
  const env = {ASSETS:{fetch:async () => {accesses++; return new Response('<html>visual</html>', {headers:{'content-type':'text/html'}});}}};
  for (const [pathname, method] of [['/api/apps-script-bridge','POST'],['/api/public-catalog','GET'],['/__/auth/handler','GET'],['/checkout','POST'],['/','DELETE']]) {
    const response = await previewWorker.fetch(new Request(`https://preview.example.test${pathname}`, {method}), env);
    assert.equal(response.status, 403);
  }
  assert.equal(accesses, 0);
  const response = await previewWorker.fetch(new Request('https://preview.example.test/checkout'), env);
  assert.equal(response.status, 200);
  assert.equal(accesses, 1);
  assert.equal(response.headers.get('content-security-policy'), previewCSP);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
