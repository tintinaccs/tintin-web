import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { hasProductStock } from '../../js/core/store/inventario-variantes.mjs';
const source = fs.readFileSync(new URL('../../tienda.js', import.meta.url), 'utf8');
const context = vm.createContext({ URL, Map, window: { location: { href: 'https://example.test/catalogo' } },
 document: { addEventListener() {} }, isInStock: hasProductStock, sanitizeClassicImageUrl: x => x || '', getProductImage: () => '',
 escapeHtml: String, escapeAttribute: String, heartIconMarkup: () => '', priceMarkup: p => String(p.price) });
vm.runInContext(fs.readFileSync(new URL('../../js/components/images/galeria-producto.js', import.meta.url), 'utf8'), context);
vm.runInContext(source.slice(source.indexOf('function productVariantGroups'),source.indexOf('function _pdGetSelectedVariant')), context);
vm.runInContext(source.slice(source.indexOf('const cardColorSelections'),source.indexOf('function renderProductsGrid')), context);
const product = () => ({id:'p',name:'Aros',stock:2,imageUrl:'https://example.test/gold.jpg',price:100,
 variants:{Color:['Dorado','Plateado']}, variantInventory:[{variant:'Dorado',stock:0},{variant:'Plateado',stock:2}],
 variantMedia:[{Color:'Dorado',imageUrl:'https://example.test/gold.jpg'},{Color:'Plateado',imageUrl:'https://example.test/silver.jpg'}]});
const policy = fs.readFileSync(new URL('../../js/pages/catalog/politica-exhibicion-catalogo.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
vm.runInContext(policy, vm.createContext({ window: context.window, hasProductStock }));
function mainImage(p) { return context.renderProductCardMarkup(p).match(/<img src="([^"]+)"/)[1]; }
test('catálogo y colecciones muestran el plateado con stock aunque la portada sea dorada', () => {
 const p=product(); assert.equal(mainImage(p),'https://example.test/silver.jpg');
 const html=context.renderProductCardMarkup(p);
 assert.match(html,/data-card-color="Dorado"[^>]*disabled aria-disabled="true"/);
 assert.match(html,/href="\/product\?id=p&color=Plateado"/);
});
test('al agotarse el color recordado se cambia a una opción disponible tras repintar', () => {
 vm.runInContext("cardColorSelections.set('p','Dorado')",context);
 assert.equal(mainImage(product()),'https://example.test/silver.jpg');
 const p=product();p.variantInventory=[{variant:'Dorado',stock:2},{variant:'Plateado',stock:0}];
 vm.runInContext("cardColorSelections.set('p','Plateado')",context);
 assert.equal(mainImage(p),'https://example.test/gold.jpg');
});
test('sin stock en ninguna opción queda al final y con el cartel AGOTADO', () => {
 const p=product();p.stock=0;p.variantInventory.forEach(row=>row.stock=0);
 const available={...product(),id:'available'};
 assert.deepEqual(Array.from(context.window.TintinCatalogMerchandising.sortCatalogProducts([p,available]),p=>p.id),['available','p']);
 assert.match(context.renderProductCardMarkup(p),/tt-stock-label" aria-hidden="true" >AGOTADO/);
});
