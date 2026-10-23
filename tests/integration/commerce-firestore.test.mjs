import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderAdmin, applyOrderAdminMutation } from '../../cloudflare/order-admin-domain.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

// Real Firestore REST/CAS on the emulator. Identity is a fixture; this does not
// test Firebase Auth, UI, external payments, emails or a production purchase.
const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Se requiere un emulador local; nunca usar producción');
const project = 'demo-tintin-commerce-integration';
const prefix = `projects/${project}/databases/(default)/documents/`;
const root = `http://${host}/v1/${prefix.slice(0, -1)}`;
const headers = { authorization: 'Bearer owner', 'content-type': 'application/json' };
async function request(suffix, body) {
  const response = await fetch(root + suffix, { headers, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  if (response.status === 404 && !body) return null;
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(JSON.stringify(data)), { status: ['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS'].includes(data.error?.status) ? 409 : response.status });
  return data;
}
const deps = {
  get: (_env, path) => request('/' + path),
  async batchGet(_env, paths) {
    const rows = await request(':batchGet', { documents: paths.map(path => prefix + path) });
    return rows.filter(row => row.found).map(row => row.found);
  },
  commit: (_env, writes) => request(':commit', { writes: writes.map(write => ({
    ...(write.delete ? { delete: prefix + write.path } : { update: { name: prefix + write.path, fields: write.fields },
      ...(write.mergeFields?.length ? { updateMask: { fieldPaths: write.mergeFields } } : {}) }),
    ...(write.currentDocument ? { currentDocument: write.currentDocument } : {}),
  })) }),
  async findFirst(_env, collection, fields, value) {
    for (const field of fields) {
      const rows = await request(':runQuery', { structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }, limit: 1 } });
      const found = rows.find(row => row.document)?.document;
      if (found) return found;
    }
    return null;
  },
  async maxNumber(_env, collection, field) {
    const rows = await request(':runQuery', { structuredQuery: { from: [{ collectionId: collection }], orderBy: [{ field: { fieldPath: field }, direction: 'DESCENDING' }], limit: 1 } });
    const found = rows.find(row => row.document)?.document;
    return found ? Number(decodeFirestoreFields(found.fields)[field]) || 0 : 0;
  },
};
const seed = (path, data) => deps.commit({}, [{ path, fields: encodeFirestoreFields(data) }]);
const product = async id => decodeFirestoreFields((await deps.get({}, 'products/' + id)).fields);
const actor = { uid: 'commerce_fixture', email: 'fixture@example.test', role: 'client', origin: 'public-checkout' };
const admin = { uid: 'admin_fixture', email: 'admin@example.test', role: 'superadmin', origin: 'superadmin' };
const input = (orderId, id, variant = '') => ({ orderId, userName: 'Clienta Fixture', userId: actor.uid, shippingMethod: 'retiro', paymentMethod: 'transferencia', paymentStatus: 'pendiente', items: [{ id, qty: 1, variant }] });

