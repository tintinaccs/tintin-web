import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../../functions/api/sheets-products-webhook.js';
import { buildLiveChecks, buildLiveEdges } from '../../js/admin/flujo-conexiones/live-checks.js';
import { ESTADOS, EDGES, NODES } from '../../js/admin/flujo-conexiones/datos-flujo-conexiones.js';
import { resolveState } from '../../js/admin/flujo-conexiones/estado-flujo.js';
test('GET devuelve solo metadatos públicos y nunca el secreto',async()=>{
  const secret='fixture-secret-do-not-return';
  const response=onRequestGet({request:new Request('https://tintinaccesorios.pages.dev/api/sheets-products-webhook'),env:{SHEETS_ENGAGEMENT_SECRET:secret}});
  assert.equal(response.status,200);const raw=await response.text();assert.ok(!raw.includes(secret));
  assert.deepEqual(JSON.parse(raw),{ok:true,revision:'products-canonical-v3',authState:'configured',destructive:false});
});
test('GET declara configuración ausente sin exponer datos ni realizar escrituras',async()=>{
  const response=onRequestGet({request:new Request('https://tintinaccesorios.pages.dev/api/sheets-products-webhook'),env:{}});
  assert.equal(response.status,200);assert.equal((await response.json()).authState,'server-secret-missing');
});
test('PayPal sandbox es parcial: Resend y Cloudinary sanos no quedan como error ni cobros live',()=>{
  const input={systemHealth:{status:200,body:{report:{integrations:{resend:true,cloudinary:true,paypal:{environment:'sandbox',productionReady:false}}}}}};
  const nodes=buildLiveChecks(input,'fixture');const edges=buildLiveEdges(input,'fixture');
  assert.equal(resolveState(NODES.find(n=>n.id==='servicios-externos'),nodes['servicios-externos'],ESTADOS),ESTADOS.PARCIAL);
  const edge=EDGES.find(e=>e.from==='apis-internas'&&e.to==='servicios-externos');
  assert.equal(resolveState(edge,edges[edge.id],ESTADOS),ESTADOS.PARCIAL);
  input.systemHealth.body.report.integrations.resend=false;
  assert.equal(resolveState(NODES.find(n=>n.id==='servicios-externos'),buildLiveChecks(input,'fixture')['servicios-externos'],ESTADOS),ESTADOS.ERROR);
});
