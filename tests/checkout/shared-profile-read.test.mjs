import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/pages/checkout/perfil-checkout.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\s*/gm, '').replace('export function', 'function');
function fixture(appCheckReady = Promise.resolve(true)) {
  const reads = [], timers = [];
  const c = vm.createContext({
    db: {}, appCheckReady, AUTH_STATES: { RESTORING: 'restoring', AUTHENTICATED: 'authenticated' },
    subscribeSession(fn) { c.session = fn; }, doc: (_, __, uid) => uid,
    getDoc(uid) { let resolve, reject; const promise = new Promise((a, b) => { resolve=a; reject=b; }); reads.push({uid,resolve,reject}); return promise; },
    window: { setTimeout(fn) { const timer={fn};timers.push(timer);return timer; }, clearTimeout(timer) { if(timer)timer.cleared=true; } }
  });
  vm.runInContext(source, c);
  return {c,reads,timers,read: user => c.readCheckoutProfile(user)};
}
const user = {uid:'same'};
const snap = data => ({exists:()=>true,data:()=>data});
const tick = () => new Promise(resolve => setImmediate(resolve));

test('dos consumidores comparten una lectura, también después de resolver', async () => {
  const f=fixture();f.c.session({status:'authenticated',user});
  const a=f.read(user), b=f.read({...user});
  assert.equal(a,b);await tick();assert.equal(f.reads.length,1);
  f.reads[0].resolve(snap({name:'Current'}));
  assert.equal((await a).name,'Current');assert.equal((await b).name,'Current');
  await f.read(user);assert.equal(f.reads.length,1);assert.ok(f.timers[0].cleared);
});

test('salir y volver a entrar invalida el perfil aunque el UID sea el mismo', async () => {
  const f=fixture();f.c.session({status:'authenticated',user});
  const old=f.read(user);await tick();f.reads[0].resolve(snap({blocked:false}));await old;
  f.c.session({status:'unauthenticated',user:null});f.c.session({status:'authenticated',user});
  const current=f.read(user);await tick();assert.equal(f.reads.length,2);
  f.reads[1].resolve(snap({blocked:true}));assert.equal((await current).blocked,true);
});

test('timeout de una sesión anterior no borra la lectura de la cuenta actual', async () => {
  const f=fixture();const old=f.read(user);await tick();
  const currentUser={uid:'new'};f.c.session({status:'authenticated',user:currentUser});
  const current=f.read(currentUser);await tick();f.timers[0].fn();await assert.rejects(old,/profile_read_timeout/);
  assert.equal(f.read(currentUser),current);assert.equal(f.reads.length,2);
  f.reads[1].resolve(snap({name:'New'}));await current;
});

test('invitados no leen perfiles privados; un error permite reintentar', async () => {
  const f=fixture();assert.equal(await f.read(null),null);assert.equal(await f.read({uid:'guest',isAnonymous:true}),null);
  assert.equal(f.reads.length,0);
  const failed=f.read(user);await tick();f.reads[0].reject(new Error('network'));await assert.rejects(failed,/network/);
  const retry=f.read(user);await tick();assert.equal(f.reads.length,2);f.reads[1].resolve(snap({}));await retry;
});

test('sin seguridad no lee datos privados y un token tardío permite reintento', async () => {
  const f=fixture(Promise.resolve(false));
  await assert.rejects(f.read(user), error => error.code === 'app-check-unavailable');
  assert.equal(f.reads.length,0);
  f.c.window.TintinAppCheckStatus='enabled';
  const recovered=f.read(user);await tick();assert.equal(f.reads.length,1);
  f.reads[0].resolve(snap({name:'Verified'}));assert.equal((await recovered).name,'Verified');
});

test('cambio de cuenta mientras espera seguridad no lee el UID anterior', async () => {
  let secure;const f=fixture(new Promise(resolve => {secure=resolve;}));
  const old=f.read(user);const next={uid:'new'};f.c.session({status:'authenticated',user:next});
  const current=f.read(next);secure(true);await tick();
  assert.equal(await old,null);assert.deepEqual(f.reads.map(read=>read.uid),['new']);
  f.reads[0].resolve(snap({name:'New'}));await current;
});
