const { test, expect } = require('@playwright/test');
// Al elegir una variante en los filtros, cada tarjeta muestra la foto, la muestra
// de color y el destino de esa combinación, para cualquier atributo.
const svg = name => ({ imageUrl: `/fixtures-filtros/${name}.svg` });
const products = [
  { id: 'bag', name: 'Bolso Bella', category: 'bolsos', price: 400000, stock: 6, active: true, imageUrl: '/fixtures-filtros/bag-white.svg',
    variants: { Color: ['Blanco', 'Beige', 'Negro'] },
    variantInventory: [{ variant: 'Blanco', stock: 2 }, { variant: 'Beige', stock: 3 }, { variant: 'Negro', stock: 1 }],
    variantMedia: [{ Color: 'Blanco', ...svg('bag-white') }, { Color: 'Beige', ...svg('bag-beige') }, { Color: 'Negro', ...svg('bag-black') }] },
  { id: 'shoe', name: 'Zapato Luna', category: 'bolsos', price: 300000, stock: 5, active: true, imageUrl: '/fixtures-filtros/shoe-plain.svg',
    variants: { Color: ['Negro', 'Beige'], Diseño: ['Liso', 'Cruz'] },
    variantInventory: [{ variant: 'Negro / Liso', stock: 4 }, { variant: 'Beige / Cruz', stock: 1 }],
    variantMedia: [{ Color: 'Negro', Diseño: 'Liso', ...svg('shoe-plain') }, { Color: 'Beige', Diseño: 'Cruz', ...svg('shoe-cross') }] },
  { id: 'plain', name: 'Pulsera sencilla', category: 'bolsos', price: 90000, stock: 3, active: true, imageUrl: '/fixtures-filtros/plain.svg' },
];
for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1280, 900], [1920, 1080]]) {
  test(`el filtro de variantes cambia foto, muestra y destino de cada tarjeta ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/public-catalog?**', route => {
      const resource = new URL(route.request().url()).searchParams.get('resource');
      if (!['products', 'collections'].includes(resource)) return route.continue();
      const items = resource === 'products' ? products : [{ id: 'bolsos', name: 'Bolsos', slug: 'bolsos', visible: true }];
      return route.fulfill({ json: { ok: true, resource, items: items.map(({ id, ...data }) => ({ id, data })) } });
    });
    await page.route('**/fixtures-filtros/*.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>' }));
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded' });
    const card = id => page.locator(`#cat-grid [data-product-id="${id}"]`);
    await expect(page.locator('#cat-grid [data-product-id]')).toHaveCount(3);
    const filter = (key, value) => page.locator(`#cat-variant-filters button[data-filter-key="${key}"][data-filter-value="${value}"]`);
    // En pantallas angostas los filtros están tras el botón «Filtros».
    const toggle = page.locator('#filter-toggle');
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
    // Sin filtros: la primera combinación con stock.
    await expect(card('bag').locator('.tt-card-img-wrap img')).toHaveAttribute('src', /bag-white/);
    await expect(card('bag').locator('[data-card-color="Blanco"]')).toHaveAttribute('aria-pressed', 'true');

    // Color Beige: la tarjeta muestra Beige (foto, muestra marcada y destino).
    await filter('color', 'beige').click();
    await expect(card('bag').locator('.tt-card-img-wrap img')).toHaveAttribute('src', /bag-beige/);
    await expect(card('bag').locator('[data-card-color="Beige"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card('bag').locator('[data-card-color="Blanco"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(card('bag').locator('a.tt-card-img-wrap')).toHaveAttribute('href', /color=Beige/);
    await expect(card('shoe').locator('.tt-card-img-wrap img')).toHaveAttribute('src', /shoe-cross/);
    await expect(card('plain')).toHaveCount(0);

    // Cambiar a otro color vuelve a ajustar cada tarjeta.
    await filter('color', 'beige').click();
    await filter('color', 'negro').click();
    await expect(card('bag').locator('.tt-card-img-wrap img')).toHaveAttribute('src', /bag-black/);
    await expect(card('bag').locator('[data-card-color="Negro"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card('shoe').locator('.tt-card-img-wrap img')).toHaveAttribute('src', /shoe-plain/);

    // Otro atributo (Diseño): la foto sigue a la combinación.
    await filter('color', 'negro').click();
    await filter('diseño', 'cruz').click();
    await expect(card('shoe').locator('.tt-card-img-wrap img')).toHaveAttribute('src', /shoe-cross/);
    await expect(card('bag')).toHaveCount(0);

    // Limpiar filtros: todas las tarjetas vuelven a su foto inicial.
    await page.locator('#btn-limpiar-filtros').click();
    await expect(page.locator('#cat-grid [data-product-id]')).toHaveCount(3);
    await expect(card('bag').locator('.tt-card-img-wrap img')).toHaveAttribute('src', /bag-white/);
    await expect(card('bag').locator('[data-card-color="Blanco"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
