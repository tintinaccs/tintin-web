import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PROFILE_STATE, PROFILE_ACTION, PROFILE_ERROR_KIND,
  normalizeRole, detectAuthMethod, classifyProfileError, readProfileSnapshot,
  isProfileComplete, resolveProfileState, resolveProfileAction, withDeadline,
} from '../../js/core/auth/estado-perfil-sesion.mjs';

const SUPER = 'admin@tintin.example';
const snap = data => ({ exists: () => data !== null, data: () => data });
const read = (result, opts) => readProfileSnapshot(result, opts);
const user = { uid: 'u1', email: 'cliente@example.com', displayName: 'Ana Gómez' };
const resolve = (result, extra = {}) => resolveProfileState({ read: read(result), user, role: 'client', superAdminEmail: SUPER, ...extra });

const COMPLETE_PROFILE = {
  role: 'client', profileStatus: 'active', firstName: 'Ana', lastName: 'Gómez', name: 'Ana Gómez',
  phone: '+595981123456', username: 'ana_g', dob: new Date('1995-03-10'),
  savedLocation: { lat: -25.29, lng: -57.63, name: 'Casa' },
};

test('CASO CRÍTICO: Auth sin documento => MISSING => crear y completar perfil (no loader, no login)', () => {
  const state = resolve({ snapshot: snap(null) });
  assert.equal(state.state, PROFILE_STATE.MISSING);
  assert.equal(resolveProfileAction(state.state), PROFILE_ACTION.CREATE_THEN_COMPLETE_PROFILE);
  assert.equal(state.plan.skip, false);
  assert.equal(state.plan.needsPhone, true);
  assert.equal(state.plan.suggestedName, 'Ana Gómez');
});

test('perfil parcial (creado por ensureUserProfile) => INCOMPLETE => completar perfil', () => {
  const state = resolve({ snapshot: snap({ role: 'client', profileStatus: 'incomplete', name: 'Ana Gómez', phone: '', onboardingCompleted: false, welcomeTutorialSeen: false }) });
  assert.equal(state.state, PROFILE_STATE.INCOMPLETE);
  assert.equal(resolveProfileAction(state.state), PROFILE_ACTION.COMPLETE_PROFILE);
});

test('documento vacío {} también es INCOMPLETE, nunca COMPLETE', () => {
  const state = resolve({ snapshot: snap({}) });
  assert.equal(state.state, PROFILE_STATE.INCOMPLETE);
  assert.equal(isProfileComplete({}, { user, role: 'client', superAdminEmail: SUPER }), false);
});

test('perfil activo => COMPLETE => entra y nunca reabre "Últimos datos"', () => {
  const state = resolve({ snapshot: snap(COMPLETE_PROFILE) });
  assert.equal(state.state, PROFILE_STATE.COMPLETE);
  assert.equal(resolveProfileAction(state.state), PROFILE_ACTION.ENTER);
});

test('perfil legacy con marca de alta terminada pero sin datos => INCOMPLETE', () => {
  assert.equal(resolve({ snapshot: snap({ role: 'client', onboardingCompleted: true }) }).state, PROFILE_STATE.INCOMPLETE);
});

test('perfil activo al que le falta un dato => INCOMPLETE (decide por datos, no por la marca)', () => {
  const { phone, ...withoutPhone } = COMPLETE_PROFILE;
  const state = resolve({ snapshot: snap(withoutPhone) });
  assert.equal(state.state, PROFILE_STATE.INCOMPLETE);
  assert.equal(state.plan.needsPhone, true);
  assert.equal(state.plan.needsUsername, false);
});

test('personal (admin/agente/viewer) con clientOnly entra al panel sin alta de clienta', () => {
  for (const role of ['admin', 'agent', 'viewer']) {
    const state = resolve({ snapshot: snap({ role }) }, { clientOnly: true });
    assert.equal(state.state, PROFILE_STATE.COMPLETE);
  }
});

test('un error de lectura NUNCA es MISSING ni incompleto: es ERROR clasificado y no navega', () => {
  for (const [code, kind] of [
    ['permission-denied', PROFILE_ERROR_KIND.PERMISSION_DENIED],
    ['unavailable', PROFILE_ERROR_KIND.UNAVAILABLE],
    ['deadline-exceeded', PROFILE_ERROR_KIND.TIMEOUT],
    ['profile/deadline', PROFILE_ERROR_KIND.TIMEOUT],
    ['algo-raro', PROFILE_ERROR_KIND.UNKNOWN],
  ]) {
    const state = resolve({ error: { code } });
    assert.equal(state.state, PROFILE_STATE.ERROR, code);
    assert.equal(state.errorKind, kind, code);
    assert.equal(resolveProfileAction(state.state), PROFILE_ACTION.STAY_WITH_RETRY);
  }
  assert.equal(classifyProfileError({ code: 'unavailable' }, { online: false }), PROFILE_ERROR_KIND.OFFLINE);
  assert.equal(classifyProfileError({ code: 'firestore/permission-denied' }), PROFILE_ERROR_KIND.PERMISSION_DENIED);
});

