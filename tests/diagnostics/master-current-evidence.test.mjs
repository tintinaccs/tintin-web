import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCurrentEvidence } from '../../functions/api/master-diagnostics.js';

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
