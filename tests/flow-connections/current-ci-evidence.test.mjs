import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCurrentEvidence } from '../../functions/api/master-diagnostics.js';
import { buildLiveEdges } from '../../js/admin/flujo-conexiones/live-checks.js';
import { EDGES, ESTADOS } from '../../js/admin/flujo-conexiones/datos-flujo-conexiones.js';
import { resolveState } from '../../js/admin/flujo-conexiones/estado-flujo.js';

test('reconoce el nombre real de Pages del proyecto Tintin y su aplicación', () => {
  const check = { name: 'Cloudflare Pages: tintinaccesorios', app: { id: 85455 }, head_sha: 'current', status: 'completed', conclusion: 'success' };
  assert.equal(buildCurrentEvidence('current', [check]).checks.cloudflarePages.state, 'PASS');
  for (const change of [
    { name: 'Cloudflare Pages: otro-proyecto' },
    { app: { id: 15368 } },
    { app: undefined },
    { head_sha: undefined },
    { head_sha: 'older' },
  ]) {
    assert.equal(buildCurrentEvidence('current', [{ ...check, ...change }]).checks.cloudflarePages.state, 'NOT_VERIFIED');
  }
});

test('un check reciente pendiente o fallido no hereda el éxito de otro nombre de Pages', () => {
  const old = { id: 1, name: 'Cloudflare Pages', app: { id: 85455 }, head_sha: 'current', status: 'completed', conclusion: 'success' };
  for (const [status, conclusion, expected] of [['in_progress', null, 'RUNNING'], ['completed', 'failure', 'FAIL']]) {
    const current = { ...old, id: 2, name: 'Cloudflare Pages: tintinaccesorios', status, conclusion };
    for (const checks of [[old, current], [current, old]]) {
      assert.equal(buildCurrentEvidence('current', checks).checks.cloudflarePages.state, expected);
    }
  }
});

test('el despliegue reconocido llega hasta la conexión real sin ocultar fallos', () => {
  const edge = EDGES.find(item => item.from === 'github-actions' && item.to === 'deployments');
  const audit = { name: 'Repository audit', status: 'completed', conclusion: 'success' };
  for (const [conclusion, expected] of [['success', ESTADOS.PROD], ['failure', ESTADOS.ERROR]]) {
    const currentEvidence = buildCurrentEvidence('current', [audit, {
      name: 'Cloudflare Pages: tintinaccesorios', app: { id: 85455 }, head_sha: 'current',
      status: 'completed', conclusion,
    }]);
    const live = buildLiveEdges({ currentEvidence }, new Date().toISOString())[edge.id];
    assert.equal(resolveState(edge, live, ESTADOS), expected);
  }
});
