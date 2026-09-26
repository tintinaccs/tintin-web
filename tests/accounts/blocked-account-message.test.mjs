import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const { ACCOUNT_PROBLEM_TEXT, accountSupportUrl, accountProblemHtml } = await import('../../js/components/modals/modal-bloqueo.js');

test('el enlace de soporte abre el WhatsApp de la tienda con el correo de la persona', () => {
  const url = new URL(accountSupportUrl('  clienta@example.com '));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/595981299331');
  assert.equal(url.searchParams.get('text'), 'Hola, tengo problemas con mi cuenta, mi correo es: clienta@example.com');
  assert.equal(new URL(accountSupportUrl()).searchParams.get('text'), 'Hola, tengo problemas con mi cuenta, mi correo es: ');
});

test('el mensaje visible es corto, sin detalle interno, y "WhatsApp" es el enlace', () => {
  const html = accountProblemHtml('clienta@example.com');
  assert.equal(ACCOUNT_PROBLEM_TEXT, 'Tu cuenta tiene problemas, por favor contáctanos por');
  assert.match(html, /^Tu cuenta tiene problemas, por favor contáctanos por <a href="https:\/\/wa\.me\/595981299331\?text=[^"]+" target="_blank" rel="noopener"[^>]*>WhatsApp<\/a>\.$/);
  assert.doesNotMatch(html, /bloquead|eliminad|desactivad|deshabilitad/i);
});

test('un correo con caracteres especiales no puede romper el enlace', () => {
  const html = accountProblemHtml('x"><script>alert(1)</script>@example.com');
  assert.doesNotMatch(html, /<script|"><|onerror=/i);
  const href = html.match(/href="([^"]+)"/)[1];
  assert.equal(new URL(href.replaceAll('&amp;', '&')).searchParams.get('text'), 'Hola, tengo problemas con mi cuenta, mi correo es: x"><script>alert(1)</script>@example.com');
});

test('login, perfil y checkout muestran solo el mensaje corto con el correo de la persona', () => {
  const login = read('login.html');
  assert.match(login, /import \{[^}]*accountProblemHtml[^}]*\} from ['"]\.\/js\/components\/modals\/modal-bloqueo\.js/);
  assert.match(login, /code === "auth\/user-disabled"\) return accountProblemHtml\(email\)/);
  for (const page of ['perfil.html', 'checkout.html']) {
    assert.match(read(page), /showBlockedModal\(\{ email: [^}]+\}\)/, `${page} debe pasar el correo al aviso`);
  }
});
