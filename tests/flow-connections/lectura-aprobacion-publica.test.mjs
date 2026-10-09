import test from 'node:test';
import assert from 'node:assert/strict';
import { readPublicApprovals } from '../../scripts/leer-aprobacion-publica.mjs';
import { validateApproval } from '../../scripts/mantenimiento-flujos-core.mjs';

test('Lee el historial real sin transmitir credenciales y exige revisión autorizada', async () => {
  const reviews = [{ state: 'approved', user: { type: 'User', id: 274170818 }, environments: [{ id: 123 }] }];
  const result = await readPublicApprovals('tintinaccs/tintin-web', '456', async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/tintinaccs/tintin-web/actions/runs/456/approvals');
    assert.equal(options.headers.authorization, undefined);
    return { ok: true, json: async () => reviews };
  });
  validateApproval(result, { id: 123 }, { reviewerIds: [274170818] });
  assert.throws(() => validateApproval(result, { id: 999 }, { reviewerIds: [274170818] }));
  assert.throws(() => validateApproval(result, { id: 123 }, { reviewerIds: [1] }));
});
test('No acepta un error de GitHub como aprobación', async () => {
  await assert.rejects(readPublicApprovals('tintinaccs/tintin-web', '456', async () => ({ ok: false, status: 403 })), /HTTP 403/);
  await assert.rejects(readPublicApprovals('tintinaccs/tintin-web', '456', async () => ({ ok: true, json: async () => ({}) })), /inválido/);
});
test('No consulta otros repositorios ni rutas inyectadas', async () => {
  const forbidden = () => { throw new Error('No debe consultar'); };
  await assert.rejects(readPublicApprovals('otro/repo', '456', forbidden), /inválidos/);
  await assert.rejects(readPublicApprovals('tintinaccs/tintin-web', '../456', forbidden), /inválidos/);
});
