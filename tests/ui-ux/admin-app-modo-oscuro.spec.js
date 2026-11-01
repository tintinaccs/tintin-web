// App móvil, Fase 27 · Modo oscuro: interruptor manual en Configuración, solo ≤768, preferencia en este dispositivo.
// El contraste se mide con transiciones apagadas (si no, se mide a mitad de animación).
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const KEY = 'tt-admin-theme';
const NO_MOTION = '*,*::before,*::after{transition:none!important;animation:none!important}';

async function openConfig(page) {
  await page.evaluate(() => document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n.id === 'section-configuracion')));
}

for (const width of [320, 390, 540, 768]) {
  test(`interruptor de modo oscuro en app a ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true });
    await openConfig(page);
    const sw = page.locator('#adm-theme-switch');
    await expect(sw).toBeVisible();
    const b = await sw.boundingBox();
    expect(Math.round(b.height)).toBeGreaterThanOrEqual(44);
    expect(Math.round(b.width)).toBeGreaterThanOrEqual(44);
    expect(b.x + b.width).toBeLessThanOrEqual(width + 1);
    await expect(sw).toHaveAttribute('role', 'switch');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(await page.evaluate(() => document.documentElement.classList.contains('adm-dark'))).toBe(false);

    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => document.documentElement.classList.contains('adm-dark'))).toBe(true);
    expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('dark');
    expect(await page.evaluate(() => document.querySelector('meta[name="theme-color"]').getAttribute('content'))).toBe('#161216');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(255, 255, 255)');

    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(await page.evaluate(() => document.documentElement.classList.contains('adm-dark'))).toBe(false);
    expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('light');
    expect(await page.evaluate(() => document.querySelector('meta[name="theme-color"]').getAttribute('content'))).not.toBe('#161216');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('la preferencia guardada se aplica al cargar en ≤768', async ({ page }) => {
  await page.addInitScript(k => { try { localStorage.setItem(k, 'dark'); } catch { /* sin almacenamiento */ } }, KEY);
  await load(page, 390, 'admin.html', { mobile: true, sidebar: true });
  expect(await page.evaluate(() => document.documentElement.classList.contains('adm-dark'))).toBe(true);
  await openConfig(page);
  await expect(page.locator('#adm-theme-switch')).toHaveAttribute('aria-checked', 'true');
});

for (const width of [820, 1024, 1440]) {
  test(`sin modo oscuro ni tarjeta a ${width}px aunque haya preferencia guardada`, async ({ page }) => {
    await page.addInitScript(k => { try { localStorage.setItem(k, 'dark'); } catch { /* sin almacenamiento */ } }, KEY);
    await load(page, width, 'admin.html', { mobile: true, sidebar: true });
    const st = await page.evaluate(() => ({
      app: document.documentElement.classList.contains('adm-app'),
      dark: document.documentElement.classList.contains('adm-dark'),
      card: getComputedStyle(document.getElementById('adm-theme-card')).display,
      meta: document.querySelector('meta[name="theme-color"]').getAttribute('content'),
    }));
    expect(st.app).toBe(false);
    expect(st.dark).toBe(false);
    expect(st.card).toBe('none');
    expect(st.meta).not.toBe('#161216');
  });
}

test('contraste en modo oscuro: textos legibles en todas las secciones y en la barra inferior (390px)', async ({ page }) => {
  await load(page, 390, 'admin.html', { mobile: true, sidebar: true });
  await page.addStyleTag({ content: NO_MOTION });
  await page.locator('#adm-theme-switch').evaluate(el => el.click());
  const bad = await page.evaluate(() => {
    const parse = c => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] }; };
    const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bgOf = n => { for (let p = n; p; p = p.parentElement) { const c = parse(getComputedStyle(p).backgroundColor); if (c.a > .5) return c; } return { r: 22, g: 18, b: 22 }; };
    const check = (scope, label, out) => {
      for (const n of scope.querySelectorAll('*')) {
        if (!n.getClientRects().length) continue;
        if (n.closest('thead') || n.tagName === 'IFRAME') continue; // thead recortado por la conversión a tarjetas; vista previa del sitio
        if (n.getBoundingClientRect().width < 2) continue;
        if (![...n.childNodes].some(t => t.nodeType === 3 && t.textContent.trim())) continue;
        const a = lum(parse(getComputedStyle(n).color)), b = lum(bgOf(n));
        const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if (ratio < 3) out.push(`${label} ${n.tagName}.${String(n.className).slice(0, 36)} ${ratio.toFixed(1)}`);
      }
    };
    const out = [];
    check(document.getElementById('adm-mobile-tabs'), 'tabs', out);
    for (const s of document.querySelectorAll('.adm-content > .adm-section')) {
      document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n === s));
      check(s, s.id, out);
    }
    return [...new Set(out)];
  });
  expect(bad, bad.join('\n')).toEqual([]);
});
