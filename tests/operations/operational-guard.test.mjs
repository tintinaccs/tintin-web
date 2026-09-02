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
