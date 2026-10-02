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
  // Las tres rutas validan el email opcional antes de armar el mensaje.
  assert.match(tienda, /if \(email && !emailInput\.checkValidity\(\)\)/);
  assert.ok(runtime.includes("values.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(values.email)"));
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

test('producto presenta slugs técnicos de material como etiquetas legibles', async () => {
  const source = await read('tienda.js');
  assert.match(source, /function productSpecDisplayValue/);
  assert.match(source, /'acero-inoxidable': 'Acero inoxidable'/);
  assert.match(source, /productSpecDisplayValue\(label, value\)/);
});

test('copy visible corrige opiniones y sesiones', async () => {
  const [reviews, admin] = await Promise.all([
    read('js/pages/product/resenas-producto.js'),
    read('js/admin/admin-app.js'),
  ]);
  assert.match(reviews, /count === 1 \? 'opinión' : 'opiniones'/);
  assert.doesNotMatch(reviews, /opinión\$\{count === 1 \? '' : 'es'\}/);
  assert.match(admin, /statisticsTrafficSessions\.length === 1 \? 'sesión' : 'sesiones'/);
  assert.doesNotMatch(admin, /sesión\$\{statisticsTrafficSessions\.length === 1 \? '' : 'es'\}/);
  // Cualquier "…ión${… ? '' : 'es'}" produce "…iónes" (tilde mal puesta).
  for (const source of [reviews, admin]) assert.doesNotMatch(source, /ión\$\{[^}]*\? '' : 'es'\}/);
});

test('home alinea fallback con el título publicado y sanea el typo de pago seguro', async () => {
  const [home, definitions] = await Promise.all([
    read('index.html'),
    read('js/core/store/definiciones-contenido.js'),
  ]);
  assert.match(home, /DETALLES QUE ELEVAN[\s\S]*?TU ESTILO/);
  assert.doesNotMatch(home, /Un detalle[\s\S]*?cambia todo/);
  assert.match(definitions, /DETALLES QUE ELEVAN TU ESTILO/);
  assert.match(definitions, /PAGO SEGUROOXSD/);
  assert.match(definitions, /'Pago seguro'/);
});

test('Operaciones aclara que su estado pertenece al navegador actual', async () => {
  const source = await read('js/admin/operaciones/sistema-operaciones-admin.js');
  assert.match(source, /Operaciones locales/);
  assert.match(source, /operaciones registradas en este navegador/);
  assert.match(source, /Operaciones de este navegador/);
});

test('perfil no presenta compras ni "sin pedidos" sin confirmar todas las consultas', async () => {
  const profile = await read('js/pages/profile/pedidos-perfil.js');
  assert.match(profile, /const complete = ready\.every\(Boolean\) && !failures\.some\(Boolean\);/);
  assert.match(profile, /onStats\(complete \? calculateOrderStats\(current\) : null\)/);
  assert.match(profile, /empty:current\.length===0 && complete/);
  assert.match(profile, /failures\[index\] = failure;\s*ready\[index\] = true;\s*onStats\(null\);/);
});
