'use strict';

// Archivo intencionalmente simple para que la revisión de sintaxis y estructura
// pueda ejecutarse sin credenciales ni conexión con Firebase.
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'create-order.js'), 'utf8');
const requiredFragments = [
  "exports.createOrder = onCall",
  "db.runTransaction",
  "transaction.create(orderRef",
  "transaction.update(productRef",
  "fail('quote_changed'",
  "fail('insufficient_stock'",
  "buildOrderId(uid, requestId)"
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Falta una protección obligatoria: ${fragment}`);
  }
}

console.log('Estructura de createOrder verificada.');
