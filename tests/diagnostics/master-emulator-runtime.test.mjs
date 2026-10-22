import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('cada suite de Maestro que invoca Firebase prepara Java 21 antes del emulador', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/diagnostico-maestro.yml', import.meta.url), 'utf8');
  for (const suite of ['static', 'commerce', 'rules']) {
    const job = workflow.split(`\n  ${suite}:`)[1]?.split(/\n  [a-z][a-z-]*:/)[0];
    assert.ok(job, suite);
    const java = job.indexOf('uses: actions/setup-java@v5');
    const audit = job.indexOf(`node scripts/ejecutar-diagnostico-maestro.mjs ${suite}`);
    assert.ok(java >= 0 && audit > java, `${suite} prepara Java antes de invocar Firebase`);
    assert.match(job, /distribution: temurin\r?\n\s+java-version: '21'/);
  }
});
