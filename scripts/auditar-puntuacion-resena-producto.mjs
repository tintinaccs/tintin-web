#!/usr/bin/env node
import fs from 'node:fs';

const review = fs.readFileSync('js/pages/product/resenas-producto.js', 'utf8');
const guard = fs.readFileSync('js/pages/product/validacion-puntuacion-resena.js', 'utf8');
const product = fs.readFileSync('product.html', 'utf8');

const checks = [
  ['helper importado', review.includes("validacion-puntuacion-resena.js?v=tintin-20260831-review-rating-required-1")],
  ['botón identificable', review.includes('data-review-submit')],
  ['estado sincronizado', review.includes('syncReviewPublishState')],
  ['guard antes de publicar', review.includes('reportMissingReviewRating') && review.includes('isValidReviewRating(selectedRating)')],
  ['helper valida 1 a 5', guard.includes('rating >= 1 && rating <= 5')],
  ['disabled nativo', guard.includes('submit.disabled = !valid')],
  ['aria-disabled', guard.includes("setAttribute('aria-disabled', String(!valid))")],
  ['mensaje claro', guard.includes('Elegí de 1 a 5 estrellas antes de publicar tu comentario.')],
  ['Producto usa versión nueva', product.includes('resenas-producto.js?v=tintin-20260902-reviews-pagination-1')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'OK' : 'FALTA'} - ${label}`);
if (failed.length) process.exit(1);
console.log(`OK - ${checks.length}/${checks.length} contratos de puntuación obligatoria`);
