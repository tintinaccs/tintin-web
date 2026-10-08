import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const loader=fs.readFileSync(new URL('../../js/cargador-pagina.js',import.meta.url),'utf8');
test('entrada, carga tardía y retorno del navegador empiezan arriba sin animación',()=>{
  const listeners=new Map(), frames=[], calls=[];
  const root={style:{scrollBehavior:'smooth'},scrollTop:540},body={scrollTop:540};
  const c=vm.createContext({history:{scrollRestoration:'auto'},document:{documentElement:root,body,addEventListener:(name,fn)=>listeners.set(name,fn)},window:{scrollTo:(x,y)=>calls.push([x,y,root.style.scrollBehavior]),addEventListener:(name,fn)=>listeners.set(name,fn)},requestAnimationFrame:fn=>frames.push(fn),console});
  vm.runInContext(loader.slice(loader.indexOf("  try { history.scrollRestoration"),loader.indexOf('  // El sitio oficial')),c);
  assert.equal(c.history.scrollRestoration,'manual');
  for(const event of [null,'DOMContentLoaded','load','pageshow']){
    if(event){root.scrollTop=body.scrollTop=700;listeners.get(event)();}
    while(frames.length)frames.shift()();
    assert.equal(root.scrollTop,0);assert.equal(body.scrollTop,0);assert.equal(root.style.scrollBehavior,'smooth');
  }
  assert.ok(calls.length>=8);assert.ok(calls.every(([x,y,behavior])=>x===0&&y===0&&behavior==='auto'));
});

test('enlaces iniciales a pedido o reseña no vuelven a desplazar la página tras hidratar datos',()=>{
  const reviews=fs.readFileSync(new URL('../../js/pages/product/resenas-producto.js',import.meta.url),'utf8');
  assert.ok(!reviews.slice(reviews.indexOf('function highlightDeepLink'),reviews.indexOf('function renderReply')).includes('scrollIntoView'));
  const orders=fs.readFileSync(new URL('../../js/pages/profile/pedidos-perfil.js',import.meta.url),'utf8');
  assert.ok(!orders.includes('scrollIntoView'));
});
