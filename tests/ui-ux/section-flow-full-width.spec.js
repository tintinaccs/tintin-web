const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const styles = fs.readFileSync('css/theme/sistema-superficies-tintin.css', 'utf8');
const runtime = fs.readFileSync('js/theme/alternancia-secciones.js', 'utf8');
for (const width of [390, 1440]) test(`bloques entre wrappers llenan el ancho y alternan al ocultar secciones en ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(`<style>${styles}body{margin:0}.cat-wrap{max-width:800px;margin:auto;padding:24px}.cat-hero{height:160px;border-radius:24px;margin-bottom:32px}.cat-layout{height:200px}.tt-footer{height:140px}.white-card{background:white;height:60px;width:120px}</style><body><div class="cat-wrap"><section class="cat-hero"><h1>Catálogo</h1></section><section id="hidden-block" hidden>Oculto</section><div class="cat-layout"><article class="white-card">Tarjeta blanca</article></div></div><footer class="tt-footer">Pie</footer><section role="dialog">Panel</section></body>`);
  await page.addScriptTag({ content: runtime });
  const sequence = () => page.evaluate(() => [...document.querySelectorAll('[data-tt-flow-block]')].map(node => ({ flow: node.dataset.ttFlowBlock, left: node.querySelector('[data-tt-flow-background]').getBoundingClientRect().left, width: node.querySelector('[data-tt-flow-background]').getBoundingClientRect().width, start: getComputedStyle(node).getPropertyValue('--tt-section-start'), end: getComputedStyle(node).getPropertyValue('--tt-section-end') })));
  await expect.poll(async () => (await sequence()).map(row => row.flow)).toEqual(['light', 'pink', 'light']);
  for (const row of await sequence()) { expect(Math.abs(row.left)).toBeLessThan(1); expect(row.width).toBe(width); }
  const rows = await sequence(); expect(rows[0].end).toBe(rows[1].start); expect(rows[1].end).toBe(rows[2].start);
  await expect(page.locator('.white-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.locator('.cat-layout').evaluate(node => { node.hidden = true; });
  await expect.poll(async () => (await sequence()).map(row => row.flow)).toEqual(['light', 'pink']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
