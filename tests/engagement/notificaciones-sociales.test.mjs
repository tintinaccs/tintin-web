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
  read('firestore.rules'),
]);

const [core, api, engagementApi, customerEngagement, adminEngagement, productReviews, clientUi, adminUi, rules] = files;

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

test('la API cubre altas, pedidos y lectura para clienta y superadmin', () => {
  for (const action of [
    'profileCreated', 'orderCreated', 'notificationSeen', 'notificationsSeenAll',
    'adminNotificationSeen', 'adminNotificationsSeenAll', 'adminOrderStatusChanged',
  ]) assert.match(api, new RegExp(action));
  assert.match(api, /requireFirebaseUser/);
  assert.match(api, /requireSuperAdmin/);
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

test('clientas y superadmin tienen centro de actividad con contador', () => {
  assert.match(clientUi, /data-notification-badge/);
  assert.match(clientUi, /users'.*notifications|users.*,.*notifications/s);
  assert.match(clientUi, /notificationSeen/);
  assert.match(adminUi, /adminNotifications/);
  assert.match(adminUi, /adminOrderStatusChanged/);
  assert.match(adminUi, /adm-notifications-badge/);
});

test('Firestore mantiene las notificaciones de solo lectura desde el navegador', () => {
  assert.match(rules, /match \/notifications\/\{notificationId\}/);
  assert.match(rules, /match \/adminNotifications\/\{notificationId\}/);
  assert.match(rules, /allow create, update, delete: if false;/);
});
