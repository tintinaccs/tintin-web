import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { flowFileHash } from '../../scripts/auditar-proteccion-flujos.mjs';

for (const allowed of [false, true]) test(`el helper usa la autorización de main=${allowed}, no la del candidato`, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tintin-control-plan-'));
  const write = (file, body) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), body); };
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    for (const file of ['preparar-mantenimiento-flujos.mjs', 'mantenimiento-flujos-core.mjs', 'auditar-proteccion-flujos.mjs']) {
      write(`scripts/${file}`, fs.readFileSync(new URL(`../../scripts/${file}`, import.meta.url)));
    }
    const target = '.github/workflows/fixture.yml';
    write(target, 'name: Old\n');
    write('config/mantenimiento-flujos.json', JSON.stringify({ automaticControlMaintenance: allowed }));
    write('config/proteccion-flujos.json', JSON.stringify({ schemaVersion: 1, records: { fixture: [target] }, files: { [target]: flowFileHash('name: Old\n') } }));
    git('init', '-q'); git('add', '.');
    git('-c', 'user.name=Offline test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Trusted base');
    const base = git('rev-parse', 'HEAD');
    write(target, 'name: New\n');
    write('config/mantenimiento-flujos.json', JSON.stringify({ automaticControlMaintenance: !allowed }));
    const result = spawnSync(process.execPath, ['scripts/preparar-mantenimiento-flujos.mjs', base, 'Actualizar el workflow autorizado con pruebas específicas.', target], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, allowed ? 0 : 1, result.stdout + result.stderr);
    if (allowed) {
      const plan = JSON.parse(fs.readFileSync(path.join(dir, 'config/mantenimiento-flujos-plan.json')));
      assert.equal(plan.baseCommit, base);
      assert.deepEqual(plan.files, [{ path: target, oldHash: flowFileHash('name: Old\n'), newHash: flowFileHash('name: New\n') }]);
    } else assert.equal(fs.existsSync(path.join(dir, 'config/mantenimiento-flujos-plan.json')), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
