import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { statusFromError } from '../../cloudflare/seguridad-cloudinary.js';

const read = file => fs.readFile(file, 'utf8');

test('statusFromError conserva estados HTTP válidos y usa fallback para errores internos', () => {
  assert.equal(statusFromError({ status: 401 }, 400), 401);
  assert.equal(statusFromError({ status: 403 }, 400), 403);
  assert.equal(statusFromError({ status: 409 }, 400), 409);
  assert.equal(statusFromError({ status: 700 }, 400), 400);
  assert.equal(statusFromError(new Error('fallo')), 500);
});

test('endpoints sensibles no degradan autenticación/autorización a 400', async () => {
  const files = [
    'functions/api/admin-order-mutation.js',
    'functions/api/admin-delete-user.js',
    'functions/api/admin-catalog-delete.js',
    'functions/api/admin-engagement.js',
    'functions/api/notifications.js',
    'functions/api/push-admin.js',
    'functions/api/push-test.js',
  ];
  for (const file of files) assert.match(await read(file), /statusFromError/);
});
