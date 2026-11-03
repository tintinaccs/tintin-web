import vm from 'node:vm';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('el checkout público usa únicamente el bridge de Cloudflare para crear pedidos', () => {
  const client = read('js/create-order-public-client.js');
  const checkout = read('js/orders/pedido-checkout-seguro.js');

  assert.match(checkout, /create-order-public-client\.js\?v=/);
  assert.doesNotMatch(checkout, /create-order-client\.js\?v=/);
  assert.doesNotMatch(checkout, /components\/cart\/sincronizacion-carrito\.js\?v=/);
  assert.match(checkout, /window\.TintinCartRuntime/);
  assert.match(client, /apiUrl\(['"]apps-script-bridge['"]\)/);
  assert.match(client, /getIdToken\(\)/);
  assert.match(client, /result\.error === ['"]invalid_id_token['"]/);
  assert.match(client, /getIdToken\(true\)/);
  assert.doesNotMatch(client, /EMAIL_WEBHOOK_URL/);
  assert.doesNotMatch(client, /script\.google\.com/);
});

test('Cloudflare verifica la sesión y descarta identidad controlada por el navegador', () => {
  const bridge = read('functions/api/apps-script-bridge.js');

  assert.match(bridge, /authenticatedUser = await verifyFirebaseIdToken\(idToken\)/);
  assert.match(bridge, /delete forwardedPayload\.userId/);
  assert.match(bridge, /delete forwardedPayload\.customerId/);
  assert.match(bridge, /delete forwardedPayload\.userEmail/);
});

test('un pedido exitoso debe quedar ligado a CUS_<UID> antes de responder éxito', () => {
  const bridge = read('functions/api/apps-script-bridge.js');

  const policy = read('cloudflare/politica-checkout-publico.js');
  assert.match(policy, /customerId: `CUS_\$\{uid\}`/);
  assert.match(policy, /userId: uid/);
  assert.match(bridge, /await preparePublicCheckoutOrder\(env, forwardedPayload, authenticatedUser\)/);
  assert.match(bridge, /await createOrderAdmin\(/);
  assert.match(bridge, /order: created\.order/);
  assert.doesNotMatch(bridge, /enforceCanonicalOrderIdentity/);

});

test('el espejo inmediato a Sheets recibe el pedido ya canonizado', () => {
  const bridge = read('functions/api/apps-script-bridge.js');

  assert.match(bridge, /syncOrderToSheetsBestEffort/);
  assert.match(bridge, /order: created\.order/);
  assert.match(bridge, /sheetsSync: \{ ok: true, deferred: true \}/);
});

test('los fallos internos del bridge no exponen mensajes ni stack al navegador', () => {
  const bridge = read('functions/api/apps-script-bridge.js');
  const catchBlock = bridge.slice(bridge.lastIndexOf('} catch (error)'));

  assert.match(catchBlock, /console\.error\(/);
  assert.doesNotMatch(catchBlock, /detail\s*:/);
  assert.doesNotMatch(catchBlock, /stack/);
  assert.doesNotMatch(catchBlock, /error\?\.message\s*\|\|\s*error\s*[,}]/);
});

test('Apps Script deriva userId desde el token y no desde el payload', () => {
  const appsScript = read('apps-script/CrearPedido.gs');

  assert.match(appsScript, /var uid = auth\.uid;/);
  assert.match(appsScript, /userId: uid/);
  assert.doesNotMatch(appsScript, /userId:\s*payload\./);
});

test('Apps Script rechaza creación pública legacy sin invocar escritores y conserva el espejo', () => {
  const source=read('apps-script/ProductosUnificados.gs');
  let created=0,mirrored=0;
  const context=vm.createContext({phase4CreateOrder_:()=>{created++;return {ok:true};},tintinHandleUnifiedProductsPost_:()=>{mirrored++;return 'mirror-ok';},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:value=>({setMimeType:()=>value})}});
  vm.runInContext(source.slice(source.indexOf('function doPost(e) {'),source.indexOf('// Enlazar desde el doPost')),context);
  for(const version of [1,2]){
    const response=JSON.parse(context.doPost({postData:{contents:JSON.stringify({action:'createOrder',idToken:'fixture-only',variantCommerceVersion:version})}}));
    assert.equal(response.ok,false);assert.equal(response.error,'canonical_checkout_required');
  }
  assert.equal(created,0);assert.equal(mirrored,0);
  assert.equal(context.doPost({postData:{contents:JSON.stringify({action:'syncProducts'})}}),'mirror-ok');assert.equal(mirrored,1);
});
