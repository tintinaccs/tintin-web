import test from 'node:test';
import assert from 'node:assert/strict';
import { sendInitialOrderEmailOnce } from '../../cloudflare/recibo-correo-pedido.js';
import { encodeFirestoreFields, decodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';

function harness() {
  const documents = new Map();
  let clock = Date.parse('2026-10-05T00:00:00Z');
  let version = 0;
  let sends = 0;
  let rejectCommit = false;
  const deps = {
    now: () => clock,
    get: async (_, path) => documents.get(path) || null,
    commit: async (_, writes) => {
      if (rejectCommit) throw new Error('Storage unavailable');
      for (const write of writes) {
        const current = documents.get(write.path);
        const condition = write.currentDocument;
        if ((condition.exists === false && current) ||
            (condition.updateTime && condition.updateTime !== current?.updateTime)) {
          throw Object.assign(new Error('Conflict'), { code: 'version_conflict' });
        }
        documents.set(write.path, {
          fields: write.mergeFields ? { ...current.fields, ...write.fields } : write.fields,
          updateTime: String(++version),
        });
      }
    },
  };
  const send = async () => { sends++; return { id: 'accepted' }; };
  const deliver = (channel = 'customer', callback = send) => sendInitialOrderEmailOnce({}, {
    orderId: 'ORDER_123456789', channel, send: callback,
  }, deps);
  return { deps, deliver, documents, send, count: () => sends,
    advance: ms => { clock += ms; }, failStorage: () => { rejectCommit = true; } };
}

test('a successful initial email remains deduplicated beyond the provider window', async () => {
  const h = harness();
  await h.deliver();
  h.advance(3 * 86400000);
  assert.deepEqual(await h.deliver(), { duplicate: true });
  assert.equal(h.count(), 1);
});

test('concurrent checkout/customer/queue requests reserve a channel once', async () => {
  const h = harness();
  const outcomes = await Promise.allSettled([h.deliver(), h.deliver(), h.deliver()]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(h.count(), 1);
});

test('a failed customer delivery does not resend the successful admin channel', async () => {
  const h = harness();
  await h.deliver('admin');
  await assert.rejects(h.deliver('customer', async () => { throw new Error('Provider unavailable'); }));
  await assert.rejects(h.deliver(), /ya se está enviando/);
  h.advance(11 * 60000);
  await h.deliver();
  await h.deliver('admin');
  assert.equal(h.count(), 2);
});

test('storage failure prevents calling the mail provider', async () => {
  const h = harness();
  h.failStorage();
  await assert.rejects(h.deliver(), /Storage unavailable/);
  assert.equal(h.count(), 0);
});

test('uncertain provider acceptance is held after the safe retry window', async () => {
  const h = harness();
  await assert.rejects(h.deliver('customer', async () => { throw new Error('Network timeout'); }));
  h.advance(24 * 3600000);
  await assert.rejects(h.deliver(), /ventana segura/);
  assert.equal(h.count(), 0);
});

test('receipt completion failure retains the reservation and prevents immediate duplicates', async () => {
  const h = harness();
  await assert.rejects(h.deliver('customer', async () => { await h.send(); h.failStorage(); return {}; }), /Storage unavailable/);
  const receipt = [...h.documents.values()][0];
  assert.equal(decodeFirestoreFields(receipt.fields).status, 'sending');
  await assert.rejects(h.deliver(), /ya se está enviando/);
  assert.equal(h.count(), 1);
});

test('invalid identities cannot reach provider or write arbitrary document paths', async () => {
  const h = harness();
  for (const params of [{ orderId: '../orders/other', channel: 'customer' }, { orderId: 'ORDER_123', channel: 'unknown' }]) {
    await assert.rejects(sendInitialOrderEmailOnce({}, { ...params, send: h.send }, h.deps), /Identidad/);
  }
  assert.equal(h.count(), 0);
  assert.equal(h.documents.size, 0);
});

test('an obsolete provider attempt cannot overwrite a newer reservation', async () => {
  const h = harness();
  await assert.rejects(h.deliver('customer', async () => {
    await h.send();
    const [path, record] = [...h.documents][0];
    h.documents.set(path, { fields: encodeFirestoreFields({ status: 'sending', claimId: 'newer' }), updateTime: 'newer' });
    return {};
  }), /Conflict/);
  assert.equal(decodeFirestoreFields([...h.documents.values()][0].fields).claimId, 'newer');
});
