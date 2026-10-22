const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { visualSource } = require('../js/quality/revision-visual.mjs');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'diagnostic-manifest.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function canonicalTextBuffer(filePath) {
  return Buffer.from(
    fs.readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n'),
    'utf8'
  );
}

function fail(message) {
  console.error(`FAIL — ${message}`);
  process.exitCode = 1;
}

function cleanRouteHasBackingPage(raw) {
  const value = String(raw || '').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  const pathname = value.split('#')[0].split('?')[0].replace(/^\/+|\/+$/g, '');
  if (!pathname) return fs.existsSync(path.join(ROOT, 'index.html'));
  if (path.extname(pathname)) return false;
  return fs.existsSync(path.join(ROOT, `${pathname}.html`));
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('FAIL — No existe diagnostic-manifest.json. Ejecutá primero npm run build:diagnostics.');
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (error) {
  console.error(`FAIL — diagnostic-manifest.json no es JSON válido: ${error.message}`);
  process.exit(1);
}

if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.pages)) {
  console.error('FAIL — El manifiesto no tiene el formato esperado.');
  process.exit(1);
}

try {
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'site-version.json'), 'utf8'));
  if (version.revision !== manifest.sourceFingerprint) fail('site-version.json no corresponde al artefacto diagnóstico actual.');
  if (version.schemaVersion !== 2 || !version.pages || Object.keys(version.pages).length !== manifest.pages.length || manifest.pages.some(page => {
    const html = fs.readFileSync(path.join(ROOT, page.path), 'utf8');
    const expected = sha256(Buffer.from(visualSource(html)));
    return version.pages[page.path] !== expected || (/<head\b/i.test(html) && !html.includes(`name="tintin-page-revision" content="${expected}"`));
  })) fail('site-version.json no corresponde a las interfaces inventariadas.');
  const cacheVersions = { ...JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/cache-version-baseline.json'))), ...JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/cache-version-approvals.json'))).approved };
  const resources = Object.keys(cacheVersions).filter(file => fs.existsSync(path.join(ROOT, file)) && manifest.files.some(item => item.path === file));
  if (!version.clientResources || resources.some(file => version.clientResources[file]?.version !== cacheVersions[file].version || version.clientResources[file]?.revision !== sha256(Buffer.from(visualSource(fs.readFileSync(path.join(ROOT, file), 'utf8')))))) fail('Los recursos de interfaz no corresponden a sus fuentes y versiones inmutables.');
} catch {
  fail('Falta el marcador de publicación site-version.json o no es JSON válido.');
}

for (const page of manifest.pages) {
  const filePath = path.join(ROOT, page.path);
  if (!fs.existsSync(filePath)) {
    fail(`Falta la página inventariada ${page.path}.`);
    continue;
  }

  const buffer = canonicalTextBuffer(filePath);
  const actualBytes = buffer.byteLength;
  const actualHash = sha256(buffer);

  if (actualBytes !== page.bytes || actualHash !== page.sha256) {
    fail(
      `${page.path} no coincide con el manifiesto: ` +
      `archivo ${actualBytes} bytes / ${actualHash}; ` +
      `manifiesto ${page.bytes} bytes / ${page.sha256}.`
    );
  }
}

if (!Array.isArray(manifest.missingReferences)) {
  fail('El manifiesto no incluye el inventario de referencias faltantes.');
} else {
  // Las URLs públicas finales son limpias (/catalogo, /contact, etc.), pero el
  // repositorio conserva su asset físico equivalente (*.html). Solo se descarta
  // la advertencia cuando ese HTML existe de verdad; una ruta limpia huérfana
  // continúa fallando y bloqueando el deploy.
  const unresolved = manifest.missingReferences.filter(
    item => !cleanRouteHasBackingPage(item.raw || item.target)
  );
  if (unresolved.length) {
    const summary = unresolved
      .slice(0, 10)
      .map(item => `${item.page}:${item.line || '?'} → ${item.raw || item.target || '?'}`)
      .join(' | ');
    fail(`Hay ${unresolved.length} referencia(s) local(es) faltante(s): ${summary}.`);
  }
}

if (process.exitCode) {
  console.error('\nIntegridad página-manifiesto: incorrecta. No se debe publicar esta versión.');
  process.exit(process.exitCode);
}

console.log(`Integridad página-manifiesto: correcta para ${manifest.pages.length} páginas.`);
