import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../.github/workflows/auditoria-dependencias.yml', import.meta.url), 'utf8');
const block = name => source.split(new RegExp(`^  ${name}:\\n`, 'm'))[1].split(/^  [a-z]+:\n/m)[0];
const permits = (job, github, inputs = {}) => Function('github', 'inputs', `return !!(${block(job).match(/^    if: (.+)$/m)[1]})`)(github, inputs);
const context = event => ({ ref: 'refs/heads/main', repository: 'owner/repo', event_name: 'workflow_run', event });

test('sólo el CI de PRs propias o el mantenimiento manual pueden iniciar el merge', () => {
  const run = { name: 'CI Tintin — contrato único', event: 'pull_request', head_repository: { full_name: 'owner/repo' } };
  assert.equal(permits('automatic', context({ workflow_run: run })), true);
  assert.equal(permits('automatic', context({ workflow_run: { ...run, name: 'Otro workflow' } })), false);
  assert.equal(permits('automatic', context({ workflow_run: { ...run, head_repository: { full_name: 'external/fork' } } })), false);
  assert.equal(permits('automatic', { ...context({ pull_request: { number: 7 } }), event_name: 'pull_request_target' }), false);
  assert.equal(permits('automatic', { ...context({}), event_name: 'schedule' }), false);
  assert.equal(permits('automatic', { ...context({}), event_name: 'workflow_dispatch' }, { maintenance: true }), true);
  assert.equal(permits('automatic', { ...context({}), ref: 'refs/heads/other', event_name: 'workflow_dispatch' }, { maintenance: true }), false);
});

test('los recibos usan sólo código confiable y no se notifican recursivamente', () => {
  assert.equal(permits('notify', context({ workflow_run: { name: 'CI Tintin — contrato único' } })), true);
  assert.equal(permits('notify', context({ workflow_run: { name: source.match(/^name: (.+)$/m)[1] } })), false);
  assert.equal(permits('notify', { ...context({ pull_request: { number: 7 } }), event_name: 'pull_request_target' }), true);
  assert.equal(permits('notify', { ...context({}), event_name: 'schedule' }), false);
  const permissions = Object.fromEntries(block('notify').match(/    permissions:\n((?:      [^\n]+\n)+)/)[1].trim().split('\n').map(line => line.trim().split(/:\s*/)));
  assert.deepEqual(permissions, { contents: 'read', actions: 'read', issues: 'write', 'pull-requests': 'write' });
  assert.ok(block('notify').includes('ref: ${{ github.event.repository.default_branch }}'));
  assert.ok(block('notify').includes('persist-credentials: false'));
});
