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

test('navegar durante un bloqueo lleva arriba y cerrar un modal normal conserva su posición',()=>{
 const listeners=new Map(),frames=[];
 const style=()=>({overflow:'',overscrollBehavior:'',position:'',top:'',left:'',right:'',width:'',touchAction:'',scrollBehavior:'smooth'});
 const root={style:style(),scrollTop:0,classList:{add(){},remove(){}}};
 const body={style:style(),scrollTop:0,classList:{add(){},remove(){}}};
 const win={scrollY:0,addEventListener:(name,fn)=>listeners.set(name,fn),scrollTo:(x,y)=>{win.scrollY=y;root.scrollTop=y;}};
 const context=vm.createContext({window:win,history:{},document:{documentElement:root,body,addEventListener:(name,fn)=>listeners.set(name,fn)},documentElement:root,scrollLockCount:0,savedScrollY:0,previousBodyStyle:null,previousHtmlStyle:null,requestAnimationFrame:fn=>frames.push(fn),console});
 vm.runInContext(loader.slice(loader.indexOf("  try { history.scrollRestoration"),loader.indexOf('  // El sitio oficial')),context);
 vm.runInContext(loader.slice(loader.indexOf('  function lockScroll()'),loader.indexOf('  function escText(')),context);
 while(frames.length)frames.shift()();
 win.scrollY=540;root.scrollTop=540;
 win.TintinScrollLock.lock();win.TintinScrollLock.unlock();
 assert.equal(win.scrollY,540);
 win.TintinScrollLock.lock();
 win.TintinPageScroll.reset();
 while(frames.length)frames.shift()();
 assert.equal(body.style.top,'0px');
 win.TintinScrollLock.unlock();
 assert.equal(win.scrollY,0);assert.equal(root.scrollTop,0);
});

test('reinicios coincidentes conservan el estilo de desplazamiento original',()=>{
 const frames=[];
 const root={style:{scrollBehavior:'smooth'},scrollTop:0},body={scrollTop:0};
 const context=vm.createContext({history:{},document:{documentElement:root,body,addEventListener(){}},window:{scrollTo(){},addEventListener(){}},requestAnimationFrame:fn=>frames.push(fn),console});
 vm.runInContext(loader.slice(loader.indexOf("  try { history.scrollRestoration"),loader.indexOf('  // El sitio oficial')),context);
 context.window.TintinPageScroll.reset();context.window.TintinPageScroll.reset();
 while(frames.length)frames.shift()();
 assert.equal(root.style.scrollBehavior,'smooth');
 assert.equal(root.scrollTop,0);assert.equal(body.scrollTop,0);
});
