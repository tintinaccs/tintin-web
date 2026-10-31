import test from 'node:test';
import assert from 'node:assert/strict';
import { orderContactLinks } from '../../cloudflare/contactos-pedido.mjs';
test('pago parcial no inventa el saldo ni cobra otra vez el total al enviar a delivery',()=>{
  const links=orderContactLinks({userName:'QA',userPhone:'0981123456',shippingMethod:'delivery',paymentStatus:'parcial',paymentMethod:'efectivo',total:95000},'order_fixture_partial');
  assert.match(links.dispatchMessage,/Monto a cobrar: A confirmar \(pago parcial\)/);
  assert.doesNotMatch(links.dispatchMessage,/Monto a cobrar: 95/);
  assert.match(links.dispatchMessage,/Confirmar saldo pendiente/);
});
import { adminEmail } from '../../functions/api/order-email.js';

const order = {
  userName: 'Cliente de prueba', userPhone: '0982 123456', userEmail: 'fixture@example.test',
  shortId: 'TEST', total: 95000, subtotal: 80000, paymentMethod: 'efectivo',
  shippingMethod: 'delivery', status: 'pendiente', items: [{name:'Reloj Alessia',variant:'Dorado',qty:2,price:40000}],
  shipping: { city: 'Capiatá', address: 'Calle de prueba 123', referencia: 'Portón verde',
    mapLocation: { lat: -25.3931, lng: -57.4813 } },
};
test('delivery abre el chat de Fito con datos del pedido confirmado', () => {
  const links = orderContactLinks(order, 'fixture-id');
  const url = new URL(links.dispatch);
  assert.equal(url.pathname, '/595982518206');
  const message = url.searchParams.get('text');
  for (const field of ['Cliente: Cliente de prueba','Teléfono: +595982123456',
    'Ciudad: Capiatá','Dirección: Calle de prueba 123','Pedido: TEST','Reloj Alessia','Dorado','2 ×',
    '95.000 Gs','Paga al recibir','Portón verde']) assert.ok(message.includes(field), field);
  assert.ok(message.includes(links.map));
  assert.doesNotMatch(message, /Empaque Verde|fixture-id/);
});
test('encomienda y retiro excluyen el botón para Fito en HTML y texto', () => {
  for (const shippingMethod of ['encomienda','retiro']) {
    const fixture = { ...order, shippingMethod };
    assert.equal(orderContactLinks(fixture,'fixture-id').dispatch, '');
    const email = adminEmail(fixture,'fixture-id');
    assert.doesNotMatch(email.html + email.text, /Enviar a Fito|595982518206/);
    assert.match(email.html, /Contactar al cliente por WhatsApp/);
    assert.match(email.html, /Abrir Super Admin/);
  }
});
test('pago acreditado no vuelve a cobrar y transferencia pendiente exige acreditación', () => {
  const paid = orderContactLinks({ ...order, paymentStatus: 'paid' }, 'fixture-id');
  assert.doesNotMatch(paid.dispatchMessage, /Monto a cobrar:/);
  assert.match(paid.dispatchMessage, /Pedido pagado/);
  const transfer = orderContactLinks({ ...order, paymentMethod: 'transferencia' }, 'fixture-id');
  assert.match(transfer.dispatchMessage, /confirmar acreditación antes de despachar/);
  const providerPending = orderContactLinks({ ...order, paymentMethod: 'paypal', paymentStatus: 'pendiente' }, 'fixture-id');
  assert.doesNotMatch(providerPending.dispatchMessage, /Pago por transferencia|Monto a cobrar/);
  assert.match(providerPending.dispatchMessage, /Pago pendiente/);
});
test('contacto del cliente apunta al pedido y rechaza teléfonos o mapas inválidos', () => {
  const links = orderContactLinks(order, 'fixture/id');
  const url = new URL(links.customer);
  assert.equal(url.pathname, '/595982123456');
  assert.match(url.searchParams.get('text'), /perfil#pedido-fixture%2Fid/);
  const invalid = orderContactLinks({ ...order, userPhone: 'abc', shipping: { mapLocation: {lat: 200,lng: 0} } }, 'id');
  assert.equal(invalid.customer, '');
  assert.equal(invalid.map, '');
});

test('transferencia no solicita cobro en efectivo y conserva observaciones sin arrastre', () => {
  const transfer = orderContactLinks({...order,paymentMethod:'transferencia',paymentStatus:'pendiente',notes:'Llamar al llegar'},'id');
  assert.doesNotMatch(transfer.dispatchMessage,/Monto a cobrar|Paga al recibir|Empaque Verde/);
  assert.match(transfer.dispatchMessage,/Estado del pago: Pendiente/);
  assert.match(transfer.dispatchMessage,/Llamar al llegar/);
  const next = orderContactLinks({...order,items:[{name:'Collar Luna',qty:1,price:10000}],notes:''},'next');
  assert.match(next.dispatchMessage,/Collar Luna/);
  assert.doesNotMatch(next.dispatchMessage,/Llamar al llegar|Reloj Alessia/);
  assert.equal(new URL(transfer.dispatch).searchParams.get('text'),transfer.dispatchMessage);
});
