import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const browserPackage = 'playwright';
const { chromium } = await import(browserPackage);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sizes = [[1920,1080],[1440,900],[1280,720],[1024,768],[768,1024],[390,844],[320,568]];

test('Últimos datos mantiene una columna, foco continuo y errores junto al campo en siete tamaños', async () => {
  let html = await fs.readFile(path.join(root, 'login.html'), 'utf8');
  const files = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"?]+)[^"]*"/g)]
    .map(match => match[1]).filter(file => !file.startsWith('http'));
  files.push('css/pages/login/login-onboarding-form-layout.css');
  const css = await Promise.all(files.map(file => fs.readFile(path.join(root, file), 'utf8')));
  // Bloquea todos los scripts y la red: el fixture solo prueba el HTML/CSS real.
  html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="script-src 'none'; connect-src 'none'; style-src 'unsafe-inline'; img-src data:">`)
    .replace('</head>', `<style>${css.join('\n')}</style></head>`)
    .replace('<body>', '<body class="login-setup-open">');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/*', route => route.abort());
    await page.setContent(html);
    const ids = ['login-profile-first-name','login-profile-last-name','login-profile-username','login-profile-phone','login-profile-dob'];
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      const geometry = await page.evaluate(ids => {
        const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,bottom:r.bottom}; };
        return {fields:ids.map(rect),form:rect('login-profile-block'),viewport:document.querySelector('.login-page').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-innerWidth};
      }, ids);
      assert.ok(geometry.overflow <= 2, `overflow a ${width}`);
      assert.ok(Math.abs(geometry.form.x + geometry.form.w/2 - geometry.viewport/2) <= 2, `formulario descentrado a ${width}: ${JSON.stringify(geometry)}`);
      geometry.fields.forEach((field,index) => {
        assert.ok(field.w > 80 && field.x >= geometry.form.x-2 && field.x+field.w <= geometry.form.x+geometry.form.w+2, `campo comprimido/fuera a ${width}`);
        if(index) assert.ok(field.y >= geometry.fields[index-1].bottom, `orden visual roto a ${width}`);
      });
      await page.locator('#login-profile-first-name').focus();
      for (const id of ids.slice(1)) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.id), id, `foco roto a ${width}`);
      }
    }
    await page.evaluate(() => {
      const error = document.getElementById('login-first-name-error');
      error.textContent = 'Revisá el nombre'; error.classList.add('show');
    });
    const errorOrder = await page.evaluate(() => {
      const r = id => document.getElementById(id).getBoundingClientRect();
      return {first:r('login-profile-first-name').bottom,errorTop:r('login-first-name-error').top,errorBottom:r('login-first-name-error').bottom,last:r('login-profile-last-name').top};
    });
    assert.ok(errorOrder.errorTop >= errorOrder.first && errorOrder.errorBottom <= errorOrder.last);
  } finally { await browser.close(); }
});

test('Tus datos del checkout conserva campos verticales y teléfono completo en siete tamaños', async () => {
  let html = await fs.readFile(path.join(root, 'checkout.html'), 'utf8');
  const files = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"?]+)[^"]*"/g)]
    .map(match => match[1]).filter(file => !file.startsWith('http'));
  const css = await Promise.all(files.map(file => fs.readFile(path.join(root, file), 'utf8')));
  html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="script-src 'none'; connect-src 'none'; style-src 'unsafe-inline'; img-src data:">`)
    .replace('</head>', `<style>${css.join('\n')} #panel-2 { display:block !important; }</style></head>`);
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent(html);
    const ids = ['ck-name','ck-phone-number','ck-email','ck-notes','ck-coupon'];
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      const geometry = await page.evaluate(ids => {
        const rect = el => { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,bottom:r.bottom}; };
        const body=document.querySelector('#panel-2 .ck-panel-body');
        return {form:rect(body), panel:rect(body.parentElement), fields:ids.map(id => rect(document.getElementById(id)))};
      }, ids);
      assert.ok(Math.abs(geometry.form.x+geometry.form.w/2-geometry.panel.x-geometry.panel.w/2)<=2, `checkout descentrado a ${width}`);
      geometry.fields.forEach((field,index) => {
        assert.ok(field.w>=80 && field.x>=geometry.form.x-2 && field.x+field.w<=geometry.form.x+geometry.form.w+2, `checkout campo comprimido/fuera a ${width}`);
        if(index) assert.ok(field.y>=geometry.fields[index-1].bottom, `checkout orden roto a ${width}`);
      });
      await page.locator('#ck-name').focus();
      for (const id of ids.slice(1)) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.id),id,`checkout foco roto a ${width}`);
      }
    }
  } finally { await browser.close(); }
});
