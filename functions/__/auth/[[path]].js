// =============================================================
// TINTIN — Proxy transparente hacia el dominio real de Firebase Auth
//
// Firebase Authentication sirve sus páginas de ayuda (el manejador de
// resultado de Google y el iframe que usa para detectarlo) bajo
// /__/auth/* en el dominio configurado como "authDomain" —
// tintin-accesorios.firebaseapp.com. Cuando ese dominio es distinto al
// del sitio (como pasa hoy, sea GitHub Pages o Cloudflare Pages), Safari
// y otros navegadores tratan esas páginas como almacenamiento de
// terceros y restringen o bloquean lo que necesitan para completar el
// login — de ahí que a veces la ventana quede bloqueada o la sesión no
// se guarde al volver.
//
// Esta función reexpone esas mismas páginas bajo /__/auth/* de ESTE
// dominio, reenviando la petición a firebaseapp.com y devolviendo la
// respuesta tal cual. Para que sirva de algo, "authDomain" en
// js/core/firebase/firebase.js tiene que apuntar a este mismo dominio (paso separado,
// recién después de autorizarlo en la consola de Firebase).
// =============================================================

const FIREBASE_AUTH_ORIGIN = 'https://tintin-accesorios.firebaseapp.com';

export async function onRequest(context) {
  const { request } = context;
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, FIREBASE_AUTH_ORIGIN);

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete('host');
  forwardHeaders.delete('cf-connecting-ip');
  forwardHeaders.delete('cf-ipcountry');
  forwardHeaders.delete('cf-ray');
  forwardHeaders.delete('cf-visitor');

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: forwardHeaders,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    // El navegador tiene que ser quien siga cualquier redirect (por ejemplo
    // hacia accounts.google.com para elegir la cuenta) — si este proxy lo
    // siguiera por su cuenta, la barra de direcciones y las cookies de
    // Google quedarían mal.
    redirect: 'manual'
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  // Si vinieran de firebaseapp.com, podrían impedir que esta respuesta se
  // muestre embebida (el iframe de detección) o ejecute sus propios
  // scripts bajo este origen — se sacan para que el proxy sea transparente.
  responseHeaders.delete('content-security-policy');
  responseHeaders.delete('content-security-policy-report-only');
  responseHeaders.delete('x-frame-options');

  const location = responseHeaders.get('location');
  if (location) {
    try {
      const locationUrl = new URL(location, FIREBASE_AUTH_ORIGIN);
      if (locationUrl.origin === FIREBASE_AUTH_ORIGIN) {
        // Un redirect que Firebase manda de vuelta a su propio origen se
        // reescribe para que siga pasando por este proxy — si no, el
        // navegador saltaría directo a firebaseapp.com y se pierde el
        // mismo-origen que es todo el punto de este archivo.
        const rewritten = new URL(locationUrl.pathname + locationUrl.search, incomingUrl.origin);
        responseHeaders.set('location', rewritten.toString());
      }
    } catch {
      // Location con formato inesperado: se deja tal cual vino.
    }
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}
