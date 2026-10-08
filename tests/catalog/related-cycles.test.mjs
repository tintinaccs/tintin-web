import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../js/pages/product/productos-relacionados.js',import.meta.url),'utf8');
function harness(products) {
  const grid = { innerHTML:'', setAttribute(){}, closest(){return {hidden:false};}, querySelectorAll(){return [];} };
  const button = { addEventListener() {}, classList:{add(){},remove(){}} };
  const window = { PRODUCTS:products, location:{href:'https://example.com/product?id=main',search:'?id=main'}, matchMedia:()=>({matches:true}), requestAnimationFrame:fn=>fn(), addEventListener(){}, setTimeout, renderProductCardMarkup:p=>p.id };
  vm.runInNewContext(source,{window,document:{getElementById:id=>id==='related-grid'?grid:id==='related-refresh'?button:null},URL,URLSearchParams,sessionStorage:{getItem:()=>null,setItem(){}},MutationObserver:class {observe(){}},console});
  return window;
}
const product = (id,category) => ({id,category,name:id,price:100,stock:1});
test('fila de tres colecciones distintas y sin repetición hasta agotar el ciclo',async()=>{
  const products=[product('main','aros'),...['collares','pulseras','anillos','bags','earcuff','tobilleras'].map((c,i)=>product(`p${i}`,c)),product('same','aros')];
  const win=harness(products);
  const first=win.TintinRelatedProducts.getVisible();
  assert.equal(first.length,3); assert.equal(new Set(first.map(p=>p.category)).size,3);
  assert(!first.some(p=>p.category==='aros'));
  await win.TintinRelatedProducts.refresh();
  const second=win.TintinRelatedProducts.getVisible();
  assert.equal(second.length,3);
  assert.equal(new Set([...first,...second].map(p=>p.id)).size,6);
  await win.TintinRelatedProducts.refresh();
  assert.equal(win.TintinRelatedProducts.getVisible().length,3);
});
test('colecciones desiguales agotan cada producto sin rellenar con duplicados',async()=>{
  const products=[product('main','aros'),product('a','collares'),product('b','pulseras'),product('c','anillos'),product('d','anillos'),product('e','anillos')];
  const win=harness(products);const seen=new Set();
  for(let i=0;i<3;i++) {
    const row=win.TintinRelatedProducts.getVisible();
    assert.equal(new Set(row.map(p=>p.category)).size,row.length);
    for(const p of row){assert(!seen.has(p.id));seen.add(p.id);}
    if(i<2)await win.TintinRelatedProducts.refresh();
  }
  assert.equal(seen.size,5);
});
test('stock ocultado o eliminado se retira y datos actualizados permanecen canónicos',()=>{
  const win=harness([product('main','aros'),product('a','collares'),product('b','pulseras'),product('c','anillos')]);
  win.PRODUCTS=[product('main','aros'),{...product('b','pulseras'),price:200}, {...product('c','anillos'),stock:0}];
  win.TintinRelatedProducts.sync();
  assert.deepEqual(Array.from(win.TintinRelatedProducts.getVisible(),p=>p.id),['b']);
});
