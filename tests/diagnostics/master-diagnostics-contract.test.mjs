import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('Diagnóstico Maestro distingue autenticación y límites temporales de GitHub', () => {
  const source = read('functions/api/master-diagnostics.js');
  assert.match(source, /error\?\.status===401 \|\| \/sesión\|super admin\|correo verificado\|autenticación\//);
  assert.match(source, /const rateLimited=isGithubRateLimited\(error\)/);
  assert.match(source, /authFailure\?401:\(rateLimited\?503:\(error\?\.status===403\?502:500\)\)/);
  assert.match(source, /code:rateLimited\?'github_rate_limited'/);
  assert.match(source, /'retry-after':'60'/);
});
