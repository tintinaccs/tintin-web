const fs = require('node:fs');
const path = require('node:path');
const { expect } = require('@playwright/test');
const { mockRuntime, fixtureHtml } = require('./admin-commerce-fixture.cjs');
const { removeFixtureScripts } = require('../../../scripts/lib/html-layout-fixture.js');
const root = path.resolve(__dirname, '../../..');
const shell = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const headStyles = (shell.match(/<link[^>]+rel="stylesheet"[^>]*>/g) || []).join('');
const source = fs.readFileSync(path.join(root, 'js/admin/admin-app.js'), 'utf8');
const start = shell.indexOf('<div class="adm-card" id="prod-form-card"');
const form = shell.slice(start, shell.indexOf('\n    </div>\n\n    <!-- ===================== COLECCIONES', start));
const code = source.slice(source.indexOf('let productVariantStockBaseline = null;'), source.indexOf('window.prodToggleActive ='));

async function openProductSaveFixture(page, width, height, {fullShell=false,photos=false,workflow=false,initialRecords=[],gallerySource=null} = {}) {
  await page.setViewportSize({ width, height });
  await mockRuntime(page);
  if(gallerySource)await page.route('**/products/galeria-unificada.js*',route=>route.fulfill({contentType:'text/javascript',body:gallerySource}));
  await page.route('**/components/images/biblioteca-multimedia.js*',route=>route.fulfill({contentType:'text/javascript',body:`export const deleteMediaByUrlIfUnused=async()=>{throw Error('No se permite borrar archivos en QA');};export const deleteMediaItem=deleteMediaByUrlIfUnused;export const uploadImageToLibrary=async(file,options)=>{options?.onProgress?.('uploading');if(window.qaUploadFailure)throw Error('Carga fallida de prueba');return {url:'https://img.test/'+file.name,mediaId:'synthetic'};};`}));
  if(!await page.evaluate(()=>typeof window.qaCommercialWrite==='function'))await page.exposeFunction('qaCommercialWrite', async ({ request, records }) => {
    const { pathToFileURL } = require('node:url');
    const [{ saveProductEditor }, { encodeFirestoreFields, decodeFirestoreFields },{productEditorWorkspace}] = await Promise.all([
      import(pathToFileURL(path.join(root, 'cloudflare/product-editor-domain.mjs')).href),
      import(pathToFileURL(path.join(root, 'cloudflare/firebase-admin-ligero.js')).href),
      import(pathToFileURL(path.join(root, 'cloudflare/product-editor-workspaces.mjs')).href),
    ]);
    const data = new Map(records), writes = [];
    try {
      const writer=request.action==='saveProduct'?saveProductEditor:productEditorWorkspace;
      const result = await writer({}, request, { uid: 'qa-admin', role: 'superadmin', email: 'qa-admin@example.invalid' }, {
        get: async (_env, key) => key === 'collections/qa-tablet' ? { fields: encodeFirestoreFields({ name: 'Colección ficticia' }), updateTime: 'qa-collection' } : data.has(key) ? { fields: encodeFirestoreFields(data.get(key)), updateTime: 'qa-record' } : null,
        list:async (_env,path)=>[...data].filter(([key])=>key.startsWith(path+'/')).map(([,value])=>({fields:encodeFirestoreFields(value)})),
        commit: async (_env, changes) => { for (const change of changes) { data.set(change.path, { ...data.get(change.path), ...decodeFirestoreFields(change.fields) }); writes.push(change.path); } },
      });
      return { ok: true, result, records: [...data], writes };
    } catch (error) { return { ok: false, error: error.message,status:error.status }; }
  });
  let html = fixtureHtml().replace('<section class="adm-section" id="section-productos">', '<section class="adm-section active" id="section-productos">').replace(/<link[^>]+rel="stylesheet"[^>]*>/g, '').replace('</head>', headStyles + '</head>');
  if(fullShell){
    const seed=[...fixtureHtml().matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).join('\n');
    const loader=fs.readFileSync(path.join(root,'js/cargador-pagina.js'),'utf8');
    const scroll=loader.slice(loader.indexOf("  try { history.scrollRestoration"),loader.indexOf('  // El sitio oficial'));
    const modules=['/js/admin/shopify-commerce-admin.js','/js/admin/maestro/espacio-modulos-admin.js','/js/admin/maestro/navegacion-movil-admin.js','/js/admin/sidebar-expandible-admin.js'];
    html=removeFixtureScripts(shell)
      .replace('class="adm-section active" id="section-dashboard"','class="adm-section" id="section-dashboard"')
      .replace('class="adm-section" id="section-productos"','class="adm-section active" id="section-productos"')
      .replace('</head>',`<script>document.documentElement.classList.add('adm-auth-ready');${scroll}</script></head>`)
      .replace('</body>',`<script>${seed}</script>${modules.map(src=>`<script type="module" src="${src}"></script>`).join('')}</body>`);
  }
  const before = html.indexOf('<div class="adm-card" id="prod-form-card"');
  await page.route('https://tintin.test/admin-commerce-fixture', route => route.fulfill({ contentType: 'text/html', body: fullShell ? html : html.slice(0, before) + form + html.slice(html.indexOf('</section>', before)) }));
  await page.goto('https://tintin.test/admin-commerce-fixture');
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await expect(page.locator('[data-action="product-new"]')).toBeVisible();
  await page.evaluate(async ({code,workflow,initialRecords}) => {
    const load = file => import(new URL(file, location.origin).href);
    const [inventory, commercial, commercialUi, editorialUi, editorial, master, imageUtilities] = await Promise.all([
      load('/js/core/store/inventario-variantes.mjs'), load('/js/admin/products/editor-comercial-core.mjs'),
      load('/js/admin/products/editor-comercial-interfaz.js'), load('/js/admin/products/editor-editorial-interfaz.js'),
      load('/js/core/store/estado-editorial-producto.mjs'), load('/js/admin/products/maestro-productos-core.mjs'), load('/js/components/images/utilidades-imagenes.js'),
    ]);
    const rows = new Map(initialRecords); let counter = 0;
    window.qaProductStore = rows; window.qaProductWrites = []; window.qaProductOperations = [];
    const apply = (ref, data) => { rows.set(ref.path, { ...rows.get(ref.path), ...structuredClone(data) }); window.qaProductWrites.push(ref.path); };
    const galleryModule=await load('/js/admin/products/galeria-unificada.js');
    const workspaceModule=workflow?await load('/js/admin/products/espacio-trabajo-producto.js'):{};
    const responseModule=await load('/js/admin/products/respuesta-editor-producto.mjs');
    const uploadModule=await load('/js/components/images/carga-imagenes.js?v=tintin-20261025-gallery-unified-1');
    const deps = {
      ...responseModule,...workspaceModule,...galleryModule,...uploadModule,openMediaLibraryPicker:async()=>window.qaChooseLibraryPhoto?window.qaChooseLibraryPhoto():window.qaLibraryPhoto || null,
      ...inventory, ...commercial, ...commercialUi, ...editorialUi, ...editorial, ...master,
      _allProducts: [], _productSourceById: new Map(), _productInventoryById: new Map(), adminRealtimeReady: { orders: false }, _allCollections: [{ slug: 'qa-tablet', name: 'Colección ficticia' },...initialRecords.filter(([key])=>key.startsWith('collections/')).map(([key,data])=>({slug:key.slice('collections/'.length),name:data.name}))],
      productEditBaseline: null, productCommercialBaseline: null, _formImageWidgets: new Map(),
      productColorPhotos: { serialize: () => [], flush: async () => {} },
      mountFormImageWidget() {}, mountProductColorPhotos() {},
      currentRole: 'superadmin', currentUser: { uid: 'qa-admin' }, auth: { currentUser: { uid: 'qa-admin' } }, db: {},
      can: () => true, roleCanDo: () => true, wristCategory: value => value,
      sanitizeImageUrl: imageUtilities.sanitizeImageUrl,
      UnsavedGuard: { confirmLeave: fn => fn(), track() {}, clear() {} },
      collection: (_db, name) => name,
      doc: (...args) => args.length === 1 ? { id: `qa-product-${++counter}`, path: `products/qa-product-${counter}` } : { id: args[2], path: args[1] + '/' + args[2] },
      serverTimestamp: () => new Date(), deleteField: () => null,
      withAdminSiteChange: fn => fn(), setDoc: async (ref, data) => {
        if (window.qaHoldSave && ref.path.startsWith('products/')) await new Promise(resolve => window.qaReleaseSave = resolve);
        if (window.qaRejectSave) throw new Error('Almacenamiento ficticio sin conexión');
        apply(ref, data);
      },
      runTransaction: async (_db, action) => {
        const writes = [];
        const result = await action({ get: async ref => ({ exists: () => rows.has(ref.path), data: () => structuredClone(rows.get(ref.path)) }), update: (ref, data) => writes.push([ref, data]) });
        for (const args of writes) apply(...args);
        return result;
      },
      authenticatedFetch: async (_url, options) => {
        if(window.qaHtmlResponse)return new Response('<!DOCTYPE html><title>Unavailable</title>',{status:503,headers:{'content-type':'text/html'}});
        if (window.qaRejectSave) return { ok: false, json: async () => ({ ok: false, error: 'Almacenamiento ficticio sin conexión' }) };
        if(window.qaHoldWork && JSON.parse(options.body).action==='saveProductWork')await new Promise(resolve=>window.qaReleaseWork=resolve);
        if(window.qaHoldCommit && JSON.parse(options.body).action==='saveProduct')await new Promise(resolve=>window.qaReleaseCommit=resolve);
        const response = await window.qaCommercialWrite({ request: JSON.parse(options.body), records: [...rows] });
        if (response.ok) { for (const [key, value] of response.records) rows.set(key, value); window.qaProductWrites.push(...response.writes); }
        return { ok: response.ok,status:response.status || (response.ok?200:500), json: async () => response };
      },
      pushProductsToSheets: async () => { return !window.qaFailSync; }, logAudit: async () => {},
      loadProductos() {
        deps._allProducts = [...rows].filter(([key]) => key.startsWith('products/')).map(([key, data]) => ({ ...structuredClone(data), _docId: key.split('/')[1] }));
        deps._productSourceById = new Map(deps._allProducts.map(product => [product._docId, structuredClone(rows.get('products/' + product._docId))]));
        deps._productInventoryById = new Map([...rows].filter(([key]) => key.startsWith('productInventory/')).map(([key, data]) => [key.split('/')[1], structuredClone(data)]));
      },
      runAdminCrudOperation: async config => { try { await config.action({ start() {}, ok() {} }); window.qaProductOperations.push('green'); return { status: 'green' }; } catch (error) { window.qaProductOperations.push(error.message); return { status: 'red' }; } },
    };
    // Original controller and DOM; only identity, storage and external services are fictitious.
    new Function('__deps', `with (__deps) { ${code}\nwindow.prodGuardar = prodGuardar; window.qaProductController = { serializeProductForm,refresh:()=>loadProductos(),get workspace(){return productWorkspace;} }; }`)(deps);
    const category = document.getElementById('prod-category'); category.replaceChildren(new Option('Elegí colección', ''),...deps._allCollections.map(row=>new Option(row.name,row.slug)));
  }, {workflow,initialRecords,code:photos ? source.slice(source.indexOf('const _formImageWidgets = new Map();'),source.indexOf('let productVariantStockBaseline = null;'))+code : code});
  await page.locator('[data-action="product-new"]').click();
  await expect(page.locator('#prod-tab-general')).toBeVisible();
}
async function openOptionAvailability(page,value,attribute='Color',combination=null){
 await page.getByRole('tab',{name:'Precio y stock',exact:true}).click();
 const panel=page.locator('#prod-variant-stock');const search=panel.getByRole('searchbox',{name:'Buscar combinación',exact:true});if(await search.count()){await search.fill(combination || value);await search.press('Tab');}
 const fields=panel.locator('.tt-commercial-row').filter({has:page.locator('legend').filter({hasText:combination || value})});
 if(await fields.count()===1)await fields.scrollIntoViewIfNeeded();
}
module.exports = { openProductSaveFixture,openOptionAvailability };
