import assert from 'node:assert/strict';
import test from 'node:test';

test('el reintento de correos de pedido usa OIDC y no duplica secretos de Firebase/Resend en GitHub', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..', '..');

  const [workflow, routes, endpoint] = await Promise.all([
    readFile(resolve(root, '.github/workflows/drenar-cola-correo-pedidos.yml'), 'utf8'),
    readFile(resolve(root, '_routes.json'), 'utf8'),
    readFile(resolve(root, 'functions/api/order-email-drain.js'), 'utf8'),
  ]);

  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /tintin-order-email-retry/);
  assert.match(workflow, /\/api\/order-email-drain/);
  assert.doesNotMatch(workflow, /secrets\.FIREBASE_SERVICE_ACCOUNT_(?:JSON|KEY)/);
  assert.doesNotMatch(workflow, /secrets\.RESEND_API_KEY/);
  assert.doesNotMatch(workflow, /\bnpm ci\b/);

  const routeConfig = JSON.parse(routes);
  assert.ok(routeConfig.include.includes('/api/order-email-drain'));
  assert.match(endpoint, /verifyGitHubActionsOidc/);
  assert.match(endpoint, /drainOrderEmailQueueScheduled/);
  assert.match(endpoint, /tintin-order-email-retry/);
});
