import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogQueueRetryDelayMs,
  catalogQueueTaskId,
} from '../../cloudflare/resiliencia-sync-catalogo.js';

test('la cola usa backoff creciente y acotado', () => {
  const first = catalogQueueRetryDelayMs(1);
  const second = catalogQueueRetryDelayMs(2);
  const last = catalogQueueRetryDelayMs(99);
  assert.ok(first > 0);
  assert.ok(second > first);
  assert.ok(last >= second);
  assert.equal(last, catalogQueueRetryDelayMs(8));
});

test('la tarea de reconciliación es idempotente para el mismo conjunto de productos', async () => {
  const a = await catalogQueueTaskId(['producto-b', 'producto-a', 'producto-a']);
  const b = await catalogQueueTaskId(['producto-a', 'producto-b']);
  const c = await catalogQueueTaskId(['producto-c']);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^catalog_sync_[a-f0-9]{32}$/);
});
