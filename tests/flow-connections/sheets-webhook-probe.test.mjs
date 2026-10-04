import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS, EDGES, NODES } from '../../js/admin/flujo-conexiones/datos-flujo-conexiones.js';
import { resolveState } from '../../js/admin/flujo-conexiones/estado-flujo.js';
import {
  PRODUCTS_WEBHOOK_EXPECTED_REVISION,
  buildLiveChecks,
  buildLiveEdges,
  classifySheetsWebhookProbe,
} from '../../js/admin/flujo-conexiones/live-checks.js';
import { PRODUCTS_WEBHOOK_REVISION } from '../../functions/api/sheets-products-webhook.js';

const at = '2026-10-03T00:00:00.000Z';
const node = NODES.find(item => item.id === 'sheets-products-webhook');
const edge = EDGES.find(item => item.from === 'apps-script' && item.to === 'sheets-products-webhook');
const run = sheetsWebhook => ({
  live: buildLiveChecks({ protectedProbes: { sheetsWebhook } }, at)['sheets-products-webhook'],
  edge: buildLiveEdges({ protectedProbes: { sheetsWebhook } }, at)[edge.id],
});

test('el panel espera la misma revisión que publica el webhook', () => {
  assert.equal(PRODUCTS_WEBHOOK_EXPECTED_REVISION, PRODUCTS_WEBHOOK_REVISION);
});

test('401 por falta de secreto con la revisión esperada es parcial: guard vivo, escritura no probada', () => {
  const { live, edge: liveEdge } = run({ status: 401, revision: PRODUCTS_WEBHOOK_REVISION, authState: 'missing-header' });
  assert.equal(live.ok, true);
  assert.equal(live.promote, false);
  assert.equal(resolveState(node, live, ESTADOS), ESTADOS.PARCIAL);
  assert.equal(liveEdge.promote, false);
  assert.equal(resolveState(edge, liveEdge, ESTADOS), ESTADOS.PARCIAL);
  assert.match(live.note, /escritura Sheets → Firestore no probada/);
});

test('sin secreto configurado en el servidor es error, aunque responda 401', () => {
  const { live } = run({ status: 401, revision: PRODUCTS_WEBHOOK_REVISION, authState: 'server-secret-missing' });
  assert.equal(live.ok, false);
  assert.equal(resolveState(node, live, ESTADOS), ESTADOS.ERROR);
});

test('una revisión distinta desplegada es error', () => {
  const { live } = run({ status: 401, revision: 'products-canonical-v2', authState: 'missing-header' });
  assert.equal(resolveState(node, live, ESTADOS), ESTADOS.ERROR);
});

test('aceptar un POST sin secreto es error, nunca verde', () => {
  const { live } = run({ status: 200, revision: PRODUCTS_WEBHOOK_REVISION, authState: 'authenticated' });
  assert.equal(live.ok, false);
  assert.equal(resolveState(node, live, ESTADOS), ESTADOS.ERROR);
});

test('sin respuesta o con límite de tasa queda no verificado', () => {
  for (const status of [0, 429]) {
    const { live } = run({ status, revision: '', authState: '' });
    assert.equal(resolveState(node, live, ESTADOS), ESTADOS.NO_VERIFICADO, `HTTP ${status}`);
  }
});

test('sin sonda no se inventa evidencia', () => {
  assert.equal(classifySheetsWebhookProbe(null), null);
  assert.equal(run(null).live, undefined);
});

test('GET diagnóstico confirma configuración sin ejecutar POST ni simular una escritura', () => {
  const {live}=run({status:200,revision:PRODUCTS_WEBHOOK_REVISION,authState:'configured'});
  assert.equal(live.ok,true);
  assert.equal(resolveState(node,live,ESTADOS),ESTADOS.PARCIAL);
  assert.match(live.note,/GET diagnóstico/);
});
