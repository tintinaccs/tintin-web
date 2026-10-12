import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/test-email.js';

test('correo de diagnóstico rechaza falta de sesión antes de consultar configuración o proveedor', async () => {
  const request = new Request('https://tintinaccesorios.pages.dev/api/test-email', {
    method: 'POST', headers: { origin: 'https://tintinaccesorios.pages.dev', 'content-type': 'application/json' },
    body: JSON.stringify({ toEmail: 'nobody@example.test' }),
  });
  const response = await onRequest({ request, env: {} });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.customerSent, false);
  assert.doesNotMatch(JSON.stringify(body), /RESEND_API_KEY|no está configurad/);
});
