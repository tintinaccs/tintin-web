import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const [identity, orderClient, orderV2, api, shell, mapCapture] = await Promise.all([
  read('js/pages/checkout/checkout-identidad-navegacion.js'),
  read('js/create-order-client-v2.js'),
  read('js/orders/pedido-checkout-seguro-v2.js'),
  read('functions/api/create-order.js'),
  read('js/components/navigation/compartido/carga-navegacion.js'),
  read('js/pages/checkout/checkout-captura-mapa.js'),
]);

test('la cédula existe únicamente para encomienda y exige entre 6 y 8 dígitos', () => {
  assert.match(identity, /ck-document-number/);
  assert.match(identity, /isEncomienda\(\)/);
  assert.match(identity, /field\.hidden = !required/);
  assert.match(identity, /\^\\d\{6,8\}\$/);
  assert.match(identity, /formatDocumentNumber/);
  assert.match(api, /shipping\.method === 'encomienda'/);
  assert.match(api, /\^\\d\{6,8\}\$/);
  assert.match(api, /documentNumber/);
});

test('teléfono y cédula bloquean símbolos escritos por la clienta y usan teclado numérico', () => {
  assert.match(identity, /inputmode=\"numeric\"/);
  assert.match(identity, /beforeinput/);
  assert.match(identity, /\/\\D\/\.test\(event\.data\)/);
  assert.match(identity, /insertFromPaste/);
  assert.match(identity, /digitsOnly/);
});

test('Paraguay normaliza 8, 9 y 10 dígitos al formato 0981-336-401', () => {
  const start = identity.indexOf('function normalizeParaguayNational');
  const end = identity.indexOf('function isEncomienda', start);
  const source = identity.slice(start, end);
  assert.match(source, /raw\.length === 8/);
  assert.match(source, /`09\$\{raw\}`/);
  assert.match(source, /raw\.length === 9 && raw\.startsWith\('9'\)/);
  assert.match(source, /`0\$\{raw\}`/);
  assert.match(source, /raw\.slice\(0, 4\).*raw\.slice\(4, 7\).*raw\.slice\(7, 10\)/s);
});

test('el checkout permite volver solo hacia pasos ya recorridos y agrega volver desde confirmación', () => {
  assert.match(identity, /btn-step5-back/);
  assert.match(identity, /Volver al pago/);
  assert.match(identity, /targetIndex >= current/);
  assert.match(identity, /tt-step-back-available/);
  assert.match(identity, /keydown/);
  assert.match(identity, /\['Enter', ' '\]/);
});

test('la creación de pedidos ya no usa el Apps Script desincronizado', () => {
  assert.match(orderClient, /apiUrl\('create-order'\)/);
  assert.doesNotMatch(orderClient, /EMAIL_WEBHOOK_URL/);
  assert.doesNotMatch(orderClient, /action:\s*'createOrder'/);
  assert.match(api, /requireFirebaseUser/);
  assert.match(api, /documents:beginTransaction/);
  assert.match(api, /documents:batchGet/);
  assert.match(api, /documents:commit/);
  assert.match(api, /FIREBASE_SERVICE_ACCOUNT_KEY/);
});

test('el servidor limita ids de producto a un segmento Firestore seguro', () => {
  assert.match(api, /\^\[A-Za-z0-9_-\]\{1,180\}\$/);
  assert.match(api, /error: 'invalid_cart'/);
});

test('el flujo V2 se activa antes del import heredado y está versionado', () => {
  assert.match(shell, /window\.TintinSecureCheckoutOrderBooted = true/);
  assert.match(shell, /pedido-checkout-seguro-v2\.js/);
  assert.match(shell, /checkout-identidad-navegacion\.js/);
  assert.match(shell, /checkout-captura-mapa\.js/);
  assert.match(orderV2, /create-order-client-v2\.js/);
  assert.match(orderV2, /createOrderViaServer/);
  assert.match(orderV2, /document_invalid/);
});

test('la captura del mapa conserva coordenadas aunque el texto muestre el nombre del lugar', () => {
  assert.match(mapCapture, /__TintinCheckoutPoint/);
  assert.match(mapCapture, /data-tt-machine-coords|ttMachineCoords/);
  assert.match(mapCapture, /MutationObserver/);
  assert.match(mapCapture, /marker\.on\?\.\('add move dragend'/);
});
