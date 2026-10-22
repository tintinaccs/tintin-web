import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCurrentEvidence } from '../../functions/api/master-diagnostics.js';

test('el diagnóstico manual propone el origen productivo canónico', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../../config/public-site.json', import.meta.url), 'utf8'));
  const workflow = fs.readFileSync(new URL('../../.github/workflows/diagnostico-maestro.yml', import.meta.url), 'utf8');
  const input = workflow.split('      production_origin:')[1]?.split('      include_production:')[0];
  const origin = input?.match(/^\s*default:\s*(https:\/\/\S+)\s*$/m)?.[1];
  assert.equal(origin, config.origin, 'La auditoría no debe usar un dominio anterior a la migración');
});

test('las auditorías con navegador sirven los módulos locales antes de ejecutar sus pruebas', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/diagnostico-maestro.yml', import.meta.url), 'utf8');
  for (const suite of ['static', 'commerce']) {
    const job = workflow.split(`\n  ${suite}:`)[1]?.split(/\n  [a-z][a-z-]*:/)[0];
    assert.ok(job, `Existe el trabajo ${suite}`);
    const server = job.indexOf('node scripts/servidor-local-pruebas.mjs 4173');
    const audit = job.indexOf(`node scripts/ejecutar-diagnostico-maestro.mjs ${suite}`);
    assert.ok(server >= 0 && audit > server, `${suite} debe iniciar el servidor antes de importar módulos reales`);
    assert.match(job, /curl --fail --silent --show-error http:\/\/127\.0\.0\.1:4173\/index\.html/);
    assert.match(job, /PLAYWRIGHT_BASE_URL: http:\/\/127\.0\.0\.1:4173/);
  }
});

test('la evidencia actual usa checks del commit consultado y conserva los faltantes como no verificados', () => {
  const evidence = buildCurrentEvidence('abc123def456', [
    {
      name: 'Repository audit',
      status: 'completed',
      conclusion: 'success',
      completed_at: '2026-09-20T16:00:00Z',
      details_url: 'https://github.com/tintinaccs/tintin-web/actions/runs/1',
    },
    {
      name: 'Cloudflare Pages',
      status: 'completed',
      conclusion: 'success',
      completed_at: '2026-09-20T16:01:00Z',
      details_url: 'https://dash.cloudflare.com/pages/deployments/1',
    },
  ]);

  assert.equal(evidence.commit, 'abc123def456');
  assert.equal(evidence.checks.repositoryAudit.state, 'PASS');
  assert.equal(evidence.checks.cloudflarePages.state, 'PASS');
  assert.equal(evidence.checks.productionHealth.state, 'NOT_VERIFIED');
});
