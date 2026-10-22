const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../js/quality/vigilancia-version.js'), 'utf8');
const revisionSource = fs.readFileSync(path.resolve(__dirname, '../../js/quality/revision-visual.mjs'), 'utf8');
const { createHash } = require('node:crypto');

async function scopedMount(page, pathname = '/', {unlisted=false,status=200} = {}) {
  const { visualSource } = await import('../../js/quality/revision-visual.mjs');
  const hash = value => createHash('sha256').update(visualSource(value)).digest('hex');
  const file = pathname === '/' ? 'index.html' : `${pathname.slice(1)}.html`;
  let release = 1, loaderTag = 1, productTag = 1, productVisual = 'anterior', loaderVisual = '';
  const loader = () => `window.fixtureLoader=true;const version='tintin-202610${loaderTag === 1 ? '20-old' : '21-new'}-1';${loaderVisual}`;
  const product = () => `document.body.dataset.productDesign=${JSON.stringify(productVisual)};`;
  const originalLoader = loader();
  let productMarker = 'a'.repeat(64), pageMarker = 'a'.repeat(64);
  await page.route('https://scope.test/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/revision-visual.mjs')) return route.fulfill({contentType:'text/javascript',body:revisionSource});
    if (url.pathname === '/watch.js') return route.fulfill({contentType:'text/javascript',body:source});
    if (url.pathname === '/loader.js') return route.fulfill({contentType:'text/javascript',headers:{'cache-control':'public, max-age=31536000, immutable'},body:url.searchParams.get('v') === '1' ? originalLoader : loader()});
    if (url.pathname === '/product.js') return route.fulfill({contentType:'text/javascript',body:product()});
    if (url.pathname === '/site-version.json') return route.fulfill({json:{schemaVersion:2,revision:String(release).padStart(64,'0'),pages:{...(unlisted?{}:{[file]:pageMarker}),'product.html':productMarker},clientResources:{'loader.js':{version:String(loaderTag),revision:hash(loader())},'product.js':{version:String(productTag),revision:hash(product())}}}});
    const isProduct = url.pathname === '/product';
    return route.fulfill({status,contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="tintin-page-revision" content="${isProduct ? productMarker : pageMarker}"><input aria-label="Borrador"><a href="/product">Abrir producto</a><script src="/loader.js?v=${loaderTag}"></script>${isProduct ? `<script src="/product.js?v=${productTag}"></script>` : ''}<script type="module" src="/watch.js?v=1"></script>`});
  });
  await page.goto('https://scope.test'+pathname);
  await page.waitForFunction(() => !!window.TintinVersionWatch);
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  return action => {
    release++;
    if (action === 'product') { productTag++; productVisual = 'nuevo'; productMarker = 'b'.repeat(64); }
    if (action === 'propagate') loaderTag++;
    if (action === 'shared') { loaderTag++; loaderVisual = 'document.body.dataset.sharedDesign="nuevo";'; }
    if (action === 'html') pageMarker = 'b'.repeat(64);
  };
}

test('una ruta personalizada también detecta recursos cargados sin una entrada estática',async({page})=>{
  const publish=await scopedMount(page,'/pages/guia',{unlisted:true});
  publish('product');publish('propagate');
  expect(await page.evaluate(()=>window.TintinVersionWatch.checkNow())).toBe('current');
  await expect(page.locator('#tt-version-notice')).toHaveCount(0);
  publish('shared');
  expect(await page.evaluate(()=>window.TintinVersionWatch.checkNow())).toBe('outdated');
  await expect(page.locator('#tt-version-notice')).toBeVisible();
});

test('una página 404 real usa su marcador aunque la dirección no figure en el inventario',async({page})=>{
  const publish=await scopedMount(page,'/no-existe',{unlisted:true,status:404});
  publish('html');
  expect(await page.evaluate(()=>window.TintinVersionWatch.checkNow())).toBe('outdated');
  await expect(page.locator('#tt-version-notice')).toBeVisible();
});

test('el renderer personalizado avisa por diseño visible y carga lo último al volver a entrar',async({page})=>{
  const {renderPage}=await import('../../functions/pages/[slug].js');
  const data={title:'Guía',contentHtml:'<h2>Contenido anterior</h2>',template:'standard',metaDescription:'SEO anterior'};
  await page.route('https://custom.test/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname==='/js/quality/vigilancia-version.js')return route.fulfill({contentType:'text/javascript',body:source});
    if(url.pathname==='/js/quality/revision-visual.mjs')return route.fulfill({contentType:'text/javascript',body:revisionSource});
    if(url.pathname==='/site-version.json')return route.fulfill({json:{schemaVersion:2,pages:{'index.html':'a'.repeat(64)},clientResources:{}}});
    const response=await renderPage(data,new Request(request.url()));
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  await page.goto('https://custom.test/pages/guia');
  await page.waitForFunction(()=>!!window.TintinVersionWatch);
  expect(await page.evaluate(()=>window.TintinVersionWatch.checkNow())).toBe('current');
  data.metaDescription='SEO actualizado';data.stock=0;
  expect(await page.evaluate(()=>window.TintinVersionWatch.checkNow())).toBe('current');
  await expect(page.locator('#tt-version-notice')).toHaveCount(0);
  data.contentHtml='<h2>Contenido vigente</h2>';
  expect(await page.evaluate(()=>window.TintinVersionWatch.checkNow())).toBe('outdated');
  await expect(page.locator('#tt-version-notice')).toBeVisible();
  await page.reload();
  await page.waitForFunction(()=>!!window.TintinVersionWatch);
  await expect(page.getByRole('heading',{name:'Contenido vigente'})).toBeVisible();
  expect(await page.evaluate(()=>window.TintinVersionWatch.checkNow())).toBe('current');
  await expect(page.locator('#tt-version-notice')).toHaveCount(0);
});

for (const pathname of ['/', '/catalogo', '/collections', '/perfil', '/admin', '/admin-images', '/checkout', '/login']) {
  test(`regla global por pantalla y datos sin aviso · ${pathname}`, async ({page}) => {
    const publish = await scopedMount(page, pathname);
    await page.getByRole('textbox').fill('Conservar borrador');
    await page.evaluate(() => { window.dispatchEvent(new CustomEvent('tintin:site-content-updated')); localStorage.setItem('cart','conservar'); });
    publish('data');
    expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
    publish('product');
    publish('propagate');
    expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
    await expect(page.locator('#tt-version-notice')).toHaveCount(0);
    publish('shared');
    expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
    await expect(page.locator('#tt-version-notice')).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveValue('Conservar borrador');
    await page.getByRole('button',{name:'Más tarde',exact:true}).click();
    publish('product'); // No insiste por una publicación ajena al posponer.
    expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
    await expect(page.locator('#tt-version-notice')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('cart'))).toBe('conservar');
  });
}

test('al entrar después a la página modificada carga directamente el diseño vigente', async ({page}) => {
  const publish = await scopedMount(page);
  publish('product'); publish('propagate');
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  await page.getByRole('link',{name:'Abrir producto'}).click();
  await page.waitForFunction(() => !!window.TintinVersionWatch);
  await expect(page.locator('body')).toHaveAttribute('data-product-design','nuevo');
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  await expect(page.locator('#tt-version-notice')).toHaveCount(0);
});

test('el HTML cargado conserva su referencia aunque la publicación cambie antes del primer sondeo', async ({page}) => {
  await scopedMount(page);
  await page.route('**/site-version.json',route=>route.fulfill({json:{schemaVersion:2,pages:{'index.html':'b'.repeat(64)},clientResources:{}}}));
  await page.reload();
  await page.waitForFunction(() => !!window.TintinVersionWatch);
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
  await expect(page.locator('#tt-version-notice')).toBeVisible();
});

async function mount(page, { cookies = false } = {}) {
  let revision = 'a'.repeat(64);
  let otherPageRevision = 'a'.repeat(64);
  await page.route('https://version.test/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/revision-visual.mjs') return route.fulfill({ contentType: 'text/javascript', body: revisionSource });
    if (url.pathname === '/site-version.json') return route.fulfill({ json: { revision: otherPageRevision, pages: { 'index.html': revision, 'product.html': otherPageRevision } } });
    if (url.pathname === '/watch.js') return route.fulfill({ contentType: 'text/javascript', body: source });
    return route.fulfill({ contentType: 'text/html', body: `<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#tt-tabbar{position:fixed;bottom:16px;right:16px;left:16px;height:72px;background:#eee;z-index:1100}@media(min-width:1100px){#tt-tabbar{display:none}}#tt-privacy-consent{position:fixed;bottom:0;right:0;width:100%;height:85vh;background:#ccc;z-index:2147483600}</style><input aria-label="Borrador"><div id="tt-tabbar">Navegación</div>${cookies ? '<div id="tt-privacy-consent">Cookies</div>' : ''}<script type="module" src="/watch.js?v=initial"></script>` });
  });
  await page.goto('https://version.test/');
  await page.waitForFunction(() => !!window.TintinVersionWatch);
  await page.getByRole('textbox').fill('Conservar edición');
  await page.evaluate(() => localStorage.setItem('cart', 'conservar'));
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  return (value = 'b', otherPageOnly = false) => { if (otherPageOnly) otherPageRevision = value.repeat(64); else revision = value.repeat(64); };
}

