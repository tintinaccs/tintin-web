import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { isValidCustomerName } from '../../js/pages/profile/configuracion-inicial-perfil.mjs';

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

test('contacto valida, usa el WhatsApp configurado y permite una segunda consulta sin duplicar aperturas', async () => {
  const [html, source, tienda] = await Promise.all([
    read('contact.html'),
    read('js/pages/institutional/mantenimiento-contacto.js'),
    read('tienda.js'),
  ]);
  const nodes = new Map();
  let focused = '';
  function element(id = '') {
    const node = {
      id, style: {}, attributes: {}, dataset: {}, children: [], listeners: [], value: '', hidden: false,
      classList: { add() {} },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      appendChild(child) { this.children.push(child); nodes.set(child.id, child); },
      insertAdjacentElement(_position, child) { nodes.set(child.id, child); },
      before(child) { nodes.set(child.id, child); },
      addEventListener(type, callback, capture) { this.listeners.push({ type, callback, capture: capture === true }); },
      focus() { focused = this.id; },
      checkValidity() { return !this.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value); },
    };
    if (id) nodes.set(id, node);
    return node;
  }
  const form = element('contact-form');
  const submit = element('submit');
  const success = element('form-success');
  const fallback = element('form-wa-fallback');
  const inputs = ['f-nombre', 'f-email', 'f-tel', 'f-msg'].map(element);
  form.querySelector = selector => selector === '[type="submit"]' ? submit : inputs.find(input => input.attributes['aria-invalid'] === 'true');
  form.reset = () => inputs.forEach(input => { input.value = ''; });
  const opened = [];
  const windowListeners = new Map();
  let receiveSettings;
  const navigator = { onLine: true };
  const context = vm.createContext({
    window: {
      addEventListener: (type, callback) => windowListeners.set(type, callback),
      open: url => { opened.push(url); return null; },
    },
    document: {
      getElementById: id => nodes.get(id),
      createElement: () => element(),
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    location: { pathname: '/contact', origin: 'https://tintin.example' },
    navigator, URL, console, isValidCustomerName,
    appCheckReady: Promise.resolve(true), db: {}, doc: () => ({}),
    onSnapshot: (_ref, callback) => { receiveSettings = callback; },
  });
  // Run all real handlers. Capture must suppress the legacy handlers from the
  // document and tienda.js, otherwise a submission opens multiple windows.
  const inline = html.match(/<script>\s*(\(function\(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)[1];
  vm.runInContext(inline, context);
  const legacyHandler = tienda.match(/function initContactForm\(\) \{[\s\S]*?\r?\n\}/)[0];
  vm.runInContext(`${legacyHandler}\ninitContactForm();`, context);
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, ''), context);
  await Promise.resolve();
  function send() {
    let stopped = false;
    const event = { preventDefault() {}, stopImmediatePropagation() { stopped = true; } };
    for (const listener of form.listeners.filter(listener => listener.type === 'submit').sort((a, b) => Number(b.capture) - Number(a.capture))) {
      listener.callback(event);
      if (stopped) break;
    }
  }
  assert.equal(inputs[0].attributes['aria-invalid'], 'false', 'accessibility initializes on first load');
  send();
  assert.equal(opened.length, 0);
  assert.equal(inputs[0].attributes['aria-invalid'], 'true');
  assert.equal(focused, 'f-nombre');
  inputs.forEach((input, index) => { input.value = ['Ana Perez', 'ana@example.com', '0981111111', 'Quiero consultar por un bolso'][index]; });
  inputs[1].value = 'invalid-email';
  send();
  assert.equal(opened.length, 0);
  assert.equal(focused, 'f-email');
  inputs[1].value = 'ana@example.com';
  receiveSettings({ exists: () => true, data: () => ({ whatsappNumber: '595981999999' }) });
  navigator.onLine = false;
  send();
  assert.equal(opened.length, 0, 'offline submission preserves the editable form');
  assert.equal(form.hidden, false);
  assert.equal(nodes.get('tt-contact-net-state').hidden, false);
  navigator.onLine = true;
  windowListeners.get('online')();
  send();
  assert.equal(opened.length, 1);
  assert.equal(new URL(opened[0]).pathname, '/595981999999');
  assert.match(new URL(opened[0]).searchParams.get('text'), /ana@example\.com/);
  assert.equal(form.hidden, true);
  assert.equal(success.style.display, 'block');
  assert.equal(fallback.href, opened[0], 'blocked popup retains the configured destination');
  assert.equal(fallback.style.display, 'inline-flex');
  send();
  assert.equal(opened.length, 1, 'repeat submit while complete does not reopen WhatsApp');
  nodes.get('tt-contact-new-message').listeners.find(listener => listener.type === 'click').callback();
  assert.equal(form.hidden, false);
  assert.equal(submit.disabled, false);
  assert.equal(inputs[0].value, '');
  inputs.forEach((input, index) => { input.value = ['Maria Lopez', '', '', 'Tengo otra consulta'][index]; });
  send();
  assert.equal(opened.length, 2);
  assert.match(new URL(opened[1]).searchParams.get('text'), /Maria Lopez/);
});

test('reseñas no encoge el CTA y permite wrap cerca de 924px', async () => {
  const css = await read('css/pages/product/resenas-producto.css');
  assert.match(css, /\.tt-review-form-actions \.tt-btn,[\s\S]*?flex:\s*0 0 auto/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.match(css, /@media \(max-width:\s*940px\)[\s\S]*?flex-wrap:\s*wrap/);
});

test('admin móvil mantiene cuatro accesos directos y Más con etiquetas cortas', async () => {
  const html = await read('admin.html');
  const primaries = html.match(/data-mobile-primary/g) || [];
  assert.equal(primaries.length, 4);
  assert.match(html, /data-mobile-primary data-section="dashboard"[\s\S]{0,500}>Inicio<\/button>/);
  assert.match(html, /data-mobile-primary data-section="estadisticas"[\s\S]{0,500}>Stats<\/button>/);
  assert.match(html, /id="adm-mobile-more-toggle"/);
});

test('WhatsApp fijo no alterna su visibilidad por el contenido al hacer scroll', async () => {
  const source = await read('tienda.js');
  assert.doesNotMatch(source, /PRODUCT_COLLISION_TARGETS|CONTROL_TARGETS/);
  assert.match(source, /collisionSelector = '\.tt-cart-feedback\.is-visible,\.tt-privacy-consent:not\(\[hidden\]\)'/);
  // La geometría se descarta antes de getComputedStyle para que la lista ampliada siga siendo barata.
  assert.match(source, /if \(!overlapsRect\(r, nr\)\) return false;\s*const style = getComputedStyle\(node\);/);
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
  assert.match(admin, /sessionsFor\('visitors'\)\.length === 1 \? 'sesión' : 'sesiones'/);
  assert.doesNotMatch(admin, /sesión\$\{statisticsTrafficSessions\.length === 1 \? '' : 'es'\}/);
  // Cualquier "…ión${… ? '' : 'es'}" produce "…iónes" (tilde mal puesta).
  for (const source of [reviews, admin]) assert.doesNotMatch(source, /ión\$\{[^}]*\? '' : 'es'\}/);
});

test('home alinea fallback con el título publicado y sanea el typo de pago seguro', async () => {
  const [home, definitions] = await Promise.all([
    read('index.html'),
    read('js/core/store/definiciones-contenido.js'),
  ]);
  assert.match(home, /UN DETALLE[\s\S]*?MUY VOS/);
  assert.doesNotMatch(home, /Un detalle[\s\S]*?cambia todo/);
  assert.match(definitions, /UN DETALLE MUY VOS/);
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

test('presentación de especificaciones: slugs y acabados legibles sin tocar texto libre', async () => {
  const source = await read('tienda.js');
  const body = source.match(/function productSpecDisplayValue\(label, value\) \{[\s\S]*?\r?\n\}\r?\n/)[0];
  const sanitizePlainText = (value, max) => String(value ?? '').slice(0, max);
  const display = new Function('sanitizePlainText', `${body}; return productSpecDisplayValue;`)(sanitizePlainText);
  assert.equal(display('Material', 'acero-inoxidable'), 'Acero inoxidable');
  assert.equal(display('Material', 'acero-quirurgico'), 'Acero quirúrgico');
  assert.equal(display('Material', 'plata-925'), 'Plata 925');
  assert.equal(display('Material', 'enchapado-en-oro'), 'Enchapado en oro');
  assert.equal(display('Material', 'Acero 316L con baño PVD'), 'Acero 316L con baño PVD');
  assert.equal(display('Color / acabado', 'dorado'), 'Dorado');
  assert.equal(display('Color / acabado', 'Oro rosa'), 'Oro rosa');
  assert.equal(display('Medidas', 'aro de 2 cm'), 'aro de 2 cm');
});

test('pestañas móviles del admin se dimensionan por etiqueta y no se pisan a 320–390 px', async () => {
  const css = await read('css/admin/admin.css');
  assert.match(css, /#adm-mobile-tabs > \.adm-mobile-tab \{\s*flex: 1 1 auto;\s*min-width: 44px;/);
  assert.doesNotMatch(css, /#adm-mobile-tabs > \.adm-mobile-tab \{\s*flex: 1 1 0;/);
  assert.match(css, /@media \(max-width: 360px\) \{\s*#adm-mobile-tabs > \.adm-mobile-tab \{ letter-spacing: 0; \}/);
});

test('el probe del carrito en Flujo de conexiones monta la portada con viewport real', async () => {
  const flow = await read('js/admin/flujo-conexiones/flujo-conexiones-admin.js');
  assert.match(flow, /frame\.style\.cssText = 'position:fixed;left:-10000px;top:0;width:390px;height:844px;opacity:0;pointer-events:none;border:0'/);
  assert.doesNotMatch(flow, /width:1px;height:1px/);
});
