import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, normalizeWorkspaceLayout } from '../../js/admin/appearance/workspace-splitters.js';

test('el layout de Apariencia limita los tres paneles a tamaños utilizables', () => {
  assert.deepEqual(normalizeWorkspaceLayout({ previewRatio: 0.05, sidebarWidth: 80 }), {
    previewRatio: 0.3,
    sidebarWidth: 220,
  });
  assert.deepEqual(normalizeWorkspaceLayout({ previewRatio: 0.95, sidebarWidth: 900 }), {
    previewRatio: 0.72,
    sidebarWidth: 520,
  });
  assert.equal(clamp(0.56, 0.3, 0.72), 0.56);
});

test('el layout de Apariencia recupera valores seguros si la preferencia está dañada', () => {
  assert.deepEqual(normalizeWorkspaceLayout({ previewRatio: 'error', sidebarWidth: null }), {
    previewRatio: 0.56,
    sidebarWidth: 300,
  });
});
