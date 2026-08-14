const fs = require('fs');
const path = require('path');
const VERSION = 'tintin-20260814-social-notifications-1';

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, value) { fs.writeFileSync(file, value); }
function replaceRequired(file, from, to, label = from) {
  const source = read(file);
  if (!source.includes(from)) throw new Error(`No se encontró el contrato requerido en ${file}: ${label}`);
  write(file, source.replace(from, to));
}
function appendOnce(file, marker, text) {
  const source = read(file);
  if (source.includes(marker)) return;
  write(file, `${source.trimEnd()}\n\n${text.trim()}\n`);
}

replaceRequired('firestore.rules', `      match /reviews/{productId} {
        allow read: if isSignedIn() &&
          !isBlockedUser() &&
          request.auth.uid == userId &&
          isStoreOpenOrAllowed();
        allow create, update, delete: if false;
      }
    }`, `      match /reviews/{productId} {
        allow read: if isSignedIn() &&
          !isBlockedUser() &&
          request.auth.uid == userId &&
          isStoreOpenOrAllowed();
        allow create, update, delete: if false;
      }

      match /reviewLikeProducts/{productId} {
        allow read: if isSignedIn() &&
          !isBlockedUser() &&
          request.auth.uid == userId;
        allow create, update, delete: if false;
      }

      match /notifications/{notificationId} {
        allow get: if isSignedIn() &&
          !isBlockedUser() &&
          request.auth.uid == userId;
        allow list: if isSignedIn() &&
          !isBlockedUser() &&
          request.auth.uid == userId &&
          request.query.limit != null &&
          request.query.limit <= 100;
        allow create, update, delete: if false;
      }
    }`, 'subcolecciones sociales de usuario');

replaceRequired('firestore.rules', `    match /likeRecords/{likeId} {
      allow read: if isSuperAdmin();
      allow create, update, delete: if false;
    }

    match /collections/{collectionId} {`, `    match /likeRecords/{likeId} {
      allow read: if isSuperAdmin();
      allow create, update, delete: if false;
    }

    match /adminNotifications/{notificationId} {
      allow get: if isSuperAdmin();
      allow list: if isSuperAdmin() &&
        request.query.limit != null &&
        request.query.limit <= 100;
      allow create, update, delete: if false;
    }

    match /collections/{collectionId} {`, 'notificaciones privadas del superadmin');

replaceRequired('functions/api/notifications.js', `  decodeFirestoreFields, firestoreAdminGet, firestoreAdminMerge,\n`, `  decodeFirestoreFields, firestoreAdminGet, firestoreAdminList, firestoreAdminMerge,\n`, 'import firestoreAdminList');
replaceRequired('functions/api/notifications.js', `  const createdAt = profile.createdAt ? new Date(profile.createdAt) : new Date();\n\n  const adminResult = await notifyAdminIfAbsent(env, {`, `  const createdAt = profile.createdAt ? new Date(profile.createdAt) : null;\n  const createdAtMs = createdAt?.getTime?.();\n  if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > 60 * 60 * 1000) {\n    return { created: false, skipped: true, reason: 'existing_profile' };\n  }\n\n  const adminResult = await notifyAdminIfAbsent(env, {`, 'guard de altas históricas');
replaceRequired('functions/api/notifications.js', `      if (action === 'adminNotificationsSeenAll') {\n        const count = await markAllNotificationsRead(env, { admin: true, limit: 150 });\n        return jsonResponse({ ok: true, count }, 200, origin, request.url);\n      }`, `      if (action === 'adminNotificationsSeenAll') {\n        const documents = await firestoreAdminList(env, 'adminNotifications', 100);\n        const unreadSources = documents\n          .filter(document => document?.fields?.read?.booleanValue !== true)\n          .map(document => decodeFirestoreFields(document.fields || {}));\n        await Promise.allSettled(unreadSources.map(notification => markSourceSeen(env, notification)));\n        const count = await markAllNotificationsRead(env, { admin: true, limit: 100 });\n        return jsonResponse({ ok: true, count }, 200, origin, request.url);\n      }`, 'integración de marcar todo con badges existentes');

replaceRequired('js/components/notifications/notificaciones-clientes.js', `  authUnsubscribe = onAuthStateChanged(auth, user => {\n    currentUser = user || null;\n    setTriggersVisible(Boolean(user));\n    subscribe(currentUser);\n  });`, `  authUnsubscribe = onAuthStateChanged(auth, user => {\n    currentUser = user || null;\n    setTriggersVisible(Boolean(user));\n    subscribe(currentUser);\n    if (currentUser) {\n      api('profileCreated').catch(error => console.warn('[notifications] No se pudo registrar el alta social:', error));\n    }\n  });`, 'alta social desde sesión pública');

appendOnce('css/admin/notificaciones-admin.css', '.adm-notifications-wrap .tt-notification-badge', `
.adm-notifications-wrap .tt-notification-badge {
  position:absolute;
  top:-6px;
  right:-7px;
  min-width:18px;
  height:18px;
  padding:0 5px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:2px solid #fff;
  border-radius:999px;
  background:#9f315c;
  color:#fff;
  font-size:10px;
  font-weight:850;
  line-height:1;
  box-shadow:0 4px 10px rgba(159,49,92,.22);
}
.adm-notifications-wrap .tt-notification-badge[hidden] { display:none!important; }
`);

