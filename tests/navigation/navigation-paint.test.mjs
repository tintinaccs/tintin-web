import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { navigationPaintState } from '../../scripts/lib/superficie-navegacion.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

test('la auditoría reconoce pintura real y rechaza capas vacías u ocultas', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>
      nav { height:64px; position:relative; isolation:isolate; }
      #white { background:white; } #pink { background:#f8aaca; }
      .layer::before { content:""; position:absolute; inset:0; z-index:-1; pointer-events:none;
        background:linear-gradient(color-mix(in srgb,#f8aaca 94%,transparent),transparent); }
      #empty::before { background:linear-gradient(transparent,transparent); }
      #hidden::before { opacity:0; }
    </style><nav id="white"></nav><nav id="pink"></nav><nav class="layer" id="fade"></nav>
    <nav class="layer" id="empty"></nav><nav class="layer" id="hidden"></nav><nav id="bare"></nav>`);
    for (const id of ['white', 'pink', 'fade']) assert.equal((await page.locator('#' + id).evaluate(navigationPaintState)).painted, true, id);
    assert.equal((await page.locator('#fade').evaluate(navigationPaintState)).source, 'before');
    for (const id of ['empty', 'hidden', 'bare']) assert.equal((await page.locator('#' + id).evaluate(navigationPaintState)).painted, false, id);
  } finally { await browser.close(); }
});
