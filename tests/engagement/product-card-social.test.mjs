import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { buildPublicProductEngagementStats } from '../../functions/api/product-engagement-stats.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function firestoreDocument(collectionName, id, data) {
  return {
    name: `projects/demo/databases/(default)/documents/${collectionName}/${id}`,
    fields: encodeFirestoreFields(data),
  };
}

test('agrega Me gusta globales y reseñas sin exponer datos privados', () => {
  const likes = [
    firestoreDocument('likeRecords', 'l1', { productId: 'reloj-1', email: 'uno@example.com', realName: 'Uno' }),
    firestoreDocument('likeRecords', 'l2', { productId: 'reloj-1', email: 'dos@example.com', realName: 'Dos' }),
    firestoreDocument('likeRecords', 'l3', { productId: 'aro-2', email: 'tres@example.com', realName: 'Tres' }),
  ];
  const reviewStats = [
    firestoreDocument('productReviewStats', 'reloj-1', { productId: 'reloj-1', count: 3, average: 4.7 }),
    firestoreDocument('productReviewStats', 'collar-3', { productId: 'collar-3', count: 0, average: 5 }),
  ];

  const result = buildPublicProductEngagementStats(likes, reviewStats);
  assert.deepEqual(result, [
    { productId: 'aro-2', likeCount: 1, reviewCount: 0, average: 0 },
    { productId: 'collar-3', likeCount: 0, reviewCount: 0, average: 0 },
    { productId: 'reloj-1', likeCount: 2, reviewCount: 3, average: 4.7 },
  ]);
  assert.equal(JSON.stringify(result).includes('example.com'), false);
  assert.equal(JSON.stringify(result).includes('realName'), false);
});

test('descarta identificadores inválidos y nunca devuelve contadores negativos', () => {
  const likes = [firestoreDocument('likeRecords', 'x1', { productId: '../privado' })];
  const reviewStats = [
    firestoreDocument('productReviewStats', 'ok-1', { productId: 'ok-1', count: -4, average: 9 }),
  ];
  assert.deepEqual(buildPublicProductEngagementStats(likes, reviewStats), [
    { productId: 'ok-1', likeCount: 0, reviewCount: 0, average: 0 },
  ]);
});

test('la capa de tarjetas cubre Inicio/Colecciones y Catálogo con estados en cero', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/components/reviews/participacion-tarjetas.js'), 'utf8');
  assert.match(source, /\.tt-product-card\[data-id\]/);
  assert.match(source, /\.tt-card\[data-product-id\]/);
  assert.match(source, /0 Me gusta/);
  assert.match(source, /0 comentarios/);
  assert.match(source, /#product-reviews/);
  assert.match(source, /data-card-product-like/);
});

test('la ficha conserva selector accesible de 1 a 5 estrellas antes de publicar', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/pages/product/resenas-producto.js'), 'utf8');
  assert.match(source, /\[1,2,3,4,5\]/);
  assert.match(source, /role=\"radiogroup\"/);
  assert.match(source, /data-review-rating=\"\$\{value\}\"/);
  assert.match(source, /Sin puntuación seleccionada/);
  assert.match(source, /const action = ownReview \? 'editReview' : 'createReview'/);
  assert.match(source, /api\(\{ action, productId, rating: selectedRating, comment \}\)/);
  assert.match(source, /Elegí de 1 a 5 estrellas antes de publicar tu reseña/);
});

test('el middleware inyecta el módulo social versionado solo en superficies de producto', () => {
  const source = fs.readFileSync(path.join(ROOT, 'functions/_middleware.js'), 'utf8');
  assert.match(source, /participacion-tarjetas\.js\?v=tintin-20260824-card-social-1/);
  for (const route of ["'/'", "'/catalogo'", "'/collections'", "'/product'"]) {
    assert.equal(source.includes(route), true, `falta ruta ${route}`);
  }
  assert.match(source, /Content-Security-Policy/);
  assert.match(source, /X-Tintin-CSP/);
});
