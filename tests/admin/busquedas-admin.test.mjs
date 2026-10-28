import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeAdminSearch, debounceAdminSearch } from '../../js/admin/datos/busqueda-admin.mjs';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('búsqueda administrativa compara tildes, espacios y valores históricos sin cambiar los datos', () => {
  const name = '  Ámelys\t  Reloj  ';
  assert.equal(normalizeAdminSearch(name), 'amelys reloj');
  assert.equal(name, '  Ámelys\t  Reloj  ');
  assert.equal(normalizeAdminSearch(null), '');
  assert.equal(normalizeAdminSearch(125), '125');
  assert.ok(normalizeAdminSearch(name).includes(normalizeAdminSearch('AMELYS  RELOJ')));
});

test('escritura rápida ejecuta sólo la última búsqueda y cancel libera el trabajo pendiente', async () => {
  const values = [];
  const search = debounceAdminSearch(value => values.push(value), 10);
  search('a'); search('am'); search('amelys');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(values, ['amelys']);
  search('cancelada'); search.cancel();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(values, ['amelys']);
});

async function reportsRuntime() {
  const source = await read('js/admin/participacion/gestion-participacion-admin-v2.js');
  const code = source.slice(source.indexOf('let reportsGeneration ='), source.indexOf('const scheduleReports ='));
  const calls = [], renders = [];
  const fields = { '#reports-search': { value: 'anterior' }, '#reports-filter': { value: '' } };
  const owner = { uid: 'owner', getIdToken: async () => 'test-token' };
  const context = vm.createContext({
    user: owner, reports: [], reportPage: 1, AbortController, URLSearchParams,
    $: selector => fields[selector],
    fetch: (url, options) => { const done = deferred(); calls.push({ url, options, ...done }); return done.promise; },
    renderReports: () => renders.push(context.reports.map(report => report.reportId)),
  });
  vm.runInContext(code + '\nthis.load = loadReports; this.cancel = cancelReports;', context);
  return { context, calls, fields, renders };
}
const response = id => ({ ok: true, json: async () => ({ ok: true, reports: [{ reportId: id }] }) });

test('denuncias aborta la petición anterior y descarta respuestas desordenadas aunque el transporte ignore abort', async () => {
  const { context, calls, fields, renders } = await reportsRuntime();
  const old = context.load(); await tick();
  fields['#reports-search'].value = 'nueva';
  const latest = context.load(); await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.signal.aborted, true);
  calls[1].resolve(response('actual')); await latest;
  calls[0].resolve(response('obsoleta')); await old;
  assert.deepEqual(renders, [['actual']]);
  assert.match(calls[1].url, /search=nueva/);
});

test('denuncias invalida al escribir durante debounce y al cambiar de cuenta', async () => {
  const { context, calls, renders } = await reportsRuntime();
  const pending = context.load(); await tick();
  context.cancel(); calls[0].resolve(response('obsoleta')); await pending;
  assert.deepEqual(renders, []);
  const second = context.load(); await tick();
  context.user = { uid: 'otra' };
  calls[1].resolve(response('privada')); await second;
  assert.deepEqual(renders, []);
});

test('denuncias no oculta errores actuales pero ignora errores de una consulta reemplazada', async () => {
  const { context, calls } = await reportsRuntime();
  const pending = context.load(); await tick();
  calls[0].resolve({ ok: false, json: async () => ({ error: 'Sin conexión' }) });
  await assert.rejects(pending, /Sin conexión/);
  const stale = context.load(); await tick(); context.cancel();
  calls[1].resolve({ ok: false, json: async () => ({ error: 'No vigente' }) });
  await stale;
});

test('servidor y panel de denuncias no discrepan al buscar términos con tildes', async () => {
  const source = await read('cloudflare/comentarios-sociales.js');
  const code = source.slice(source.indexOf('export async function listCommentReports'), source.indexOf('export async function updateCommentReport')).replace('export ', '');
  const context = vm.createContext({
    clean: value => String(value || '').trim(), reportStatus: value => value,
    MAX_REPORTS: 300, decoded: value => value,
    firestoreAdminList: async () => [{ reportId: '1', commentText: 'Información   engañosa' }, { reportId: '2', commentText: 'Otro' }],
  });
  vm.runInContext(code + '\nthis.list = listCommentReports;', context);
  assert.deepEqual(Array.from(await context.list({}, { search: '  INFORMACION  ENGAÑOSA ' }), report => report.reportId), ['1']);
});
