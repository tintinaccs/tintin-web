// Comprueba infraestructura de Auth sin iniciar sesión, enviar credenciales ni
// atribuir a esta sonda una aceptación OAuth de usuario real.
export async function inspectFirebaseAuthHelpers({ authDomain, expectedAuthDomain, fetchImpl = fetch, timeoutMs = 15000 }) {
  if (!/^[a-z0-9.-]+$/.test(authDomain || '') || authDomain !== expectedAuthDomain) {
    throw new Error('Firebase Auth usa un authDomain distinto al configurado para este host.');
  }
  const results = [];
  for (const helper of ['iframe', 'handler']) {
    const url = `https://${authDomain}/__/auth/${helper}`;
    const response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    const type = response.headers.get('content-type') || '';
    const body = await response.text();
    const marker = helper === 'iframe' ? 'fireauth.iframe.AuthRelay.initialize' : 'fireauth.oauthhelper.widget.initialize';
    if (response.status !== 200 || !type.includes('text/html') || !body.includes(marker)) {
      throw new Error(`Helper Firebase ${helper} no disponible en el authDomain efectivo (HTTP ${response.status}).`);
    }
    results.push({ helper, url, status: response.status, type });
  }
  return results;
}
