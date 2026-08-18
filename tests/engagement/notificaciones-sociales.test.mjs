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
  read('css/components/notifications/notificaciones-sociales.css'),
  read('css/components/navigation/compartido/responsive-shell-hardening.css'),
]);

const [
  core, api, engagementApi, customerEngagement, adminEngagement, productReviews,
  clientUi, adminUi, orderEmail, rules, navigationRuntime, notificationCss, responsiveCss,
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

test('clientas escuchan Firestore realtime sin polling y con metadatos en vivo', () => {
  assert.match(clientUi, /data-notification-badge/);
  assert.match(clientUi, /users'.*notifications|users.*,.*notifications/s);
  assert.match(clientUi, /notificationSeen/);
  assert.match(clientUi, /limit\(150\)/);
  assert.match(clientUi, /onSnapshot\(source, \{ includeMetadataChanges: true \}/);
  assert.match(clientUi, /tintin:notifications-realtime/);
  assert.match(clientUi, /safeImageUrl/);
  assert.match(clientUi, /apiWithRetry\('notificationsSeenAll'/);
  assert.match(clientUi, /apiWithRetry\('profileCreated'/);
  assert.doesNotMatch(clientUi, /setInterval\(/);
});

test('el shell inicia notificaciones en todas las páginas y no espera interacción', () => {
  const initIndex = navigationRuntime.indexOf('void loadNotificationsRuntime()');
  const earlyReturnIndex = navigationRuntime.indexOf('if (!FULL_COMMERCE_PAGES.has(page))');
  assert.ok(initIndex >= 0, 'debe iniciar el runtime de notificaciones');
  assert.ok(earlyReturnIndex >= 0, 'debe conservar el fast-path de páginas informativas');
  assert.ok(initIndex < earlyReturnIndex, 'el listener debe iniciar antes del retorno de páginas informativas');
  assert.match(navigationRuntime, /notificaciones realtime/);
  assert.doesNotMatch(navigationRuntime, /\(\) => Promise\.all\(\[loadAuthRuntime\(\), loadNotificationsRuntime\(\)\]\)/);
});

test('notificaciones públicas tienen fondo sólido y mobile ocupa el viewport completo', () => {
  assert.match(notificationCss, /\.tt-notification-card[\s\S]*background: #fff !important/);
  assert.match(notificationCss, /\.tt-notifications-list[\s\S]*background: #fff !important/);
  assert.match(notificationCss, /@media \(max-width: 767px\)[\s\S]*\.tt-notifications-drawer[\s\S]*width: 100vw !important/);
  assert.match(notificationCss, /height: 100dvh !important/);
  assert.match(notificationCss, /border-radius: 0 !important/);
});

test('todas las superficies principales del header quedan ajustadas al viewport móvil', () => {
  for (const selector of [
    '.tt-search-panel', '.tt-cart-drawer', '.tt-account-drawer', '.tt-collections-sheet', '.tt-notifications-drawer',
  ]) assert.match(responsiveCss, new RegExp(selector.replaceAll('.', '\\.') + '[\\s\\S]*100vw'));
  assert.match(responsiveCss, /html\.tt-surface-locked #tt-tabbar/);
  assert.match(responsiveCss, /grid-template-columns: repeat\(6/);
  assert.match(responsiveCss, /@media \(min-width: 768px\) and \(max-width: 1024px\)/);
  assert.match(responsiveCss, /@media \(min-width: 1025px\)/);
});

test('superadmin escucha adminNotifications en tiempo real y recupera estados recientes', () => {
  assert.match(adminUi, /adminNotifications/);
  assert.match(adminUi, /onSnapshot\(source/);
  assert.match(adminUi, /adminOrderStatusChanged/);
  assert.match(adminUi, /adm-notifications-badge/);
  assert.match(adminUi, /limit\(100\)/);
  assert.match(adminUi, /ORDER_RECOVERY_WINDOW_MS/);
  assert.match(adminUi, /orderNotificationInFlight/);
  assert.match(adminUi, /notifyOrderStatusWithRetry/);
  assert.match(adminUi, /recoverRecentOrderStatuses/);
  assert.match(adminUi, /safeImageUrl/);
  assert.doesNotMatch(adminUi, /setInterval\(/);
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
