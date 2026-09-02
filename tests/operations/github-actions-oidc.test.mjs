import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GITHUB_ACTIONS_OIDC_AUDIENCE,
  GitHubActionsOidcError,
  verifyGitHubActionsOidc,
} from '../../functions/lib/github-actions-oidc.js';

const NOW = 1_800_000_000;
const REPOSITORY = 'tintinaccs/tintin-web';
const REF = 'refs/heads/main';
const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/drenar-cola-sync-catalogo.yml@${REF}`;

function base64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

function encodeJson(value) {
  return base64Url(Buffer.from(JSON.stringify(value)));
}

async function fixture() {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  Object.assign(publicJwk, {
    kid: 'test-signing-key',
    alg: 'RS256',
    use: 'sig',
  });
  const fetchImpl = async () => new Response(JSON.stringify({ keys: [publicJwk] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

  async function token(overrides = {}) {
    const header = encodeJson({ alg: 'RS256', typ: 'JWT', kid: publicJwk.kid });
    const payload = encodeJson({
      iss: 'https://token.actions.githubusercontent.com',
      aud: GITHUB_ACTIONS_OIDC_AUDIENCE,
      sub: `repo:${REPOSITORY}:ref:${REF}`,
      repository: REPOSITORY,
      ref: REF,
      ref_type: 'branch',
      workflow_ref: WORKFLOW_REF,
      event_name: 'schedule',
      iat: NOW - 5,
      nbf: NOW - 5,
      exp: NOW + 300,
      run_id: '1234',
      run_attempt: '1',
      ...overrides,
    });
    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      pair.privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    );
    return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
  }

  return { fetchImpl, token };
}

test('acepta únicamente el workflow programado de main con OIDC válido', async () => {
  const { fetchImpl, token } = await fixture();
  const claims = await verifyGitHubActionsOidc(await token(), {
    fetchImpl,
    nowSeconds: NOW,
  });
  assert.equal(claims.repository, REPOSITORY);
  assert.equal(claims.event_name, 'schedule');
});

test('rechaza un token firmado pero emitido para otro repositorio', async () => {
  const { fetchImpl, token } = await fixture();
  await assert.rejects(
    verifyGitHubActionsOidc(await token({
      repository: 'otra-cuenta/otro-repo',
      sub: `repo:otra-cuenta/otro-repo:ref:${REF}`,
    }), {
      fetchImpl,
      nowSeconds: NOW,
    }),
    error => error instanceof GitHubActionsOidcError && error.code === 'invalid_repository',
  );
});

test('rechaza eventos distintos del schedule o despacho manual', async () => {
  const { fetchImpl, token } = await fixture();
  await assert.rejects(
    verifyGitHubActionsOidc(await token({ event_name: 'pull_request' }), {
      fetchImpl,
      nowSeconds: NOW,
    }),
    error => error instanceof GitHubActionsOidcError && error.code === 'invalid_event',
  );
});

test('rechaza tokens vencidos aunque la firma sea válida', async () => {
  const { fetchImpl, token } = await fixture();
  await assert.rejects(
    verifyGitHubActionsOidc(await token({ iat: NOW - 900, exp: NOW - 120 }), {
      fetchImpl,
      nowSeconds: NOW,
    }),
    error => error instanceof GitHubActionsOidcError && error.code === 'token_expired',
  );
});

test('el scheduler de Sheets usa OIDC y no duplica la cuenta de servicio Firebase en GitHub', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..', '..');

  const [workflow, routes, endpoint] = await Promise.all([
    readFile(resolve(root, '.github/workflows/drenar-cola-sync-catalogo.yml'), 'utf8'),
    readFile(resolve(root, '_routes.json'), 'utf8'),
    readFile(resolve(root, 'functions/api/catalog-sheet-sync-drain.js'), 'utf8'),
  ]);

  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /tintin-catalog-sheet-sync/);
  assert.match(workflow, /\/api\/catalog-sheet-sync-drain/);
  assert.doesNotMatch(workflow, /secrets\.FIREBASE_SERVICE_ACCOUNT_(?:JSON|KEY)/);
  assert.doesNotMatch(workflow, /secrets\.SHEETS_ENGAGEMENT_SECRET/);
  assert.doesNotMatch(workflow, /\bnpm ci\b/);

  const routeConfig = JSON.parse(routes);
  assert.ok(routeConfig.include.includes('/api/catalog-sheet-sync-drain'));
  assert.match(endpoint, /verifyGitHubActionsOidc/);
  assert.match(endpoint, /drainCatalogSheetSyncQueueScheduled/);
});
