import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('renombrar una página confirma alta y baja juntas; un rechazo conserva la original y el borrador', async () => {
  const source = readFileSync(new URL('../../js/admin/pages/paginas-admin.js', import.meta.url), 'utf8');
  const save = source.slice(source.indexOf('async function savePage()'), source.indexOf('\nasync function removePage('));
  for (const rejected of [false, true]) {
    const records = new Map([['original', { title: 'Antes' }]]), audits = [], errors = [];
    let commits = 0, revisions = 0;
    const input = { 'tt-page-title': { value: 'Después' }, 'tt-page-slug': { value: 'renombrada' }, 'tt-page-content': { value: '<p>Contenido</p>' }, 'tt-page-published': { checked: true }, 'tt-pages-save': {} };
    const deps = {
      canUse: () => true, clearError() {}, showError: error => errors.push(error),
      slugify: value => value, cleanHtml: value => value, document: { getElementById: id => input[id] },
      auth: { currentUser: { email: 'owner@example.test' } }, db: {}, serverTimestamp: () => 'timestamp',
      doc: (_db, _collection, id) => id,
      setDoc: () => assert.fail('el renombrado no admite escrituras separadas'),
      writeBatch: () => {
        const ops = [];
        return { set: (id, data) => ops.push(() => records.set(id, data)), delete: id => ops.push(() => records.delete(id)),
          commit: async () => { commits++; if (rejected) throw new Error('denied'); ops.forEach(op => op()); } };
      },
      withAdminSiteChange: async write => { const value = await write(); revisions++; return value; },
      window: { logAudit: (...args) => audits.push(args), toast() {} },
    };
    const runtime = new Function('deps', `const {${Object.keys(deps).join(',')}}=deps; let pages=[{slug:'original'}], editing={original:{slug:'original'}}; ${save}; return {save:savePage,editing:()=>editing};`)(deps);
    await runtime.save();
    assert.equal(commits, 1);
    assert.equal(records.has('original'), rejected);
    assert.equal(records.has('renombrada'), !rejected);
    assert.equal(audits.length, rejected ? 0 : 1);
    assert.equal(revisions, rejected ? 0 : 1);
    assert.equal(Boolean(runtime.editing()), rejected);
    assert.deepEqual(errors, rejected ? ['denied'] : []);
  }
});
