const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_HOSTS = new Set(['script.google.com', 'script.googleusercontent.com']);
const MAX_REDIRECT_HOPS = 4;

/**
 * Apps Script Web Apps responden el primer POST con un 302 hacia
 * script.googleusercontent.com/macros/echo: esa URL sirve el resultado ya
 * calculado por doPost, nunca vuelve a ejecutarlo, y solo acepta GET (un
 * POST ahí devuelve 405). Por eso cada salto de redirect se sigue con GET
 * sin cuerpo, y no con el método original — y puede haber más de un salto
 * antes del contenido final, así que se siguen todos, no solo el primero.
 */
export async function fetchAppsScript(url, init = {}, fetchImpl = fetch) {
  const requestUrl = new URL(url);
  if (!ALLOWED_HOSTS.has(requestUrl.hostname)) throw new Error('Apps Script URL no permitida.');

  let response = await fetchImpl(requestUrl, { ...init, redirect: 'manual' });
  let fromUrl = requestUrl;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS && REDIRECT_STATUSES.has(response.status); hop += 1) {
    const location = response.headers.get('location');
    if (!location) return response;
    const redirectUrl = new URL(location, fromUrl);
    if (!ALLOWED_HOSTS.has(redirectUrl.hostname)) throw new Error('Redirección de Apps Script no permitida.');

    response = await fetchImpl(redirectUrl, { method: 'GET', redirect: 'manual' });
    fromUrl = redirectUrl;
  }

  return response;
}
