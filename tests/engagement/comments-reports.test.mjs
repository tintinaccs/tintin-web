import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { commentReportReasons, commentReportStatuses } from '../../cloudflare/comentarios-sociales.js';
import { SOCIAL_EVENT_TYPES, socialEventType } from '../../cloudflare/notificaciones-sociales.js';

const read = path => fs.readFile(path, 'utf8');

test('el contrato canónico de eventos sociales está cerrado y mapea comentarios', () => {
  for (const type of ['USER_REGISTERED', 'USER_LOGIN', 'ORDER_CREATED', 'PRODUCT_LIKED', 'COMMENT_CREATED', 'COMMENT_REPLIED', 'COMMENT_LIKED', 'COMMENT_REPORTED', 'REVIEW_CREATED']) {
    assert.ok(SOCIAL_EVENT_TYPES.includes(type));
  }
  assert.equal(socialEventType({ kind: 'review_reply' }), 'COMMENT_REPLIED');
  assert.equal(socialEventType({ kind: 'comment_reported' }), 'COMMENT_REPORTED');
  assert.equal(socialEventType({ kind: 'review_created' }), 'REVIEW_CREATED');
});

test('denuncias usan razones/estados cerrados y el modelo de dedupe', async () => {
  assert.deepEqual(commentReportReasons, ['spam', 'offensive', 'harassment', 'inappropriate', 'misleading', 'other']);
  assert.deepEqual(commentReportStatuses, ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']);
  const source = await read('cloudflare/comentarios-sociales.js');
  assert.match(source, /comment-report:\$\{reporterUid\}:\$\{commentId\}/);
  for (const field of ['reportId', 'commentId', 'productId', 'reporterUid', 'reportedAuthorUid', 'reason', 'details', 'status', 'createdAt', 'updatedAt']) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
  assert.match(source, /No podés denunciar tu propio comentario/);
  assert.match(source, /dispatchAdminNotificationPush/);
});

test('la denuncia no habilita escrituras Firestore directas y la bandeja es administrativa', async () => {
  const [rules, engagement, admin, product, panel] = await Promise.all([
    read('firestore.rules'),
    read('functions/api/engagement.js'),
    read('functions/api/admin-engagement.js'),
    read('js/pages/product/resenas-producto.js'),
    read('js/admin/participacion/gestion-participacion-admin-v2.js'),
  ]);
  assert.match(rules, /match \/commentReports\//);
  assert.match(rules, /allow create, update, delete: if false/);
  assert.match(engagement, /input\.action === 'reportComment'/);
  assert.match(admin, /action.*commentReports/);
  assert.match(admin, /commentReportStatus/);
  assert.match(product, /data-report-comment/);
  assert.match(panel, /data-eg-review-view="reports"/);
  assert.match(panel, /reports-open-badge/);
});

test('los avisos personales excluyen al actor y conservan idempotencia', async () => {
  const source = await read('cloudflare/notificaciones-sociales.js');
  assert.match(source, /event\.actorUid.*recipientUid/);
  assert.match(source, /skipped: 'actor'/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /persistIfAbsent/);
});

test('likes de comentario y respuesta tienen toggle off transaccional y replies lazy', async () => {
  const [social, product] = await Promise.all([
    read('cloudflare/participacion-clientes.js'),
    read('js/pages/product/resenas-producto.js'),
  ]);
  assert.match(social, /delete: true, currentDocument: \{ updateTime: likeDoc\.updateTime \}/);
  assert.match(social, /removeInteractionId\(mapping, 'reviewIds'/);
  assert.match(social, /removeInteractionId\(mapping, 'replyIds'/);
  assert.match(social, /toggledOff/);
  assert.match(product, /INITIAL_REPLY_LIMIT = 3/);
  assert.match(product, /data-thread-toggle/);
});
