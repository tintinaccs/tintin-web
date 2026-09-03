import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAppsScript } from '../../cloudflare/apps-script-fetch.js';

test('sigue el redirect de Apps Script conservando POST y cuerpo', async () => {
  const calls = [];
  const response = await fetchAppsScript('https://script.google.com/macros/s/demo/exec', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '{"action":"syncOrder"}',
  }, async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: 'https://script.googleusercontent.com/macros/echo?user_content_key=demo' } });
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[1].init.method, 'POST');
  assert.equal(calls[1].init.body, '{"action":"syncOrder"}');
});

test('rechaza redirects de Apps Script hacia hosts no permitidos', async () => {
  const fakeFetch = async (_url, init) => {
    assert.equal(init.redirect, 'manual');
    return new Response(null, { status: 302, headers: { location: 'https://example.com/no-permitido' } });
  };
  await assert.rejects(
    () => fetchAppsScript('https://script.google.com/macros/s/demo/exec', { method: 'POST', body: 'x' }, fakeFetch),
    /no permitida/
  );
});
