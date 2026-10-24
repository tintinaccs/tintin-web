import {saveProductEditor,saveProductBulk} from '../../cloudflare/product-editor-domain.mjs';
import {productFingerprint} from '../../js/admin/products/maestro-productos-core.mjs';
import {commercialDraft} from '../../js/admin/products/editor-comercial-core.mjs';
import {composeCheckoutDraft} from '../../js/orders/politica-checkout.js';
import {preparePublicCheckoutOrder} from '../../cloudflare/politica-checkout-publico.js';
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

test('Editor → checkout público → pedido: precio, fotos, clave estable y cancelación',async()=>{
 const id='editor_checkout',requestId='editor_checkout_20261024';
 await seed('settings/orderSequence',{lastNumber:0,highWaterMark:0,historyReconciledAt:new Date()});
 await seed('settings/general',{storeOpen:true,paymentMethods:{transferencia:true}});
 await seed(`checkoutGuards/${actor.uid}`,{lastCheckoutOrderId:`${actor.uid}_${requestId}`,lastCheckoutAt:new Date()});
 await seed('collections/editor_checkout',{name:'Fixture'});
 const original=commercialDraft({name:'Pulsera de prueba',category:'editor_checkout',price:30000,active:true,oferta:false,destacado:false,variants:{Color:['Dorado','Plateado'],Talle:['M']}});
 original.variantInventory.forEach((row,index)=>{row.stock=2;row.price=index===0?45000:35000;});original.stock=4;
 original.variantMedia=[{Color:'Dorado',imageUrl:'https://example.invalid/gold.png'},{Color:'Plateado',imageUrl:'https://example.invalid/silver.png'}];
 await saveProductEditor({},{productId:id,expected:null,changeId:'editor_checkout_create',product:original},admin,deps);
 const before=await product(id),selectedKey=before.variantInventory[0].variant;
 const reordered=commercialDraft(before,{Talle:['M'],Color:['Plateado','Dorado']});
 await saveProductEditor({},{productId:id,expected:productFingerprint(before),changeId:'editor_checkout_reorder',product:{variants:reordered.variants,variantInventory:reordered.variantInventory}},admin,deps);
 const draft=composeCheckoutDraft({requestId,items:[{id,qty:1,variant:'M / Dorado',variantKey:selectedKey}],name:'Clienta Fixture',phone:'595981123456',contactEmail:actor.email,notes:'',selectedCity:'__retiro__',departamento:'',address:'',referencia:'',shipping:{method:'retiro',cost:0,pending:false},paymentMethod:'transferencia',subtotal:45000});
 assert.deepEqual(draft.cartLines,[{id,qty:1,variant:'M / Dorado',variantKey:selectedKey}]);
 const prepared=await preparePublicCheckoutOrder({},draft,actor,deps);
 const order=await createOrderAdmin({},prepared.input,actor,{...deps,inspect:prepared.inspect});
 assert.equal(order.order.total,45000);assert.equal(order.order.items[0].price,45000);
 assert.equal(order.order.items[0].variantKey,selectedKey);assert.equal(order.order.items[0].variant,'M / Dorado');
 assert.equal(order.order.items[0].imageUrl,'https://example.invalid/gold.png');
 assert.equal((await product(id)).variantInventory.find(row=>row.variant===selectedKey).stock,1);
 const duplicate=await createOrderAdmin({},prepared.input,actor,{...deps,inspect:prepared.inspect});assert.equal(duplicate.duplicate,true);
 await applyOrderAdminMutation({},{orderId:order.orderId,status:'cancelado',changeId:'editor_checkout_cancel'},admin,deps);
 await applyOrderAdminMutation({},{orderId:order.orderId,status:'cancelado',changeId:'editor_checkout_cancel'},admin,deps);
 const after=await product(id);assert.equal(after.stock,4);assert.equal(after.variantInventory.find(row=>row.variant===selectedKey).stock,2);
 assert.deepEqual(after.variantMedia,before.variantMedia);
});

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


