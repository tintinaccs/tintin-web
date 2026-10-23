const { test, expect } = require('@playwright/test');

// No page/browser fixture: exercise Playwright's Node transform without Chromium.
test('metadata de producto carga en el mismo runtime que las suites SEO', async () => {
  const product = await import('../../functions/product.js');
  expect(typeof product.onRequest).toBe('function');
  expect(typeof product.renderProductMetadataHtml).toBe('function');
});
