import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {
  GITHUB_INCIDENT_REPOSITORY,
  GITHUB_INCIDENT_WORKFLOW,
  githubIncidentFromEvent,
  githubIncidentPush,
} from '../../cloudflare/incidentes-github.mjs';

const runId = 45091100022;
const repository = { full_name: GITHUB_INCIDENT_REPOSITORY };
const run = {
  id: runId,
  run_attempt: 1,
  name: 'Salud de producción',
  head_repository: repository,
  head_branch: 'main',
  conclusion: 'failure',
  event: 'schedule',
};

function upstream(overrides) {
  return githubIncidentFromEvent({
    eventName: 'workflow_run',
    event: { repository, workflow_run: { ...run, ...overrides } },
  });
}

test('distingue fallos reales, intentos, forks y cancelaciones obsoletas', () => {
  const incident = upstream();
  const push = githubIncidentPush(incident);
  assert.deepEqual(incident, { runId: String(runId), attempt: '1', workflow: run.name, conclusion: 'failure' });
  assert.match(push.body, /Salud de producción falló/);
  assert.equal(push.tag, push.eventId);
  assert.equal(githubIncidentPush(upstream()).eventId, push.eventId);
  assert.notEqual(githubIncidentPush(upstream({ run_attempt: 2 })).eventId, push.eventId);
  assert.ok(upstream({ head_branch: 'pr', event: 'pull_request', conclusion: 'timed_out' }));
  assert.ok(upstream({ conclusion: 'cancelled' }));
  for (const change of [
    { conclusion: 'success' },
    { name: GITHUB_INCIDENT_WORKFLOW },
    { head_repository: { full_name: 'fork/tintin-web' } },
    { head_branch: 'pr', event: 'pull_request', conclusion: 'cancelled' },
    { id: '12?payload=42' },
  ]) {
    assert.equal(upstream(change), null);
  }
});

test('un fallo propio de protección usa la identidad de la ejecución del mantenedor', () => {
  const event = { eventName: 'workflow_dispatch', runId, attempt: 2 };
  assert.equal(githubIncidentFromEvent({ ...event, jobResults: ['skipped', 'success'] }), null);
  assert.deepEqual(githubIncidentFromEvent({ ...event, jobResults: ['skipped', 'failure'] }), {
    runId: String(runId), attempt: '2', workflow: GITHUB_INCIDENT_WORKFLOW, conclusion: 'failure',
  });
});

test('el clic del aviso abre el run exacto y conserva enlaces de pedidos', async () => {
  const listeners = new Map();
  const windows = [];
  const context = {
    URL, URLSearchParams,
    importScripts() {},
    firebase: { initializeApp() {}, messaging: () => ({ onBackgroundMessage() {} }) },
    self: {
      location: { origin: 'https://tintinaccs.com' },
      addEventListener: (type, listener) => listeners.set(type, listener),
      clients: { matchAll: async () => [], openWindow: async link => windows.push(link) },
    },
  };
  vm.runInNewContext(readFileSync('firebase-messaging-sw.js', 'utf8'), context);
  const follow = url => new Promise(resolve => listeners.get('notificationclick')({
    notification: { data: { url }, close() {} },
    waitUntil: resolve,
  }));

  await follow(githubIncidentPush(upstream()).url);
  await follow('/admin.html?section=pedidos&orderId=fixture');
  await follow('https://untrusted.invalid/action');
  assert.deepEqual(windows, [
    `https://github.com/${GITHUB_INCIDENT_REPOSITORY}/actions/runs/${runId}`,
    'https://tintinaccs.com/admin.html?section=pedidos&orderId=fixture',
    'https://tintinaccs.com/admin.html?section=pedidos',
  ]);
});
