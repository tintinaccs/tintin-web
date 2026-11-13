import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const smoke = fs.readFileSync('scripts/smoke-todas-paginas.mjs', 'utf8');

test('el smoke local modela el feed público de Instagram con el handler real', () => {
  assert.match(smoke, /onRequestGet as instagramFeed/);
  assert.match(smoke, /pathname === '\/api\/instagram-feed'/);
  assert.match(smoke, /instagramFeed\(\{ env: \{\}, request: new Request\(parsed\.href\) \}\)/);
  assert.match(smoke, /response\.writeHead\(result\.status, Object\.fromEntries\(result\.headers\)\)/);
});

test('el servidor del smoke acepta handlers async sin degradar el fallback estático', () => {
  assert.match(smoke, /http\.createServer\(async \(request, response\) => \{/);
  assert.match(smoke, /fs\.stat\(absolute,/);
});
