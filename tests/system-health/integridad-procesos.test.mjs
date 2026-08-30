import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('functions/api/admin-process-integrity-runtime.js', 'utf8');
const injector = fs.readFileSync('cloudflare/inyectar-diagnostico-maestro-admin.js', 'utf8');
const routes = JSON.parse(fs.readFileSync('_routes.json', 'utf8'));

function browserRuntimeBody(source) {
  const start = source.indexOf('function browserRuntime()');
  const end = source.indexOf('\n}\n\nexport async function onRequest');
  assert.ok(start >= 0 && end > start, 'debe existir browserRuntime autocontenido');
  return source.slice(start, end + 2);
}

test('Integridad de procesos se inyecta solo como lectura derivada del Diagnóstico', () => {
  assert.match(injector, /PROCESS_INTEGRITY_RUNTIME_URL\s*=\s*'\/api\/admin-process-integrity-runtime'/);
  assert.match(injector, /x-tintin-process-integrity/);
  assert.ok(routes.include.includes('/api/admin-process-integrity-runtime'));

  const browser = browserRuntimeBody(runtime);
  assert.doesNotMatch(browser, /\bfetch\s*\(/, 'el runtime no debe crear otra lectura API/Firestore/Sheets');
  assert.match(browser, /#master-diagnostic-areas \.adm-master-area/);
  assert.match(browser, /#system-health-areas \.adm-master-area/);
  assert.match(browser, /btn-refresh-master-diagnostics/);
  assert.match(browser, /btn-refresh-system-health/);
});

test('El mapa cubre las cadenas críticas de Tintin y marca el primer punto problemático', () => {
  for (const flow of [
    'Compra y pedido',
    'Cuenta y perfil',
    'Comunidad, reseñas y notificaciones',
    'Catálogo, stock y sincronización',
    'Integraciones externas',
    'Publicación y experiencia pública',
  ]) {
    assert.ok(runtime.includes(flow), `falta flujo crítico: ${flow}`);
  }

  for (const dependency of [
    'Carrito V2',
    'Checkout',
    'Pedido en Firestore',
    'Inventario',
    'Cloudinary',
    'Resend',
    'Google Sheets',
    'Apps Script',
    'Web Push',
    'GitHub / CI',
  ]) {
    assert.ok(runtime.includes(dependency), `falta dependencia: ${dependency}`);
  }

  assert.match(runtime, /Primer fallo verificable:/);
  assert.match(runtime, /Primer punto a revisar:/);
  assert.match(runtime, /no tienen evidencia suficiente/);
});

test('El endpoint del runtime es no-cache, JS y no expone contratos privados', () => {
  assert.match(runtime, /application\/javascript; charset=utf-8/);
  assert.match(runtime, /no-store, max-age=0/);
  assert.match(runtime, /x-content-type-options/);
  assert.doesNotMatch(runtime, /SHEETS_ENGAGEMENT_SECRET|FIREBASE_PRIVATE_KEY|CLOUDINARY_API_SECRET|RESEND_API_KEY/);
});
