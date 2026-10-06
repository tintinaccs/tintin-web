import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const browserPackage = 'playwright';
const { chromium } = await import(browserPackage);
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const hero = home.match(/<section class="tt-hero"[\s\S]*?<\/section>/)[0];
const fallbackRoot = 'assets-tintin/images/home/hero-nuevo/hero-nuevo-';

test('Firestore conserva WebP por dispositivo, no precarga desktop móvil y PNG queda como fallback real', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  try {
    for (const [width,height,art] of [[390,844,'mobile'],[820,1180,'tablet-vertical'],[1024,768,'tablet-horizontal'],[1440,900,'desktop']]) {
      const page = await browser.newPage({ viewport: { width,height } });
      const requests = [];
      const errors = [];
      const logoRequests = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.host !== 'tintin.test') return route.abort();
        if (url.pathname === '/index.html') return route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'});
        if (url.pathname.endsWith('/imagenes.js')) return route.fulfill({contentType:'text/javascript',body:`export const HERO_IMAGE_CONFIG_VERSION='test'; export const HERO_IMAGE_FALLBACKS={desktop:'${fallbackRoot}desktop.png',tablet:'${fallbackRoot}tablet-vertical.png',tabletLandscape:'${fallbackRoot}tablet-horizontal.png',mobile:'${fallbackRoot}mobile.png'};export const resolveSlotImage=(images,slot,device)=>images[slot+'_'+device]||'';export const onImagesUpdate=callback=>{window.confirmImages=callback;callback({});};`});
        if (url.pathname.includes('/hero-nuevo/')) requests.push(url.pathname);
        if (url.pathname.endsWith('/general/logo.png')) logoRequests.push(url.href);
        const file = path.resolve(root, '.' + url.pathname);
        if (!file.startsWith(root + path.sep)) return route.abort();
        try { await route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'text/plain'}); }
        catch { await route.abort(); }
      });
      await page.goto('https://tintin.test/index.html');
      await page.setContent(`<base href="https://tintin.test/">${hero}<img class="tt-logo-img" src="assets-tintin/images/general/logo.png?v=fixture-logo"><script type="module" src="js/components/images/gestion-imagenes.js"></script>`);
      await page.waitForFunction(()=>window.confirmImages && document.getElementById('tt-hero-img').naturalWidth>0, null, {timeout:5000}).catch(async error => { throw new Error(JSON.stringify({errors,state:await page.evaluate(()=>({callback:typeof window.confirmImages,src:document.getElementById('tt-hero-img').currentSrc,ready:document.getElementById('tt-hero-img').complete})),requests})); });
      await page.waitForLoadState('networkidle');
      requests.length=0;
      await page.evaluate(()=>window.confirmImages({}));
      await page.waitForFunction(()=>document.getElementById('tt-hero-img').dataset.ttHeroPhase5Signature);
      await page.waitForLoadState('networkidle');
      assert.match(await page.locator('#tt-hero-img').evaluate(img=>img.currentSrc),new RegExp(`hero-nuevo-${art}\\.webp`));
      assert.equal(requests.filter(url=>url.endsWith('.png')).length,0,'sin segunda descarga PNG ni precarga desktop');
      assert.ok(logoRequests.every(url=>url.endsWith('?v=fixture-logo')), 'el snapshot no quita la versión del logo publicado');
      assert.match(await page.locator('.tt-logo-img').evaluate(img=>img.src), /logo\.png\?v=fixture-logo$/);
      requests.length=0;
      await page.evaluate(root=>window.confirmImages({hero_bg_configVersion:'test',hero_bg_desktop:root+'desktop.png?custom=1',hero_bg_tablet:root+'tablet-vertical.png?custom=1',hero_bg_mobile:root+'mobile.png?custom=1'}),fallbackRoot);
      await page.waitForFunction(()=>document.getElementById('tt-hero-img').currentSrc.includes('?custom=1'));
      await page.waitForLoadState('networkidle');
      const customArt=art==='tablet-horizontal'?'tablet-vertical':art;
      assert.match(await page.locator('#tt-hero-img').evaluate(img=>img.currentSrc),new RegExp(`hero-nuevo-${customArt}\\.png\\?custom=1`));
      assert.ok(requests.filter(url=>url.endsWith('.png')).every(url=>url.endsWith(`hero-nuevo-${customArt}.png`)), `se predecodifica solamente la personalización activa: ${requests.join(',')}`);
      assert.ok(await page.locator('#tt-hero-img').evaluate(img=>[...img.closest('picture').querySelectorAll('source')].every(source=>source.srcset.includes('?custom=1')&&!source.type)), 'todos los sources usan el formato real de la personalización');
      await page.evaluate(()=>window.confirmImages({}));
      await page.waitForFunction(()=>document.getElementById('tt-hero-img').currentSrc.includes('.webp?'));
      await page.evaluate(()=>document.getElementById('tt-hero-img').dispatchEvent(new Event('error')));
      await page.waitForFunction(()=>document.getElementById('tt-hero-img').currentSrc.endsWith('.png?v=tintin-20261006-hero-rotulo-1'));
      assert.match(await page.locator('#tt-hero-img').evaluate(img=>img.currentSrc),new RegExp(`hero-nuevo-${art}\\.png`));
      await page.close();
    }
  } finally { await browser.close(); }
});

test('etiqueta de relacionadas visible sin solapar corazón, conserva tres columnas y objetivo de 44px', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  try {
    const page=await browser.newPage();
    const files=['styles.min.css','css/theme/sistema-superficies-tintin.css','css/pages/product/product-premium-overhaul.css'];
    const css=await Promise.all(files.map(file=>fs.readFile(path.join(root,file),'utf8')));
    const card='<article class="tt-product-card"><button class="tt-product-favorite-button" aria-label="Favorito">♡</button><div style="position:relative;aspect-ratio:1"><span class="tt-product-badge">Agotado</span></div><div class="tt-product-info">Producto</div></article>';
    await page.setContent(`<style>${css.join('\n')}</style><div style="padding:16px"><div class="tt-related-grid">${card.repeat(3)}</div></div>`);
    for(const width of [320,360,375,390,414,430]) {
      await page.setViewportSize({width,height:844});
      const boxes=await page.evaluate(()=>[...document.querySelectorAll('.tt-product-card')].map(card=>{const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};return {card:rect(card),badge:rect(card.querySelector('.tt-product-badge')),heart:rect(card.querySelector('button')),display:getComputedStyle(card.querySelector('.tt-product-badge')).display};}));
      assert.equal(new Set(boxes.map(b=>b.card.y)).size,1,'tres columnas');
      for(const b of boxes){assert.notEqual(b.display,'none');assert.ok(b.heart.width>=44&&b.heart.height>=44);assert.ok(b.badge.y>=b.heart.bottom||b.badge.right<=b.heart.x,`sin solape a ${width}`);assert.ok(b.badge.right<=b.card.right);}
    }
  } finally {await browser.close();}
});
