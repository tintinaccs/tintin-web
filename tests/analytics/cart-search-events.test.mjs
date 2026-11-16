import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {safeSearchTerm} from '../../js/analytics/privacidad-busqueda.mjs';
const source=fs.readFileSync(new URL('../../js/analytics/analitica.js',import.meta.url),'utf8');
test('abrir carrito cuenta una vista por apertura; snapshots de Auth no son adiciones',()=>{
 const handlers={},events=[];
 const c=vm.createContext({window:{addEventListener:(name,fn)=>handlers[name]=fn,location:{pathname:'/catalogo'},TintinCartRuntime:{getCartLocal:()=>[{qty:2,price:1000}]}},document:{addEventListener(){}},track:(name,params)=>events.push({name,params}),cartSummary:()=>({quantity:2,value:2000,lines:1}),safeSearchTerm});
 vm.runInContext(source.slice(source.indexOf('function bindCommerceEvents()'),source.indexOf('window.TintinAnalytics =')),c);c.bindCommerceEvents();
 assert.equal(handlers.tt_cart_updated,undefined);
 for(const state of ['opening','open','open'])handlers['tintin:surface-change']({detail:{surface:'cart',state}});
 assert.equal(events.length,1);assert.equal(events[0].name,'view_cart');
 handlers['tintin:surface-change']({detail:{surface:'none'}});
 handlers['tintin:surface-change']({detail:{surface:'cart'}});
 assert.equal(events.length,2);
});
test('sanitizador común impide registrar consultas personales incluso desde otras integraciones',()=>{
 const c=vm.createContext({safeSearchTerm});
 vm.runInContext(source.slice(source.indexOf('const FORBIDDEN_PARAM'),source.indexOf('const ALLOWED_EVENTS'))+source.slice(source.indexOf('function cleanText('),source.indexOf('function onceKey(')),c);
 assert.deepEqual(JSON.parse(JSON.stringify(c.sanitizeParams({search_term:'hola@example.com',email:'oculto',quantity:1}))),{quantity:1});
 assert.equal(c.sanitizeParams({search_term:'cartera beige'}).search_term,'cartera beige');
});
