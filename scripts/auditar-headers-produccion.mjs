import fs from 'node:fs';

const site = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\/$/, '');
const runtime = JSON.parse(fs.readFileSync(new URL('../config/csp-runtime.json', import.meta.url), 'utf8'));
const targets = [
  ['html', '/', /no-cache,\s*must-revalidate/i],
  ['css', '/css/pages/login/login.css?v=header-audit', /public,\s*max-age=31536000,\s*immutable/i],
  ['js', '/js/cargador-pagina.js?v=header-audit', /public,\s*max-age=31536000,\s*immutable/i],
  ['font', '/assets-tintin/fonts/montserrat-latin-wght-normal.woff2', /public,\s*max-age=31536000,\s*immutable/i],
  ['storeGate', '/api/public-catalog?resource=storeGate', /(?:public,\s*)?max-age=(?:[1-9]\d*)/i],
];

const failures = [];
for (const [name, path, expected] of targets) {
  let response;
  try {
    response = await fetch(`${site}${path}`, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    failures.push(`${name}: no pudo consultar ${site}${path}: ${error.message}`);
    continue;
  }
  const cache = response.headers.get('cache-control') || '';
  if (!expected.test(cache)) failures.push(`${name}: Cache-Control inesperado: ${cache || '(ausente)'}`);
  if (name !== 'html' && /no-store/i.test(cache)) failures.push(`${name}: producción todavía combina no-store con el caché del asset (${cache})`);
  if (name === 'html' && /no-store/i.test(cache)) failures.push('html: producción todavía fuerza no-store y bloquea la revalidación eficiente');
  if (name === 'html') {
    const actualCsp = response.headers.get('content-security-policy') || '';
    const expectedCsp = runtime.routes?.['/'] || runtime.public || '';
    if (!actualCsp) failures.push('html: producción no entrega Content-Security-Policy');
    else if (actualCsp !== expectedCsp) failures.push('html: producción entrega una CSP distinta a la generada por este commit');
  }
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
