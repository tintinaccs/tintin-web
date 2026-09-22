import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('el panel superadmin usa la autoridad canónica para todas las mutaciones comerciales de pedidos', () => {
  const adminApp = read('js/admin/admin-app.js');
  const crud = read('js/admin/orders/pedidos-superadmin-crud.js');
  const flow = read('js/admin/flujo-conexiones/datos-flujo-conexiones.js');

  assert.match(adminApp, /window\.updatePayStatus[\s\S]*?authenticatedFetch\('\/api\/admin-order-mutation'/);
  assert.match(crud, /authenticatedFetch\('\/api\/admin-order-mutation'/);
  assert.doesNotMatch(adminApp, /updateDoc\(doc\(db, ['"]orders['"], orderId\), \{[\s\S]{0,500}['"]payment\.status['"]/);
  assert.match(flow, /id: 'pedidos',[\s\S]*?state: ESTADOS\.PROD/);
  assert.match(flow, /from: 'super-panel', to: 'pedidos', state: ESTADOS\.PROD/);
});
