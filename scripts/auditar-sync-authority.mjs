#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const webhook = read('functions/api/sheets-admin-webhook.js');
const lifecycle = read('cloudflare/user-lifecycle-domain.js');
const orderDomain = read('cloudflare/order-admin-domain.js');
const appsScript = read('apps-script/ProductosUnificados.gs');
const parity = read('apps-script/AdminParity.gs');
const snapshot = read('functions/api/sheets-sync-snapshot.js');

const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

check(!/deleteFirebaseUser/.test(webhook), 'Sheets no debe eliminar Firebase Auth físicamente.');
check(!/delete:\s*true/.test(webhook), 'Sheets no debe borrar users/orders de Firestore.');
check(/softDeleteUser/.test(webhook) && /applyUserLifecycle/.test(webhook), 'Sheets debe usar lifecycle canónico para usuarios.');
check(/deleted:\s*fsBoolean\(true\)/.test(lifecycle), 'Lifecycle debe conservar tombstone histórico.');

// Pedidos sí es una superficie administrativa editable, pero nunca una
// autoridad paralela: Sheets debe pasar creación/edición por el mismo dominio
// server-side que Superadmin. Precios, totales, stock y TINPED se derivan allí.
check(/createOrderAdmin/.test(webhook) && /applyOrderAdminMutation/.test(webhook), 'Sheets debe usar el dominio canónico para crear/editar pedidos.');
check(/canonicalPrices:\s*true/.test(orderDomain), 'El dominio de pedidos debe re-leer precios canónicos al crear.');
check(/settings\/orderSequence/.test(orderDomain) && /TINPED/.test(orderDomain), 'TINPED debe asignarse dentro del dominio canónico.');
check(/computeInventoryDeltas/.test(orderDomain), 'Cambios de pedidos deben reconciliar inventario por el dominio compartido.');
check(/action:\s*'createOrder'/.test(parity) && /action:\s*'updateOrder'/.test(parity), 'Apps Script debe enviar altas y ediciones de pedidos al webhook canónico.');
check(/baseChangeId/.test(parity) && /baseChangeId/.test(webhook), 'Usuarios y pedidos deben usar optimistic concurrency.');
check(/lastChangeId/.test(snapshot), 'Snapshots deben transportar la revisión actual.');
check(/auditLog/.test(webhook) || /auditLog/.test(orderDomain), 'Cambios administrativos desde Sheets deben quedar auditados.');
check(/tintinParityHandleServerOrderSync_/.test(appsScript), 'Apps Script debe aceptar el espejo inmediato Firestore→Pedidos web.');
check(!/action:\s*'deleteOrder'/.test(parity), 'Sheets no debe ofrecer borrado físico de pedidos.');

if (errors.length) {
  console.error(`Auditoría de autoridad de sincronización: ${errors.length} problema(s):`);
  errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}
console.log('OK — autoridad única: Firestore/dominios server-side; productos y pedidos con paridad administrativa segura, auditoría read-only.');