test('una publicación de otra página no pide recargar la página abierta', async ({ page }) => {
  const publish = await mount(page);
  publish('b', true);
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  await expect(page.locator('#tt-version-notice')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveValue('Conservar edición');
  publish('c');
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
  await expect(page.locator('#tt-version-notice')).toBeVisible();
});

test('marcador válido evita descargar de nuevo el documento HTML', async ({ page }) => {
  const documents = [], markers = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/') documents.push(request.url());
    if (new URL(request.url()).pathname === '/site-version.json') markers.push(request.url());
  });
  await mount(page); // Una referencia inicial y una comprobación explícita.
  expect(markers).toHaveLength(2);
  expect(documents).toHaveLength(1);
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  expect(markers).toHaveLength(3);
  expect(documents).toHaveLength(1);
});

for (const [width, height] of [[320,568],[390,844],[430,932],[568,320],[844,390],[768,1024],[1024,768],[1280,720],[1366,768],[1920,1080]]) {
  test(`publicación sin cambios de CSS/JS avisa y permite actualizar · ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const publish = await mount(page);
    publish();
    expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
    const notice = page.locator('#tt-version-notice');
    await expect(notice).toBeVisible();
    const box = await notice.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    if (width < 1100) expect(box.y + box.height).toBeLessThanOrEqual(height - 88);
    const button = notice.getByRole('button', { name: 'Actualizar', exact: true });
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('textbox')).toHaveValue('Conservar edición');
    await Promise.all([page.waitForEvent('load'), button.click()]);
    await expect(notice).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('cart'))).toBe('conservar');
  });
}

test('horizontal con cookies grandes: el aviso sigue visible y se puede posponer', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  const publish = await mount(page, { cookies: true });
  publish();
  await page.evaluate(() => window.TintinVersionWatch.checkNow());
  const notice = page.locator('#tt-version-notice');
  await expect(notice).toBeVisible();
  const button = notice.getByRole('button', { name: 'Más tarde', exact: true });
  await button.click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveValue('Conservar edición');
});

test('al volver a la pestaña detecta una publicación y no espera diez minutos', async ({ page }) => {
  const publish = await mount(page);
  await page.clock.install();
  publish();
  await page.clock.runFor(16000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#tt-version-notice')).toBeVisible();
});

test('una revisión no disponible no inventa cambios y conserva el fallback HTML', async ({ page }) => {
  await mount(page);
  await page.route('**/site-version.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  await expect(page.locator('#tt-version-notice')).toHaveCount(0);
  await page.route('https://version.test/', route => route.fulfill({ contentType: 'text/html', body: '<script src="/watch.js?v=new"></script>' }));
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
  await expect(page.locator('#tt-version-notice')).toBeVisible();
});

test('Más tarde pospone esa versión y una publicación posterior vuelve a avisar', async ({ page }) => {
  const publish = await mount(page);
  publish();
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
  const notice = page.locator('#tt-version-notice');
  await notice.getByRole('button', { name:'Más tarde', exact:true }).click();
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  await expect(notice).toHaveCount(0);
  publish('c');
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCount(1);
});

test('el fallback tampoco insiste con referencias ya pospuestas', async ({ page }) => {
  await mount(page);
  await page.route('**/site-version.json', route => route.fulfill({ status:503, body:'unavailable' }));
  let version = 'new';
  await page.route('https://version.test/', route => route.fulfill({ contentType:'text/html', body:`<script src="/watch.js?v=${version}"></script>` }));
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
  const notice = page.locator('#tt-version-notice');
  await notice.getByRole('button', { name:'Más tarde', exact:true }).click();
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('current');
  await expect(notice).toHaveCount(0);
  version = 'next';
  expect(await page.evaluate(() => window.TintinVersionWatch.checkNow())).toBe('outdated');
  await expect(notice).toBeVisible();
});
