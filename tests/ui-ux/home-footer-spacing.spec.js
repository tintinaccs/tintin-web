const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { restoreStyleSources } = require('../../scripts/lib/estilos-inicio.js');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture.js');
const root = path.resolve(__dirname, '../..');
const html = restoreStyleSources(removeFixtureScripts(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { removeModulePreloads: true }));
const types = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

async function mountLayout(page, markup = html) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'layout.test') return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: markup });
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) return route.abort();
    try { return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); }
    catch { return route.abort(); }
  });
  await page.goto('https://layout.test/');
  await page.waitForFunction(() => [...document.querySelectorAll('link[rel~="stylesheet"]')].every(link => link.sheet));
  await page.evaluate(() => {
    document.body.classList.add('tt-public-shell-mounted', 'tt-home-runtime-ready');
    document.querySelector('.tt-footer-tagline').textContent = 'Accesorios femeninos elegantes con brillo propio. Somos tu tienda online de confianza en Paraguay.';
  });
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'js/components/color/logotipo-marca.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'js/components/navigation/compartido/acordeon-pie-pagina.js'), 'utf8').replace('export function', 'function') + '\nenhanceMobileFooter();' });
}
for(const width of [320,390,430,540,767])test(`botones de bienvenida centrados en móvil ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await mountLayout(page);
 const centers=await page.locator('#hero .tt-hero-actions a').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return b.x+b.width/2;}));
 expect(centers).toHaveLength(2);
 // A partir de 480px pueden compartir fila: el conjunto debe seguir centrado.
 const group=await page.locator('#hero .tt-hero-actions').boundingBox();
 const hero=await page.locator('#hero').boundingBox(),axis=hero.x+hero.width/2;
 expect(Math.abs(group.x+group.width/2-axis)).toBeLessThanOrEqual(1);
 if(width<480)for(const center of centers)expect(Math.abs(center-axis)).toBeLessThanOrEqual(1);
});

for (const [width, height] of [[320,568],[375,667],[390,844],[430,932],[568,320],[844,390],
  [600,960],[767,1024],[768,1024],[820,1180],[1024,768],[1025,768],[1180,820],[1280,800],[1366,768],[1440,900],[1920,1080],[2560,1440]]) {
  test(`acciones, tarjetas y footer conservan espacio y alineación · ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await mountLayout(page);
    const geometry = await page.evaluate(() => {
      const box = element => { const r = element.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height, center:r.left+r.width/2 }; };
      const q = selector => box(document.querySelector(selector));
      return { shell:q('.tt-footer-shell'), grid:q('.tt-footer-grid'), brand:q('.tt-footer-brand'), logo:q('.tt-footer-brand .tt-logo-link'), tagline:q('.tt-footer-tagline'), wa:q('.tt-footer-wa'), actionsBox:q('.tt-hero-actions'),
        cards:[...document.querySelectorAll('.tt-trust-item')].map(box),
        actions:[...document.querySelectorAll('.tt-hero-actions a')].map(a => ({ ...box(a), background:getComputedStyle(a).backgroundColor, border:parseFloat(getComputedStyle(a).borderTopWidth) })),
        copyrightPadding:parseFloat(getComputedStyle(document.querySelector('.tt-footer-bottom')).paddingBottom),
        footerTail:document.querySelector('.tt-footer').getBoundingClientRect().bottom-document.querySelector('.tt-footer-bottom').getBoundingClientRect().bottom,
        afterFooter:document.documentElement.scrollHeight-(document.querySelector('.tt-footer').getBoundingClientRect().bottom+scrollY),
        scrollWidth:document.documentElement.scrollWidth };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width + 1);
    expect(geometry.copyrightPadding).toBeLessThanOrEqual(18);
    expect(geometry.footerTail).toBeLessThanOrEqual(1);
    expect(geometry.afterFooter).toBeLessThanOrEqual(width <= 767 ? 97 : 1);
    const inside = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1;
    expect(inside(geometry.brand, geometry.shell)).toBe(true);
    if (width <= 1024) {
      expect(Math.abs(geometry.brand.width - geometry.grid.width)).toBeLessThanOrEqual(2);
      for (const element of [geometry.logo, geometry.tagline, geometry.wa]) {
        expect(Math.abs(element.center - geometry.brand.center)).toBeLessThanOrEqual(1);
      }
    } else {
      expect(Math.abs(geometry.logo.left - geometry.brand.left)).toBeLessThanOrEqual(1);
      expect(geometry.brand.width).toBeLessThan(geometry.shell.width / 2);
    }
    for (let i = 0; i < geometry.cards.length; i++) {
      const a = geometry.cards[i];
      expect(a.left).toBeGreaterThanOrEqual(15);
      expect(a.right).toBeLessThanOrEqual(width - 15);
      for (const b of geometry.cards.slice(i + 1)) {
        const xGap = Math.max(b.left - a.right, a.left - b.right);
        const yGap = Math.max(b.top - a.bottom, a.top - b.bottom);
        expect(Math.max(xGap, yGap)).toBeGreaterThanOrEqual(13);
      }
    }
    if (width <= 767) {
      for (const a of geometry.actions) {
        expect(a.height).toBeGreaterThanOrEqual(48);
        expect(a.width).toBeGreaterThanOrEqual(140);
        expect(a.left).toBeGreaterThanOrEqual(15);
        expect(a.right).toBeLessThanOrEqual(width - 15);
      }
      expect(geometry.actions[0].background).not.toBe('rgba(0, 0, 0, 0)');
      expect(geometry.actions[1].border).toBeGreaterThanOrEqual(1);
      if (width <= 479) {
        for (const a of geometry.actions) expect(Math.abs(a.center-geometry.actionsBox.center)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.actions[0].width-geometry.actions[1].width)).toBeLessThanOrEqual(1);
      }
    }
    for (const [selector, href] of [['.tt-hero-cta','/catalogo'],['.tt-hero-link','/about']]) {
      const link = page.locator(selector);
      await expect(link).toHaveAttribute('href', href);
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
      expect(await link.evaluate(el => { const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left+r.width/2, r.top+r.height/2)); })).toBe(true);
      await link.focus();
      await expect(link).toBeFocused();
    }
    if ([390,768,1024,1366,1920].includes(width)) {
      await page.evaluate(() => document.activeElement?.blur());
      for (const selector of ['#hero','.tt-trust-bar','.tt-footer']) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        if (selector === '.tt-footer') await expect.poll(() => page.locator('.tt-footer .tt-logo-img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
        const imagePath = testInfo.outputPath(selector.replace(/[.#]/g, '') + '.png');
        await page.locator(selector).screenshot({ path:imagePath, animations:'disabled' });
        await testInfo.attach(selector, { path:imagePath, contentType:'image/png' });
      }
    }
  });
}

for (const file of ['about.html', 'perfil.html']) {
  for (const [width, height] of [[390,844],[768,1024],[1024,768],[1440,900]]) {
    test(`footer compartido en ${file} · ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await mountLayout(page, removeFixtureScripts(fs.readFileSync(path.join(root, file), 'utf8'), { removeModulePreloads:true }));
      const boxes = await page.locator('.tt-footer-brand, .tt-footer-brand .tt-logo-link, .tt-footer-tagline, .tt-footer-wa').evaluateAll(nodes => nodes.map(el => {
        const r=el.getBoundingClientRect(); return { left:r.left, center:r.left+r.width/2 };
      }));
      if (width <= 1024) for (const box of boxes) expect(Math.abs(box.center-boxes[0].center)).toBeLessThanOrEqual(1);
      else expect(Math.abs(boxes[1].left-boxes[0].left)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
      if (width <= 480) {
        const toggle=page.locator('.tt-footer-accordion-toggle').first();
        await expect(toggle).toHaveAttribute('aria-expanded','false');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded','true');
        await expect(page.locator('#'+await toggle.getAttribute('aria-controls'))).toBeVisible();
      }
    });
  }
}
