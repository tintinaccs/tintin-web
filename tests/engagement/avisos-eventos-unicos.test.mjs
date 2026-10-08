import test from 'node:test';
import assert from 'node:assert/strict';
import { createActivityTracker, createLiveActivityNotices } from '../../js/components/notifications/avisos-en-vivo.mjs';

test('el historial y los acuses de entrega no duplican un evento', () => {
  const tracker = createActivityTracker();
  assert.deepEqual(tracker.update('admin:a', []), []);
  const item = { id:'like-a', eventId:'event-a', createdAt:100, updatedAt:100, aggregateCount:1, title:'Me gusta', body:'Producto' };
  assert.equal(tracker.update('admin:a', [item]).length, 1);
  assert.equal(tracker.update('admin:a', [{ ...item, updatedAt:200 }]).length, 0);
  assert.equal(tracker.update('admin:a', [{ ...item, read:true, updatedAt:300 }]).length, 0);
  assert.equal(tracker.update('admin:a', [{ ...item, aggregateCount:2 }]).length, 1);
  assert.equal(tracker.update('admin:b', [item]).length, 0);
});

test('panel y navegación comparten un único presentador de avisos', () => {
  assert.equal(createLiveActivityNotices(), createLiveActivityNotices());
});
