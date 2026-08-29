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
    reviewId: 'r1', productId: 'p1', rating: 5, comment: 'Excelente', editCount: 1,
    visible: true, deleted: false, realName: 'Antonia Peralta', email: 'antonia@example.com',
    history: [{ comment: 'Anterior' }], conversation: [], createdAt: new Date(), updatedAt: new Date(),
  });
  assert.equal(view.realName, undefined);
  assert.equal(view.email, undefined);
  assert.equal(view.history, undefined);
});

test('las reseñas públicas no incluyen hilos de respuestas', async () => {
  const source = await read('cloudflare/participacion-clientes.js');
  const publicView = source.match(/function reviewPublic\(record\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(publicView, /conversation:/);
});

test('engagement writes stay behind server APIs', async () => {
  const rules = await read('firestore.rules');
  assert.match(rules, /match \/reviewRecords\/\{reviewId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(rules, /match \/likeRecords\/\{likeId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(rules, /match \/favorites\/\{productId\}[\s\S]*?allow create, update, delete: if false/);
});

test('comentar renueva una credencial vencida sin cerrar la sesión de la clienta', async () => {
  const [product, route] = await Promise.all([
    read('js/pages/product/resenas-producto.js'),
    read('functions/api/engagement.js'),
  ]);
  assert.match(product, /getIdToken\(forceRefresh\)/);
  assert.match(product, /requestApi\(input, method, action, true\)/);
  assert.match(product, /nunca llamamos a signOut aquí/);
  assert.doesNotMatch(product, /signOut\(/);
  assert.match(route, /isClientError \? status : 400/);
});

test('la comunidad vive junto a la ficha y no interrumpe con alertas bloqueantes', async () => {
  const [product, markup] = await Promise.all([
    read('js/pages/product/resenas-producto.js'),
    read('product.html'),
  ]);
  assert.match(product, /socialBar\.insertAdjacentElement\('afterend', section\)/);
  assert.match(product, /showCommunityNotice\(/);
  assert.doesNotMatch(product, /window\.alert\(/);
  assert.match(markup, /data-open-community/);
  assert.doesNotMatch(markup, /data-product-like-icon/);
});

test('los likes de producto usan estado server-side y estadísticas públicas reales', async () => {
  const [client, route, product, rules] = await Promise.all([
    read('cloudflare/participacion-clientes.js'),
    read('functions/api/engagement.js'),
    read('js/pages/product/resenas-producto.js'),
    read('firestore.rules'),
  ]);
  assert.match(client, /productEngagementStats\//);
  assert.match(client, /likeCount: count/);
  assert.match(client, /getOwnFavorite/);
  assert.match(client, /getProductLikeStats/);
  assert.match(route, /action === 'ownFavorite'/);
  assert.match(route, /action === 'productLikes'/);
  assert.match(product, /action: 'toggleFavorite'/);
  assert.match(product, /productEngagementStats/);
  assert.doesNotMatch(product, /localStorage\.getItem\(key\)/);
  assert.match(rules, /match \/productEngagementStats\/\{productId\}[\s\S]*?allow read: if isStoreOpenOrAllowed\(\);[\s\S]*?allow write: if false/);
});

test('one review edit and one review per account/product are enforced server-side', async () => {
  const source = await read('cloudflare/participacion-clientes.js');
  assert.match(source, /Number\(record\.editCount\) >= 1/);
  assert.match(source, /opaqueId\(user\.uid, context\.productId, 'review'\)/);
  assert.match(source, /currentDocument: \{ exists: false \}/);
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

test('master engagement console exposes management views and real tools', async () => {
  const source = await read('js/admin/participacion/gestion-participacion-admin-v2.js');
  for (const token of [
    'data-eg-review-view="products"', 'data-eg-review-view="clients"', 'data-eg-review-view="analytics"',
    'data-eg-like-view="products"', 'data-eg-like-view="clients"', 'data-eg-like-view="analytics"',
    'Exportar CSV', 'reviewSaveMeta', 'likeSaveNote', 'likeArchive', 'reviewArchive', 'reviewPin',
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('archiving a like is administrative and does not remove the customer favorite', async () => {
  const source = await read('cloudflare/participacion-admin.js');
  const archiveBlock = source.match(/export async function adminLikeAction[\s\S]*?export async function markLikeSeen/)?.[0] || '';
  assert.match(archiveBlock, /likeArchive/);
  assert.match(archiveBlock, /patch\.archived = Boolean\(input\.archived\)/);
  assert.doesNotMatch(archiveBlock, /\/favorites\//);

  const deleteBlock = source.match(/export async function adminDeleteLike[\s\S]*$/)?.[0] || '';
  assert.match(deleteBlock, /\/favorites\//);
});

test('new review admin metadata stays private while actions are server-backed', async () => {
  const [adminSource, route] = await Promise.all([
    read('cloudflare/participacion-admin.js'),
    read('functions/api/admin-engagement.js'),
  ]);
  assert.match(adminSource, /reviewArchive/);
  assert.match(adminSource, /reviewPin/);
  assert.match(adminSource, /reviewMeta/);
  assert.match(adminSource, /reviewUnread/);
  assert.match(route, /likeUnread/);
  assert.match(route, /likeArchive/);
  assert.match(route, /likeNote/);
});
