const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'diagnostic-manifest.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fail(message) {
  console.error(`FAIL — ${message}`);
  process.exitCode = 1;
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

for (const page of manifest.pages) {
  const filePath = path.join(ROOT, page.path);
  if (!fs.existsSync(filePath)) {
    fail(`Falta la página inventariada ${page.path}.`);
    continue;
  }

  const buffer = fs.readFileSync(filePath);
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
} else if (manifest.missingReferences.length) {
  const summary = manifest.missingReferences
    .slice(0, 10)
    .map(item => `${item.page}:${item.line || '?'} → ${item.raw || item.target || '?'}`)
    .join(' | ');
  fail(`Hay ${manifest.missingReferences.length} referencia(s) local(es) faltante(s): ${summary}.`);
}

if (process.exitCode) {
  console.error('\nIntegridad página-manifiesto: incorrecta. No se debe publicar esta versión.');
  process.exit(process.exitCode);
}

console.log(`Integridad página-manifiesto: correcta para ${manifest.pages.length} páginas.`);
