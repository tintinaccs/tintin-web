import { authenticatedFetch } from '../../core/auth/cliente-api-autenticado.js?v=tintin-20261022-avatar-inicial-1';

export async function recordAuditEntry(entry) {
  const response = await authenticatedFetch('/api/admin-order-mutation', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'appendAudit', entry }), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok || data?.ok !== true || !data.result?.id) throw new Error('No se pudo confirmar el registro de auditoría.');
  return data.result;
}
