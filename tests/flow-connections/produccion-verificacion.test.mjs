import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../.github/workflows/monitor-produccion.yml', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const fxJob = source.split('\n  paypal_fx:\n')[1].split('\n  health:\n')[0];
const condition = fxJob.match(/^    if: (.+)$/m)[1];
for (const [name, event, inputs, expected] of [
  ['publicación automática sólo verifica', { event_name: 'workflow_dispatch' }, { verification_only: true }, false],
  ['dispatch manual conserva el refresco', { event_name: 'workflow_dispatch' }, {}, true],
  ['dispatch manual explícito conserva el refresco', { event_name: 'workflow_dispatch' }, { verification_only: false }, true],
  ['push no refresca tasas', { event_name: 'push' }, {}, false],
  ['cron de tasas conserva el refresco', { event_name: 'schedule', event: { schedule: '0 17 * * 1-5' } }, {}, true],
  ['cron de salud no refresca tasas', { event_name: 'schedule', event: { schedule: '17 * * * *' } }, {}, false],
]) test(name, () => {
  assert.equal(vm.runInNewContext(condition, { github: event, inputs }), expected);
});
