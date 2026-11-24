import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {parse}=createRequire(import.meta.url)('parse5');
import {visibleCatalog,renderCatalogHtml} from '../../cloudflare/catalogo-publico-seo.mjs';
import {interfaceLabel, sentenceCase} from '../../js/core/store/texto-interfaz.mjs';
import {productStructuredData} from '../../js/core/store/datos-producto-seo.mjs';
import {renderProductMetadataHtml} from '../../functions/product.js';

const source = fs.readFileSync(new URL('../../catalogo.html',import.meta.url),'utf8');
const products = Array.from({length:105}, (_,i) => ({id:'p'+i,data:{name:'Reloj '+i,category:'relojes',price:150000,stock:i===0?0:2,active:true,sku:i===0?'000-42':''}}));
const catalog = visibleCatalog([...products,{id:'hidden',data:{name:'Secreto',category:'privada',price:1,active:true}},{id:'draft',data:{name:'Borrador',category:'relojes',price:1,publicationStatus:'draft'}}], [{id:'relojes',data:{name:'Relojes'}}]);
function elements(html) {
 const all=[];function walk(node){if(node.tagName)all.push(node);for(const child of node.childNodes||[])walk(child);}walk(parse(html));return all;
}
function attr(node,name){return node.attrs?.find(attr=>attr.name===name)?.value;}

test('HTML inicial de categoría tiene productos, enlaces a páginas siguientes y canonical propio',()=>{
 const result=renderCatalogHtml(source,new URL('https://tintinaccs.com/catalogo?cat=relojes&page=2'),catalog);
 assert.equal(result.status,200);assert.equal(result.noindex,false);
 const nodes=elements(result.html);
 assert.equal(nodes.filter(node=>attr(node,'class')==='tt-card').length,48);
 assert.equal(nodes.filter(node=>node.tagName==='h1').length,1);
 const description=attr(nodes.find(node=>attr(node,'name')==='description'),'content');
 assert.match(description,/Elegí tu reloj/);
 assert.equal(nodes.find(node=>attr(node,'id')==='cat-subtitulo').childNodes[0].value,'Descubrí todos nuestros accesorios');
 assert.ok(result.html.includes('tt-catalog-jsonld'));
 assert.equal(attr(nodes.find(node=>attr(node,'rel')==='canonical'),'href'),'https://tintinaccs.com/catalogo?cat=relojes&page=2');
 assert.ok(nodes.some(node=>attr(node,'href')==='https://tintinaccs.com/catalogo?cat=relojes&page=3'));
 assert.ok(nodes.some(node=>attr(node,'href')?.startsWith('/product?id=')));
 assert.equal(nodes.some(node=>attr(node,'data-product-id')==='hidden'),false);
});

test('búsqueda y filtros son noindex; medición conserva canonical; desconocidos y paginación imposible son 404',()=>{
 for(const query of ['q=reloj','stock=1','sort=precio-asc','color=dorado'])assert.equal(renderCatalogHtml(source,new URL('https://tintinaccs.com/catalogo?'+query),catalog).noindex,true);
 assert.equal(renderCatalogHtml(source,new URL('https://tintinaccs.com/catalogo?cat=relojes&utm_source=instagram'),catalog).noindex,false);
 for(const query of ['cat=privada','cat=ausente','cat=relojes&page=4','page=0','page=nan'])assert.equal(renderCatalogHtml(source,new URL('https://tintinaccs.com/catalogo?'+query),catalog).status,404,query);
 assert.equal(catalog.products.length,105);
});

test('las páginas de resultados conservan título, filtros y URLs canónicas durante la hidratación',()=>{
 const result=renderCatalogHtml(source,new URL('https://tintinaccs.com/catalogo?cat=relojes&q=reloj&sort=precio-asc&page=2'),catalog);
 assert.equal(result.status,200);assert.equal(result.noindex,true);
 const nodes=elements(result.html);
 assert.equal(nodes.find(node=>node.tagName==='title').childNodes[0].value,'Relojes para mujer en Paraguay · Página 2 | Tintin Accesorios & Relojes');
 assert.equal(attr(nodes.find(node=>attr(node,'rel')==='canonical'),'href'),'https://tintinaccs.com/catalogo?cat=relojes&page=2');
 assert.equal(attr(nodes.find(node=>attr(node,'name')==='robots'),'content'),'noindex, follow');
 const pagination=nodes.find(node=>node.tagName==='nav'&&attr(node,'aria-label')==='Páginas del catálogo');
 const pageLink=pagination.childNodes.find(node=>node.tagName==='a'&&attr(node,'aria-current')!=='page');
 const pageUrl=new URL(attr(pageLink,'href'));
 assert.equal(pageUrl.searchParams.get('cat'),'relojes');
 assert.equal(pageUrl.searchParams.get('q'),'reloj');
 assert.equal(pageUrl.searchParams.get('sort'),'precio-asc');
 assert.equal(pageUrl.searchParams.get('page') || '1','1');
});