test('Firestore aislado: pedido, precio canónico, reserva, concurrencia e idempotencia reales', async t => {
  await seed('settings/orderSequence', { lastNumber: 0, highWaterMark: 0, historyReconciledAt: new Date() });
  await seed('products/simple', { name: 'Simple', active: true, stock: 2, price: 50000 });
  await seed('products/ring', { name: 'Anillo', active: true, stock: 2, price: 80000, variants: { Color: ['Dorado', 'Plateado'], Talle: ['6', '7'] }, variantInventory: [{ variant: 'Dorado / 6', stock: 1 }, { variant: 'Plateado / 7', stock: 1 }] });
  await t.test('producto sin variantes confirma pedido y reserva inventario', async () => {
    const result = await createOrderAdmin({}, input('commerce_simple', 'simple'), actor, deps);
    assert.equal(result.order.total, 50000);
    assert.equal((await product('simple')).stock, 1);
    assert.ok(await deps.get({}, 'orders/' + result.orderId));
  });
  await t.test('dos pedidos concurrentes no pueden reservar la última combinación dos veces', async () => {
    const results = await Promise.allSettled(['commerce_gold_a', 'commerce_gold_b'].map(id => createOrderAdmin({}, input(id, 'ring', 'Dorado / 6'), actor, deps)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.code, 'insufficient_stock');
    const winner = results.find(result => result.status === 'fulfilled').value;
    const before = await product('ring');
    assert.equal(before.stock, 1);
    assert.equal(before.variantInventory[0].stock, 0);
    assert.equal(winner.order.items[0].price, 80000);
    assert.equal((await createOrderAdmin({}, input(winner.orderId, 'ring', 'Dorado / 6'), actor, deps)).duplicate, true);
    await applyOrderAdminMutation({}, { orderId: winner.orderId, paymentStatus: 'pagado', status: 'confirmado', changeId: 'commerce_confirm' }, admin, deps);
    assert.equal((await product('ring')).stock, 1, 'confirmar no duplica la reserva');
    await applyOrderAdminMutation({}, { orderId: winner.orderId, status: 'cancelado', changeId: 'commerce_cancel' }, admin, deps);
    assert.equal((await product('ring')).stock, 2);
  });
  await t.test('otro color/talle conserva su clave; combinación eliminada no escribe', async () => {
    const selected = await createOrderAdmin({}, input('commerce_silver', 'ring', 'Plateado / 7'), actor, deps);
    assert.equal(selected.order.items[0].variant, 'Plateado / 7');
    assert.equal((await product('ring')).variantInventory[1].stock, 0);
    await assert.rejects(createOrderAdmin({}, input('commerce_deleted', 'ring', 'Dorado / 7'), actor, deps));
    assert.equal(await deps.get({}, 'orders/commerce_deleted'), null);
  });
});

test('Firestore real aislado: v2 prices, mixed stock, concurrent reserve, cancellation and replay',async()=>{
 await seed('products/v2',{name:'Fixture v2',price:100,stock:null,active:true,variantCommerceVersion:2,variants:{Talle:['M'],Color:['Plateado','Dorado']},
 variantInventory:[{variant:'Plateado / M',attributes:{Color:'Plateado',Talle:'M'},stock:1,price:250},{variant:'Dorado / M',attributes:{Color:'Dorado',Talle:'M'},stock:null}],
 variantMedia:[{Color:'Plateado',imageUrl:'https://example.invalid/silver.png'}]});
 const results=await Promise.allSettled(['v2_real_a','v2_real_b'].map(orderId=>createOrderAdmin({},input(orderId,'v2','M / Plateado'),actor,deps)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const winner=results.find(r=>r.status==='fulfilled').value;
 assert.equal(winner.order.items[0].price,250);assert.match(winner.order.items[0].imageUrl,/silver/);
 let p=await product('v2');assert.equal(p.variantInventory[0].stock,0);assert.equal(p.stock,null);
 const cancel={orderId:winner.orderId,status:'cancelado',changeId:'v2_real_cancel'};
 await applyOrderAdminMutation({},cancel,admin,deps);await applyOrderAdminMutation({},cancel,admin,deps);
 p=await product('v2');assert.equal(p.variantInventory[0].stock,1);assert.equal(p.variantInventory[0].price,250);assert.equal(p.variantInventory[1].stock,null);
});

test('Firestore real aislado: dos combinaciones de 60 unidades se reservan y devuelven una sola vez', async () => {
 await seed('products/v2_bulk', {name:'Fixture cantidad',price:100,stock:120,active:true,variantCommerceVersion:2,
  variants:{Color:['Plateado','Dorado']},variantInventory:[
   {variant:'Plateado',attributes:{Color:'Plateado'},stock:60,price:200},
   {variant:'Dorado',attributes:{Color:'Dorado'},stock:60}]});
 const draft={...input('v2_bulk_real','v2_bulk'),items:[
  {id:'v2_bulk',variant:'Plateado',qty:60},{id:'v2_bulk',variant:'Dorado',qty:60}]};
 const created=await createOrderAdmin({},draft,actor,deps);
 assert.equal(created.order.total,18000);
 assert.equal((await product('v2_bulk')).stock,0);
 const cancel={orderId:created.orderId,status:'cancelado',changeId:'v2_bulk_cancel'};
 await applyOrderAdminMutation({},cancel,admin,deps);
 await applyOrderAdminMutation({},cancel,admin,deps);
 const restored=await product('v2_bulk');
 assert.equal(restored.stock,120);
 assert.deepEqual(restored.variantInventory.map(row=>row.stock),[60,60]);
});
