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
  assert.match(core, /targetType/);
  assert.match(core, /targetOwnerUid/);
  assert.match(core, /reviewId/);
  assert.match(core, /replyId/);
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
  assert.match(customerEngagement, /kind: 'review_like'/);
  assert.match(customerEngagement, /kind: 'reply_like'/);
  assert.match(customerEngagement, /actorPublicName/);
  assert.match(customerEngagement, /buildUserNotificationWrite/);
  assert.match(customerEngagement, /buildAdminNotificationWrite/);
  assert.match(customerEngagement, /reviewLikeProducts/);
  assert.match(customerEngagement, /publicCustomerName/);
});

test('cada acción social conserva aviso propio y el Super Admin no queda fuera del push', () => {
  for (const token of [
    'buildOwnActivityNotification', 'buildOwnAdminActivityNotification',
    "kind: 'review_created_self'", "kind: 'review_reply_self'",
    "kind: 'review_like_self'", "kind: 'reply_like_self'",
    "kind: 'product_like_self'", "kind: 'store_review_created'",
    "kind: 'store_review_reply'", "kind: 'store_review_like'",
  ]) assert.match(customerEngagement, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(engagementApi, /dispatchSocialPushEvent/);
  assert.match(engagementApi, /const push = pushDetails/);
  assert.doesNotMatch(engagementApi, /if \(!engagementIsSuperAdmin\(user\)\)/);
});

test('las acciones de Tintin notifican a la autora de la reseña', () => {
  assert.match(adminEngagement, /kind: 'store_review_like'/);
  assert.match(adminEngagement, /A Tintin le gustó tu reseña/);
  assert.match(adminEngagement, /kind: 'store_review_reply'/);
  assert.match(adminEngagement, /Tintin respondió a tu reseña/);
  assert.match(adminEngagement, /buildUserNotificationWrite/);
  assert.match(adminEngagement, /store_review_like_self/);
  assert.match(adminEngagement, /store_review_reply_self/);
});

test('la ficha de producto admite Me gusta, respuestas y reseñas públicas con identidad protegida', () => {
  assert.match(productReviews, /toggleReviewLike/);
  assert.match(productReviews, /likeReply/);
  assert.match(productReviews, /data-review-like/);
  assert.match(productReviews, /data-reply-like/);
  assert.match(productReviews, /data-reply-toggle/);
  assert.match(productReviews, /id="review-/);
  assert.match(productReviews, /id="reply-/);
  assert.match(productReviews, /location\.hash/);
  assert.match(productReviews, /relativeDate/);
  assert.match(productReviews, /displayPublicName/);
  assert.match(productReviews, /raw\.includes\('\*\*\*'\)/);
});

test('clientas tienen bandeja de 100, saneado, autolectura canónica y reintentos', () => {
  assert.match(clientUi, /data-notification-badge/);
  assert.match(clientUi, /users'.*notifications|users.*,.*notifications/s);
  assert.match(clientUi, /notificationSeen/);
  assert.match(clientUi, /notificationsSeenAll/);
  assert.match(clientUi, /limit\(100\)/);
  assert.match(clientUi, /safeImageUrl/);
  assert.match(clientUi, /markVisibleNotificationsRead/);
  assert.match(clientUi, /notificationsSurfaceIsOpen/);
  assert.match(clientUi, /tintin:surface-change/);
  assert.match(clientUi, /surface === 'notifications'/);
  assert.match(clientUi, /state === 'opening' \|\| state === 'open'/);
  assert.match(clientUi, /if \(notificationsSurfaceIsOpen\(\)\) void markVisibleNotificationsRead\(\)/);
  assert.match(clientUi, /apiWithRetry\('notificationsSeenAll'/);
  assert.match(clientUi, /apiWithRetry\('profileCreated'/);
  assert.doesNotMatch(clientUi, /id="tt-notifications-mark-all"/);
});

test('la campana pública evita Firestore para visitas livianas y se hidrata con sesión o demanda', () => {
  assert.match(navigationRuntime, /function attachNotificationsDemand\(\)/);
  assert.match(navigationRuntime, /\[data-nav-action="notifications"\],#tabbar-notifications/);
  assert.match(navigationRuntime, /tintin:auth-nav-updated/);
  assert.match(navigationRuntime, /void loadAuthRuntime\(\)/);
  assert.match(navigationRuntime, /const authenticated = Boolean\(event\.detail\?\.authenticated\)/);
  assert.match(navigationRuntime, /void loadNotificationsRuntime\(\)\s*\.then\(\(\) => setNotificationTriggersVisible\(true\)\)/s);
  assert.match(navigationRuntime, /if \(!authenticated\) \{\s*setNotificationTriggersVisible\(false\)/s);
  assert.doesNotMatch(navigationRuntime, /tt_session_started_at|hasActiveSessionHint\(\)/);
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

test('superadmin recupera estados, auto-marca al abrir y resuelve snapshots tardíos', () => {
  assert.match(adminUi, /adminNotifications/);
  assert.match(adminUi, /adminOrderStatusChanged/);
  assert.match(adminUi, /adm-notifications-badge/);
  assert.match(adminUi, /limit\(100\)/);
  assert.match(adminUi, /ORDER_RECOVERY_WINDOW_MS/);
  assert.match(adminUi, /orderNotificationInFlight/);
  assert.match(adminUi, /notifyOrderStatusWithRetry/);
  assert.match(adminUi, /recoverRecentOrderStatuses/);
  assert.match(adminUi, /safeImageUrl/);
  assert.match(adminUi, /markVisibleNotificationsRead/);
  assert.match(adminUi, /panelIsOpen/);
  assert.match(adminUi, /apiWithRetry\('adminNotificationsSeenAll'/);
  assert.match(adminUi, /if \(panelIsOpen\(\)\) void markVisibleNotificationsRead\(\)/);
  assert.match(adminUi, /if \(opening\) window\.setTimeout\(\(\) => \{ void markVisibleNotificationsRead\(\); \}, 0\)/);
  assert.doesNotMatch(adminUi, /adm-notifications-mark-all|Marcar todo leído/);
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
