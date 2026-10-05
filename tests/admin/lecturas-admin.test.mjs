import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const flush = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };

test('fallo inicial de permisos no impide recuperar el documento en la siguiente lectura', async () => {
  const roleSource = fs.readFileSync('js/core/auth/permisos-roles.js','utf8');
  const fn = roleSource.match(/export async function loadRolePermissions\([^]*?\n\}/)[0]
    .replace('export ', '').replace(/const \{ readAdminFirestore \} = await import\([^]*?\);/, '');
  let calls=0;
  const context=vm.createContext({console:{error(){}},db:{},ROLE_PERM_DOC:{col:'rolePermissions',id:'main'},
    EDITABLE_ROLES:['admin'],PERMISSION_MODULES:{orders:{}},buildDefaultRolePermissions:()=>({admin:{orders:{view:false}}}),
    doc:()=>({}),readAdminFirestore:read=>read(),getDoc:async()=>{
      if(++calls===1) throw {code:'permission-denied'};
      return {exists:()=>true,data:()=>({admin:{orders:{view:true}}})};
    }
  });
  vm.runInContext('let _cache=null;'+fn+';globalThis.load=loadRolePermissions;',context);
  assert.equal((await context.load()).admin.orders.view,false);
  assert.equal((await context.load()).admin.orders.view,true);
  await context.load();assert.equal(calls,2);
});
const source = fs.readFileSync('js/admin/auth/lecturas-admin.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
function fixture({ready=true,recovery=true}={}) {
  const streams=[], errors=[], auth={currentUser:{uid:'a'}};
  let session, refreshes=0;
  const context=vm.createContext({auth,Promise,Error,Object,
    subscribeAuthState(fn){session=fn;fn(auth.currentUser);return()=>{};},
    waitForAdminAppCheck:async()=>ready,
    recoverAdminSecurity:async()=>{refreshes++;return recovery;},
    onSnapshot(ref,next,error){const stream={ref,next,error,stopped:false};streams.push(stream);return()=>{stream.stopped=true;};}
  });
  vm.runInContext(source+';globalThis.listen=subscribeAdminSnapshot;globalThis.read=readAdminFirestore;',context);
  return {context,auth,streams,errors,refreshes:()=>refreshes,session: user=>session(user)};
}
test('un rechazo transitorio renueva seguridad y vuelve a montar una sola vez',async()=>{
  const f=fixture();const values=[];const stop=f.context.listen('settings',v=>values.push(v),e=>f.errors.push(e));await flush();
  await f.streams[0].error({code:'permission-denied'});await flush();
  assert.equal(f.refreshes(),1);assert.equal(f.streams.length,2);assert.equal(f.streams[0].stopped,true);
  f.streams[1].next('actualizado');assert.deepEqual(values,['actualizado']);
  await f.streams[1].error({code:'permission-denied'});await flush();
  assert.equal(f.streams.length,2);assert.equal(f.errors.length,1);stop();
});
test('cambio de identidad corta datos y prohíbe recuperación de la anterior',async()=>{
  const f=fixture();const values=[];f.context.listen('private',v=>values.push(v));await flush();
  f.auth.currentUser={uid:'b'};f.session(f.auth.currentUser);f.streams[0].next('privado');
  await f.streams[0].error({code:'permission-denied'});assert.deepEqual(values,[]);assert.equal(f.refreshes(),0);assert.equal(f.streams[0].stopped,true);
});
test('cancelar durante el gate no monta un listener ni publica un error',async()=>{
  const f=fixture();const stop=f.context.listen('private',()=>{},e=>f.errors.push(e));stop();await flush();
  assert.equal(f.streams.length,0);assert.equal(f.errors.length,0);
});
test('verificación no disponible se informa, no queda como carga infinita',async()=>{
  const f=fixture({ready:false});f.context.listen('private',()=>{},e=>f.errors.push(e));await flush();
  assert.equal(f.streams.length,0);assert.equal(f.errors[0].code,'admin/security-unavailable');
});
test('lectura puntual se reintenta sin duplicar escrituras y propaga rechazos persistentes',async()=>{
  const f=fixture();let calls=0;
  assert.equal(await f.context.read(async()=>{if(++calls===1) throw {code:'permission-denied'};return 'ok';}),'ok');
  assert.equal(calls,2);assert.equal(f.refreshes(),1);
  await assert.rejects(f.context.read(async()=>{throw Object.assign(new Error('denied'),{code:'permission-denied'});}));
});
