import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLiveChecks, buildLiveEdges } from '../../js/admin/flujo-conexiones/live-checks.js';
import { ESTADOS, NODES, EDGES } from '../../js/admin/flujo-conexiones/datos-flujo-conexiones.js';
import { resolveState, liveMarker } from '../../js/admin/flujo-conexiones/estado-flujo.js';

function services(paypal, overrides = {}) {
  const input = { systemHealth: { status: 200, body: { report: { integrations: {
    resend: true, cloudinary: true, paypal, ...overrides,
  } } } } };
  const node = NODES.find(item => item.id === 'servicios-externos');
  const edge = EDGES.find(item => item.from === 'apis-internas' && item.to === 'servicios-externos');
  const nodeLive = buildLiveChecks(input, '2026-10-14T12:00:00Z')[node.id];
  const edgeLive = buildLiveEdges(input, '2026-10-14T12:00:00Z')[edge.id];
  return { nodeLive, states: [resolveState(node, nodeLive, ESTADOS), resolveState(edge, edgeLive, ESTADOS)] };
}

test('PayPal apagado voluntariamente no se presenta como una conexión rota ni como cobros habilitados', () => {
  const result = services({ optionalDisabled: true, enabled: false, configured: false, environment: 'sandbox', productionReady: false });
  assert.deepEqual(result.states, [ESTADOS.PARCIAL, ESTADOS.PARCIAL]);
  assert.match(result.nodeLive.note, /apagado.*opcional/i);
});

test('el nombre sandbox sin credenciales válidas no confirma PayPal', () => {
  const result = services({ enabled: false, configured: false, environment: 'sandbox', productionReady: false, missing: ['client_id'] });
  assert.deepEqual(result.states, [ESTADOS.ERROR, ESTADOS.ERROR]);
  assert.match(result.nodeLive.note, /no configurado/i);
});

test('un fallo de correo o imágenes se identifica aunque PayPal sea opcional', () => {
  for (const key of ['resend', 'cloudinary']) {
    const result = services({ optionalDisabled: true, enabled: false, environment: 'sandbox' }, { [key]: false });
    assert.deepEqual(result.states, [ESTADOS.ERROR, ESTADOS.ERROR]);
    assert.match(result.nodeLive.note, /no configurado/i);
  }
});

test('un acuse ausente o antiguo dice sin confirmar, no que hay una operación en curso', () => {
  assert.equal(liveMarker({ pending: true }, ESTADOS.DOCUMENTADO, ESTADOS).label, 'sin confirmar');
});
