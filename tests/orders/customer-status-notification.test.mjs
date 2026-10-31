import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orderCustomerNotice } from '../../cloudflare/notificaciones-pedido.mjs';
const source = readFileSync(new URL('../../functions/api/notifications.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('export async function notifyOrderStatus('), source.indexOf('export async function onRequest('));
function fixture() {
  const notices = new Map();
  const load = new Function('safeId','clean','firestoreAdminGet','decodeFirestoreFields','notifyUserIfAbsent','orderCustomerNotice',
    body.replace('export ', '') + '\nreturn notifyOrderStatus;');
  const notify = load(value => value, value => String(value || ''),
    () => { throw new Error('Must use committed canonical snapshot'); }, value => value,
    async (_env, uid, notice, key) => {
      if (notices.has(key)) return { duplicate: true };
      notices.set(key, {uid,notice}); return { created: true };
    }, orderCustomerNotice);
  return {notify,notices};
}
test('canonical order state produces one customer notice per revision, linked to that order', async () => {
  const h = fixture(), actor = {uid:'admin-fixture'};
  const order = {userId:'customer-fixture',shortId:'TEST',status:'confirmado',inventoryRevision:2,paymentStatus:'pendiente'};
  await h.notify({},actor,'order-fixture',order);
  assert.deepEqual(await h.notify({},actor,'order-fixture',order), {duplicate:true});
  await h.notify({},actor,'order-fixture',{...order,status:'enviado',inventoryRevision:3});
  assert.equal(h.notices.size,2);
  for (const {uid,notice} of h.notices.values()) {
    assert.equal(uid,'customer-fixture');
    assert.equal(notice.targetUrl,'perfil.html#pedido-order-fixture');
  }
});
test('initial pending order and order without account do not send another status notice', async () => {
  const h = fixture();
  await h.notify({}, {uid:'admin-fixture'}, 'id', {userId:'customer-fixture',status:'pendiente',inventoryRevision:1});
  await h.notify({}, {uid:'admin-fixture'}, 'id', {status:'enviado',inventoryRevision:3});
  assert.equal(h.notices.size,0);
});


test('cambio confirmado de pago identifica el evento sin simular avance de entrega',()=>{
 const paid=orderCustomerNotice('pedido',{userId:'client',shortId:'PRUEBA',status:'preparando',inventoryRevision:3,paymentStatus:'pagado'}, {}, {paymentChanged:true});
 assert.equal(paid.event.iconKey,'payment-confirmed');
 assert.match(paid.event.title,/Pago confirmado/);
 assert.equal(paid.event.status,'preparando');
 const pending=orderCustomerNotice('pedido',{userId:'client',shortId:'PRUEBA',status:'preparando',inventoryRevision:4,paymentStatus:'pendiente'}, {}, {paymentChanged:true});
 assert.equal(pending.event.iconKey,'payment-pending');
 assert.doesNotMatch(pending.event.title,/Pago confirmado/);
});
