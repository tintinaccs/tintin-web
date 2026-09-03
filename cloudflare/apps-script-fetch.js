const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_HOSTS = new Set(['script.google.com', 'script.googleusercontent.com']);

/**
 * Apps Script Web Apps suelen responder el primer POST con un 302 hacia
 * script.googleusercontent.com. El seguimiento nativo de redirects puede
 * transformar POST en GET; esta envoltura conserva el método y el cuerpo y
 * solo acepta el host oficial de Google Apps Script.
 */
export async function fetchAppsScript(url, init = {}, fetchImpl = fetch) {
  const requestUrl = new URL(url);
  if (!ALLOWED_HOSTS.has(requestUrl.hostname)) throw new Error('Apps Script URL no permitida.');

  const response = await fetchImpl(requestUrl, { ...init, redirect: 'manual' });
  if (!REDIRECT_STATUSES.has(response.status)) return response;

  const location = response.headers.get('location');
  if (!location) return response;
  const redirectUrl = new URL(location, requestUrl);
  if (!ALLOWED_HOSTS.has(redirectUrl.hostname)) throw new Error('Redirección de Apps Script no permitida.');

  const method = String(init.method || 'GET').toUpperCase();
  const preserveBody = method !== 'GET' && method !== 'HEAD' && response.status !== 303;
  return fetchImpl(redirectUrl, {
    ...init,
    redirect: 'error',
    body: preserveBody ? init.body : undefined,
  });
}
