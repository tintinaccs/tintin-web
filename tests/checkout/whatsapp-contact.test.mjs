import { orderDisplayCode } from '../../js/orders/pedidos-prueba.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const checkout = fs.readFileSync('checkout.html', 'utf8');
const banks = checkout.slice(checkout.indexOf('function applyBankAccounts('), checkout.indexOf('// ---- STATE ----'));

test('transferencia muestra el WhatsApp configurado aun sin cuentas y lo actualiza sin duplicarlo', () => {
  const el = { children: [], set innerHTML(value) { this.html = value; this.children = []; }, appendChild(node) { this.children.push(node); } };
  const context = vm.createContext({
    WA_NUMBER: '595981299331', escapeSearchHtml: value => value,
    document: { getElementById: () => el, createElement: () => ({}) }
  });
  vm.runInContext(banks, context);
  for (const accounts of [{ ueno: 'Cuenta de prueba' }, null]) {
    context.accounts = accounts;
    vm.runInContext('applyBankAccounts(accounts);', context);
    assert.equal(el.children.length, 1);
    assert.equal(el.children[0].href, 'https://wa.me/595981299331');
    assert.match(el.children[0].textContent, /comprobante.*\+595981299331/);
    assert.equal(el.children[0].rel, 'noopener noreferrer');
  }
  context.WA_NUMBER = '595981000001';
  vm.runInContext('applyBankAccounts({});', context);
  assert.equal(el.children.length, 1);
  assert.equal(el.children[0].href, 'https://wa.me/595981000001');
});

test('el mensaje al cliente usa el número público del pedido', () => {
  const source = fs.readFileSync('js/admin/shopify-commerce-admin.js', 'utf8');
  const display = source.slice(source.indexOf('function orderDisplayId('), source.indexOf('function productVariantsCount('));
  const whatsapp = source.slice(source.indexOf('function openWhatsApp('), source.indexOf('async function handleAction('));
  let opened;
  const context = vm.createContext({
    orderDisplayCode, orderCustomer: order => order.customer,
    toast: () => {}, window: { open: url => { opened = new URL(url); } }
  });
  vm.runInContext(display + whatsapp, context);
  for (const [identification, expectedCode] of [[{ orderNumber: 'TINPED26' }, 'TINPED26'], [{ shortId: 'TINPED27' }, 'TINPED27'], [{ orderNumber: 'TINPED23' }, 'TINPEDPRUEBA23']]) {
    context.order = { id: 'public_INTERNAL_UUID', ...identification, customer: { name: 'Flor', phone: '0981000001' } };
    vm.runInContext('openWhatsApp(order);', context);
    assert.equal(opened.pathname, '/595981000001');
    assert.ok(opened.searchParams.get('text').includes('#'+expectedCode));
    assert.doesNotMatch(opened.searchParams.get('text'), /public_INTERNAL_UUID/);
  }
});
