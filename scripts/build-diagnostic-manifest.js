const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'diagnostic-manifest.json');
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'public']);
const TEXT_EXTENSIONS = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.xml', '.txt', '.md', '.rules',
  '.gs', '.yml', '.yaml', '.toml'
]);
const PUBLIC_EXTENSIONS = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.xml', '.txt', '.md', '.rules',
  '.gs', '.yml', '.yaml', '.toml',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'
]);
const PUBLIC_FILENAMES = new Set(['.firebaserc']);

function walk(directory, prefix = '') {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute, relative));
    else if (
      entry.isFile() &&
      (
        PUBLIC_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ||
        PUBLIC_FILENAMES.has(entry.name)
      )
    ) files.push(relative);
  }
  return files.sort();
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function lineAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function stripTags(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function checkJavaScriptSyntax(source, asModule = false) {
  const args = asModule
    ? ['--input-type=module', '--check', '-']
    : ['--check', '-'];
  const result = childProcess.spawnSync(process.execPath, args, {
    input: source,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });
  return {
    ok: result.status === 0,
    error: result.status === 0
      ? ''
      : String(result.stderr || result.stdout || 'Error de sintaxis').trim().slice(0, 1200)
  };
}

function attr(fragment, name) {
  const match = fragment.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? match[1].trim() : '';
}

function normalizeLocalReference(fromFile, raw) {
  const value = String(raw || '').trim();
  if (!value || value.startsWith('#') || value.includes('${')) return null;
  if (/^(?:https?:|mailto:|tel:|javascript:|data:|blob:|\/\/)/i.test(value)) return null;
  const clean = value.split('#')[0].split('?')[0].replace(/^\//, '');
  if (!clean) return null;
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean));
  return normalized.startsWith('../') ? null : normalized;
}

function labelForPage(file, title) {
  const known = {
    'index.html': 'Inicio',
    'catalogo.html': 'Catálogo',
    'collections.html': 'Colecciones',
    'product.html': 'Producto',
    'about.html': 'Nosotros',
    'nosotros.html': 'Nosotros alternativo',
    'contact.html': 'Contacto',
    'envios.html': 'Envíos',
    'cambios-devoluciones.html': 'Cambios y devoluciones',
    'preguntas-frecuentes.html': 'Preguntas frecuentes',
    'privacidad.html': 'Privacidad',
    'terminos.html': 'Términos',
    'login.html': 'Acceso',
    'perfil.html': 'Perfil',
    'checkout.html': 'Checkout',
    'admin.html': 'Super Admin',
    'admin-images.html': 'Gestión de imágenes',
    '404.html': 'Página 404'
  };
  return known[file] || title || file;
}

function pageAccess(file) {
  if (file === 'nosotros.html') {
    return { visibility: 'hidden', requiresAuth: false, roles: ['guest', 'client'] };
  }
  if (file === 'admin.html' || file === 'admin-images.html') {
    return { visibility: 'protected', requiresAuth: true, roles: ['superadmin', 'admin', 'agent', 'viewer'] };
  }
  if (file === 'perfil.html' || file === 'checkout.html') {
    return { visibility: 'protected', requiresAuth: true, roles: ['client', 'superadmin', 'admin', 'agent', 'viewer'] };
  }
  if (file === 'login.html') {
    return { visibility: 'public-access', requiresAuth: false, roles: ['guest', 'client', 'superadmin', 'admin', 'agent', 'viewer'] };
  }
  if (file === '404.html') return { visibility: 'hidden', requiresAuth: false, roles: ['guest', 'client'] };
  if (file === 'product.html') return { visibility: 'direct-and-linked', requiresAuth: false, roles: ['guest', 'client'] };
  return { visibility: 'public', requiresAuth: false, roles: ['guest', 'client'] };
}

function extractElements(html, regex, mapper) {
  const values = [];
  let match;
  while ((match = regex.exec(html))) values.push(mapper(match, lineAt(html, match.index)));
  return values;
}

