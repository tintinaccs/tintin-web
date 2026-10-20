import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { rememberAdminDestination, adminReturnStorage } from '../../js/core/auth/destino-admin.mjs';

const source = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function adminSessionPresentation('), source.indexOf('async function recoverAdminUserFromHandoff('));
function fixture() {
  let overlay;
  const nodes = Object.fromEntries(['h1', 'p', '#adm-auth-unknown-retry', '#adm-auth-login'].map(key => [key, {addEventListener(){}}]));
  const context = vm.createContext({
    location: {href:'https://tintin.example/admin?section=pedidos&order=order_123',origin:'https://tintin.example'},
    rememberAdminDestination, adminReturnStorage,
    document: {
      documentElement: {classList: {remove(){}}},
      getElementById: () => overlay,
      createElement: () => ({setAttribute(){}, style:{}, querySelector: key => nodes[key]}),
      body: {appendChild: element => {overlay = element;}},
    },
    window: {location: {search:'?vista=lista', hash:'#productos', reload(){}}},
    hideOverlay(){},
  });
  vm.runInContext(code, context);
  return {context, nodes};
}

test('un navegador sin sesión muestra ingreso normal y no un falso fallo de restauración', () => {
  const {context, nodes} = fixture();
  context.showAdminAuthUnknown('AUTHORITATIVE_EMPTY', false);
  assert.equal(nodes.h1.textContent, 'Ingresá a tu panel');
  assert.match(nodes.p.textContent, /Este navegador no tiene una sesión iniciada/);
  assert.equal(nodes['#adm-auth-unknown-retry'].hidden, true);
  assert.equal(nodes['#adm-auth-login'].href, '/login?from=%2Fadmin%3Fvista%3Dlista%23productos');
});

test('un fallo real o handoff pendiente mantiene recuperación sin autorizar el panel', () => {
  for (const args of [['AUTH_RESTORE_FALLBACK', false], ['AUTHORITATIVE_EMPTY', true], []]) {
    const {context, nodes} = fixture();
    context.showAdminAuthUnknown(...args);
    assert.equal(nodes.h1.textContent, 'No pudimos confirmar tu sesión');
    assert.equal(nodes['#adm-auth-unknown-retry'].hidden, false);
  }
});

test('la misma pantalla actualiza su motivo tras cierre de sesión o recuperación fallida', () => {
  const {context, nodes} = fixture();
  context.showAdminAuthUnknown();
  context.showAdminAuthUnknown('AUTH_REVOKED_OR_SIGNED_OUT', false);
  assert.equal(nodes.h1.textContent, 'Tu sesión terminó');
  assert.equal(nodes['#adm-auth-unknown-retry'].hidden, true);
  context.showAdminAuthUnknown('AUTH_RESTORE_FALLBACK', false);
  assert.equal(nodes['#adm-auth-unknown-retry'].hidden, false);
});
