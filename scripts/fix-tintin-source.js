#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const VERSION = 'tintin-20260710-6';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'functions/node_modules']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(rel) && !SKIP_DIRS.has(entry.name)) out.push(...walk(full));
    } else out.push(rel);
  }
  return out;
}

function versionLocalAsset(url) {
  if (!url || /^(https?:|data:|mailto:|tel:|#)/i.test(url)) return url;
  if (!/\.(css|js)(\?|$)/i.test(url)) return url;
  const [base, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.set('v', VERSION);
  return `${base}?${params.toString()}`;
}

function fixHtml(content, rel) {
  let out = content;

  out = out.replace(/(href=["'])([^"']+\.css(?:\?[^"']*)?)(["'])/gi, (_, a, url, b) => `${a}${versionLocalAsset(url)}${b}`);
  out = out.replace(/(src=["'])([^"']+\.js(?:\?[^"']*)?)(["'])/gi, (_, a, url, b) => `${a}${versionLocalAsset(url)}${b}`);

  if (rel === 'index.html') {
    out = out.replace(/<link\s+rel=["']preload["'][^>]+href=["'][^"']*logo-(?:splash|tintin)[^"']*["'][^>]*>\s*/gi, '');
    out = out.replace(/<div\s+id=["']tt-intro-fallback["'][\s\S]*?<\/div>\s*/gi, '');
    out = out.replace(/<div\s+class=["']tt-splash-line["'][\s\S]*?<\/div>\s*/gi, '');
    out = out.replace(/#ffb6c8/gi, '#FFF6FA');
    out = out.replace(/#fff/gi, '#FFFFFF');
  }

  if (/checkout/i.test(rel)) {
    out = out.replace(/<header[\s\S]*?id=["']tt-header["'][\s\S]*?<\/header>\s*/gi, '');
    out = out.replace(/<div[\s\S]*?class=["'][^"']*tt-header[^"']*["'][\s\S]*?<\/div>\s*/gi, '');
  }

  return out;
}

let changed = 0;
for (const rel of walk(ROOT).filter(f => f.endsWith('.html'))) {
  const full = path.join(ROOT, rel);
  const before = fs.readFileSync(full, 'utf8');
  const after = fixHtml(before, rel);
  if (after !== before) {
    fs.writeFileSync(full, after);
    changed += 1;
    console.log(`fixed ${rel}`);
  }
}

console.log(`Tintin source fixer completed. Changed files: ${changed}`);
