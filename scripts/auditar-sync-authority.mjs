#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const webhook = read('functions/api/sheets-admin-webhook.js');
const lifecycle = read('cloudflare/user-lifecycle-domain.js');
const appsScript = read('apps-script/ProductosUnificados.gs');
const snapshot = read('functions/api/sheets-sync-snapshot.js');

const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

check(!/deleteFirebaseUser/.test(webhook), 'Sheets no debe eliminar Firebase Auth físicamente.');
check(!/delete:\s*true/.test(webhook), 'Sheets no debe borrar users/orders de Firestore.');
check(/softDeleteUser/.test(webhook) && /applyUserLifecycle/.test(webhook), 'Sheets debe usar lifecycle canónico para usuarios.');
check(/deleted:\s*fsBoolean\(true\)/.test(lifecycle), 'Lifecycle debe conservar tombstone histórico.');
check(/input\.entity === 'order'/.test(webhook) && /espejo de solo lectura/.test(webhook), 'Pedidos debe ser read-only desde Sheets.');
check(!/entity: 'order', orderId:/.test(appsScript), 'Apps Script no debe enviar cambios de pedidos al webhook.');
check(/baseChangeId/.test(appsScript) && /baseChangeId/.test(webhook), 'Usuarios debe usar optimistic concurrency.');
check(/lastChangeId/.test(snapshot), 'Snapshots deben transportar la revisión actual.');
check(/auditLog/.test(webhook), 'Cambios administrativos desde Sheets deben quedar auditados.');

if (errors.length) {
  console.error(`Auditoría de autoridad de sincronización: ${errors.length} problema(s):`);
  errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}
console.log('OK — autoridad de sincronización única: productos bidireccional, usuarios administrativos, pedidos/auditoría read-only.');
