import test from 'node:test';
import assert from 'node:assert/strict';
import { orderContactLinks } from '../../cloudflare/contactos-pedido.mjs';
import { adminEmail } from '../../functions/api/order-email.js';

const order = {
  userName: 'Cliente de prueba', userPhone: '0982 123456', userEmail: 'fixture@example.test',
  shortId: 'TEST', total: 95000, subtotal: 80000, paymentMethod: 'efectivo',
  shippingMethod: 'delivery', items: [],
  shipping: { city: 'Capiatá', address: 'Calle de prueba 123', referencia: 'Portón verde',
    mapLocation: { lat: -25.3931, lng: -57.4813 } },
};
test('delivery abre el chat de Fito con formato completo y sin número de pedido', () => {
  const links = orderContactLinks(order, 'fixture-id');
  const url = new URL(links.dispatch);
  assert.equal(url.pathname, '/595982518206');
  const message = url.searchParams.get('text');
  for (const field of ['Cliente: Cliente de prueba','Teléfono: +595982123456',
    'Ciudad: Capiatá','Dirección: Calle de prueba 123','Empaque Verde de cartón',
    '95.000 Gs','Paga al recibir','Portón verde']) assert.ok(message.includes(field), field);
  assert.ok(message.includes(links.map));
  assert.doesNotMatch(message, /TEST|fixture-id|PEDIDO N/i);
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
  assert.match(paid.dispatchMessage, /Monto a cobrar: 0 Gs/);
  assert.match(paid.dispatchMessage, /Pedido pagado/);
  const transfer = orderContactLinks({ ...order, paymentMethod: 'transferencia' }, 'fixture-id');
  assert.match(transfer.dispatchMessage, /confirmar acreditación antes de despachar/);
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
