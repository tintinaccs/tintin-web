import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const source = fs.readFileSync(path.join(root, 'functions/api/admin-backfill-canonical-identity.js'), 'utf8');

test('el backfill está protegido por SuperAdmin y es dry-run por defecto', () => {
  assert.match(source, /requireSuperAdmin\(request\)/);
  assert.match(source, /const apply = body\?\.apply === true/);
  assert.match(source, /mode: apply \? 'apply' : 'dry-run'/);
});

test('usuarios y pedidos derivan customerId exclusivamente del UID', () => {
  assert.match(source, /const expected = `CUS_\$\{uid\}`/g);
  assert.doesNotMatch(source, /email.*CUS_/i);
  assert.doesNotMatch(source, /name.*CUS_/i);
});

test('un customerId incompatible bloquea la escritura', () => {
  assert.match(source, /conflicts\.push\(\{ type: 'user'/);
  assert.match(source, /conflicts\.push\(\{ type: 'order'/);
  assert.match(source, /if \(conflicts\.length\)/);
  assert.match(source, /error: 'identity_conflicts'/);
  assert.match(source, /409/);
});

test('el backfill sólo hace merge de customerId y conserva precondición de versión', () => {
  assert.match(source, /mergeFields: \['customerId'\]/g);
  assert.match(source, /currentDocument: precondition\(document\)/g);
  assert.match(source, /backfill_identidad_canonica/);
  assert.match(source, /auditLog\/\$\{eventId\}/);
});
