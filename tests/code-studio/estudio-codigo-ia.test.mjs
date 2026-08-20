import test from 'node:test';
import assert from 'node:assert/strict';

import { parseStructuredProposal } from '../../cloudflare/estudio-codigo-ia.js';

const sha = 'a'.repeat(40);
const files = [{ path: 'js/demo.js', sha, content: 'export const value = 1;\n' }];

test('convierte una respuesta IA estructurada en updates completos con SHA base', () => {
  const proposal = parseStructuredProposal(JSON.stringify({
    summary: 'Actualiza el valor.',
    diagnosis: ['El valor está desactualizado.'],
    impact: ['Afecta el módulo demo.'],
    tests: ['Ejecutar la prueba demo.'],
    rollback: 'Revertir el commit.',
    changes: [{ path: 'js/demo.js', content: 'export const value = 2;\n' }]
  }), files);
  assert.equal(proposal.changes.length, 1);
  assert.equal(proposal.changes[0].baseSha, sha);
  assert.equal(proposal.changes[0].operation, 'update');
});

test('ignora archivos inventados y respuestas sin JSON no modifican buffers', () => {
  const invented = parseStructuredProposal(JSON.stringify({ changes: [{ path: 'js/no-existe.js', content: 'x' }] }), files);
  const prose = parseStructuredProposal('No hay evidencia suficiente.', files);
  assert.deepEqual(invented.changes, []);
  assert.deepEqual(prose.changes, []);
  assert.match(prose.summary, /evidencia/);
});
