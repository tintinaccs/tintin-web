import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const routerPath = resolve(process.cwd(), 'js/quality/integration-router.js');
const source = await readFile(routerPath, 'utf8');

function routeFrom(hostname) {
  const calls = [];
  const window = {
    TINTIN_FUNCTION_ORIGIN: '',
    location: {
      hostname,
      href: `https://${hostname}/`,
    },
    fetch(input, init) {
      calls.push({ input: String(input), init });
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  };
  vm.runInNewContext(source, { window, URL, Response });
  window.fetch('https://script.google.com/macros/s/test-deployment/exec', { method: 'POST' });
  return calls.at(-1)?.input || '';
}

test('github.io y netlify.app se reconocen solo por límites DNS completos', () => {
  assert.equal(
    routeFrom('tienda.github.io'),
    'https://tintinaccesorios.pages.dev/api/apps-script-bridge',
  );
  assert.equal(
    routeFrom('preview.netlify.app'),
    'https://tintinaccesorios.pages.dev/api/apps-script-bridge',
  );

  assert.equal(routeFrom('evilgithub.io'), '/api/apps-script-bridge');
  assert.equal(routeFrom('evilnetlify.app'), '/api/apps-script-bridge');
  assert.equal(routeFrom('github.io.evil.example'), '/api/apps-script-bridge');
  assert.equal(routeFrom('netlify.app.evil.example'), '/api/apps-script-bridge');
});

test('el router no vuelve a usar endsWith con sufijos de hosting públicos', () => {
  assert.doesNotMatch(source, /endsWith\(['"]github\.io['"]\)/);
  assert.doesNotMatch(source, /endsWith\(['"]netlify\.app['"]\)/);
  assert.match(source, /isDomainOrSubdomain/);
});
