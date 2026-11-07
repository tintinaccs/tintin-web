import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../.github/workflows/auditar-tintin.yml', import.meta.url), 'utf8');

test('CI valida el checkout sin escribir la rama ni invalidar su propio SHA', () => {
  assert.doesNotMatch(source, /contents:\s*write|persist-credentials:\s*true/);
  assert.doesNotMatch(source, /git\s+(?:push|commit|pull)|sync-cloud-skills-artifacts/);
  assert.match(source, /Reject generated artifact drift\n\s+run: git diff --exit-code -- \./);
  assert.match(source, /run: npm run build:pages/);
  assert.match(source, /run: python3 scripts\/agent\/check-cloud-skills.py|python3 scripts\/agent\/check-cloud-skills.py/);
});
