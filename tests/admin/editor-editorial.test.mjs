import test from 'node:test';
import assert from 'node:assert/strict';
import {editorialFields,productIsPublished,productTemplate} from '../../js/core/store/estado-editorial-producto.mjs';
import {hasPublicProductFields} from '../../js/core/store/publicacion-producto.mjs';
import {productStatistics} from '../../js/admin/statistics/estadisticas-producto.mjs';
const p={id:'x',name:'Anillo',category:'anillos',price:30000,active:true,stock:0};
test('estado y stock son independientes; borradores y archivados no son públicos aunque active esté desactualizado',()=>{
 assert.equal(hasPublicProductFields(p),true);
 for(const publicationStatus of ['draft','archived']){assert.equal(productIsPublished({...p,publicationStatus}),false);assert.equal(hasPublicProductFields({...p,publicationStatus}),false);}
 assert.equal(productIsPublished({...p,publicationStatus:'active',active:false}),false);
});
test('SEO vacío hereda y sólo se admiten plantillas/estados definidos',()=>{
 assert.deepEqual(editorialFields({publicationStatus:'draft',productTemplate:'gallery',seoTitle:'',seoDescription:''}),{publicationStatus:'draft',active:false,productTemplate:'gallery',seoTitle:'',seoDescription:''});
 assert.equal(productTemplate({productTemplate:'script'}),'default');
 assert.throws(()=>editorialFields({publicationStatus:'unlisted'}));
 assert.throws(()=>editorialFields({publicationStatus:'active',productTemplate:'default',seoTitle:'<script>',seoDescription:''}));
});
test('estadísticas separan homónimos, variantes, pruebas, reembolsos y cancelaciones; no inventan importes',()=>{
 const order={id:'order1',status:'entregado',paymentStatus:'pagado',createdAt:'2026-10-20',items:[{id:'x',variantKey:'oro-id',variant:'Oro',qty:2,price:30000},{id:'y',name:'Anillo',qty:10,price:10}]};
 const orders=[order,{...order,id:'order2',status:'cancelado'},{...order,id:'order3',paymentStatus:'reembolsado'},{...order,id:'order4',paymentStatus:'pendiente'},{...order,id:'TINPEDPRUEBA01'},{...order,id:'order5',items:[{id:'x',qty:1,price:undefined}]}];
 const result=productStatistics('x',orders,value=>new Date(value).getTime());
 assert.equal(result.units,2);assert.equal(result.revenue,60000);assert.equal(result.orders,1);assert.equal(result.incomplete,1);assert.equal(result.variants[0].key,'oro-id');assert.equal(result.months.length,1);
});

test('SEO editable llega a title, descripción y Open Graph sin cambiar canonical ni precio',async()=>{
 const {renderProductMetadataHtml}=await import('../../functions/product.js');
 const fs=await import('node:fs');
 const {html}=renderProductMetadataHtml(fs.readFileSync('product.html','utf8'),'fixture',{name:'Anillo',category:'anillos',price:30000,active:true,seoTitle:'Regalo Tintin',seoDescription:'Acero para todos los días.'});
 assert.match(html,/<title>Regalo Tintin<\/title>/);assert.match(html,/<meta property="og:title" content="Regalo Tintin"/);assert.match(html,/Acero para todos los días/);assert.match(html,/https:\/\/tintinaccs.com\/product\?id=fixture/);
});

test('los estados desconocidos permanecen ocultos aunque active sea true',()=>{
 for(const publicationStatus of ['unknown','',null,0]) {
  assert.equal(productIsPublished({...p,publicationStatus}),false);
  assert.equal(hasPublicProductFields({...p,publicationStatus}),false);
 }
 assert.equal(productIsPublished(p),true);
});

test('desactivar un producto archivado conserva el archivo; activarlo es explícito',async()=>{
 const {productBulkPatch}=await import('../../js/admin/products/maestro-productos-core.mjs');
 const archived={...p,publicationStatus:'archived',active:false};
 assert.equal(productBulkPatch(archived,'active',false).publicationStatus,'archived');
 assert.equal(productBulkPatch(archived,'active',true).publicationStatus,'active');
});

test('abrir y guardar el formulario real no publica un producto oculto por el indicador legacy',async()=>{
 const fs=await import('node:fs'),vm=await import('node:vm');
 const {productEditorialStatus}=await import('../../js/core/store/estado-editorial-producto.mjs');
 const source=fs.readFileSync('js/admin/admin-app.js','utf8');
 const fields=Object.fromEntries(['publicationStatus','productTemplate','seoTitle','seoDescription'].map(key=>[`prod-${key}`,{value:'',options:[],querySelector:()=>null,add:()=>{}}]));
 const context=vm.createContext({Option:function(text,value){this.value=value;},document:{getElementById:id=>fields[id]},ensureEditorialFields(){},productEditorialStatus,productTemplate,editorialFields});
 vm.runInContext(source.slice(source.indexOf('function productEditorialForm('),source.indexOf('function renderProductStatistics(')),context);
 for(const [publicationStatus,active,expected] of [['active',false,undefined],['archived',false,'archived'],['active',true,'active'],['draft',true,'draft']]){
  context.product={publicationStatus,active};
  const saved=vm.runInContext('productEditorialForm(product); productEditorialData()',context);
  assert.equal(saved.publicationStatus,expected);assert.equal(saved.active,expected==='active');
 }
});

import {productSuggestionProfile} from '../../js/admin/products/sugerencias-producto-core.mjs';
test('categoría explícita prevalece sobre nombre ambiguo',()=>{
 assert.equal(productSuggestionProfile({category:'Carteras',name:'Pulsera Luna'}).type,'cartera');
});
for(const [category,type] of [['Pulseras','pulsera'],['Brazaletes','pulsera'],['Carteras','cartera'],['Aros','aros'],['Relojes','reloj'],['Collares','collar'],['Anillos','anillo']])test(`sugerencias locales pertinentes: ${category}`,()=>{
 const result=productSuggestionProfile({category});assert.equal(result.type,type);assert.ok(result.care.length);assert.match(result.warrantyReview,/Confirmar|Revisar/);
 assert.doesNotMatch(JSON.stringify(result),/de por vida|impermeable|hipoalerg|30 días|6 meses/);
});
test('material sólo afecta sugerencias al estar informado',()=>{
 assert.equal(productSuggestionProfile({category:'Aros'}).care.length,1);
 assert.match(productSuggestionProfile({material:'Plata 925'}).care[1],/plata/);
 assert.match(productSuggestionProfile({material:'Baño de oro'}).care[1],/baño/);
 assert.match(productSuggestionProfile({material:'Acero inoxidable'}).care[1],/secar/);
});
test('producto desconocido conserva alternativa manual sin inventar clasificación',()=>{
 assert.equal(productSuggestionProfile({name:'Objeto nuevo'}).type,'producto');
 assert.equal(productSuggestionProfile({name:'Carolina'}).type,'producto');
 assert.equal(productSuggestionProfile({category:'Reloj'}).type,'reloj');
 assert.equal(productSuggestionProfile({category:'Collar'}).type,'collar');
});
