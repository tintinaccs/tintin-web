import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFileEvidenceGraph,
  classifyCodeRisk,
  isBlockedCodePath,
  makeWorkspaceBranch,
  normalizeBranchName,
  normalizeCodePath,
  requireRecentAuthToken,
  requiresRecentAuth,
  sanitizedAuditPayload,
  validateChanges
} from '../../cloudflare/estudio-codigo-core.js';

test('rechaza traversal, backslash y rutas secretas', () => {
  assert.throws(() => normalizeCodePath('../.env'), /Ruta de archivo inválida|bloqueado/);
  assert.throws(() => normalizeCodePath('js\\admin\\x.js'), /Ruta de archivo inválida/);
  assert.throws(() => normalizeCodePath('.env'), /bloqueado/);
  assert.equal(isBlockedCodePath('node_modules/pkg/index.js'), true);
  assert.equal(normalizeCodePath('js/admin/estudio-codigo/panel.js'), 'js/admin/estudio-codigo/panel.js');
});

test('main nunca es una rama editable', () => {
  assert.throws(() => normalizeBranchName('main'), /inválido|permitido/);
  assert.equal(normalizeBranchName('code-studio/20260820-cambio'), 'code-studio/20260820-cambio');
  assert.match(makeWorkspaceBranch('Checkout seguro'), /^code-studio\/\d{12}-checkout-seguro$/);
});

test('clasifica archivos críticos y exige autenticación reciente', () => {
  assert.equal(classifyCodeRisk('firestore.rules'), 'red');
  assert.equal(classifyCodeRisk('js/core/auth/roles.js'), 'red');
  assert.equal(classifyCodeRisk('functions/api/public-catalog.js'), 'orange');
  assert.equal(classifyCodeRisk('js/pages/catalogo.js'), 'yellow');
  assert.equal(requiresRecentAuth(['README.md', 'firestore.rules']), true);
  assert.equal(requiresRecentAuth(['README.md']), false);
});

test('valida cambios multiarchivo y requiere SHA base para update/delete', () => {
  const sha = 'a'.repeat(40);
  const changes = validateChanges([
    { path: 'js/a.js', operation: 'update', content: 'export const a = 1;', baseSha: sha },
    { path: 'js/b.js', operation: 'create', content: 'export const b = 2;' },
    { path: 'js/c.js', operation: 'delete', baseSha: sha }
  ]);
  assert.equal(changes.length, 3);
  assert.equal(changes[0].baseSha, sha);
  assert.equal(changes[1].baseSha, null);
  assert.throws(() => validateChanges([{ path: 'js/a.js', operation: 'update', content: 'x' }]), /Falta SHA base/);
  assert.throws(() => validateChanges([
    { path: 'js/a.js', operation: 'create', content: '' },
    { path: 'js/a.js', operation: 'create', content: '' }
  ]), /duplicado/);
});

test('mapa solo afirma conexiones que tienen evidencia literal', () => {
  const relativePrefix = String.fromCharCode(46, 46, 47);
  const graph = buildFileEvidenceGraph([
    {
      path: 'js/admin/demo.js',
      content: `import { x } from '${relativePrefix}core/auth/roles.js';\nfetch('/api/health');\ncollection(db, 'orders');\n`
    }
  ]);
  assert.ok(graph.nodes.some(node => node.id === 'js/core/auth/roles.js'));
  assert.ok(graph.nodes.some(node => node.id === '/api/health'));
  assert.ok(graph.nodes.some(node => node.id === 'firestore:orders'));
  assert.ok(graph.edges.every(edge => ['confirmed', 'probable', 'informational'].includes(edge.evidence)));
  assert.ok(graph.edges.some(edge => edge.kind === 'imports' && edge.evidence === 'confirmed'));
  assert.ok(graph.edges.some(edge => edge.kind === 'calls' && edge.target === '/api/health'));
});

test('la aprobación sensible exige auth_time reciente del token ya verificado', () => {
  const token = authTime => `x.${Buffer.from(JSON.stringify({ auth_time: authTime })).toString('base64url')}.y`;
  const now = Math.floor(Date.now() / 1000);
  assert.equal(requireRecentAuthToken(token(now - 30), 600), true);
  assert.throws(() => requireRecentAuthToken(token(now - 900), 600), error => error.code === 'recent_auth_required');
  assert.throws(() => requireRecentAuthToken('inválido', 600), /volver a autenticarte/);
});

test('mapa conecta símbolos, líneas exactas y consolas externas allowlisted', () => {
  const graph = buildFileEvidenceGraph([{
    path: 'js/admin/orders.js',
    content: `export async function loadOrders() {\n  collection(db, 'orders');\n  return fetch('https://github.com/tintinaccs/tintin-web');\n}\n`
  }], {
    firebaseProjectId: 'tintin-accesorios',
    allowedExternalHosts: ['github.com']
  });
  const symbol = graph.nodes.find(node => node.type === 'function' && node.label === 'loadOrders');
  const collection = graph.nodes.find(node => node.id === 'firestore:orders');
  const external = graph.nodes.find(node => node.type === 'external-link');
  assert.equal(symbol.path, 'js/admin/orders.js');
  assert.equal(symbol.line, 1);
  assert.match(collection.url, /^https:\/\/console\.firebase\.google\.com\//);
  assert.equal(external.url, 'https://github.com/tintinaccs/tintin-web');
  assert.ok(graph.edges.some(edge => edge.source === symbol.id && edge.target === collection.id && edge.line === 2));
});

test('mapa baja de archivo a función y conecta llamadas de símbolo sin inventar ambigüedades', () => {
  const graph = buildFileEvidenceGraph([{
    path: 'js/demo.js',
    content: `function helper() { return 1; }\nfunction controller() { return helper(); }\n`
  }]);
  const helper = graph.nodes.find(node => node.label === 'helper');
  const controller = graph.nodes.find(node => node.label === 'controller');
  assert.ok(graph.edges.some(edge => edge.source === 'js/demo.js' && edge.target === controller.id && edge.kind === 'contains'));
  assert.ok(graph.edges.some(edge => edge.source === controller.id && edge.target === helper.id && edge.kind === 'calls-symbol' && edge.evidence === 'probable'));
});

test('auditoría no conserva valores que parezcan secretos', () => {
  const audit = sanitizedAuditPayload({
    actorUid: 'uid123',
    actorEmail: 'ADMIN@EXAMPLE.COM',
    action: 'commit_create',
    files: ['js/a.js'],
    detail: 'token=abc123 secret:xyz authorization=BearerValue'
  });
  assert.equal(audit.actorEmail, 'admin@example.com');
  assert.doesNotMatch(audit.detail, /abc123|xyz|BearerValue/);
  assert.match(audit.detail, /\[redacted\]/);
});
