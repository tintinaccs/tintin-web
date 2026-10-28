const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { removeFixtureScripts } = require('../../scripts/lib/html-layout-fixture');
const root = path.resolve(__dirname, '../..');
const fields = '.tt-form-input,.tt-form-textarea,.perfil-input,.ck-input,.ck-select,.ck-textarea,.login-email-input';
const cards = '#contact-form,.tt-contact-alt,.perfil-card,.ck-panel';

// HTML y cascada reales. La sesión y los envíos quedan fuera de esta prueba
// geométrica: abrir el paso Datos no debe crear pedidos ni alterar perfiles.
for (const [width, height] of [[320,568],[360,640],[390,844],[844,390],[768,1024],
  [1024,768],[1280,720],[1440,900],[1920,1080],[2560,1440]]) {
  test(`formularios comparten bordes y espacio sin solapes ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'surface.test') return route.abort();
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
      if (file.endsWith('.html')) return route.fulfill({ contentType: 'text/html',
        body: removeFixtureScripts(fs.readFileSync(file, 'utf8'), { removeModulePreloads: true }) });
      return route.fulfill({ path: file });
    });
    for (const file of ['contact.html', 'perfil.html', 'checkout.html', 'login.html']) {
      await page.goto('https://surface.test/' + file);
      if (file === 'login.html') await page.addStyleTag({ path: 'css/pages/login/login-maintenance.css' });
      if (file === 'checkout.html') {
        await page.addStyleTag({ path: 'css/pages/checkout/checkout-maintenance.css' });
        await page.evaluate(() => document.querySelectorAll('.ck-panel').forEach(n => n.classList.toggle('active', n.id === 'panel-2')));
      }
      await page.evaluate(() => {
        document.documentElement.classList.remove('tt-color-scheme-pending', 'tt-store-gate-pending', 'login-auth-pending');
        document.body.classList.add('tt-public-shell-mounted');
        document.getElementById('tt-loader')?.remove();
        return document.fonts.ready;
      });
      const visibleFields = page.locator(fields).filter({ visible: true });
      expect(await visibleFields.count(), file).toBeGreaterThan(0);
      const geometry = await visibleFields.evaluateAll(nodes => nodes.map(node => {
        const b = node.getBoundingClientRect(), s = getComputedStyle(node);
        return { id: node.id, left: b.left, right: b.right, top: b.top, bottom: b.bottom, height: b.height,
          radius: parseFloat(s.borderTopLeftRadius), font: parseFloat(s.fontSize) };
      }));
      for (const field of geometry) {
        expect(field.left, file + field.id).toBeGreaterThanOrEqual(12);
        expect(field.right, file + field.id).toBeLessThanOrEqual(width - 12);
        expect(field.height, file + field.id).toBeGreaterThanOrEqual(44);
        expect(field.radius, file + field.id).toBe(14);
        if (width <= 1024) expect(field.font, file + field.id).toBeGreaterThanOrEqual(16);
      }
      const overlaps = geometry.flatMap((a, i) => geometry.slice(i + 1).filter(b =>
        a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1)
        .map(b => [a.id, b.id]));
      expect(overlaps).toEqual([]);
      for (const radius of await page.locator(cards).filter({ visible: true }).evaluateAll(nodes =>
        nodes.map(n => parseFloat(getComputedStyle(n).borderTopLeftRadius)))) {
        expect(radius, file).toBeGreaterThanOrEqual(16);
        expect(radius, file).toBeLessThanOrEqual(20);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), file).toBe(true);
      await visibleFields.first().focus();
      expect(await visibleFields.first().evaluate(n => getComputedStyle(n).outlineStyle)).not.toBe('none');
      if ([390,1440].includes(width)) await page.screenshot({ path: info.outputPath(file + '.png'), fullPage: true });
    }
  });
}

for (const width of [390, 844, 1024, 1440]) {
  test(`un solo esquema publicado controla tienda y panel en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      const js = body => route.fulfill({ contentType: 'text/javascript', body });
      if (url.pathname.endsWith('/app-check-admin.js')) return js('export async function waitForAdminAppCheck(){return window.allowAdminColors;}');
      if (url.pathname.endsWith('/suscripcion-app-check.js')) return js(`export function onAppCheckSnapshot(ref, callback){
        window.colorReads.push(ref.id);
        if(ref.id==='appearance') callback({exists:()=>true,data:()=>({activeGlobalSchemeId:'tintin-unico',activeAdminSchemeId:'anterior'})});
        else {window.publishTintin = data => callback({exists:()=>true,data:()=>data}); window.publishTintin({tokens:{'brand-primary':'#F8AACA'}});}
        return ()=>{};
      }`);
      if (url.pathname.endsWith('/firebase.js')) return js('export const db={}; export const appCheckReady=Promise.resolve(true);');
      if (url.hostname === 'www.gstatic.com') return js('export function doc(db,col,id){return {col,id};}');
      if (url.hostname !== 'surface.test') return route.abort();
      if (url.pathname === '/theme') return route.fulfill({ contentType: 'text/html', body: `<!doctype html>
        <link rel="stylesheet" href="/css/core/tokens-color.css">
        <link rel="stylesheet" href="/css/admin/admin-color-tokens.css">
        <link rel="stylesheet" href="/css/admin/admin.css">
        <link rel="stylesheet" href="/css/admin/dashboard-control.css">
        <link rel="stylesheet" href="/css/core/tema-unificado-tintin.css">
        <link rel="stylesheet" href="/css/theme/sistema-superficies-tintin.css">
        <main class="adm-main">
          <button id="public-action" class="tt-btn">Comprar</button>
          <button id="admin-action" class="adm-btn adm-btn-primary">Guardar</button>
          <button id="danger" class="adm-btn adm-btn-danger">Eliminar</button>
          <input id="admin-field" class="adm-input" aria-label="Nombre">
        </main>
        <script>window.colorReads=[];window.allowAdminColors=false;</script>` });
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
      return route.fulfill({ path: file, contentType: file.endsWith('.js') ? 'text/javascript' : undefined });
    });
    await page.goto('https://surface.test/theme');
    await page.evaluate(async () => {
      const url = new URL('/js/admin/settings/esquema-color-admin.js', location.href);
      url.searchParams.set('gate','denied'); await import(url.href);
    });
    expect(await page.evaluate(() => window.colorReads)).toEqual([]);
    await page.evaluate(async () => {
      window.allowAdminColors=true;
      const url = new URL('/js/admin/settings/esquema-color-admin.js', location.href);
      url.searchParams.set('gate','allowed'); await import(url.href);
    });
    await expect.poll(() => page.evaluate(() => window.colorReads)).toEqual(['appearance','tintin-unico']);
    // El fixture ya confirmó su sesión simulada; revelar el shell como hace Auth.
    await page.evaluate(() => document.documentElement.classList.add('adm-auth-ready'));
    // CI puede conservar el puntero sobre Comprar al revelar el formulario.
    // Reproducir ese estado y comprobar la publicación tanto en hover como en reposo.
    await page.locator('#public-action').hover();
    await page.evaluate(() => window.publishTintin({tokens:{'btn-primary-bg':'#E8AFC2','btn-primary-hover':'#D894AF','btn-danger-bg':'#B91C1C','field-border':'#D5A5B8','field-border-focus':'#B87694'}}));
    await expect(page.locator('#public-action')).toHaveCSS('background-color','rgb(216, 148, 175)');
    await page.mouse.move(width - 1, 899);
    await expect.poll(() => page.locator('#public-action').evaluate(el => el.matches(':hover'))).toBe(false);
    await expect(page.locator('#public-action')).toHaveCSS('background-color','rgb(232, 175, 194)');
    await expect(page.locator('#admin-action')).toHaveCSS('background-color','rgb(232, 175, 194)');
    await expect(page.locator('#danger')).toHaveCSS('background-color','rgb(185, 28, 28)');
    await expect(page.locator('#admin-field')).toHaveCSS('border-top-color','rgb(213, 165, 184)');
    for (const action of ['#public-action','#admin-action']) {
      await page.locator(action).hover();
      await expect(page.locator(action)).toHaveCSS('background-color','rgb(216, 148, 175)');
    }
    await page.mouse.move(width - 1, 899);
    await page.locator('#admin-field').focus();
    await expect(page.locator('#admin-field')).toHaveCSS('border-top-color','rgb(184, 118, 148)');
    const resizedWidth = width === 390 ? 1440 : 390;
    await page.setViewportSize({width:resizedWidth,height:900});
    // Resize puede recalcular :hover; retirar el puntero antes de comprobar reposo.
    await page.mouse.move(resizedWidth - 1, 899);
    await expect.poll(() => page.locator('#admin-action').evaluate(el => el.matches(':hover'))).toBe(false);
    await expect(page.locator('#admin-action')).toHaveCSS('background-color','rgb(232, 175, 194)');
    expect(await page.evaluate(() => localStorage.getItem('tt_color_scheme_admin'))).toBeNull();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tt_color_scheme_global')).tokens['--color-button-primary-background'])).toBe('#E8AFC2');
  });
}
