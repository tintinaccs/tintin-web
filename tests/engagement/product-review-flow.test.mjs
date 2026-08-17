import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const productHtml = fs.readFileSync(new URL('../../product.html', import.meta.url), 'utf8');
const reviewsJs = fs.readFileSync(new URL('../../js/pages/product/resenas-producto.js', import.meta.url), 'utf8');
const flowCss = fs.readFileSync(new URL('../../css/pages/product/product-flow-unified.css', import.meta.url), 'utf8');
const relatedJs = fs.readFileSync(new URL('../../js/pages/product/productos-relacionados.js', import.meta.url), 'utf8');

test('Producto conserva el flujo pedido y carga los assets versionados', () => {
  const detail = productHtml.indexOf('id="product-detail"');
  const trust = productHtml.indexOf('class="tinben"');
  const selection = productHtml.indexOf('id="tinsel-root"');
  const related = productHtml.indexOf('id="related-products"');

  assert.ok(detail >= 0, 'falta la ficha principal de producto');
  assert.ok(trust > detail, 'Comprá con confianza debe ir después de la ficha');
  assert.ok(selection > trust, 'Tu selección Tintin debe ir después de Comprá con confianza');
  assert.ok(related > selection, 'También te puede gustar debe ser la última sección comercial');

  assert.match(productHtml, /product-flow-unified\.css\?v=tintin-20260817-product-flow-1/);
  assert.match(productHtml, /resenas-producto\.js\?v=tintin-20260817-product-flow-1/);
  assert.match(reviewsJs, /selection\.insertAdjacentElement\('afterend', section\)/);
  assert.match(reviewsJs, /related\.parentNode\.insertBefore\(section, related\)/);
});

test('Selector de reseñas representa llenas las primeras N estrellas y contorno el resto', () => {
  assert.match(reviewsJs, /active \? '★' : '☆'/);
  assert.match(reviewsJs, /value <= effectiveRating/);
  assert.match(reviewsJs, /button\.textContent = active \? '★' : '☆'/);
  assert.match(reviewsJs, /addEventListener\('mouseover'/);
  assert.match(reviewsJs, /addEventListener\('mouseout'/);
  assert.match(reviewsJs, /addEventListener\('focusin'/);
  assert.match(reviewsJs, /ArrowRight/);
  assert.match(reviewsJs, /ArrowLeft/);
});

test('También te puede gustar queda limitado a tres y usa tres columnas en todo viewport', () => {
  assert.match(relatedJs, /const LIMIT = 3;/);
  assert.match(flowCss, /grid-template-columns:\s*repeat\(3,minmax\(0,1fr\)\)\s*!important/);
  assert.match(flowCss, /@media \(max-width:768px\)/);
  assert.match(flowCss, /@media \(max-width:390px\)/);
});

test('Reseñas comparte la superficie visual del resto del flujo de producto', () => {
  assert.match(flowCss, /--tt-product-section-bg:\s*#fdf0f5/);
  assert.match(flowCss, /--tt-product-card-bg:\s*#ffffff/);
  assert.match(flowCss, /max-width:\s*1600px\s*!important/);
  assert.match(flowCss, /border-radius:\s*32px\s*!important/);
});
