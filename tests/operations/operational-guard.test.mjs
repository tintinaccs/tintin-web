import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit, safePath, sanitizeText } from '../../functions/lib/operational-guard.js';

test('sanitizeText elimina email, teléfono y tokens largos', () => {
  const value = sanitizeText('falló para client@example.com +595981123456 abcdefghijklmnopqrstuvwxyz123456');
  assert.equal(value.includes('client@example.com'), false);
  assert.equal(value.includes('981123456'), false);
  assert.match(value, /\[email\]/);
  assert.match(value, /\[phone\]/);
  assert.match(value, /\[token\]/);
});

test('safePath elimina querystring y fragmento', () => {
  assert.equal(safePath('https://example.com/checkout?token=secreto#x'), '/checkout');
});

test('rateLimit bloquea después del límite y expone retry-after', () => {
  const request = new Request('https://example.com/api/test', { headers: { 'cf-connecting-ip': '203.0.113.10', 'user-agent': 'test' } });
  const first = rateLimit(request, { id: 'unit-test', limit: 2, windowMs: 60_000 });
  const second = rateLimit(request, { id: 'unit-test', limit: 2, windowMs: 60_000 });
  const third = rateLimit(request, { id: 'unit-test', limit: 2, windowMs: 60_000 });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfter > 0);
});

test('el mismo IP no reinicia su límite cambiando User-Agent o X-Forwarded-For', () => {
  const request = value => new Request('https://example.com/api/test', {
    headers: { 'cf-connecting-ip': '203.0.113.11', 'user-agent': value, 'x-forwarded-for': value }
  });
  assert.equal(rateLimit(request('first'), { id: 'header-evasion', limit: 1 }).allowed, true);
  assert.equal(rateLimit(request('second'), { id: 'header-evasion', limit: 1 }).allowed, false);
  const other = new Request('https://example.com/api/test', { headers: { 'cf-connecting-ip': '203.0.113.12' } });
  assert.equal(rateLimit(other, { id: 'header-evasion', limit: 1 }).allowed, true);
});

test('sin IP de Cloudflare no confía en X-Forwarded-For enviado por el cliente', () => {
  const request = ip => new Request('https://example.com/api/test', { headers: { 'x-forwarded-for': ip } });
  assert.equal(rateLimit(request('192.0.2.1'), { id: 'untrusted-ip', limit: 1 }).allowed, true);
  assert.equal(rateLimit(request('192.0.2.2'), { id: 'untrusted-ip', limit: 1 }).allowed, false);
});

test('muchas identidades activas no crean contadores ilimitados ni expulsan la cuota anterior', () => {
  let accepted = 0;
  const request = index => new Request('https://example.com/api/test', { headers: { 'cf-connecting-ip': `2001:db8::${index}` } });
  for (let index = 0; index < 5_100; index += 1) {
    if (rateLimit(request(index), { id: 'saturation', limit: 1 }).allowed) accepted += 1;
  }
  assert.ok(accepted <= 5_001, `identidades con reserva propia: ${accepted}`);
  assert.equal(rateLimit(request(0), { id: 'saturation', limit: 1 }).allowed, false);
  assert.equal(rateLimit(request(6_000), { id: 'saturation', limit: 1 }).allowed, false);
});
