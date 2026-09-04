import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../functions/api/master-diagnostics.js', import.meta.url), 'utf8');

test('el Diagnóstico Maestro distingue autenticación ausente de error interno', () => {
  assert.match(source, /error\?\.status===401/);
  assert.match(source, /status=authFailure\?401/);
});