test('una lectura sin snapshot ni error es ERROR, no perfil vacío', () => {
  assert.equal(resolve({}).state, PROFILE_STATE.ERROR);
  assert.equal(resolve(undefined).state, PROFILE_STATE.ERROR);
});

test('sin lectura solicitada el estado es NOT_REQUESTED', () => {
  assert.equal(resolveProfileState({ read: null, user, superAdminEmail: SUPER }).state, PROFILE_STATE.NOT_REQUESTED);
});

test('SuperAdmin siempre COMPLETE, aun sin documento o con error de Firestore', () => {
  const admin = { uid: 'a1', email: 'Admin@Tintin.example' };
  for (const result of [{ snapshot: snap(null) }, { error: { code: 'permission-denied' } }, { snapshot: snap({}) }]) {
    const state = resolveProfileState({ read: read(result), user: admin, superAdminEmail: SUPER });
    assert.equal(state.state, PROFILE_STATE.COMPLETE);
    assert.equal(state.role, 'superadmin');
  }
});

test('roles nulos, desconocidos o legacy se degradan a client; nunca a privilegio', () => {
  for (const raw of [null, undefined, '', 'owner', 'ADMINISTRADOR', 42]) assert.equal(normalizeRole(raw), 'client');
  assert.equal(normalizeRole(' Admin '), 'admin');
  const state = resolve({ snapshot: snap({ role: 'owner' }) });
  assert.equal(state.role, 'client');
  assert.equal(state.state, PROFILE_STATE.INCOMPLETE);
});

test('clientOnly exime al personal sin exigirle alta comercial', () => {
  const state = resolve({ snapshot: snap({ role: 'admin' }) }, { clientOnly: true });
  assert.equal(state.state, PROFILE_STATE.COMPLETE);
  assert.equal(state.reason, 'staff-exempt');
});

test('el método de acceso se infiere de Auth: Google vs correo (custom token)', () => {
  assert.equal(detectAuthMethod({ providerData: [{ providerId: 'google.com' }] }), 'google');
  assert.equal(detectAuthMethod({ providerData: [] }), 'emailOtp');
  assert.equal(detectAuthMethod({}), 'emailOtp');
  assert.equal(detectAuthMethod(null), 'emailOtp');
});

test('withDeadline deja una salida cuando Firestore no responde y limpia el temporizador', async () => {
  const cleared = [];
  const scheduler = { set: fn => { queueMicrotask(fn); return 7; }, clear: id => cleared.push(id) };
  await assert.rejects(withDeadline(new Promise(() => {}), 10, scheduler), error => error.code === 'profile/deadline');
  assert.deepEqual(cleared, [7]);
  const fast = await withDeadline(Promise.resolve('ok'), 10, { set: () => 9, clear: id => cleared.push(id) });
  assert.equal(fast, 'ok');
  assert.deepEqual(cleared, [7, 9]);
});

// --- Contrato del cableado en login.html -------------------------------------------------

const login = await readFile(new URL('../../login.html', import.meta.url), 'utf8');

test('login.html repara el documento inexistente con la función canónica antes del alta', () => {
  const body = login.slice(login.indexOf('async function ensureProfileComplete'), login.indexOf('async function finishGoogleLogin'));
  assert.match(body, /CREATE_THEN_COMPLETE_PROFILE/);
  assert.match(body, /ensureUserProfile\(db, user, detectAuthMethod\(user\)\)/);
  assert.match(body, /resolved\.state === PROFILE_STATE\.ERROR[\s\S]{0,120}PROFILE_STATE\.MISSING/);
  // nunca se vuelve a convertir un documento inexistente en `{}` dentro del alta
  assert.doesNotMatch(body, /snap\.exists\(\) \? snap\.data\(\) : \{\}/);
  assert.doesNotMatch(body, /currentSnap\.exists\(\) \? currentSnap\.data\(\) : \{\}/);
  assert.match(body, /if \(!currentSnap\.exists\(\)\)[\s\S]{0,300}profile\/missing/);
});

test('la sesión restaurada nunca cierra sesión ni deja un cargador colgado ante un error', () => {
  const start = login.indexOf('subscribeSession(async snapshot');
  const handler = login.slice(start, login.indexOf('// GOOGLE — primera opción', start));
  assert.match(handler, /try \{\s*await ensureProfileComplete\(user, role\);[\s\S]*?\} catch \(restoreError\) \{[\s\S]*?hideLoginOverlay\(\);[\s\S]*?revealLoginSurface\(\);[\s\S]*?showActiveSessionState\(/);
  assert.doesNotMatch(handler, /signOut\(/);
  assert.match(handler, /withDeadline\(getDoc/);
});

test('withDeadline por defecto no llama setTimeout/clearTimeout como métodos de un objeto (Illegal invocation en navegador)', async () => {
  const src = await (await import('node:fs/promises')).readFile(new URL('../../js/core/auth/estado-perfil-sesion.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /scheduler = \{ set: setTimeout, clear: clearTimeout \}/);
  assert.equal(await withDeadline(Promise.resolve('ok'), 10), 'ok');
});
