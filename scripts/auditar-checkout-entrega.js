'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');

const checkout = read('checkout.html');
const client = read('js/orders/pedido-checkout-seguro.js');
const server = read('apps-script/CrearPedido.gs');

const checks = [
  ['Retiro protege la dirección y solicita la ubicación después del pedido',
    checkout.includes('Ubicación de retiro protegida') && checkout.includes('Confirmá primero tu pedido') &&
    client.includes('Solicito la ubicación exacta y el horario disponible para retirar.')],
  ['Retiro no suma envío en cliente ni servidor',
    client.includes("city: 'Retiro coordinado'") && server.includes("method: 'retiro', city: 'Retiro coordinado', cost: 0")],
  ['Delivery conserva su tarifa dentro del total',
    client.includes('cost: delivery.price') && server.includes('cost: delivery.price')],
  ['Encomienda se cobra al recibir y no entra al total web',
    checkout.includes('Se abona a la transportadora al recibir') &&
    client.includes("method: 'encomienda'") && client.includes('cost: 0') &&
    server.includes("method: 'encomienda', city: encomienda.name, cost: 0")],
  ['Agencia no exige dirección; puerta exige dirección y mapa',
    client.includes("shipping.encomiendaMode === 'puerta'") && server.includes("encomiendaMode === 'puerta'") &&
    server.includes("encomiendaMode !== 'agencia' && encomiendaMode !== 'puerta'")],
  ['El endpoint acepta y conserva el modo validado de encomienda',
    server.includes("'shippingMethod', 'encomiendaMode'") &&
    server.includes("encomiendaMode: shipping.method === 'encomienda' ? encomiendaMode : ''")],
];

let failures = 0;
for (const [label, ok] of checks) {
  if (ok) console.log(`OK — ${label}`);
  else { failures += 1; console.error(`FAIL — ${label}`); }
}

if (failures) process.exit(1);
console.log(`\nCheckout de entrega correcto (${checks.length} comprobaciones).`);
