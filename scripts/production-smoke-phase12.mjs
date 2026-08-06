import fs from 'node:fs';
import path from 'node:path';

const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\/$/, '');
const expectedCommit = 'b36e8ed';
const timeoutMs = 20000;
const checkedAt = new Date().toISOString();
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchText(relative) {
  const url = new URL(relative, origin + '/');
  url.searchParams.set('tt_verify', `${expectedCommit}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const started = Date.now();
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'TintinProductionVersionVerifier/1.0',
      'cache-control': 'no-cache',
      pragma: 'no-cache'
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const body = await response.text();
  const result = {
    relative,
    url: response.url,
    status: response.status,
    ok: response.ok,
    ms: Date.now() - started,
    bytes: body.length,
    cacheControl: response.headers.get('cache-control') || '',
    contentType: response.headers.get('content-type') || ''
  };
  results.push(result);
  assert(response.ok, `${relative} respondió ${response.status}`);
  return { response, body, result };
}

async function verifyFile(relative, checks) {
  const { body } = await fetchText(relative);
  for (const [label, test] of checks) {
    assert(test(body), `${relative}: falta ${label}`);
  }
  console.log(`OK — ${relative} — ${checks.length} marcador(es) — producción actualizada`);
}

let failure = null;
try {
  await verifyFile('/js/pages/collections/pagina-colecciones.js', [
    ['FEATURED_LIMIT = 4', body => /const\s+FEATURED_LIMIT\s*=\s*4\s*;/.test(body)]
  ]);

  await verifyFile('/js/quality/correccion-auditoria-pagina.js', [
    ['detección de páginas Admin', body => body.includes('function isAdminPage()')],
    ['retorno previo que evita reversionar CSS del Admin', body => body.includes('function versionLocalCssLinks(){if(isAdminPage())return;')]
  ]);

  await verifyFile('/js/quality/revelado-desplazamiento-global.js', [
    ['detección de Admin para reveals', body => body.includes('const isAdminPage =')],
    ['clase tt-reveal-admin-disabled', body => body.includes("classList.add('tt-reveal-admin-disabled')")]
  ]);

  await verifyFile('/css/admin/admin-color-tokens.css', [
    ['reserva previa de dashboard-visitor-geo', body => body.includes('html:not(.adm-auth-ready) #dashboard-visitor-geo[hidden]')],
    ['reserva invisible sin interacción', body => body.includes('visibility: hidden !important;') && body.includes('pointer-events: none !important;')]
  ]);

  await verifyFile('/js/admin/content/control-bienvenida-admin.js', [
    ['guarda de pertenencia para navegación desktop', body => body.includes('config?.parentElement === nav ? config : null')],
    ['guarda de pertenencia para navegación móvil', body => body.includes('config?.parentElement === tabs ? config : null')]
  ]);

  const home = await fetchText('/index.html');
  const csp = home.response.headers.get('content-security-policy') || '';
  assert(csp.includes('frame-src'), 'La CSP publicada no contiene frame-src.');
  assert(csp.includes('https://tintinaccesorios.pages.dev'), 'La CSP publicada no permite el dominio canónico para Auth en previews.');
  console.log('OK — CSP de producción contiene frame-src y el dominio canónico.');
} catch (error) {
  failure = error;
}

fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
fs.writeFileSync(
  path.resolve('artifacts/production-version-verification.json'),
  JSON.stringify({ checkedAt, origin, expectedCommit, ok: !failure, results, error: failure ? String(failure.message || failure) : '' }, null, 2)
);

if (failure) {
  console.error('\nVerificación exacta de producción fallida:', failure.message || failure);
  process.exit(1);
}

console.log(`\nProducción exacta verificada para los cambios de ${expectedCommit} en ${origin}.`);
