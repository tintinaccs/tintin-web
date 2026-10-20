import test from 'node:test';
import assert from 'node:assert/strict';
import { adminNotificationLink, normalizeAdminDestination, rememberAdminDestination, pendingAdminDestination, consumeAdminDestination, ADMIN_RETURN_KEY, adminReturnStorage } from '../../js/core/auth/destino-admin.mjs';
const origin = 'https://tintin.example';
const storage = () => { const data = new Map(); return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}; };

test('conserva sección, identificador y parámetros históricos dentro del panel', () => {
  for (const [input, expected] of [
    ['admin.html#section-usuarios', '/admin?section=usuarios'],
    ['/admin.html#section-resenas?report=report_123', '/admin?section=resenas&report=report_123'],
    ['/admin?section=pedidos&order=order_123#pedidos', '/admin?section=pedidos&order=order_123'],
  ]) assert.equal(normalizeAdminDestination(input, origin), expected);
  for (const input of ['//evil.test/admin', 'https://evil.test/admin', '/admin/../checkout', '/administrator', '/admin\\evil', 'javascript:alert(1)']) assert.equal(normalizeAdminDestination(input, origin), '');
});

test('cada productor conserva la identidad de su ficha en vez de abrir sólo una lista', () => {
  for (const [record, section, key, id] of [
    [{sourceType:'order', sourceId:'order_123'}, 'pedidos', 'order', 'order_123'],
    [{sourceType:'auth', sourceId:'user_123'}, 'usuarios', 'user', 'user_123'],
    [{sourceType:'user', sourceId:'user_456'}, 'usuarios', 'user', 'user_456'],
    [{sourceType:'product_like', sourceId:'like_123', targetUrl:'/product?id=product_123'}, 'me-gusta', 'like', 'like_123'],
    [{sourceType:'favorite', sourceId:'like_456'}, 'me-gusta', 'like', 'like_456'],
    [{sourceType:'reply_like', sourceId:'like_123', reviewId:'review_123', replyId:'reply_123'}, 'resenas', 'review', 'review_123'],
    [{sourceType:'comment_report', sourceId:'report_123'}, 'resenas', 'report', 'report_123'],
    [{sourceType:'wholesale_quote', sourceId:'quote_123'}, 'mayoristas', 'quote', 'quote_123'],
  ]) {
    const url = new URL(adminNotificationLink(record), origin);
    assert.equal(url.searchParams.get('section'), section);
    assert.equal(url.searchParams.get(key), id);
    if (record.replyId) assert.equal(url.searchParams.get('reply'), record.replyId);
  }
  assert.equal(adminNotificationLink({targetUrl:'/admin.html#section-diagnostico'}), '/admin.html?section=diagnostico');
  assert.ok(!adminNotificationLink({sourceType:'user',sourceId:'../private'}).includes('private'));
});

test('el retorno dura lo necesario para login y se consume sólo al abrir ese destino', () => {
  const s = storage(); const now = Date.now();
  rememberAdminDestination('/admin?section=usuarios&user=first', s, origin, now);
  assert.equal(pendingAdminDestination(s, origin, now+1000), '/admin?section=usuarios&user=first');
  rememberAdminDestination('/admin?section=pedidos&order=second', s, origin, now);
  consumeAdminDestination('/admin?section=usuarios&user=first', s, origin);
  assert.ok(pendingAdminDestination(s, origin).includes('second'), 'un resultado tardío no elimina un clic posterior');
  consumeAdminDestination('/admin?section=pedidos&order=second', s, origin);
  assert.equal(pendingAdminDestination(s, origin), '');
  rememberAdminDestination('/admin?section=usuarios&user=first', s, origin, now);
  assert.equal(pendingAdminDestination(s, origin, now+31*60*1000), '');
  s.setItem(ADMIN_RETURN_KEY, JSON.stringify({url:'https://evil.test/admin',at:now}));
  assert.equal(pendingAdminDestination(s, origin), '');
});

test('almacenamiento bloqueado o corrupto no impide navegar con el enlace explícito', () => {
  assert.equal(adminReturnStorage({get sessionStorage(){throw Error('blocked');}}), null);
  assert.equal(rememberAdminDestination('/admin?section=pedidos&order=one', null, origin), '/admin?section=pedidos&order=one');
  assert.equal(pendingAdminDestination({getItem(){return '{bad';}}, origin), '');
});
