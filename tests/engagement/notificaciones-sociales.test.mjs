import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

const files = await Promise.all([
  read('cloudflare/notificaciones-sociales.js'),
  read('functions/api/notifications.js'),
  read('functions/api/engagement.js'),
  read('cloudflare/participacion-clientes.js'),
  read('cloudflare/participacion-admin.js'),
  read('js/pages/product/resenas-producto.js'),
  read('js/components/notifications/notificaciones-clientes.js'),
  read('js/admin/notifications/notificaciones-admin.js'),
  read('js/email/notificacion-pedido-resend.js'),
  read('firestore.rules'),
  read('js/components/navigation/compartido/carga-navegacion.js'),
  read('js/components/navigation/compartido/iconos.js'),
  read('js/components/navigation/escritorio/encabezado-escritorio.js'),
  read('js/components/navigation/tableta/encabezado-tableta.js'),
  read('js/components/navigation/movil/encabezado-movil.js'),
]);

const [
  core, api, engagementApi, customerEngagement, adminEngagement, productReviews,
  clientUi, adminUi, orderEmail, rules, navigationRuntime, sharedIcons,
  desktopHeader, tabletHeader, mobileHeader,
] = files;

test('el núcleo social usa notificaciones dirigidas, idempotentes y saneadas', () => {
  assert.match(core, /buildUserNotificationWrite/);
  assert.match(core, /buildAdminNotificationWrite/);
  assert.match(core, /dedupeKey/);
  assert.match(core, /normalizeDedupeKey/);
  assert.match(core, /review_like/);
  assert.match(core, /safeImageUrl/);
  assert.match(core, /markNotificationRead/);
  assert.match(core, /markAllNotificationsRead/);
  assert.match(core, /nextPageToken/);
});

test('la API cubre altas, pedidos, recuperación y lectura para clienta y superadmin', () => {
  for (const action of [
    'profileCreated', 'orderCreated', 'notificationSeen', 'notificationsSeenAll',
    'adminNotificationSeen', 'adminNotificationsSeenAll', 'adminOrderStatusChanged',
  ]) assert.match(api, new RegExp(action));
  assert.match(api, /requireFirebaseUser/);
  assert.match(api, /requireSuperAdmin/);
  assert.match(api, /PROFILE_RECOVERY_WINDOW_MS/);
  assert.match(api, /24 \* 60 \* 60 \* 1000/);
  assert.match(api, /profile\.firstName/);
  assert.match(api, /profile\.lastName/);
  assert.match(api, /initial_order_state/);
});

test('las respuestas entre clientas tienen ventana anti-ráfaga server-side', () => {
  assert.match(engagementApi, /REPLY_COOLDOWN_MS/);
  assert.match(engagementApi, /socialRateLimits/);
  assert.match(engagementApi, /reserveReplyWindow/);
  assert.match(engagementApi, /currentDocument/);
});

test('la participación entre clientas genera actividad social y protege identidad pública', () => {
  assert.match(customerEngagement, /toggleReviewLike/);
  assert.match(customerEngagement, /actorPublicName/);
  assert.match(customerEngagement, /buildUserNotificationWrite/);
  assert.match(customerEngagement, /buildAdminNotificationWrite/);
  assert.match(customerEngagement, /reviewLikeProducts/);
  assert.match(customerEngagement, /publicCustomerName/);
});

test('las acciones de Tintin notifican a la autora de la reseña', () => {
  assert.match(adminEngagement, /A TINTIN le gustó tu reseña/);
  assert.match(adminEngagement, /Tintin Accesorios respondió a tu reseña/);
  assert.match(adminEngagement, /buildUserNotificationWrite/);
});

test('la ficha de producto admite Me gusta, respuestas y deep links de reseña', () => {
  assert.match(productReviews, /toggleReviewLike/);
  assert.match(productReviews, /replyReview/);
  assert.match(productReviews, /data-review-id/);
  assert.match(productReviews, /id="review-/);
  assert.match(productReviews, /#review-/);
});

test('clientas tienen bandeja de 100, saneado y reintentos de acciones importantes', () => {
  assert.match(clientUi, /data-notification-badge/);
  assert.match(clientUi, /users'.*notifications|users.*,.*notifications/s);
  assert.match(clientUi, /notificationSeen/);
  assert.match(clientUi, /limit\(100\)/);
  assert.match(clientUi, /safeImageUrl/);
  assert.match(clientUi, /apiWithRetry\('notificationsSeenAll'/);
  assert.match(clientUi, /apiWithRetry\('profileCreated'/);
});

test('la campana pública evita Firestore para visitas livianas y se hidrata con sesión o demanda', () => {
  assert.match(navigationRuntime, /function attachNotificationsDemand\(\)/);
  assert.match(navigationRuntime, /\[data-nav-action="notifications"\],#tabbar-notifications/);
  assert.match(navigationRuntime, /tintin:auth-nav-updated/);
  assert.match(navigationRuntime, /hasActiveSessionHint\(\)/);
  assert.doesNotMatch(navigationRuntime, /attachProductsDemand\(\);\s*loadNavigationBehaviors\(\);\s*void loadNotificationsRuntime\(\)/);
  assert.match(sharedIcons, /bell:\s*'<path/);
  assert.match(desktopHeader, /svgIcon\(UI_ICONS\.bell/);
  assert.match(tabletHeader, /svgIcon\(UI_ICONS\.bell/);
  assert.match(mobileHeader, /svgIcon\(UI_ICONS\.bell/);
  for (const source of [desktopHeader, tabletHeader, mobileHeader]) {
    assert.match(source, /data-nav-action="notifications"/);
    assert.match(source, /data-notification-badge/);
  }
});

test('superadmin recupera estados recientes y reintenta sin carreras', () => {
  assert.match(adminUi, /adminNotifications/);
  assert.match(adminUi, /adminOrderStatusChanged/);
  assert.match(adminUi, /adm-notifications-badge/);
  assert.match(adminUi, /limit\(100\)/);
  assert.match(adminUi, /ORDER_RECOVERY_WINDOW_MS/);
  assert.match(adminUi, /orderNotificationInFlight/);
  assert.match(adminUi, /notifyOrderStatusWithRetry/);
  assert.match(adminUi, /recoverRecentOrderStatuses/);
  assert.match(adminUi, /safeImageUrl/);
});

test('pedido nuevo registra actividad social en paralelo y con reintentos', () => {
  assert.match(orderEmail, /registerOrderSocialActivity/);
  assert.match(orderEmail, /MAX_DELIVERY_ATTEMPTS/);
  assert.match(orderEmail, /socialActivityPromise/);
  assert.match(orderEmail, /registerOrderSocialActivity\(normalizedOrderId, idToken\)/);
  assert.match(orderEmail, /await socialActivityPromise/);
});

test('Firestore mantiene las notificaciones de solo lectura desde el navegador', () => {
  assert.match(rules, /match \/notifications\/\{notificationId\}/);
  assert.match(rules, /match \/adminNotifications\/\{notificationId\}/);
  assert.match(rules, /allow create, update, delete: if false;/);
});
