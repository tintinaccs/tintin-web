import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Ejecutar el helper real, sin importar el spec que registra suites Playwright.
// El transporte responde durante fill/click: una respuesta HTTP ya emitida no
// se reproduce al registrar un observador después de la acción.
const source = fs.readFileSync(new URL('../runtime/critical-flows.spec.js', import.meta.url), 'utf8');
const start = source.indexOf('async function otp(');
const end = source.indexOf('\nasync function fillProfile', start);
assert.ok(start >= 0 && end > start);
const helper = source.slice(start, end);

function immediateTransport() {
  const pending = [], lost = [], requests = [];
  const node = { value: '' };
  let accepted = false;
  const response = (path, status) => ({ url: () => `http://fixture${path}`, status: () => status, request: () => ({ method: () => 'POST' }) });
  const emit = (path, status) => {
    requests.push({ path, status });
    const value = response(path, status);
    const observers = pending.filter(item => item.predicate(value));
    for (const item of observers) {
      pending.splice(pending.indexOf(item), 1);
      item.resolve(value);
    }
    if (!observers.length) lost.push(value);
  };
  const verify = () => {
    if (accepted) return;
    const valid = node.value === '123456';
    accepted = valid;
    emit('/api/email-otp-verify', valid ? 200 : 400);
  };
  const page = {
    goto: async () => {},
    waitForResponse(predicate) {
      const missed = lost.findIndex(predicate);
      if (missed >= 0) {
        lost.splice(missed, 1);
        const failure = Promise.reject(new Error('La respuesta OTP llegó antes de registrar el observador'));
        failure.catch(() => {});
        return failure;
      }
      return new Promise(resolve => pending.push({ predicate, resolve }));
    },
    locator(selector) {
      return {
        async fill(value) {
          if (selector !== '#login-otp-input') return;
          node.value = value;
          if (/^\d{6}$/.test(value)) verify();
        },
        async click() {
          if (selector === '#btn-send-otp') emit('/api/email-otp-send', 200);
          if (selector === '#btn-verify-otp') verify();
        },
        async press(key) { if (key === 'Enter') verify(); },
        async evaluate(callback, value) { callback(node, value); },
      };
    },
  };
  const expect = value => ({
    async toBeVisible() {}, async toBeEnabled() {}, async toContainText() {},
    toBe: expected => assert.equal(value, expected),
    toMatch: pattern => assert.match(value, pattern),
    toHaveLength: length => assert.equal(value.length, length),
  });
  const state = async () => ({ code: '123456', requests });
  return { page, expect, state, pending, lost, requests };
}

for (const submit of ['auto', 'enter']) for (const invalid of [false, true]) {
  test(`OTP captura respuestas inmediatas, sin duplicarlas: ${submit}, rechazo previo=${invalid}`, async () => {
    const fixture = immediateTransport();
    const otp = vm.runInNewContext(`(${helper})`, { expect: fixture.expect, state: fixture.state });
    await otp(fixture.page, {}, 'fixture@example.test', { submit, invalid });
    assert.equal(fixture.pending.length, 0);
    assert.equal(fixture.lost.length, 0);
    assert.deepEqual(fixture.requests.filter(item => item.path === '/api/email-otp-verify').map(item => item.status), invalid ? [400, 200] : [200]);
  });
}
