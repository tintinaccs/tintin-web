import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { recordFiles, fingerprint, checkSeal, applySeal, buildSeal, shaMapFromManifest } from '../../js/admin/flujo-conexiones/sellos-flujo.js';

const ESTADOS = { PROD: 'FUNCIONANDO EN PRODUCCIÓN', NO_VERIFICADO: 'IMPLEMENTADO PERO NO VERIFICADO', ERROR: 'CON ERROR' };
const nodes = {
  a: { id: 'a', evidence: [{ file: 'login.html' }, { file: 'tests/' }] },
  b: { id: 'b', evidence: [{ file: 'js/x.js' }] },
};

test('los archivos de una conexión incluyen sus extremos y excluyen carpetas', () => {
  assert.deepEqual(recordFiles(nodes.a), ['login.html']);
  assert.deepEqual(recordFiles({ id: 'e', from: 'a', to: 'b', evidence: [{ file: 'firestore.rules' }] }, nodes), ['firestore.rules', 'js/x.js', 'login.html']);
});

test('sellado y sin cambios queda verde aunque no se revalide', () => {
  const sha = { 'login.html': 'h1' };
  const seal = buildSeal(['login.html'], sha, { sealedAt: '2026-10-01T10:00:00Z', sealedBy: 'super' });
  assert.ok(Array.isArray(seal.files), 'la huella se guarda como lista (Firestore no admite puntos en claves)');
  const check = checkSeal(seal, fingerprint(['login.html'], sha));
  assert.equal(check.intact, true);
  assert.equal(applySeal(ESTADOS.NO_VERIFICADO, check, undefined, ESTADOS), ESTADOS.PROD);
});

test('si se toca el código del flujo sellado vuelve a amarillo aunque el live responda', () => {
  const seal = buildSeal(['login.html'], { 'login.html': 'h1' }, { sealedAt: 'x' });
  const check = checkSeal(seal, fingerprint(['login.html'], { 'login.html': 'h2' }));
  assert.equal(check.intact, false);
  assert.deepEqual(check.changed, ['login.html']);
  assert.equal(applySeal(ESTADOS.PROD, check, { ok: true }, ESTADOS), ESTADOS.NO_VERIFICADO);
});

test('una prueba en vivo que falla siempre se muestra, con o sin sello', () => {
  const seal = buildSeal(['login.html'], { 'login.html': 'h1' }, {});
  const check = checkSeal(seal, { 'login.html': 'h1' });
  assert.equal(applySeal(ESTADOS.ERROR, check, { ok: false, status: 500 }, ESTADOS), ESTADOS.ERROR);
  // 401/403 no es un fallo del flujo: el sello se respeta.
  assert.equal(applySeal(ESTADOS.NO_VERIFICADO, check, { ok: false, status: 401, authRequired: true }, ESTADOS), ESTADOS.PROD);
});

test('sin sello no cambia nada; el manifiesto se traduce a huellas', () => {
  assert.equal(applySeal(ESTADOS.NO_VERIFICADO, null, undefined, ESTADOS), ESTADOS.NO_VERIFICADO);
  assert.equal(checkSeal(null, {}), null);
  assert.deepEqual(shaMapFromManifest({ files: [{ path: 'a.js', sha256: 's' }, { path: 'b' }] }), { 'a.js': 's' });
});

test('huellas ausentes nunca certifican un sello intacto', () => {
  assert.throws(() => buildSeal(['missing.js'], {}, {}), /huellas completas/);
  assert.throws(() => buildSeal([], {}, {}), /huellas completas/);
  const legacy = { files: [{ path: 'missing.js', sha: null }] };
  assert.equal(checkSeal(legacy, { 'missing.js': null }).intact, false);
  assert.equal(checkSeal({ files: [] }, {}).intact, false);
});

test('el manifiesto incluye la huella vigente de los headers que protegen CSP', () => {
  const root = new URL('../../', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('diagnostic-manifest.json', root), 'utf8'));
  const headers = fs.readFileSync(new URL('_headers', root), 'utf8').replace(/\r\n?/g, '\n');
  assert.equal(shaMapFromManifest(manifest)._headers, crypto.createHash('sha256').update(headers).digest('hex'));
});