test('Editor v2: commit real público/privado, reintento e interferencia de una venta',async()=>{
  const data={name:'Anillo editor',category:'editor_fixture',price:30000,priceBefore:null,active:true,oferta:false,destacado:false,variantCommerceVersion:2,variants:{Color:['Oro']},variantInventory:[{variant:'oro',attributes:{Color:'Oro'},stock:2,price:40000}],stock:2};
  await seed('collections/editor_fixture',{name:'Fixture'});
  const inventory={costUnit:100,purchased:2,stockMinimum:1,internalNotes:'Dato privado demo'};
  const create={productId:'editor_fixture',expected:null,changeId:'editor_create_123',product:data,inventory,expectedInventory:null};
  const saved=await saveProductEditor({},create,admin,deps);
  assert.equal((await product('editor_fixture')).price,30000);
  assert.equal(decodeFirestoreFields((await deps.get({},'productInventory/editor_fixture')).fields).internalNotes,inventory.internalNotes);
  assert.equal((await saveProductEditor({},create,admin,deps)).duplicate,true);
  const expected=productFingerprint(saved.product);
  const order=await createOrderAdmin({},input('commerce_editor_sale','editor_fixture','Oro'),actor,deps);
  assert.equal(order.order.items[0].price,40000);
  await assert.rejects(saveProductEditor({},{...create,expected,changeId:'editor_edit_456',product:{...data,name:'Cambio concurrente'}},admin,deps),error=>error.status===409);
  assert.equal((await product('editor_fixture')).stock,1);
  assert.equal((await product('editor_fixture')).name,'Anillo editor');
});


test('Editor v2: lote mixto comercial atómico y conflicto antes de escribir',async()=>{
 const commercial=await product('editor_fixture');
 await seed('products/editor_simple',{name:'Simple',price:20000,stock:2,active:true});
 const simple=await product('editor_simple');
 const request={ids:['editor_fixture','editor_simple'],expected:{editor_fixture:productFingerprint(commercial),editor_simple:productFingerprint(simple)},field:'price',value:35000};
 await assert.rejects(saveProductBulk({},{...request,expected:{...request.expected,editor_simple:'obsoleto'}},admin,deps));
 assert.equal((await product('editor_fixture')).price,commercial.price);
 await saveProductBulk({},request,admin,deps);
 assert.equal((await product('editor_fixture')).price,35000);assert.equal((await product('editor_fixture')).variantInventory[0].price,40000);
 assert.equal((await product('editor_simple')).price,35000);
});

