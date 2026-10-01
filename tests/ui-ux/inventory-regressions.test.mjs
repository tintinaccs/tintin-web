import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('perfil muestra el identificador comercial del pedido antes que el id técnico', async () => {
  const source = await read('js/pages/profile/pedidos-perfil.js');
  assert.match(source, /order\.orderNumber \|\| order\.shortId \|\| order\.id/);
  assert.match(source, /Número de pedido<\/strong>\$\{escapeHtml\(displayNumber\)\}/);
  assert.doesNotMatch(source, /id\.slice\(-6\)/);
});

test('contacto conserva email en todas las rutas de WhatsApp', async () => {
  const [html, runtime, tienda] = await Promise.all([
    read('contact.html'),
    read('js/pages/institutional/mantenimiento-contacto.js'),
    read('tienda.js'),
  ]);
  assert.match(html, /emailInput\.checkValidity\(\)/);
  assert.match(html, /Email: ' \+ email/);
  assert.match(runtime, /Mi correo es \$\{values\.email\}/);
  assert.match(tienda, /\*Email:\* \$\{email \|\| 'No indicado'\}/);
});

test('reseñas no encoge el CTA y permite wrap cerca de 924px', async () => {
  const css = await read('css/pages/product/resenas-producto.css');
  assert.match(css, /\.tt-review-form-actions \.tt-btn,[\s\S]*?flex:\s*0 0 auto/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.match(css, /@media \(max-width:\s*940px\)[\s\S]*?flex-wrap:\s*wrap/);
});

test('admin móvil mantiene cinco accesos principales con etiquetas cortas y Más', async () => {
  const html = await read('admin.html');
  const primaries = html.match(/data-mobile-primary/g) || [];
  assert.equal(primaries.length, 5);
  assert.match(html, /data-mobile-primary data-section="dashboard"[\s\S]{0,500}>Inicio<\/button>/);
  assert.match(html, /data-mobile-primary data-section="estadisticas"[\s\S]{0,500}>Stats<\/button>/);
  assert.match(html, /id="adm-mobile-more-toggle"/);
});

test('WhatsApp flotante de producto vigila texto y controles no clickeables', async () => {
  const source = await read('tienda.js');
  assert.match(source, /PRODUCT_COLLISION_TARGETS = '#product-desc,#product-specifications,#product-variants,#qty-wrap'/);
  assert.match(source, /querySelectorAll\(collisionSelector\)/);
});
