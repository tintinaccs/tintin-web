import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { engagementOwnReviewView, publicCustomerName } from '../../cloudflare/participacion-clientes.js';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('public review names follow the required mask', () => {
  assert.equal(publicCustomerName('Antonia Peralta'), 'A*** P***');
  assert.equal(publicCustomerName('Antonia'), 'A***');
});

test('customer responses never expose private review fields', () => {
  const view = engagementOwnReviewView({
    reviewId: 'r1', productId: 'p1', rating: 5, comment: 'Excelente',
    visible: true, deleted: false, realName: 'Antonia Peralta', email: 'antonia@example.com',
    username: 'antonia', history: [{ comment: 'Anterior' }], conversation: [],
    createdAt: new Date(), updatedAt: new Date(),
  });
  assert.equal(view.realName, undefined);
  assert.equal(view.email, undefined);
  assert.equal(view.username, undefined);
  assert.equal(view.history, undefined);
});

test('public reviews expose only public conversation data', async () => {
  const source = await read('cloudflare/participacion-clientes.js');
  const publicView = source.match(/function reviewPublic\(record\) \{[\s\S]*?\n\}/)?.[0] || '';
  const publicReply = source.match(/function publicReply\(message\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(publicView, /conversation:/);
  assert.match(publicReply, /publicName:/);
  assert.doesNotMatch(publicReply, /actorEmail:/);
  assert.doesNotMatch(publicReply, /actorRealName:/);
  assert.doesNotMatch(publicReply, /actorUsername:/);
});

test('engagement writes stay behind server APIs', async () => {
  const rules = await read('firestore.rules');
  assert.match(rules, /match \/reviewRecords\/\{reviewId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(rules, /match \/likeRecords\/\{likeId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(rules, /match \/favorites\/\{productId\}[\s\S]*?allow create, update, delete: if false/);
});

test('community auth refreshes credentials without client sign-out', async () => {
  const product = await read('js/pages/product/resenas-producto.js');
  assert.match(product, /getIdToken\(forceRefresh\)/);
  assert.match(product, /requestApi\(input, method, action, true\)/);
  assert.doesNotMatch(product, /signOut\(/);
});

test('community lives beside product and avoids blocking alerts', async () => {
  const [product, markup] = await Promise.all([
    read('js/pages/product/resenas-producto.js'),
    read('product.html'),
  ]);
  assert.match(product, /socialBar\.insertAdjacentElement\('afterend', section\)/);
  assert.match(product, /showCommunityNotice\(/);
  assert.doesNotMatch(product, /window\.alert\(/);
  assert.match(markup, /data-open-community/);
});

test('product likes are permanent server-side interactions', async () => {
  const [client, route, product, rules] = await Promise.all([
    read('cloudflare/participacion-clientes.js'),
    read('functions/api/engagement.js'),
    read('js/pages/product/resenas-producto.js'),
    read('firestore.rules'),
  ]);
  assert.match(client, /productEngagementStats\//);
  assert.match(client, /alreadyLiked: true/);
  assert.match(client, /currentDocument: \{ exists: false \}/);
  assert.match(route, /action === 'ownFavorite'/);
  assert.match(route, /action === 'productLikes'/);
  assert.match(product, /productLiked\) return/);
  assert.match(product, /is-locked/);
  assert.doesNotMatch(product, /Quitar Me gusta/);
  assert.match(rules, /match \/productEngagementStats\/\{productId\}[\s\S]*?allow read: if isStoreOpenOrAllowed\(\);[\s\S]*?allow write: if false/);
});

test('multiple reviews use unique review IDs and never overwrite by product', async () => {
  const [client, admin] = await Promise.all([
    read('cloudflare/participacion-clientes.js'),
    read('cloudflare/participacion-admin.js'),
  ]);
  assert.match(client, /opaqueId\('review', uid, context\.productId, now\.getTime\(\), crypto\.randomUUID\(\)\)/);
  assert.match(client, /users\/\$\{uid\}\/reviews\/\$\{reviewId\}/);
  assert.match(admin, /users\/\$\{safeId\(record\.ownerUid, 'Cuenta'\)\}\/reviews\/\$\{safeId\(record\.reviewId, 'Reseña'\)\}/);
  assert.doesNotMatch(client, /opaqueId\(user\.uid, context\.productId, 'review'\)/);
});

test('normal customers have 10-review cooldown while super admin is exempt', async () => {
  const client = await read('cloudflare/participacion-clientes.js');
  assert.match(client, /CUSTOMER_REVIEW_BATCH_LIMIT = 10/);
  assert.match(client, /CUSTOMER_REVIEW_COOLDOWN_MS = 30 \* 60 \* 1000/);
  assert.match(client, /SUPER_ADMIN_EMAIL = 'tintinaccs@gmail\.com'/);
  assert.match(client, /context\.isSuperAdmin \? null : nextReviewLimitState/);
  assert.match(client, /Llegaste al límite de 10 comentarios/);
});

test('rating is mandatory and stars render cumulatively', async () => {
  const [client, product] = await Promise.all([
    read('cloudflare/participacion-clientes.js'),
    read('js/pages/product/resenas-producto.js'),
  ]);
  assert.match(client, /rating < 1 \|\| rating > 5/);
  assert.match(client, /Elegí una puntuación de 1 a 5 estrellas/);
  assert.match(product, /'★'\.repeat\(value\).*'☆'\.repeat\(5 - value\)/s);
  assert.match(product, /selectedRating >= value/);
  assert.match(product, /Elegí de 1 a 5 estrellas/);
});

test('rating distribution includes every star bucket', async () => {
  const [client, product] = await Promise.all([
    read('cloudflare/participacion-clientes.js'),
    read('js/pages/product/resenas-producto.js'),
  ]);
  assert.match(client, /distribution = \{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 \}/);
  assert.match(client, /distribution\[rating\] \+= 1/);
  assert.match(product, /\[5,4,3,2,1\]\.map/);
  assert.match(product, /tt-review-stats-fill/);
});

test('customers cannot edit or delete published reviews', async () => {
  const [client, route] = await Promise.all([
    read('cloudflare/participacion-clientes.js'),
    read('functions/api/engagement.js'),
  ]);
  assert.match(client, /editOwnReview\(\)[\s\S]*customer-edit-disabled/);
  assert.doesNotMatch(route, /deleteOwnReview/);
});

test('review and reply likes are idempotent and linked to owners', async () => {
  const client = await read('cloudflare/participacion-clientes.js');
  assert.match(client, /export async function toggleReviewLike/);
  assert.match(client, /export async function likeReply/);
  assert.match(client, /alreadyLiked: true/);
  assert.match(client, /targetOwnerUid/);
  assert.match(client, /replyIds:/);
  assert.match(client, /reviewIds:/);
});

test('social notifications retain actor-target-product relationships', async () => {
  const client = await read('cloudflare/participacion-clientes.js');
  for (const token of ['actorUid:', 'actorName:', 'actorUsername:', 'targetOwnerUid:', 'productId', 'reviewId', 'replyId', 'sourceType:', 'sourceId:']) {
    assert.match(client, new RegExp(token));
  }
  assert.match(client, /dio Me gusta al comentario de/);
  assert.match(client, /#reply-/);
  assert.match(client, /#review-/);
});

test('opening notifications marks current unread alerts as seen automatically', async () => {
  const notifications = await read('js/components/notifications/notificaciones-clientes.js');
  assert.match(notifications, /markVisibleNotificationsRead/);
  assert.match(notifications, /notificationsSeenAll/);
  assert.match(notifications, /data-nav-action="notifications"/);
  assert.doesNotMatch(notifications, /id="tt-notifications-mark-all"/);
});

test('admin and customer surfaces are wired', async () => {
  const [admin, product, profile, adminLoader, adminStyles] = await Promise.all([
    read('admin.html'), read('product.html'), read('perfil.html'),
    read('js/admin/participacion/gestion-participacion-admin.js'),
    read('css/admin/participacion-admin.css'),
  ]);
  assert.match(admin, /id="section-resenas"/);
  assert.match(admin, /id="section-me-gusta"/);
  assert.match(product, /resenas-producto\.js/);
  assert.match(profile, /favoritos-perfil\.js/);
  assert.match(adminLoader, /gestion-participacion-admin-v2\.js/);
  assert.match(adminStyles, /participacion-admin-v2\.css/);
});

test('master engagement console exposes management views and tools', async () => {
  const source = await read('js/admin/participacion/gestion-participacion-admin-v2.js');
  for (const token of [
    'data-eg-review-view="products"', 'data-eg-review-view="clients"', 'data-eg-review-view="analytics"',
    'data-eg-like-view="products"', 'data-eg-like-view="clients"', 'data-eg-like-view="analytics"',
    'Exportar CSV', 'reviewSaveMeta', 'likeSaveNote', 'likeArchive', 'reviewArchive', 'reviewPin',
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('admin multi-review CRUD maps by reviewId and keeps private controls server-backed', async () => {
  const [adminSource, route] = await Promise.all([
    read('cloudflare/participacion-admin.js'),
    read('functions/api/admin-engagement.js'),
  ]);
  assert.match(adminSource, /reviews\/\$\{safeId\(record\.reviewId/);
  for (const action of ['reviewVisibility', 'reviewReply', 'reviewEdit', 'reviewDelete', 'reviewRestore', 'reviewArchive', 'reviewPin', 'reviewMeta']) {
    assert.match(adminSource, new RegExp(action));
  }
  assert.match(route, /adminReviewAction/);
});

test('archiving a like is administrative and does not remove customer favorite', async () => {
  const source = await read('cloudflare/participacion-admin.js');
  const archiveBlock = source.match(/export async function adminLikeAction[\s\S]*?export async function markLikeSeen/)?.[0] || '';
  assert.match(archiveBlock, /likeArchive/);
  assert.match(archiveBlock, /patch\.archived = Boolean\(input\.archived\)/);
  assert.doesNotMatch(archiveBlock, /\/favorites\//);
});
