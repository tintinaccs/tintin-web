import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {orderAmounts} from '../../js/orders/importes-pedido.mjs';
const bridge=fs.readFileSync('js/pages/checkout/checkout-puente-correo.js','utf8');
const source=fs.readFileSync('js/analytics/analitica.js','utf8');
test('compra local comunica productos como value y delivery como shipping sin alterar identidad de deduplicación',()=>{
 const events=[];const start=bridge.indexOf('  function dispatchSafePurchase('),end=bridge.indexOf('  async function notifyAfterSuccess()',start);
 const dispatch=new Function('orderAmounts','window','CustomEvent','clean',bridge.slice(start,end)+';return dispatchSafePurchase;')(orderAmounts,{dispatchEvent:event=>events.push(event)},class{constructor(type,options){this.type=type;this.detail=options.detail;}},value=>String(value||''));
 dispatch({subtotal:100000,shippingCost:15000,total:115000,items:[{qty:2} ]},'FIXTURE');
 assert.equal(events[0].detail.value,100000);assert.equal(events[0].detail.shipping,15000);assert.equal(events[0].detail.dedupeKey,'FIXTURE');
 dispatch({total:115000},'LEGACY');assert.equal(events[1].detail.value,null);assert.equal(events[1].detail.shipping,null);
});
test('Analytics publica venta y envío separados y no inventa revenue para snapshot incompleto',()=>{
 const start=source.indexOf("  window.addEventListener('tintin:order-created'"),end=source.indexOf("  if (/(?:^|\\/)checkout",start);let listener;const sent=[];
 const numbers=source.slice(source.indexOf('function safeNumber('),source.indexOf('function sanitizeParams('));
 new Function('window','track','cleanText',numbers+source.slice(start,end))({addEventListener:(_name,fn)=>listener=fn},(...args)=>sent.push(args),value=>String(value||''));
 listener({detail:{value:100000,shipping:15000,itemCount:1,quantity:2,dedupeKey:'fixture'}});assert.equal(sent[0][0],'purchase');assert.equal(sent[0][1].value,100000);assert.equal(sent[0][1].shipping,15000);assert.equal(sent[0][1].currency,'PYG');
 listener({detail:{value:null,shipping:null}});assert.equal(Object.hasOwn(sent[1][1],'value'),false);assert.equal(Object.hasOwn(sent[1][1],'shipping'),false);
});
