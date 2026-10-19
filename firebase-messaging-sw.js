/* =============================================================
   TINTIN — Service worker de Firebase Cloud Messaging (Web Push)

   Vive en la raíz del sitio a propósito: el SDK de Firebase Messaging
   sólo acepta un registro con alcance "/" para recibir mensajes con la
   aplicación cerrada.

   Acá NO hay ninguna credencial de servidor: la configuración de abajo
   es la misma configuración pública del SDK web que ya está en
   js/core/firebase/firebase.js (identificadores del proyecto, no
   secretos). La clave privada de la cuenta de servicio y el secreto del
   webhook viven únicamente en las variables cifradas de Cloudflare.

   Los mensajes se envían SIN bloque `notification` (sólo `data`), así
   que FCM no muestra nada por su cuenta: la única notificación visible
   es la que crea onBackgroundMessage acá abajo. Ese es el motivo por el
   que no aparecen avisos duplicados y por el que podemos controlar el
   `tag`, el ícono y el destino del clic.
   ============================================================= */

// Cambiar esta versión fuerza a los navegadores a tratar el archivo como
// nuevo. Junto con la regla no-cache de _headers y skipWaiting/clients.claim
// de abajo, ningún dispositivo queda atrapado en una versión vieja.
const TINTIN_SW_VERSION = '2026-10-19-push-navigation-2';

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = safeInternalLink(event.notification?.data?.url);
  const targetUrl = new URL(link, self.location.origin + '/').href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reutiliza una ventana de Tintin ya abierta: le pide navegar al destino
    // y la trae al frente, en vez de dejar dos copias del panel abiertas.
    for (const client of windows) {
      let sameOrigin = false;
      try { sameOrigin = new URL(client.url).origin === self.location.origin; } catch {}
      if (!sameOrigin || !/^\/admin(?:\.html)?$/.test(new URL(client.url).pathname)) continue;
      if ('navigate' in client) {
        try {
          const navigated = await client.navigate(targetUrl);
          if (!navigated) continue;
        } catch { continue; }
      } else {
        try { client.postMessage({ type: 'tintin-push-navigate', url: link }); } catch {}
      }
      try { await client.focus(); } catch {}
      return;
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0',
  authDomain: 'tintinaccesorios.pages.dev',
  projectId: 'tintin-accesorios',
  messagingSenderId: '207918562502',
  appId: '1:207918562502:web:c2ebe4f8d96dad3a50abc7'
});

const messaging = firebase.messaging();

const DEFAULT_LINK = '/admin.html?section=pedidos';
const NOTIFICATION_ICON = '/assets-tintin/images/admin/push-icon-192.png';
const NOTIFICATION_BADGE = '/assets-tintin/images/admin/push-badge-96.png';

self.addEventListener('install', () => {
  // Sin esto, una pestaña abierta del panel puede dejar activa la versión
  // anterior del service worker por tiempo indefinido.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

/** Sólo se acepta un destino interno del propio sitio: nada de orígenes externos. */
function safeInternalLink(rawLink) {
  const link = String(rawLink || '').trim();
  if (!/^(?:\/)?admin(?:\.html)?(?:[?#]|$)/.test(link)) return DEFAULT_LINK;
  try {
    const url = new URL(link, self.location.origin + '/');
    if (url.origin !== self.location.origin) return DEFAULT_LINK;
    if (!/^\/admin(?:\.html)?$/.test(url.pathname)) return DEFAULT_LINK;
    if (!url.searchParams.has('section') && url.hash) {
      const section = url.hash.slice(1).replace(/^section-/, '');
      if (/^[a-z][a-z-]{0,60}$/.test(section)) url.searchParams.set('section', section);
    }
    return `/admin.html${url.search}`;
  } catch {
    return DEFAULT_LINK;
  }
}

function cleanText(value, maxLength) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

messaging.onBackgroundMessage(payload => {
  const data = payload && payload.data ? payload.data : {};
  const title = cleanText(data.title, 90) || 'Tintin Pedidos';
  const body = cleanText(data.body, 160);
  const link = safeInternalLink(data.url);
  // El `tag` estable hace que un reintento del mismo evento reemplace el
  // aviso anterior en lugar de sumar uno nuevo.
  const tag = cleanText(data.tag || data.eventId, 120) || 'tintin-push';

  return self.registration.showNotification(title, {
    body,
    tag,
    renotify: false,
    silent: false,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    lang: 'es-PY',
    dir: 'ltr',
    requireInteraction: false,
    data: {
      url: link,
      type: cleanText(data.type, 40),
      orderId: cleanText(data.orderId, 220),
      eventId: cleanText(data.eventId, 260),
      swVersion: TINTIN_SW_VERSION
    }
  });
});
