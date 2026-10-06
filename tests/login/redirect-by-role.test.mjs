// Ejecuta redirectByRole y safeLocalRedirect tal como están escritas en
// login.html (se extraen del archivo y se corren con dependencias simuladas).
// Sostiene la conexión «Roles → Página principal» del Flujo de conexiones:
// una clienta con acceso termina en la tienda, el personal en el panel y una
// tienda cerrada no navega a ningún lado.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const LOGIN = fs.readFileSync(new URL('../../login.html', import.meta.url), 'utf8');
const SUPER_ADMIN = 'tintinaccs@gmail.com';
const ORIGIN = 'https://tintinaccesorios.pages.dev';

// Devuelve el texto completo de una función contando llaves desde su firma.
function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `login.html ya no contiene «${signature}»`);
  assert.equal(source.indexOf(signature, start + 1), -1, `«${signature}» debe existir una sola vez`);
  let depth = 0;
  for (let index = source.indexOf('{', start + signature.length - 1); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`No se pudo delimitar «${signature}»`);
}

const SAFE_LOCAL_REDIRECT = extractFunction(LOGIN, 'function safeLocalRedirect(value) {');
const REDIRECT_BY_ROLE = extractFunction(LOGIN, 'async function redirectByRole(role, email, options = {}) {');

function createLogin({ search = '', storeConfig = { __storeConfigStatus: 'ok', open: true }, allowed = true } = {}) {
  const world = { redirects: [], overlays: [], handoffs: [], diagnostics: [], persistenceWaits: 0, configReads: 0 };
  const window = {
    location: { origin: ORIGIN, search, replace: url => world.redirects.push(url) },
  };
  const deps = {
    window,
    URL,
    URLSearchParams,
    SUPER_ADMIN,
    PROFILE_READ_DEADLINE_MS: 15000,
    withDeadline: promise => promise,
    getStoreAccessConfig: async () => { world.configReads += 1; return storeConfig; },
    isAccessAllowed: () => allowed,
    hideLoginOverlay: () => world.overlays.push('hide'),
    renderStoreConfigUnavailableOverlay: () => world.overlays.push('config-unavailable'),
    renderStoreClosedOverlay: () => world.overlays.push('store-closed'),
    createAuthHandoff: uid => { world.handoffs.push(uid); return true; },
    waitForPersistedAuthRecord: async () => { world.persistenceWaits += 1; return true; },
    recordAuthDiagnostic: (event, detail) => world.diagnostics.push({ event, ...detail }),
  };
  const names = Object.keys(deps);
  const redirectByRole = new Function(...names,
    `${SAFE_LOCAL_REDIRECT}\n${REDIRECT_BY_ROLE}\nreturn redirectByRole;`)(...names.map(name => deps[name]));
  return { redirectByRole, world };
}

test('una clienta con acceso entra a la página principal', async () => {
  const { redirectByRole, world } = createLogin();
  await redirectByRole('client', 'clienta@example.com', { user: { uid: 'u1' } });
  assert.deepEqual(world.redirects, ['index.html']);
  assert.deepEqual(world.handoffs, [], 'una clienta no deja handoff hacia el panel');
  assert.ok(world.diagnostics.some(item => item.reason === 'authenticated-storefront'));
});

test('la primera entrada tras completar el alta muestra la bienvenida', async () => {
  const { redirectByRole, world } = createLogin();
  await redirectByRole('client', 'clienta@example.com', { welcomePending: true });
  assert.deepEqual(world.redirects, ['index.html?welcome=1']);
});

test('vuelve a la página pública de origen y descarta destinos externos o privados', async () => {
  const cases = [
    ['?from=' + encodeURIComponent('/product?id=p1#opiniones'), '/product?id=p1#opiniones'],
    ['?from=' + encodeURIComponent('/checkout'), '/checkout'],
    ['?from=' + encodeURIComponent('https://evil.example/'), 'index.html'],
    ['?from=' + encodeURIComponent('//evil.example/'), 'index.html'],
    ['?from=' + encodeURIComponent('/admin'), 'index.html'],
    ['?from=' + encodeURIComponent('/login'), 'index.html'],
    ['?from=' + encodeURIComponent('javascript:alert(1)'), 'index.html'],
  ];
  for (const [search, expected] of cases) {
    const { redirectByRole, world } = createLogin({ search });
    await redirectByRole('client', 'clienta@example.com', {});
    assert.deepEqual(world.redirects, [expected], `from=${decodeURIComponent(search.slice(6))}`);
  }
});

test('el personal y el Super Admin van al panel aunque exista un destino de retorno', async () => {
  for (const [role, email] of [
    ['superadmin', SUPER_ADMIN],
    ['client', 'TintinAccs@Gmail.com'],
    ['admin', 'admin@example.com'],
    ['agent', 'agente@example.com'],
    ['viewer', 'lector@example.com'],
  ]) {
    const { redirectByRole, world } = createLogin({ search: '?from=' + encodeURIComponent('/catalogo') });
    await redirectByRole(role, email, { user: { uid: 'u-interno' } });
    assert.deepEqual(world.redirects, ['admin.html'], `${role} <${email}>`);
    assert.deepEqual(world.handoffs, ['u-interno'], 'el panel recibe el handoff de la sesión');
    assert.equal(world.persistenceWaits, 1, 'se espera la sesión persistida antes de navegar');
  }
});

test('un rol desconocido o vacío se trata como clienta, nunca como personal', async () => {
  for (const role of ['', null, undefined, 'owner', 'ADMINISTRADOR']) {
    const { redirectByRole, world } = createLogin();
    await redirectByRole(role, 'alguien@example.com', {});
    assert.deepEqual(world.redirects, ['index.html'], `rol=${String(role)}`);
  }
});

test('tienda cerrada confirmada o configuración sin confirmar: no se navega', async () => {
  const closed = createLogin({ allowed: false, storeConfig: { __storeConfigStatus: 'ok' } });
  await closed.redirectByRole('client', 'clienta@example.com', {});
  assert.deepEqual(closed.world.redirects, []);
  assert.deepEqual(closed.world.overlays, ['hide', 'store-closed']);

  const unknown = createLogin({ allowed: false, storeConfig: { __storeConfigStatus: 'degraded' } });
  await unknown.redirectByRole('client', 'clienta@example.com', {});
  assert.deepEqual(unknown.world.redirects, []);
  assert.deepEqual(unknown.world.overlays, ['hide', 'config-unavailable'], 'una lectura fallida no se presenta como tienda cerrada');
});

test('la configuración de tienda ya leída se reutiliza sin otra consulta', async () => {
  const provided = createLogin();
  await provided.redirectByRole('client', 'clienta@example.com', { storeAccessConfig: { __storeConfigStatus: 'ok' } });
  assert.deepEqual(provided.world.redirects, ['index.html']);
  assert.equal(provided.world.configReads, 0, 'con la configuración ya leída no se consulta de nuevo');

  const missing = createLogin();
  await missing.redirectByRole('client', 'clienta@example.com', {});
  assert.equal(missing.world.configReads, 1, 'sin configuración previa se lee una sola vez');
});
