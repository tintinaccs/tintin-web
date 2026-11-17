import test from 'node:test';import assert from 'node:assert/strict';
import {contextFromLocation,activityContextLabel,normalizeActivityContext,normalizeActivityEvent,activityPeriodDays,checkoutFailureReason} from '../../js/analytics/contexto-actividad.mjs';
test('categoría y paso precisos sin búsqueda, datos privados ni query strings',()=>{
 const c=contextFromLocation({pathname:'/catalogo.html',search:'?cat=relojes&q=persona@example.test&token=secret'});
 assert.equal(activityContextLabel(c),'Catálogo de relojes');assert.equal(JSON.stringify(c).includes('secret'),false);
 assert.equal(activityContextLabel(contextFromLocation({pathname:'/checkout',step:3})),'Checkout · Paso 4 de 5: Pago');
 assert.equal(activityContextLabel(null,'/checkout'),'Checkout');
 assert.deepEqual(normalizeActivityContext({page:'checkout',step:100,email:'private',status:'password'}),{page:'checkout'});
 assert.deepEqual(normalizeActivityContext({page:'catalogo',category:'<script>'}),{page:'catalogo'});
});
test('acciones acotadas por nombre, identidad y fecha sin aceptar texto libre',()=>{
 const now=Date.now(),event={id:'event_12345',at:now,action:'view',context:{page:'index'}};
 assert.ok(normalizeActivityEvent(event,now));assert.equal(normalizeActivityEvent({...event,action:'typed_password'},now),null);
 assert.equal(normalizeActivityEvent({...event,at:now-86400001},now),null);
 assert.equal(checkoutFailureReason('server_timeout'),'network');assert.equal(checkoutFailureReason('insufficient_stock'),'stock');
});
test('día, semana y mes usan períodos completos y fechas reales incluso año bisiesto',()=>{
 assert.deepEqual(activityPeriodDays('day','2026-11-17'),['2026-11-17']);
 const week=activityPeriodDays('week','2026-11-17');assert.equal(week.length,7);assert.equal(week.at(-1),'2026-11-16');
 const month=activityPeriodDays('month','2024-02-10');assert.equal(month.length,29);assert.equal(month[0],'2024-02-29');
 assert.deepEqual(activityPeriodDays('day','2026-02-31'),[]);
});

test('una confirmación sin resultado se distingue de un error demostrado',async()=>{
 const {activityPresenceLabel}=await import('../../js/analytics/contexto-actividad.mjs');
 const now=Date.now();const label=activityPresenceLabel({context:{page:'checkout',step:4,status:'confirming',phase:'server'},contextSince:new Date(now-65000)},now);
 assert.match(label,/Sin resultado registrado hace 1 min/);assert.doesNotMatch(label,/trabado|falló|error/i);
});