replaceRequired('js/pages/profile/mantenimiento-perfil.js', `      return \`<article class="perfil-order-row">`, `      const orderAnchor = String(order.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 220);\n      return \`<article class="perfil-order-row" id="pedido-\${orderAnchor}" data-order-id="\${orderAnchor}">`, 'ancla de pedido');
replaceRequired('js/pages/profile/mantenimiento-perfil.js', `    }).join('') + (sorted.length > visible.length ? \`<div class="tt-profile-state">Mostrando los 10 pedidos más recientes de \${sorted.length}.</div>\` : '');\n  }`, `    }).join('') + (sorted.length > visible.length ? \`<div class="tt-profile-state">Mostrando los 10 pedidos más recientes de \${sorted.length}.</div>\` : '');\n\n    const requested = String(location.hash || '').match(/^#pedido-([A-Za-z0-9_-]+)$/)?.[1];\n    if (requested) {\n      requestAnimationFrame(() => {\n        const target = document.getElementById(\`pedido-\${requested}\`);\n        if (!target) return;\n        target.querySelector('details')?.setAttribute('open', '');\n        target.classList.add('tt-profile-order-focus');\n        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });\n        window.setTimeout(() => target.classList.remove('tt-profile-order-focus'), 2200);\n      });\n    }\n  }`, 'resolución de deep link de pedido');
replaceRequired('js/pages/profile/mantenimiento-perfil.js', `      .perfil-order-row { padding:14px!important;border-radius:14px;margin-bottom:10px;border:1px solid var(--border,#ecd5de)!important; }\n`, `      .perfil-order-row { padding:14px!important;border-radius:14px;margin-bottom:10px;border:1px solid var(--border,#ecd5de)!important; }\n      .perfil-order-row.tt-profile-order-focus { box-shadow:0 0 0 4px rgba(199,154,59,.24),0 18px 38px rgba(173,63,103,.14)!important; }\n`, 'highlight de pedido');

replaceRequired('admin.html', `</body>`, `<script type="module" src="js/admin/notifications/notificaciones-admin.js?v=${VERSION}"></script>\n</body>`, 'runtime de notificaciones admin');
replaceRequired('product.html', `<link rel="stylesheet" href="css/pages/product/resenas-producto.css?v=tintin-20260814-reviews-pink-gold-1">`, `<link rel="stylesheet" href="css/pages/product/resenas-producto.css?v=tintin-20260814-reviews-pink-gold-1">\n  <link rel="stylesheet" href="css/components/notifications/interacciones-sociales.css?v=${VERSION}">`, 'estilos sociales de producto');
replaceRequired('product.html', `js/pages/product/resenas-producto.js?v=tintin-20260814-reviews-pink-gold-1`, `js/pages/product/resenas-producto.js?v=${VERSION}`, 'runtime social de reseñas');

replaceRequired('js/components/navigation/entrada-navegacion-publica.js', `import { renderDesktopHeader } from './escritorio/encabezado-escritorio.js';`, `import { renderDesktopHeader } from './escritorio/encabezado-escritorio.js?v=${VERSION}';`);
replaceRequired('js/components/navigation/entrada-navegacion-publica.js', `import { renderTabletHeader, renderTabletMenu } from './tableta/encabezado-tableta.js';`, `import { renderTabletHeader, renderTabletMenu } from './tableta/encabezado-tableta.js?v=${VERSION}';`);
replaceRequired('js/components/navigation/entrada-navegacion-publica.js', `import { renderMobileTabbar } from './movil/encabezado-movil.js';`, `import { renderMobileTabbar } from './movil/encabezado-movil.js?v=${VERSION}';`);
replaceRequired('js/inicio-navegacion-publica.js', `const MODULE_VERSION = 'tintin-20260810-global-studio-7';`, `const MODULE_VERSION = '${VERSION}';`);

replaceRequired('js/pages/checkout/checkout-puente-correo.js', `../../email/notificacion-pedido-resend.js?v=tintin-20260717-resend-1`, `../../email/notificacion-pedido-resend.js?v=${VERSION}`, 'notificación social de pedido');
replaceRequired('js/orders/pedido-checkout-seguro.js', `../pages/checkout/checkout-puente-correo.js?v=tintin-20260716-cloudinary-fix-1`, `../pages/checkout/checkout-puente-correo.js?v=${VERSION}`, 'puente de checkout social');

{
  const file = 'js/components/cart/sincronizacion-carrito.js';
  let source = read(file);
  const before = source;
  source = source.replace(/pedido-checkout-seguro\.js\?v=[A-Za-z0-9._-]+/g, `pedido-checkout-seguro.js?v=${VERSION}`);
  if (source === before) throw new Error('No se encontró import de pedido-checkout-seguro en sincronizacion-carrito.js');
  write(file, source);
}

for (const file of fs.readdirSync('.').filter(name => name.endsWith('.html'))) {
  let source = read(file);
  source = source
    .replace(/js\/inicio-navegacion-publica\.js\?v=[A-Za-z0-9._-]+/g, `js/inicio-navegacion-publica.js?v=${VERSION}`)
    .replace(/js\/components\/navigation\/entrada-navegacion-publica\.js\?v=[A-Za-z0-9._-]+/g, `js/components/navigation/entrada-navegacion-publica.js?v=${VERSION}`)
    .replace(/js\/components\/cart\/sincronizacion-carrito\.js\?v=[A-Za-z0-9._-]+/g, `js/components/cart/sincronizacion-carrito.js?v=${VERSION}`);
  write(file, source);
}

const walk = current => {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) {
      let source = read(full);
      source = source.replace(/sincronizacion-carrito\.js\?v=[A-Za-z0-9._-]+/g, `sincronizacion-carrito.js?v=${VERSION}`);
      write(full, source);
    }
  }
};
walk('js');

console.log('Social commerce final patches applied.');