// All actors, products, orders and payment captures below are synthetic and
// confined by the local emulator guard above. No provider, email or Sheets call.
import { createPaypalOrder, capturePaypalOrder, markPaid, markReversed, paypalAmountFromPyg } from '../../cloudflare/paypal-seguro.js';
import { withPaypalSimulator } from './helpers/paypal-simulator.mjs';
test('compra enteramente ficticia: producto → pedido → captura simulada → devolución/cancelación', async () => {
  const id = 'qa_fake_product_payment', requestId = 'qa_fake_payment_20261024';
  await seed('settings/orderSequence', { lastNumber: 0, highWaterMark: 0, historyReconciledAt: new Date() });
  await seed('settings/general', { storeOpen: true, paypal: { enabled: true }, paymentMethods: { paypal: true } });
  await seed('collections/qa_fake_collection', { name: 'Colección ficticia' });
  await seed(`checkoutGuards/${actor.uid}`, { lastCheckoutOrderId: `${actor.uid}_${requestId}`, lastCheckoutAt: new Date() });
  const draftProduct = commercialDraft({ name: 'Producto ficticio QA', category: 'qa_fake_collection', price: 30000, active: true, publicationStatus: 'active', productTemplate: 'default', seoTitle: '', seoDescription: '', oferta: false, destacado: false, variants: { Color: ['Dorado'] } });
  draftProduct.variantInventory[0].stock = 2; draftProduct.variantInventory[0].price = 45000; draftProduct.stock = 2;
  await saveProductEditor({}, { productId: id, expected: null, changeId: 'qa_fake_product_create', product: draftProduct }, admin, deps);
  const stored = await product(id), key = stored.variantInventory[0].variant;
  const draft = composeCheckoutDraft({ requestId, items: [{ id, qty: 1, variant: 'Dorado', variantKey: key }], name: 'Ana Gómez', phone: '595981123456', contactEmail: 'qa@example.invalid', notes: 'Sólo emulador', selectedCity: '__retiro__', departamento: '', address: '', referencia: '', shipping: { method: 'retiro', cost: 0, pending: false }, paymentMethod: 'paypal', subtotal: 45000 });
  await assert.rejects((async () => {
    const tampered = await preparePublicCheckoutOrder({}, { ...draft, expectedSubtotal: 1, expectedTotal: 1 }, actor, deps);
    return createOrderAdmin({}, tampered.input, actor, { ...deps, inspect: tampered.inspect });
  })(), error => error.code === 'quote_changed');
  assert.equal((await product(id)).stock, 2, 'un importe manipulado no reserva stock');
  const prepared = await preparePublicCheckoutOrder({}, draft, actor, deps);
  const result = await createOrderAdmin({}, prepared.input, actor, { ...deps, inspect: prepared.inspect });
  assert.equal(result.order.total, 45000, 'se confirma únicamente la cotización autorizada');
  assert.equal(result.order.paymentStatus, 'pendiente'); assert.equal((await product(id)).stock, 1);
  const duplicate = await createOrderAdmin({}, prepared.input, actor, { ...deps, inspect: prepared.inspect });
  assert.equal(duplicate.duplicate, true); assert.equal((await product(id)).stock, 1);
  const providerId = 'QA_PROVIDER_ORDER_20261024', captureId = 'QA_CAPTURE_20261024';
  const amount = paypalAmountFromPyg(result.order.total, 7500);
  assert.equal(amount.value, '6.00');
  await withPaypalSimulator(project, host, { providerId, captureId, value: amount.value, failCaptureOnce: true }, async ({ env, calls }) => {
  const created = await createPaypalOrder(env, { orderId: result.orderId, uid: actor.uid });
  assert.equal(created.providerOrderId, providerId); assert.equal(created.value, '6.00');
  const request = calls.find(call => call.path === '/v2/checkout/orders');
  assert.deepEqual(request.body.purchase_units[0].amount, { currency_code: 'USD', value: '6.00' });
  const mapping = async () => { const doc = await deps.get({}, `paypalOrders/${providerId}`); return { ...decodeFirestoreFields(doc.fields), id: providerId, updateTime: doc.updateTime }; };
  await assert.rejects(markPaid({}, await mapping(), { id: captureId, amount: { currency_code: 'USD', value: '5.99' } }, deps), /no coincide/);
  let order = decodeFirestoreFields((await deps.get({}, `orders/${result.orderId}`)).fields);
  assert.equal(order.paymentStatus, 'pendiente');
  await assert.rejects(capturePaypalOrder(env, { providerOrderId: providerId, uid: actor.uid }), /PayPal API falló/);
  assert.equal(decodeFirestoreFields((await deps.get({}, `orders/${result.orderId}`)).fields).paymentStatus, 'pendiente');
  assert.equal((await product(id)).stock, 1);
  const paid = await capturePaypalOrder(env, { providerOrderId: providerId, uid: actor.uid });
  assert.equal(paid.paid, true);
  order = decodeFirestoreFields((await deps.get({}, `orders/${result.orderId}`)).fields);
  assert.equal(order.paymentStatus, 'pagado'); assert.equal(order.payment.captureId, captureId);
  assert.equal((await product(id)).stock, 1, 'cobrar no descuenta dos veces la reserva');
  const repeated = await capturePaypalOrder(env, { providerOrderId: providerId, uid: actor.uid });
  assert.equal(repeated.idempotent, true); assert.equal((await product(id)).stock, 1);
  const attempts = calls.filter(call => call.path.endsWith('/capture'));
  assert.equal(attempts.length, 2); assert.ok(attempts[0].requestId); assert.equal(attempts[0].requestId, attempts[1].requestId);
  const notice = await deps.findFirst({}, 'adminNotifications', ['orderId'], result.orderId);
  const noticeBody = decodeFirestoreFields(notice.fields).body;
  assert.match(noticeBody, /Gs\. 45\.000/, 'el aviso usa el total del pedido en guaraníes');
  assert.doesNotMatch(noticeBody, /USD|Gs\. 6(?:\D|$)/);
  await markReversed({}, await mapping(), { kind: 'refunded', refundId: 'QA_REFUND_20261024', eventId: 'QA_EVENT_REFUND_20261024', captureId, currency: 'USD', cents: amount.cents }, { ...deps, notify: async () => {} });
  order = decodeFirestoreFields((await deps.get({}, `orders/${result.orderId}`)).fields);
  assert.equal(order.paymentStatus, 'reembolsado');
  await applyOrderAdminMutation({}, { orderId: result.orderId, status: 'cancelado', changeId: 'qa_fake_payment_cancel' }, admin, deps);
  await applyOrderAdminMutation({}, { orderId: result.orderId, status: 'cancelado', changeId: 'qa_fake_payment_cancel' }, admin, deps);
  assert.equal((await product(id)).stock, 2, 'cancelar dos veces restituye una sola vez');
  });
});

