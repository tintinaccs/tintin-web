import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture() {
 let callback, loads = 0, resolve;
 const pending = new Promise(r => { resolve = r; });
 const source = fs.readFileSync(new URL('../../js/core/auth/insignia-edicion.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/import\('\.\/permisos-roles\.js\?v=[^']+'\)/, 'loadPermissions()');
 const context = vm.createContext({ console, SUPER_ADMIN: 'owner@example.test',
  subscribeAuthState(fn) { callback = fn; },
  loadPermissions() { loads++; return pending; },
  getUserRole: async () => 'admin',
 });
 vm.runInContext(source, context);
 return { context, get loads() { return loads; }, callback: user => callback(user),
  resolve: () => resolve({ EDITABLE_ROLES: ['admin'], loadRolePermissions: async () => {}, canDo: () => true }) };
}
test('visitante y sesión anónima no descargan permisos del editor', async () => {
 const f = fixture(); await f.callback(null); await f.callback({ isAnonymous: true }); assert.equal(f.loads, 0);
});
test('la comprobación de Super Admin mantiene su autoridad sin descargar matriz', async () => {
 const f = fixture(); assert.equal(await vm.runInContext("canEditContent({email:'owner@example.test'})", f.context), true); assert.equal(f.loads, 0);
});
test('un permiso tardío no restaura las insignias después de cerrar sesión', async () => {
 const f = fixture(); const first = f.callback({ uid: 'staff', email: 'staff@example.test' });
 assert.equal(f.loads, 1); await f.callback(null); f.resolve(); await first;
 assert.equal(vm.runInContext('authorized', f.context), false);
});
