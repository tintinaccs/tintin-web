import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/_middleware.js';

async function invoke(url, body, { method = 'GET', contentType = 'text/html; charset=utf-8' } = {}) {
  const request = new Request(url, { method });
  const response = new Response(method === 'HEAD' ? null : body, {
    headers: { 'content-type': contentType },
  });
  return onRequest({ request, next: async () => response });
}

test('Pages.dev storefront responses carry noindex while canonical domains remain indexable', async () => {
  const preview = await invoke('https://pr-123.tintinaccesorios.pages.dev/','<html><head></head><body></body></html>');
  const production = await invoke('https://tintinaccs.com/','<html><head></head><body></body></html>');

  assert.equal(preview.headers.get('x-robots-tag'), 'noindex');
  assert.equal(production.headers.get('x-robots-tag'), null);
  assert.ok(preview.headers.has('content-security-policy'));
  assert.ok(production.headers.has('content-security-policy'));
});

test('Pages.dev robots stays crawlable for noindex discovery but omits its technical sitemap', async () => {
  const robots = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Sitemap: https://tintinaccesorios.pages.dev/sitemap.xml',
    '',
  ].join('\n');
  const response = await invoke('https://tintinaccesorios.pages.dev/robots.txt', robots, { contentType: 'text/plain' });
  const body = await response.text();

  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  assert.match(body, /Allow: \/\n/);
  assert.match(body, /Disallow: \/admin/);
  assert.doesNotMatch(body, /^\s*Sitemap\s*:/im);
});

test('commercial-domain robots retains its sitemap and Firebase Auth stays a transparent proxy', async () => {
  const sitemap = 'User-agent: *\nAllow: /\nSitemap: https://tintinaccs.com/sitemap.xml\n';
  const productionRobots = await invoke('https://tintinaccs.com/robots.txt', sitemap, { contentType: 'text/plain' });
  const authRequest = new Request('https://tintinaccesorios.pages.dev/__/auth/handler');
  const authResponse = new Response('auth callback', { headers: { 'content-type': 'text/html' } });
  const auth = await onRequest({ request: authRequest, next: async () => authResponse });

  assert.equal(productionRobots.headers.get('x-robots-tag'), null);
  assert.match(await productionRobots.text(), /Sitemap: https:\/\/tintinaccs\.com\/sitemap\.xml/);
  assert.equal(auth, authResponse);
});

test('HEAD robots response has no body and retains the Pages.dev noindex policy', async () => {
  const response = await invoke('https://tintinaccesorios.pages.dev/robots.txt','', {method:'HEAD',contentType:'text/plain'});
  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  assert.equal(await response.text(), '');
});