test('pago ficticio: un pedido cancelado después de abrir PayPal no se puede capturar', async () => {
  const id = 'qa_cancel_before_payment', requestId = 'qa_cancel_before_payment_20261024';
  await seed('settings/orderSequence', { lastNumber: 0, highWaterMark: 0, historyReconciledAt: new Date() });
  await seed('settings/general', { storeOpen: true, paypal: { enabled: true }, paymentMethods: { paypal: true } });
  await seed(`products/${id}`, { name: 'Producto ficticio para cancelación', active: true, stock: 1, price: 45000 });
  await seed(`checkoutGuards/${actor.uid}`, { lastCheckoutOrderId: `${actor.uid}_${requestId}`, lastCheckoutAt: new Date() });
  const draft = composeCheckoutDraft({ requestId, items: [{ id, qty: 1 }], name: 'Ana Gómez', phone: '595981123456', contactEmail: 'qa@example.invalid', selectedCity: '__retiro__', shipping: { method: 'retiro', cost: 0, pending: false }, paymentMethod: 'paypal', subtotal: 45000 });
  const prepared = await preparePublicCheckoutOrder({}, draft, actor, deps);
  const result = await createOrderAdmin({}, prepared.input, actor, { ...deps, inspect: prepared.inspect });
  const providerId = 'QA_PROVIDER_CANCEL_20261024';
  await withPaypalSimulator(project, host, { providerId, captureId: 'QA_CAPTURE_CANCEL_20261024', value: '6.00' }, async ({ env, calls }) => {
    await createPaypalOrder(env, { orderId: result.orderId, uid: actor.uid });
    await applyOrderAdminMutation({}, { orderId: result.orderId, status: 'cancelado', changeId: 'qa_cancel_before_capture' }, admin, deps);
    assert.equal((await product(id)).stock, 1);
    await assert.rejects(capturePaypalOrder(env, { providerOrderId: providerId, uid: actor.uid }), /cerrado/);
    assert.equal(calls.filter(call => call.path.endsWith('/capture')).length, 0, 'rechaza antes de pedir un cobro al proveedor');
    const order = decodeFirestoreFields((await deps.get({}, `orders/${result.orderId}`)).fields);
    assert.notEqual(order.paymentStatus, 'pagado'); assert.equal((await product(id)).stock, 1);
  });
});
