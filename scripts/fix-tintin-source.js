#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const VERSION = 'tintin-20260716-cloudinary-fix-1';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'functions/node_modules']);
const LEGACY_VERSIONS = [
  'tintin-20260715-17',
  'tintin-20260716-diagnostics-fix-1',
  'tintin-20260716-product-page-1',
];

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

// Los <script src>/<link href> ya quedaban versionados, pero un import
// estático (import { x } from './y.js') dentro de un <script type="module">
// o dentro de otro archivo .js nunca pasaba por acá — el navegador (o un CDN)
// podía seguir sirviendo una copia vieja de esos archivos para siempre, sin
// ninguna forma de invalidarla. Esta misma pasada de versionLocalAsset ahora
// también reescribe cualquier especificador estático `from '...js'` o
// `import('...js')` literal (el helper versioned('./x.js') en tiempo de
// ejecución ya se calcula con la versión actual y queda intacto).
function versionStaticImports(content) {
  let out = content.replace(/(\bfrom\s+["'])([^"']+\.js(?:\?[^"']*)?)(["'])/g, (_, a, url, b) => `${a}${versionLocalAsset(url)}${b}`);
  out = out.replace(/(\bimport\(\s*["'])([^"']+\.js(?:\?[^"']*)?)(["']\s*\))/g, (_, a, url, b) => `${a}${versionLocalAsset(url)}${b}`);
  return out;
}

function fixHtml(content, rel) {
  let out = replaceLegacyVersions(content);

  out = out.replace(/(href=["'])([^"']+\.css(?:\?[^"']*)?)(["'])/gi, (_, a, url, b) => `${a}${versionLocalAsset(url)}${b}`);
  out = out.replace(/(src=["'])([^"']+\.js(?:\?[^"']*)?)(["'])/gi, (_, a, url, b) => `${a}${versionLocalAsset(url)}${b}`);
  out = versionStaticImports(out);

  if (rel === 'index.html') {
    out = out.replace(/<link\s+rel=["']preload["'][^>]+href=["'][^"']*logo-(?:splash|tintin)[^"']*["'][^>]*>\s*/gi, '');
    out = out.replace(/<div\s+id=["']tt-intro-fallback["'][\s\S]*?<\/div>\s*/gi, '');
    out = out.replace(/<div\s+class=["']tt-splash-line["'][\s\S]*?<\/div>\s*/gi, '');
    out = out.replace(/#ffb6c8/gi, '#FFF6FA');
    out = out.replace(/#fff/gi, '#FFFFFF');
  }

  return out;
}

function replaceLegacyVersions(content) {
  return LEGACY_VERSIONS.reduce(
    (current, legacy) => current.replaceAll(legacy, VERSION),
    content
  );
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

// functions/ y cloudflare/ corren como Cloudflare Pages Functions: Wrangler
// las empaqueta (bundlea) en el build, no las sirve como módulos ES sueltos a
// un navegador — un `?v=` en su import relativo no cachea nada ahí y puede
// llegar a romper cómo el bundler resuelve el archivo. Cache-busting solo
// tiene sentido para lo que efectivamente se sirve y cachea por URL.
const NO_STATIC_IMPORT_VERSIONING = /^(functions|cloudflare)\//;

for (const rel of walk(ROOT).filter(f => f !== 'scripts/fix-tintin-source.js' && /\.(?:js|json|yml|yaml)$/i.test(f))) {
  const full = path.join(ROOT, rel);
  const before = fs.readFileSync(full, 'utf8');
  let after = replaceLegacyVersions(before);
  if (/\.js$/i.test(rel) && !NO_STATIC_IMPORT_VERSIONING.test(rel)) {
    after = versionStaticImports(after);
  }
  if (after !== before) {
    fs.writeFileSync(full, after);
    changed += 1;
    console.log(`versioned ${rel}`);
  }
}

console.log(`Tintin source fixer completed. Changed files: ${changed}`);