function extractPage(file, allPaths, jsCorpus) {
  const html = read(file);
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, match => {
    const source = match.match(/\bsrc=["'][^"']+["']/i);
    const linePadding = '\n'.repeat((match.match(/\n/g) || []).length);
    return source ? `<script ${source[0]}></script>${linePadding}` : linePadding;
  });
  const title = stripTags((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  const description = attr((html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i) || [])[0] || '', 'content');
  const ids = extractElements(markup, /\bid=["']([^"']+)["']/gi, (match, line) => ({ value: match[1], line }));
  const h1Lines = extractElements(markup, /<h1\b/gi, (_match, line) => line);
  const duplicateIds = [...ids.reduce((map, item) => {
    const list = map.get(item.value) || [];
    list.push(item.line);
    map.set(item.value, list);
    return map;
  }, new Map()).entries()]
    .filter(([, lines]) => lines.length > 1)
    .map(([id, lines]) => ({ id, lines }));

  const scripts = extractElements(html, /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, (match, line) => ({
    raw: match[1], target: normalizeLocalReference(file, match[1]), line
  }));
  const styles = extractElements(markup, /<link\b[^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi, (match, line) => {
    const raw = match[1] || match[2];
    return { raw, target: normalizeLocalReference(file, raw), line };
  });
  const images = extractElements(markup, /<(img|source)\b([^>]*)>/gi, (match, line) => {
    const fragment = match[2];
    const raw = attr(fragment, 'src') || attr(fragment, 'srcset').split(/\s+/)[0] || '';
    return {
      tag: match[1].toLowerCase(),
      raw,
      target: normalizeLocalReference(file, raw),
      alt: attr(fragment, 'alt'),
      hasAlt: /\balt\s*=/i.test(fragment),
      line
    };
  }).filter(item => item.raw);
  const links = extractElements(markup, /<a\b([^>]*)\bhref=["']([^"']*)["']([^>]*)>([\s\S]*?)<\/a>/gi, (match, line) => ({
    raw: match[2],
    target: normalizeLocalReference(file, match[2]),
    text: stripTags(match[4]).slice(0, 120),
    id: attr(match[1] + match[3], 'id'),
    ariaLabel: attr(match[1] + match[3], 'aria-label'),
    title: attr(match[1] + match[3], 'title'),
    imageAlt: attr(match[4], 'alt'),
    line
  }));
  const forms = extractElements(markup, /<form\b([^>]*)>/gi, (match, line) => ({
    id: attr(match[1], 'id') || '',
    action: attr(match[1], 'action') || '',
    method: (attr(match[1], 'method') || 'get').toLowerCase(),
    line
  }));
  const tables = extractElements(markup, /<table\b([^>]*)>/gi, (match, line) => ({
    id: attr(match[1], 'id') || '',
    classes: attr(match[1], 'class') || '',
    line
  }));
  const modals = extractElements(markup, /<(?:div|section|dialog)\b([^>]*(?:class=["'][^"']*(?:modal|dialog)[^"']*["']|role=["']dialog["'])[^>]*)>/gi, (match, line) => ({
    id: attr(match[1], 'id') || '',
    role: attr(match[1], 'role') || '',
    classes: attr(match[1], 'class') || '',
    line
  }));
  const tabs = extractElements(markup, /<(?:button|a)\b([^>]*(?:role=["']tab["']|data-[\w-]*tab[\w-]*=["'][^"']+["'])[^>]*)>/gi, (match, line) => ({
    id: attr(match[1], 'id') || '',
    role: attr(match[1], 'role') || '',
    line
  }));
  const sections = extractElements(markup, /<(?:section|div)\b([^>]*\bid=["'](?:section-|[\w-]*panel-)[^"']+["'][^>]*)>/gi, (match, line) => ({
    id: attr(match[1], 'id'),
    classes: attr(match[1], 'class'),
    line
  }));
  const buttons = extractElements(markup, /<button\b([^>]*)>([\s\S]*?)<\/button>/gi, (match, line) => {
    const fragment = match[1];
    const id = attr(fragment, 'id');
    const classes = attr(fragment, 'class').split(/\s+/).filter(Boolean);
    const selectors = [
      id ? `#${id}` : '',
      ...classes.slice(0, 3).map(name => `.${name}`)
    ].filter(Boolean);
    const hasSourceReference = selectors.some(selector => jsCorpus.includes(selector)) ||
      (id && jsCorpus.includes(`'${id}'`)) ||
      (id && jsCorpus.includes(`"${id}"`));
    const type = attr(fragment, 'type') || '';
    const dataAction = Object.fromEntries(
      [...fragment.matchAll(/\b(data-[\w-]+)=["']([^"']*)["']/gi)].map(item => [item[1], item[2]])
    );
    return {
      id,
      classes,
      type,
      text: stripTags(match[2]).slice(0, 120),
      ariaLabel: attr(fragment, 'aria-label'),
      title: attr(fragment, 'title'),
      inlineHandler: /\bon\w+\s*=/i.test(fragment),
      dataAction,
      hasSourceReference,
      line
    };
  });
  const controls = extractElements(markup, /<(input|select|textarea)\b([^>]*)>/gi, (match, line) => ({
    tag: match[1].toLowerCase(),
    id: attr(match[2], 'id'),
    name: attr(match[2], 'name'),
    type: attr(match[2], 'type'),
    ariaLabel: attr(match[2], 'aria-label'),
    line
  }));
  const labelsFor = new Set(extractElements(markup, /<label\b[^>]*\bfor=["']([^"']+)["'][^>]*>/gi, match => match[1]));
  const refs = [...scripts, ...styles, ...images, ...links]
    .filter(item => item.target)
    .map(item => ({
      raw: item.raw,
      target: item.target,
      line: item.line,
      exists: allPaths.has(item.target)
    }));

  const access = pageAccess(file);
  const buffer = fs.readFileSync(path.join(ROOT, file));
  const inlineScripts = [...html.matchAll(/<script\b([^>]*)(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/i.test(match[1]) && !/type=["'](?:application\/ld\+json|application\/json)["']/i.test(match[1]))
    .map(match => ({
      line: lineAt(html, match.index),
      module: /type=["']module["']/i.test(match[1]),
      ...checkJavaScriptSyntax(match[2], /type=["']module["']/i.test(match[1]))
    }));
  return {
    id: file.replace(/\.html$/i, ''),
    path: file,
    sourceFile: file,
    label: labelForPage(file, title),
    title,
    description,
    ...access,
    bytes: buffer.length,
    sha256: hash(buffer),
    metadata: {
      hasViewport: /<meta\b[^>]*name=["']viewport["']/i.test(html),
      hasDescription: Boolean(description),
      noindex: /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html),
      redirectsTo: attr((html.match(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*>/i) || [])[0] || '', 'content')
        .replace(/^[^;]*;\s*url\s*=\s*/i, ''),
      htmlLang: attr((html.match(/<html\b[^>]*>/i) || [])[0] || '', 'lang'),
      h1Count: h1Lines.length,
      h1Lines
    },
    duplicateIds,
    inlineScripts,
    ids: ids.length,
    scripts,
    styles,
    images,
    links,
    references: refs,
    forms,
    tables,
    modals,
    tabs,
    sections,
    buttons,
    controls: controls.map(control => ({
      ...control,
      labeled: Boolean(
        control.ariaLabel ||
        (control.id && labelsFor.has(control.id)) ||
        (control.id && new RegExp(`<label\\b[^>]*>[\\s\\S]*?<${control.tag}\\b[^>]*\\bid=["']${control.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(markup))
      )
    }))
  };
}

function extractImports(file, source) {
  const analyzableSource = source
    .replace(/\/\*[\s\S]*?\*\//g, value => '\n'.repeat((value.match(/\n/g) || []).length))
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  const imports = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(analyzableSource))) {
      imports.push({
        raw: match[1],
        target: normalizeLocalReference(file, match[1]),
        dynamic: pattern.source.includes('\\('),
        line: lineAt(analyzableSource, match.index)
      });
    }
  }
  return imports;
}

function extractEndpoints(file, source) {
  const endpoints = [];
  const seen = new Set();
  for (const match of source.matchAll(/https?:\/\/[^\s"'`<>)]+/g)) {
    let value = match[0].replace(/[),.;]+$/, '');
    try {
      const url = new URL(value);
      url.search = '';
      url.hash = '';
      value = url.href;
    } catch (_) {
      continue;
    }
    if (seen.has(value)) continue;
    seen.add(value);
    endpoints.push({ url: value, line: lineAt(source, match.index) });
  }
  return endpoints;
}

function extractRouteReferences(files, allPaths) {
  const references = [];
  const candidates = files.filter(file =>
    (!file.includes('/') && /\.(?:html|js)$/i.test(file)) ||
    file.startsWith('js/')
  );
  for (const file of candidates) {
    const source = read(file);
    const seen = new Set();
    for (const match of source.matchAll(/(["'`])((?:\.\.\/|\.\/|\/)?[A-Za-z0-9_-]+\.html)(?:[?#][^"'`]*)?\1/g)) {
      const raw = match[2];
      const target = path.posix.basename(raw.split('#')[0].split('?')[0]);
      if (!target || seen.has(`${target}:${match.index}`)) continue;
      seen.add(`${target}:${match.index}`);
      references.push({
        file,
        line: lineAt(source, match.index),
        raw,
        target,
        exists: allPaths.has(target)
      });
    }
  }
  return references;
}

function extractRoutePatterns(files) {
  const patterns = new Map();
  const candidates = files.filter(file =>
    (!file.includes('/') && /\.(?:html|js)$/i.test(file)) ||
    file.startsWith('js/')
  );
  for (const file of candidates) {
    const source = read(file);
    for (const match of source.matchAll(/([A-Za-z0-9_-]+\.html)\?([A-Za-z0-9_-]+)=/g)) {
      const pattern = `${match[1]}?${match[2]}=:dynamic`;
      const entry = patterns.get(pattern) || { pattern, references: [] };
      entry.references.push({ file, line: lineAt(source, match.index) });
      patterns.set(pattern, entry);
    }
  }
  return [...patterns.values()].sort((a, b) => a.pattern.localeCompare(b.pattern));
}

function extractApiCalls(files) {
  const calls = [];
  const candidates = files.filter(file =>
    (!file.includes('/') && /\.(?:html|js)$/i.test(file)) ||
    file.startsWith('js/') ||
    file.startsWith('netlify/functions/') ||
    file.startsWith('apps-script/')
  );
  for (const file of candidates) {
    const source = read(file);
    for (const match of source.matchAll(/\b(?:fetch|UrlFetchApp\.fetch)\s*\(\s*["'`]([^"'`]+)["'`]/g)) {
      const raw = match[1];
      if (raw.includes('${')) continue;
      const nearby = source.slice(match.index, match.index + 260);
      const methodMatch = nearby.match(/\bmethod\s*:\s*["']([A-Z]+)["']/i);
      calls.push({
        file,
        line: lineAt(source, match.index),
        target: raw.replace(/[?#].*$/, ''),
        method: (methodMatch?.[1] || 'GET').toUpperCase()
      });
    }
  }
  return calls;
}

function extractFirestoreCollections(files) {
  const used = new Map();
  const register = (name, file, line, operation) => {
    if (!name || name.includes('$') || name.includes('/')) return;
    const entry = used.get(name) || { name, references: [] };
    entry.references.push({ file, line, operation });
    used.set(name, entry);
  };
  for (const file of files.filter(name => /\.(?:js|html|gs)$/i.test(name))) {
    const source = read(file);
    const patterns = [
      { operation: 'collection', regex: /\bcollection\s*\(\s*db\s*,\s*["']([^"']+)["']/g },
      { operation: 'doc', regex: /\bdoc\s*\(\s*db\s*,\s*["']([^"']+)["']/g }
    ];
    for (const { operation, regex } of patterns) {
      let match;
      while ((match = regex.exec(source))) register(match[1], file, lineAt(source, match.index), operation);
    }
  }
  return [...used.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function extractUnboundedReads(files) {
  const reads = [];
  const candidates = files.filter(file =>
    (!file.includes('/') && /\.(?:html|js)$/i.test(file)) ||
    file.startsWith('js/')
  );
  for (const file of candidates) {
    const source = read(file);
    const pattern = /\b(getDocs|onSnapshot)\s*\(\s*collection\s*\(\s*db\s*,\s*["']([^"']+)["'][^)]*\)\s*\)/g;
    let match;
    while ((match = pattern.exec(source))) {
      reads.push({
        file,
        line: lineAt(source, match.index),
        operation: match[1],
        collection: match[2]
      });
    }
  }
  return reads;
}

function extractRuleCollections() {
  const source = read('firestore.rules');
  const names = [];
  for (const match of source.matchAll(/match\s+\/([A-Za-z0-9_-]+)(?:\/|\s*\{)/g)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names.sort();
}

const allFiles = walk(ROOT).filter(file => file !== 'diagnostic-manifest.json');
const allPaths = new Set(allFiles);
const textFiles = allFiles.filter(file => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()));
const jsFiles = allFiles.filter(file => /\.(?:js|mjs)$/i.test(file));
const inlineHtmlScripts = allFiles
  .filter(file => !file.includes('/') && file.endsWith('.html'))
  .flatMap(file => {
    const html = read(file);
    return [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .map(match => match[1]);
  });
const jsCorpus = jsFiles
  .filter(file => !file.startsWith('scripts/'))
  .map(read)
  .concat(inlineHtmlScripts)
  .join('\n');
const pages = allFiles
  .filter(file => !file.includes('/') && file.endsWith('.html'))
  .map(file => extractPage(file, allPaths, jsCorpus));

const modules = jsFiles.map(file => {
  const source = read(file);
  const buffer = fs.readFileSync(path.join(ROOT, file));
  const syntax = childProcess.spawnSync(process.execPath, ['--check', path.join(ROOT, file)], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });
  return {
    path: file,
    bytes: buffer.length,
    sha256: hash(buffer),
    syntax: {
      ok: syntax.status === 0,
      error: syntax.status === 0
        ? ''
        : String(syntax.stderr || syntax.stdout || 'Error de sintaxis').trim().slice(0, 1200)
    },
    imports: extractImports(file, source),
    endpoints: extractEndpoints(file, source)
  };
});
const routeReferences = extractRouteReferences(textFiles, allPaths);
const routePatterns = extractRoutePatterns(textFiles);
const apiCalls = extractApiCalls(textFiles);

const files = allFiles.map(file => {
  const buffer = fs.readFileSync(path.join(ROOT, file));
  return {
    path: file,
    extension: path.extname(file).toLowerCase(),
    bytes: buffer.length,
    sha256: hash(buffer)
  };
});

const missingReferences = pages.flatMap(page =>
  page.references
    .filter(reference => !reference.exists)
    .map(reference => ({
      page: page.path,
      target: reference.target,
      raw: reference.raw,
      line: reference.line
    }))
);
for (const module of modules.filter(item => !item.path.startsWith('scripts/'))) {
  for (const dependency of module.imports) {
    if (dependency.target && !allPaths.has(dependency.target)) {
      missingReferences.push({
        page: module.path,
        target: dependency.target,
        raw: dependency.raw,
        line: dependency.line
      });
    }
  }
}
for (const reference of routeReferences.filter(item => !item.exists)) {
  if (missingReferences.some(item =>
    item.page === reference.file &&
    item.target === reference.target &&
    item.line === reference.line
  )) continue;
  missingReferences.push({
    page: reference.file,
    target: reference.target,
    raw: reference.raw,
    line: reference.line
  });
}

const sitemap = read('sitemap.xml');
const sitemapRoutes = [...sitemap.matchAll(/<loc>[^<]*\/([^/]+\.html)<\/loc>/g)].map(match => match[1]);
const firestoreUsed = extractFirestoreCollections(allFiles);
const firestoreRules = extractRuleCollections();
const unboundedReads = extractUnboundedReads(allFiles);
const sourceFingerprint = hash(Buffer.from(
  files.map(file => `${file.path}:${file.sha256}`).join('\n'),
  'utf8'
));

let previousManifest = null;
try {
  previousManifest = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
} catch (_) {}

const manifest = {
  schemaVersion: 2,
  generatedAt: previousManifest?.sourceFingerprint === sourceFingerprint
    ? previousManifest.generatedAt
    : new Date().toISOString(),
  sourceFingerprint,
  safety: {
    mode: 'read-only',
    runtimeScriptsExecuted: false,
    destructiveTests: false,
    historyStorage: 'indexeddb-local'
  },
  platform: {
    files: files.length,
    textFiles: textFiles.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    pages: pages.length,
    modules: modules.length
  },
  viewports: [
    { id: 'desktop-large', label: 'Desktop grande', width: 1920, height: 1080 },
    { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
    { id: 'laptop', label: 'Laptop', width: 1280, height: 720 },
    { id: 'tablet-landscape', label: 'Tablet horizontal', width: 1024, height: 768 },
    { id: 'tablet-portrait', label: 'Tablet vertical', width: 768, height: 1024 },
    { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
    { id: 'mini-mobile', label: 'Mini mobile', width: 320, height: 568 }
  ],
  roles: ['guest', 'client', 'viewer', 'agent', 'admin', 'superadmin'],
  pages,
  modules,
  files,
  sitemapRoutes,
  missingReferences,
  routeReferences,
  routePatterns,
  apiCalls,
  firestore: {
    collectionsUsed: firestoreUsed,
    ruleCollections: firestoreRules,
    unboundedReads,
    usedWithoutExplicitRule: firestoreUsed
      .map(item => item.name)
      .filter(name => !firestoreRules.includes(name)),
    rulesWithoutDetectedClientUse: firestoreRules
      .filter(name => !firestoreUsed.some(item => item.name === name))
  }
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Diagnostic manifest: ${pages.length} pages, ${modules.length} modules, ${files.length} files.`);
