import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browserPackage = 'playwright';
const { chromium } = await import(browserPackage);

// Execute the actual global click filter together with an asynchronous guard.
// Layout fixtures which omit calidad-interfaz.js cannot detect this collision.
const source = fs.readFileSync(new URL('../../js/quality/calidad-interfaz.js', import.meta.url), 'utf8');
const forms = source.slice(source.indexOf('function forms(){'), source.indexOf('\nfunction ', source.indexOf('function forms(){') + 1));

test('un clic táctil validado asincrónicamente alcanza el handler una sola vez', async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await page.setContent('<button id="continue">Continuar</button><output id="result"></output>');
    await page.evaluate(forms => {
      new Function(forms + ';forms();')();
      const button = document.getElementById('continue');
      let replaying = false;
      document.addEventListener('click', event => {
        if (event.target !== button || replaying) return;
        event.preventDefault(); event.stopImmediatePropagation();
        Promise.resolve().then(() => {
          replaying = true;
          try { button.click(); } finally { replaying = false; }
        });
      }, true);
      window.calls = 0;
      button.onclick = () => { document.getElementById('result').textContent = String(++window.calls); };
    }, forms);
    await page.locator('#continue').tap();
    assert.equal(await page.locator('#result').textContent(), '1', 'el filtro global debe dejar llegar el clic reemitido al handler');
  } finally { await browser.close(); }
});

test('el filtro conserva la protección contra dos pulsaciones humanas consecutivas', async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent('<button id="continue">Continuar</button>');
    await page.evaluate(forms => {
      new Function(forms + ';forms();')();
      // Fixed clock makes this deterministic, without slowing/retrying clicks.
      Date.now = () => 10000;
      window.calls = 0;
      document.getElementById('continue').onclick = () => window.calls++;
    }, forms);
    await page.locator('#continue').dblclick();
    assert.equal(await page.evaluate(() => window.calls), 1);
  } finally { await browser.close(); }
});
