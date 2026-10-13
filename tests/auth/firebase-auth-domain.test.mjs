import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inspectFirebaseAuthHelpers } from '../../scripts/lib/auth-helper-health.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = fs.readFileSync(resolve(root, 'js/core/firebase/firebase.js'), 'utf8');
const config = JSON.parse(fs.readFileSync(resolve(root, 'config/public-site.json'), 'utf8'));
const technical = config.technicalFirebaseAuthDomain;
const initialization = source.slice(source.indexOf('const TECHNICAL_FIREBASE_AUTH_DOMAIN'), source.indexOf('// Clave pública'))
  .replace(/export function /g, 'function ');

function initializedDomain(hostname, configuredDomain = config.firebaseAuthDomain, existingDomain = null) {
  let initialized = null;
  const world = vm.createContext({
    window: { location: { hostname } }, getApps: () => existingDomain ? [{}] : [],
    getApp: () => ({ options: { authDomain: existingDomain } }),
    initializeApp: options => { initialized = options; return { options }; },
  });
  vm.runInContext(initialization.replace(/authDomain\s*:\s*(['"])[^'"]+\1/, `authDomain: "${configuredDomain}"`) + ';globalThis.actualDomain = getFirebaseAuthDomain();', world);
  return { actualDomain: world.actualDomain, initialized };
}

test('Pages conserva su proxy Auth exacto con el artefacto anterior y el preparado para cutover', () => {
  for (const canonicalDomain of [technical, config.firebaseAuthDomain]) {
    for (const hostname of [technical, technical.toUpperCase()]) {
      const actual = initializedDomain(hostname, canonicalDomain);
      assert.equal(actual.actualDomain, technical);
      assert.equal(actual.initialized.authDomain, technical);
    }
  }
});

test('dominio final, localhost y previews conservan el authDomain declarado sin autoautorizar hosts', () => {
  for (const canonicalDomain of [technical, config.firebaseAuthDomain]) {
    for (const hostname of ['tintinaccs.com', 'www.tintinaccs.com', 'localhost', '127.0.0.1', 'preview.tintinaccesorios.pages.dev', 'tintinaccesorios.pages.dev.evil.example', 'tintinaccesorios.pages.dev.', 'tintinaccesorios.pages.dev:443', 'unrelated.pages.dev']) {
      assert.equal(initializedDomain(hostname, canonicalDomain).actualDomain, canonicalDomain, hostname);
    }
  }
});

test('el diagnóstico informa la app real reutilizada sin crear otra ni exponer opciones privadas', () => {
  const actual = initializedDomain(technical, config.firebaseAuthDomain, 'existing.example');
  assert.equal(actual.actualDomain, 'existing.example');
  assert.equal(actual.initialized, null);
});

test('el build sincroniza ambos dominios desde config y conserva el técnico al cambiar canonical', () => {
  const cwd = fs.mkdtempSync(resolve(tmpdir(), 'tintin-auth-domain-'));
  try {
    fs.mkdirSync(resolve(cwd, 'config'));
    fs.mkdirSync(resolve(cwd, 'scripts'));
    fs.mkdirSync(resolve(cwd, 'js/core/firebase'), { recursive: true });
    fs.copyFileSync(resolve(root, 'scripts/sincronizar-origen-publico.js'), resolve(cwd, 'scripts/sync.js'));
    fs.writeFileSync(resolve(cwd, 'config/public-site.json'), JSON.stringify(config));
    fs.writeFileSync(resolve(cwd, 'js/core/firebase/firebase.js'), 'const TECHNICAL_FIREBASE_AUTH_DOMAIN = "stale.pages.dev";\nconst firebaseConfig = { authDomain: "old.example" };\nconst canonical = "https://tintinaccesorios.pages.dev";\n');
    for (const args of [[], ['--check']]) {
      const run = spawnSync(process.execPath, ['scripts/sync.js', ...args], { cwd, encoding: 'utf8', env: { ...process.env, TINTIN_PUBLIC_ORIGIN: '', TINTIN_FIREBASE_AUTH_DOMAIN: '' } });
      assert.equal(run.status, 0, run.stderr);
    }
    const output = fs.readFileSync(resolve(cwd, 'js/core/firebase/firebase.js'), 'utf8');
    assert.ok(output.includes(`const TECHNICAL_FIREBASE_AUTH_DOMAIN = "${technical}";`));
    assert.ok(output.includes(`authDomain: "${config.firebaseAuthDomain}"`));
    assert.ok(output.includes(`const canonical = "${config.origin}";`));
    fs.writeFileSync(resolve(cwd, 'config/public-site.json'), JSON.stringify({ ...config, technicalFirebaseAuthDomain: 'unrelated.pages.dev' }));
    const invalid = spawnSync(process.execPath, ['scripts/sync.js'], { cwd, encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
  } finally {
    assert.ok(cwd.startsWith(resolve(tmpdir(), 'tintin-auth-domain-')));
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('el monitor rechaza authDomain inesperado antes de consultar un host ajeno', async () => {
  let calls = 0;
  await assert.rejects(inspectFirebaseAuthHelpers({ authDomain: 'unrelated.example', expectedAuthDomain: technical, fetchImpl: async () => { calls++; } }), /authDomain distinto/);
  assert.equal(calls, 0);
});

test('el monitor exige los helpers reales y falla ante Shopify404, redirect o HTML genérico200', async () => {
  for (const status of [404, 302, 200]) {
    await assert.rejects(inspectFirebaseAuthHelpers({ authDomain: technical, expectedAuthDomain: technical, fetchImpl: async () => new Response('<html>Otra tienda</html>', { status, headers: { 'content-type': 'text/html' } }) }), /Helper Firebase iframe no disponible/);
  }
  const inspected = [];
  const helpers = await inspectFirebaseAuthHelpers({ authDomain: technical, expectedAuthDomain: technical, fetchImpl: async (url, options) => {
    inspected.push(url);
    assert.equal(options.redirect, 'manual');
    const marker = url.endsWith('/iframe') ? 'fireauth.iframe.AuthRelay.initialize' : 'fireauth.oauthhelper.widget.initialize';
    return new Response(`<script>${marker}();</script>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } });
  assert.deepEqual(inspected, [`https://${technical}/__/auth/iframe`, `https://${technical}/__/auth/handler`]);
  assert.deepEqual(helpers.map(item => item.status), [200, 200]);
});

test('el proxy conserva ruta/query y redirects same-origin para Pages y el dominio posterior al corte', async () => {
  const proxySource = fs.readFileSync(resolve(root, 'functions/__/auth/[[path]].js'), 'utf8').replace('export async function ', 'async function ');
  for (const incomingHost of [technical, config.firebaseAuthDomain]) {
    const calls = [];
    const world = vm.createContext({ URL, Headers, Response, fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(null, { status: 302, headers: { location: 'https://tintin-accesorios.firebaseapp.com/__/auth/handler?fixture=1' } });
    } });
    vm.runInContext(proxySource + ';globalThis.proxy = onRequest;', world);
    const response = await world.proxy({ request: new Request(`https://${incomingHost}/__/auth/iframe?fixture=1`) });
    assert.equal(calls[0].url, 'https://tintin-accesorios.firebaseapp.com/__/auth/iframe?fixture=1');
    assert.equal(calls[0].options.redirect, 'manual');
    assert.equal(response.headers.get('location'), `https://${incomingHost}/__/auth/handler?fixture=1`);
  }
});
