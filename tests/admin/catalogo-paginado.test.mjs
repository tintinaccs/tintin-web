import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAdminPagedSource } from '../../js/admin/datos/fuente-paginada-admin.mjs';

for (const [name, pageSize, count] of [['products', 1000, 1201], ['collections', 200, 251]]) {
  test(`${name}: Super Admin recibe todos los registros y los otros roles conservan consultas acotadas`, () => {
    const source = readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
    const start = source.indexOf('function subscribeAdminCollectionPages(');
    const end = source.indexOf('\nfunction startAdminRealtimeData()', start);
    assert.ok(start > 0 && end > start);
    for (const role of ['superadmin', 'admin']) {
      const watches = [], values = [];
      const deps = { createAdminPagedSource, currentRole: role, db: {},
        collection: (_db, collection) => collection, orderBy: field => ({ order: field }), startAfter: cursor => ({ cursor }), limit: n => ({ limit: n }), query: (...parts) => parts,
        onSnapshot(query, _options, next, fail) { watches.push({ query, next, fail }); return () => {}; },
      };
      const subscribe = new Function('deps', `const {${Object.keys(deps).join(',')}}=deps;${source.slice(start, end)};return subscribeAdminCollectionPages;`)(deps);
      const stop = subscribe(name, pageSize, records => values.push(records), error => { throw error; });
      const docs = Array.from({ length: count }, (_, i) => ({ id: `doc-${i}`, data: () => ({ name: 'Registro ' + i }) }));
      for (let page = 0; page < watches.length; page++) {
        const watch = watches[page];
        assert.equal(watch.query.at(-1).limit, pageSize);
        watch.next({ docs: docs.slice(page * pageSize, (page + 1) * pageSize), metadata: { fromCache: false } });
      }
      assert.equal(values.at(-1).length, role === 'superadmin' ? count : pageSize);
      stop();
    }
  });
}
