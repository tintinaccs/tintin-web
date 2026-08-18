import { firestoreAdminGet, firestoreAdminList } from './firebase-admin-ligero.js';

const DEFAULT_ACCESS = Object.freeze({
  get: firestoreAdminGet,
  list: firestoreAdminList,
});

export const ADMIN_RUNTIME_CHECK_IDS = Object.freeze([
  'products',
  'collections',
  'orders',
  'users',
  'reviews',
  'likes',
  'emailLogs',
  'siteContent',
  'visualBuilder',
]);

export function classifyAdminRuntimeError(error) {
  const message = String(error?.message || error || '');
  if (/FIREBASE_SERVICE_ACCOUNT_KEY/i.test(message)) return 'service_account_config';
  if (/autenticar la cuenta de servicio|oauth2|access token/i.test(message)) return 'service_account_auth';
  if (/Firestore\s+(?:GET|LIST|PATCH|DELETE|COMMIT|RUN QUERY)/i.test(message)) return 'firestore_unavailable';
  if (/fetch failed|network|timeout|timed out|ECONN|ENOTFOUND|EAI_AGAIN/i.test(message)) return 'network_unavailable';
  return 'runtime_check_failed';
}

async function runProbe(id, callback) {
  const started = Date.now();
  try {
    await callback();
    return { id, ok: true, ms: Date.now() - started, code: '' };
  } catch (error) {
    const code = classifyAdminRuntimeError(error);
    console.error(JSON.stringify({
      message: 'admin runtime health probe failed',
      probe: id,
      code,
      detail: error?.message || String(error),
    }));
    return { id, ok: false, ms: Date.now() - started, code };
  }
}

/**
 * Smoke no destructivo del backend administrativo.
 *
 * No devuelve documentos ni datos de clientas: únicamente comprueba que la
 * cuenta de servicio que usa Cloudflare puede leer las superficies reales que
 * sostienen el Super Admin. Los documentos/colecciones pueden no existir; un
 * 404 se considera lectura válida porque los helpers admin lo normalizan a
 * null/array vacío. `access` es inyectable exclusivamente para tests.
 */
export async function runAdminRuntimeChecks(env, { access = DEFAULT_ACCESS } = {}) {
  const checks = {};
  const probe = async (id, callback) => {
    checks[id] = await runProbe(id, callback);
  };

  // La primera lectura calienta el token OAuth cacheado del helper. El resto
  // se ejecuta secuencialmente para no disparar múltiples intercambios OAuth
  // simultáneos en un isolate nuevo de Cloudflare.
  await probe('products', () => access.list(env, 'products', 1));
  await probe('collections', () => access.list(env, 'collections', 1));
  await probe('orders', () => access.list(env, 'orders', 1));
  await probe('users', () => access.list(env, 'users', 1));
  await probe('reviews', () => access.list(env, 'reviewRecords', 1));
  await probe('likes', () => access.list(env, 'likeRecords', 1));
  await probe('emailLogs', () => access.list(env, 'emailLogs', 1));
  await probe('siteContent', () => access.get(env, 'site_content/index'));
  await probe('visualBuilder', async () => {
    await access.get(env, 'visualBuilderPages/index');
    await access.get(env, 'visualBuilderDrafts/index');
    await access.list(env, 'visualBuilderHistory', 1);
  });

  const ok = ADMIN_RUNTIME_CHECK_IDS.every(id => checks[id]?.ok === true);
  return {
    ok,
    checks,
    failed: ADMIN_RUNTIME_CHECK_IDS.filter(id => checks[id]?.ok !== true),
  };
}

export function compactAdminRuntimeChecks(report) {
  return Object.fromEntries(
    ADMIN_RUNTIME_CHECK_IDS.map(id => [id, report?.checks?.[id]?.ok === true])
  );
}
