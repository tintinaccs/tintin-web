import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const site = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\/$/, '');
const targets = [
  ['html', '/', /no-cache,\s*no-store,\s*must-revalidate/i],
  ['css', '/css/pages/login/login.css?v=header-audit', /public,\s*max-age=31536000,\s*immutable/i],
  ['js', '/js/cargador-pagina.js?v=header-audit', /public,\s*max-age=31536000,\s*immutable/i],
  ['font', '/assets-tintin/fonts/montserrat-latin-wght-normal.woff2', /public,\s*max-age=31536000,\s*immutable/i],
  ['storeGate', '/api/public-catalog?resource=storeGate', /(?:public,\s*)?max-age=(?:[1-9]\d*)/i],
];

function headersFor(path) {
  return execFileSync('curl.exe', ['-sS', '-L', '-D', '-', '-o', 'NUL', `${site}${path}`], { encoding: 'utf8' });
}

const failures = [];
for (const [name, path, expected] of targets) {
  let raw;
  try { raw = headersFor(path); } catch (error) {
    failures.push(`${name}: curl no pudo consultar ${site}${path}: ${error.message}`);
    continue;
  }
  const blocks = raw.split(/\r?\n\r?\n/).filter(Boolean);
  const block = blocks.at(-1) || raw;
  const cache = block.match(/^cache-control:\s*(.+)$/im)?.[1] || '';
  if (!expected.test(cache)) failures.push(`${name}: Cache-Control inesperado: ${cache || '(ausente)'}`);
  if (name !== 'html' && /no-store/i.test(cache)) failures.push(`${name}: producción todavía combina no-store con el caché del asset (${cache})`);
  if (name === 'html' && !/no-store/i.test(cache)) failures.push('html: producción no conserva no-store para HTML');
  else console.log(`OK — ${name}: ${cache}`);
}

// El control global nunca debe volver a imponer no-store sobre cada respuesta.
const sourceHeaders = fs.readFileSync('_headers', 'utf8');
const globalBlock = sourceHeaders.split(/\r?\n\s*\n/)[1] || '';
if (/^\s*Cache-Control:\s*.*no-store/im.test(globalBlock)) {
  failures.push('source: _headers vuelve a declarar no-store en el bloque global');
}

if (failures.length) {
  console.error('\nAuditoría de cabeceras de producción fallida:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log('\nAuditoría de cabeceras de producción completada correctamente.');