test('ofertas muestran PYG, referencia real, vendedor separado y bajo pedido explícito',()=>{
 const product={id:'p',name:'Bolso',category:'bolsos',price:200000,stock:1,sku:'00042',description:'Autenticidad: Imitación no original con logotipo. Producto bajo pedido.'};
 const schema=productStructuredData(product);
 assert.equal(schema.sku,'00042');assert.equal(schema.brand,undefined);assert.equal(schema.offers.priceCurrency,'PYG');
 assert.equal(schema.offers.availability,'https://schema.org/PreOrder');
 assert.equal(schema.offers.seller['@id'],'https://tintinaccs.com/#organization');
 assert.equal(productStructuredData({...product,stock:0}).offers.availability,'https://schema.org/OutOfStock');
 const rendered=renderProductMetadataHtml(fs.readFileSync(new URL('../../product.html',import.meta.url),'utf8'),'p',product).html;
 assert.match(rendered,/Bajo pedido · sujeto a confirmación/);assert.match(rendered,/Imitación no original/);assert.match(rendered,/tt-product-breadcrumbs/);
 assert.ok(elements(rendered).some(node=>attr(node,'href')==='/envios'));
});

test('la ficha muestra descripción y características sin el apartado de envío adicional', () => {
 const product = {name:'Anillo', price:50000, stock:1, description:'Anillo con cristal',
   material:'Acero inoxidable', sizeFit:'Ajustable', care:'Evitar perfumes'};
 const source = fs.readFileSync(new URL('../../product.html', import.meta.url), 'utf8');
 const {html} = renderProductMetadataHtml(source, 'anillo', product);
 assert.doesNotMatch(html, /id="product-server-fulfilment"|Ver condiciones de envío|Consultar disponibilidad/);
 assert.match(html, /Anillo con cristal/);
 assert.ok(elements(html).some(node => attr(node, 'id') === 'product-specifications'));
 assert.equal(productStructuredData(product).material, 'Acero inoxidable');
});

test('ProductGroup usa identidad estable y no inventa SKUs de las variantes',()=>{
 const schema=productStructuredData({id:'v2',name:'Anillo',price:100,variantCommerceVersion:2,variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'gold',attributes:{Color:'Dorado'},stock:2,price:150},{variant:'silver',attributes:{Color:'Plateado'},stock:0,price:200}],variantMedia:[{Color:'Dorado',imageUrl:'https://example.test/gold.jpg'},{Color:'Plateado',imageUrl:'https://example.test/silver.jpg'}]});
 assert.equal(schema['@type'],'ProductGroup');assert.equal(schema.productGroupID,'v2');
 assert.equal(schema.hasVariant[0].offers.price,'150');assert.equal(schema.hasVariant[1].offers.availability,'https://schema.org/OutOfStock');
 assert.equal(schema.hasVariant[0].sku,undefined);
 assert.deepEqual(schema.hasVariant.map(variant=>variant.image[0]),['https://example.test/gold.jpg','https://example.test/silver.jpg']);
});


test('HTML de ficha conserva el precio base para variantes sin sobreprecio',()=>{
 const product={id:'v2',name:'Anillo',price:100,variantCommerceVersion:2,variants:{Color:['Dorado','Plateado']},variantInventory:[{variant:'gold',attributes:{Color:'Dorado'},stock:2,price:150},{variant:'silver',attributes:{Color:'Plateado'},stock:2}]};
 const html=renderProductMetadataHtml(fs.readFileSync(new URL('../../product.html',import.meta.url),'utf8'),'v2',product).html;
 const schemas=elements(html).filter(node=>attr(node,'type')==='application/ld+json').map(node=>JSON.parse(node.childNodes.map(child=>child.value||'').join('')));
 const group=schemas.find(schema=>schema['@type']==='ProductGroup');
 assert.deepEqual(group.hasVariant.map(variant=>variant.offers.price),['150','100']);
});


test('los textos de interfaz conservan tildes, marcas, siglas y códigos', () => {
  assert.equal(interfaceLabel('MÁS INFORMACIÓN.'), 'Más información');
  assert.equal(interfaceLabel('CONTACTANOS POR WHATSAPP.'), 'Contactanos por WhatsApp');
  assert.equal(interfaceLabel('CÓDIGO QR ABC-123'), 'Código QR ABC-123');
  assert.equal(interfaceLabel('¿Cómo llego a San Lorenzo?'), '¿Cómo llego a San Lorenzo?');
  assert.equal(sentenceCase('ACERO INOX.'), 'Acero INOX.');
});
