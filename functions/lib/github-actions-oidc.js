const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
const DEFAULT_AUDIENCE = 'tintin-catalog-sheet-sync';
const DEFAULT_REPOSITORY = 'tintinaccs/tintin-web';
const DEFAULT_REF = 'refs/heads/main';
const DEFAULT_WORKFLOW_REF = `${DEFAULT_REPOSITORY}/.github/workflows/drenar-cola-sync-catalogo.yml@${DEFAULT_REF}`;

export class GitHubActionsOidcError extends Error {
  constructor(code) {
    super(code);
    this.name = 'GitHubActionsOidcError';
    this.code = code;
  }
}

function decodeBase64Url(value) {
  const text = String(value || '');
  if (!text || !/^[A-Za-z0-9_-]+$/.test(text)) throw new GitHubActionsOidcError('invalid_token_encoding');
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    throw new GitHubActionsOidcError('invalid_token_encoding');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeJsonSegment(value) {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch (error) {
    if (error instanceof GitHubActionsOidcError) throw error;
    throw new GitHubActionsOidcError('invalid_token_json');
  }
}

function audienceMatches(actual, expected) {
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

function assertClaim(condition, code) {
  if (!condition) throw new GitHubActionsOidcError(code);
}

export async function verifyGitHubActionsOidc(token, {
  fetchImpl = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
  audience = DEFAULT_AUDIENCE,
  repository = DEFAULT_REPOSITORY,
  ref = DEFAULT_REF,
  workflowRef = DEFAULT_WORKFLOW_REF,
  maxTokenAgeSeconds = 10 * 60,
  clockSkewSeconds = 30,
} = {}) {
  const raw = String(token || '').trim();
  assertClaim(raw.length > 100 && raw.length < 20_000, 'invalid_token_length');

  const parts = raw.split('.');
  assertClaim(parts.length === 3, 'invalid_token_format');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonSegment(encodedHeader);
  const claims = decodeJsonSegment(encodedPayload);

  assertClaim(header?.alg === 'RS256', 'invalid_token_algorithm');
  assertClaim(typeof header?.kid === 'string' && header.kid.length > 4, 'missing_token_kid');

  let jwksResponse;
  try {
    jwksResponse = await fetchImpl(JWKS_URL, {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'error',
    });
  } catch {
    throw new GitHubActionsOidcError('oidc_jwks_unavailable');
  }
  if (!jwksResponse?.ok) throw new GitHubActionsOidcError('oidc_jwks_unavailable');

  let jwks;
  try {
    jwks = await jwksResponse.json();
  } catch {
    throw new GitHubActionsOidcError('oidc_jwks_invalid');
  }
  const jwk = Array.isArray(jwks?.keys) ? jwks.keys.find(key => key?.kid === header.kid && key?.kty === 'RSA') : null;
  assertClaim(jwk, 'oidc_signing_key_not_found');

  let publicKey;
  try {
    publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch {
    throw new GitHubActionsOidcError('oidc_signing_key_invalid');
  }

  let signatureValid = false;
  try {
    signatureValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
  } catch {
    signatureValid = false;
  }
  assertClaim(signatureValid, 'invalid_token_signature');

  const now = Number(nowSeconds);
  const issuedAt = Number(claims?.iat);
  const expiresAt = Number(claims?.exp);
  const notBefore = claims?.nbf == null ? null : Number(claims.nbf);

  assertClaim(claims?.iss === ISSUER, 'invalid_token_issuer');
  assertClaim(audienceMatches(claims?.aud, audience), 'invalid_token_audience');
  assertClaim(Number.isFinite(expiresAt) && expiresAt >= now - clockSkewSeconds, 'token_expired');
  assertClaim(Number.isFinite(issuedAt) && issuedAt <= now + clockSkewSeconds, 'invalid_token_iat');
  assertClaim(issuedAt >= now - maxTokenAgeSeconds - clockSkewSeconds, 'token_too_old');
  if (notBefore != null) assertClaim(Number.isFinite(notBefore) && notBefore <= now + clockSkewSeconds, 'token_not_active');

  assertClaim(claims?.repository === repository, 'invalid_repository');
  assertClaim(claims?.ref === ref && claims?.ref_type === 'branch', 'invalid_ref');
  assertClaim(claims?.workflow_ref === workflowRef, 'invalid_workflow_ref');
  assertClaim(['schedule', 'workflow_dispatch'].includes(claims?.event_name), 'invalid_event');
  assertClaim(claims?.sub === `repo:${repository}:ref:${ref}`, 'invalid_subject');

  return claims;
}

export const GITHUB_ACTIONS_OIDC_AUDIENCE = DEFAULT_AUDIENCE;
