import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertCIResults, requiredStages } from '../../scripts/ci-result.mjs';

test('el gate final rechaza fallos, cancelaciones, omisiones y resultados ausentes', () => {
  const success = Object.fromEntries(requiredStages.map(name => [name, { result: 'success' }]));
  assert.doesNotThrow(() => assertCIResults(success));
  for (const name of requiredStages) {
    for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
      const candidate = structuredClone(success);
      candidate[name] = { result };
      assert.throws(() => assertCIResults(candidate), new RegExp(name));
    }
  }
  assert.throws(() => assertCIResults({}));
});

test('las fases conservan exactamente todos los componentes de audit:final', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const plan = JSON.parse(fs.readFileSync('config/ci-stages.json', 'utf8'));
  const assigned = Object.values(plan).flatMap(group => group.audits.map(name => `npm run ${name}`));
  assert.deepEqual(assigned.sort(), pkg.scripts['audit:final'].split(' && ').sort());
});

test('los comandos de CI no pueden aprobar una suite inexistente con cero pruebas', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const plan = JSON.parse(fs.readFileSync('config/ci-stages.json', 'utf8'));
  const seen = new Set();
  function check(command) {
    if (seen.has(command)) return;
    seen.add(command);
    for (const match of command.matchAll(/npm run ([\w:-]+)/g)) {
      assert.ok(pkg.scripts[match[1]], `Script inexistente: ${match[1]}`);
      check(pkg.scripts[match[1]]);
    }
    for (const match of command.matchAll(/(tests\/[\w/-]+)\/\*\.test\.mjs/g)) {
      assert.ok(fs.existsSync(match[1]), `Carpeta de pruebas ausente: ${match[1]}`);
      assert.ok(fs.readdirSync(match[1]).some(file => file.endsWith('.test.mjs')), `Suite vacía: ${match[0]}`);
    }
    for (const match of command.matchAll(/tests\/[\w/.-]+\.(?:test\.mjs|spec\.js)/g)) {
      assert.ok(fs.existsSync(match[0]), `Prueba ausente: ${match[0]}`);
    }
  }
  for (const stage of Object.values(plan)) {
    for (const command of [...stage.audits.map(name => `npm run ${name}`), ...stage.commands]) check(command);
  }
});
