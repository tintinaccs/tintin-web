import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProtectedFlows, flowFileHash } from '../../scripts/auditar-proteccion-flujos.mjs';

const baseline = { schemaVersion: 1, files: { 'green.js': flowFileHash('green') }, records: { green: ['green.js'] } };
const copy = () => structuredClone(baseline);
test('un cambio en amarillo no afecta el archivo verde protegido', () => {
  assert.deepEqual(checkProtectedFlows(baseline, copy(), path => path === 'green.js' ? 'green' : 'yellow changed'), []);
});
test('tocar un verde falla incluso si el candidato intenta actualizar la huella', () => {
  const candidate = copy(); candidate.files['green.js'] = flowFileHash('changed');
  const errors = checkProtectedFlows(baseline, candidate, () => 'changed');
  assert.ok(errors.some(error => error.includes('retirar la protección')));
  assert.ok(errors.some(error => error.includes('Archivo protegido modificado')));
});
test('borrar el archivo o su alcance no elude el bloqueo', () => {
  const candidate = copy(); delete candidate.files['green.js']; delete candidate.records.green;
  const errors = checkProtectedFlows(baseline, candidate, () => { throw new Error('absent'); });
  assert.equal(errors.length, 3);
});
test('se pueden agregar nuevos verdes sin cambiar la protección anterior', () => {
  const candidate = copy(); candidate.files['new.js'] = flowFileHash('new'); candidate.records.new = ['new.js'];
  assert.deepEqual(checkProtectedFlows(baseline, candidate, path => path === 'new.js' ? 'new' : 'green'), []);
});
test('una huella nueva falsa y un intento de salir del repositorio fallan', () => {
  const candidate = copy(); candidate.files['new.js'] = flowFileHash('new'); candidate.files['../outside'] = flowFileHash('secret');
  const reads = [];
  const errors = checkProtectedFlows(baseline, candidate, path => { reads.push(path); return 'green'; });
  assert.equal(errors.length, 2); assert.ok(!reads.includes('../outside'));
});
test('las rutas dinámicas de Pages se congelan sin admitir escapes del repositorio', () => {
  const route = 'functions/__/auth/[[path]].js';
  const candidate = copy(); candidate.files[route] = flowFileHash('route'); candidate.records.route = [route];
  const read = path => path === route ? 'route' : 'green';
  assert.deepEqual(checkProtectedFlows(baseline, candidate, read), []);
  assert.deepEqual(checkProtectedFlows(candidate, structuredClone(candidate), read), []);
  assert.ok(checkProtectedFlows(candidate, structuredClone(candidate), () => 'changed').some(e => e.includes('Archivo protegido modificado')));
  for (const path of ['../[[path]].js', '/[[path]].js', 'functions/../../[[path]].js', 'functions\\[[path]].js']) {
    const escape = copy(); escape.files[path] = flowFileHash('route');
    const reads = [];
    assert.ok(checkProtectedFlows(baseline, escape, p => {reads.push(p);return 'green';}).length);
    assert.ok(!reads.includes(path));
  }
});
