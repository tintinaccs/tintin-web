import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanFinding, cleanJobId, cleanPrompt, featureIsEnabled, publicJob, transitionJob } from '../../cloudflare/desarrollador-ia-core.js';

test('feature flag fails closed', () => {
  assert.equal(featureIsEnabled({}), false);
  assert.equal(featureIsEnabled({ AI_DEVELOPER_ENABLED: 'false' }), false);
  assert.equal(featureIsEnabled({ AI_DEVELOPER_ENABLED: 'true' }), true);
});

test('prompt and finding are bounded', () => {
  assert.throws(() => cleanPrompt('short'));
  assert.equal(cleanPrompt('  corregir el checkout  '), 'corregir el checkout');
  assert.equal(cleanFinding({ title: 'x'.repeat(300) }).title.length, 180);
});

test('job identifiers and transitions reject tampering', () => {
  assert.equal(cleanJobId('ai_123456789012'), 'ai_123456789012');
  assert.throws(() => cleanJobId('../secret'));
  assert.deepEqual(transitionJob('queued', 'analyzing'), { status: 'analyzing', progress: 20, terminal: false });
  assert.throws(() => transitionJob('queued', 'completed'));
});

test('public job never exposes prompt or arbitrary URL', () => {
  const value = publicJob({ id: 'a', prompt: 'secret', prUrl: 'javascript:alert(1)', error: 'x'.repeat(700) });
  assert.equal('prompt' in value, false);
  assert.equal(value.prUrl, '');
  assert.equal(value.error.length, 500);
});
