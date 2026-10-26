import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as phone from '../../js/components/forms/utilidades-telefono.js';
import * as username from '../../js/components/forms/utilidades-username.js';
import { splitFullName, isValidFullName } from '../../js/pages/profile/configuracion-inicial-perfil.mjs';
import { readAccountIdentity } from '../../js/pages/profile/estado-canonico-perfil.mjs';

const html = fs.readFileSync(new URL('../../perfil.html', import.meta.url), 'utf8');
const save = html.slice(html.indexOf('  // Save'), html.indexOf('  // Logout'));

function fixture({ name = 'María López', write = async () => {} } = {}) {
  const trace = [], messages = [];
  const button = { disabled: false, dataset: {}, setAttribute() {}, removeAttribute() {} };
  const fields = {
    'btn-guardar-perfil': button,
    'perfil-nombre': { value: name },
    'perfil-tel': { value: '982234567', focus() {} },
    'perfil-dir': { value: 'Dirección de prueba' },
    'perfil-username': { value: 'maria_nueva' },
    'perfil-username-hint': { textContent: '' },
    'perfil-nombre-display': { textContent: 'Nombre anterior' },
  };
  const reservePhone = async () => { trace.push('reserve-phone'); return phone.phoneKey(fields['perfil-tel'].value, phone.DEFAULT_COUNTRY); };
  const releasePhone = async () => { trace.push('release-phone'); };
  const reserveUsername = async () => { trace.push('reserve-username'); return fields['perfil-username'].value; };
  const releaseUsername = async () => { trace.push('release-username'); };
  const context = vm.createContext({
    ...phone, ...username, splitFullName, isValidFullName, readAccountIdentity,
    document: { getElementById: id => fields[id] },
    window: { TintinReleaseProfileButton: () => { button.disabled = false; button.dataset.ttBusy = '0'; } },
    profileConfirmed: true, generation: 1, profileGeneration: 1,
    auth: { currentUser: { uid: 'owner' } }, user: { uid: 'owner', email: 'owner@example.test' },
    userData: { name: 'Nombre Anterior', firstName: 'Nombre', lastName: 'Anterior', phone: '+595981234567', username: 'maria_anterior' },
    usernameEditable: true, db: {}, ref: 'users/owner', serverTimestamp: () => 'server-time',
    reservePhone, releasePhone, reserveUsername, releaseUsername,
    // Model the current helpers' real reserve-then-release ordering for RED.
    changeReservedPhone: async (...args) => { const key = await reservePhone(...args); await releasePhone(); return key; },
    changeReservedUsername: async (...args) => { const key = await reserveUsername(...args); await releaseUsername(); return key; },
    setDoc: async (...args) => { trace.push('write'); await write(...args); trace.push('confirmed'); },
    toast: message => messages.push(message), console: { error() {} },
  });
  vm.runInContext(save, context);
  return { context, fields, button, trace, messages, submit: () => button.onclick() };
}

test('nombre inválido no reserva ni libera identidades antes de validar el formulario completo', async () => {
  const f = fixture({ name: 'María' });
  await f.submit();
  assert.deepEqual(f.trace, []);
  assert.equal(f.messages.length, 1);
  assert.equal(f.button.disabled, false);
});

test('un fallo al persistir conserva ambas reservas anteriores', async () => {
  const f = fixture({ write: async () => { throw Object.assign(Error('offline'), { code: 'unavailable' }); } });
  await f.submit();
  assert.deepEqual(f.trace.slice(0, 2).sort(), ['reserve-phone', 'reserve-username']);
  assert.deepEqual(f.trace.slice(2), ['write']);
  assert.equal(f.context.userData.username, 'maria_anterior');
  assert.equal(f.button.disabled, false);
});

test('libera reservas anteriores sólo después de confirmar el perfil y sincroniza sus campos', async () => {
  const f = fixture();
  await f.submit();
  assert.deepEqual(f.trace.slice(0, 2).sort(), ['reserve-phone', 'reserve-username']);
  assert.deepEqual(f.trace.slice(2), ['write', 'confirmed', 'release-phone', 'release-username']);
  assert.equal(f.context.userData.name, 'María López');
  assert.equal(f.context.userData.username, 'maria_nueva');
  assert.equal(f.fields['perfil-username'].disabled, true);
});

test('dos activaciones durante una escritura lenta comparten un único guardado', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ write: () => pending });
  const first = f.submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.button.disabled, true);
  const second = f.submit();
  finish();
  await Promise.all([first, second]);
  assert.equal(f.trace.filter(x => x === 'write').length, 1);
  assert.equal(f.button.disabled, false);
});

test('una confirmación tardía de otra sesión no modifica ni habilita la interfaz actual', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ write: () => pending });
  const saving = f.submit();
  await new Promise(resolve => setImmediate(resolve));
  f.context.auth.currentUser = { uid: 'other' };
  f.context.profileGeneration++;
  f.fields['perfil-nombre-display'].textContent = 'Otra cuenta';
  f.button.disabled = true;
  finish(); await saving;
  assert.equal(f.fields['perfil-nombre-display'].textContent, 'Otra cuenta');
  assert.equal(f.button.disabled, true);
  assert.equal(f.messages.length, 0);
});

test('el mantenimiento no libera Guardar con el timeout de 1800ms mientras persiste', async () => {
  const maintenance = fs.readFileSync(new URL('../../js/pages/profile/mantenimiento-perfil.js', import.meta.url), 'utf8');
  let click, finish;
  const timers = [];
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ write: () => pending });
  const button = f.button;
  button.id = 'btn-guardar-perfil';
  button.closest = () => button;
  vm.runInNewContext(maintenance, {
    window: { location: { pathname: '/perfil' }, addEventListener() {}, setTimeout(callback) { timers.push(callback); return timers.length; }, clearTimeout() {} },
    document: { readyState: 'complete', querySelector: () => null, getElementById: id => id === button.id ? button : null, addEventListener: (type, callback) => { if (type === 'click') click = callback; } },
    navigator: { onLine: true },
  });
  assert.equal(typeof click, 'function');
  click({ target: button });
  const saving = f.submit();
  await new Promise(resolve => setImmediate(resolve));
  for (const expire of timers) expire();
  assert.equal(button.disabled, true);
  assert.equal(timers.length, 0);
  finish(); await saving;
  assert.equal(button.disabled, false);
});
