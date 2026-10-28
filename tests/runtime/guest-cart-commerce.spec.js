const { test, expect } = require('@playwright/test');

// Reutiliza las mismas aserciones comerciales, pero con el host canónico que
// conecta Auth/Firestore a emuladores. Nunca depende del proyecto productivo
// ni de que el proxy del navegador conserve CORS del CDN oficial.
let productionRequests;
test.beforeEach(async ({ context, request }) => {
  const reset = await request.post('/__test/reset');
  expect(reset.ok()).toBe(true);
  productionRequests = [];
  await context.route('https://www.gstatic.com/firebasejs/10.14.1/**', async route => {
    const response = await request.get('/__test/firebase-sdk/' + new URL(route.request().url()).pathname.split('/').pop());
    expect(response.ok()).toBe(true);
    await route.fulfill({ response, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' } });
  });
  await context.route(/https:\/\/(?:identitytoolkit|firestore|securetoken)\.googleapis\.com\//, route => {
    productionRequests.push(new URL(route.request().url()).origin);
    return route.abort('blockedbyclient');
  });
  await context.route('https://apis.google.com/**', route => {
    productionRequests.push(new URL(route.request().url()).origin);
    return route.abort('blockedbyclient');
  });
});
test.afterEach(() => {
  expect(productionRequests, 'el carrito de prueba nunca debe acceder al backend productivo').toEqual([]);
});

require('../cart/color-choice-browser.spec.js');
require('../cart/quantity-browser.spec.js');
