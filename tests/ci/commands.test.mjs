import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
import { resolveCICommands } from '../../scripts/ci-commands.js';

function candidate() {
  return {
    workflow: fs.readFileSync('.github/workflows/auditar-tintin.yml', 'utf8').replace(/\r\n/g, '\n'),
    scripts: JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts,
    stages: JSON.parse(fs.readFileSync('config/ci-stages.json', 'utf8')),
  };
}

test('la cobertura se obtiene de fases conectadas al gate y expande scripts anidados', () => {
  const input = candidate();
  const commands = resolveCICommands(input);
  for (const command of input.scripts['audit:final'].split(' && ')) assert.ok(commands.has(command), command);
  assert.ok(commands.has('node scripts/auditar-legal-paginas.js'));
  assert.ok(commands.has('node scripts/probar-flujos-runtime.mjs'));
});

test('rechaza fases desconectadas, opcionales o ausentes del gate final', () => {
  for (const name of Object.keys(candidate().stages)) {
    for (const mutate of [
      input => { input.workflow = input.workflow.replace(`run: npm run ci:${name}`, 'run: true'); },
      input => { input.workflow = input.workflow.replace(`      - ${name}\n`, ''); },
      input => { input.workflow = input.workflow.replace(`  ${name}:\n`, `  ${name}:\n    if: false\n`); },
      input => { input.workflow = input.workflow.replace(`run: npm run ci:${name}`, `if: false\n        run: npm run ci:${name}`); },
      input => { input.scripts[`ci:${name}`] = 'echo skip'; },
    ]) {
      const input = candidate();
      mutate(input);
      assert.throws(() => resolveCICommands(input), undefined, name);
    }
  }
});

test('no hereda cobertura de un plan o script que dejó de ejecutarse', () => {
  const missingAudit = candidate();
  missingAudit.stages.preflight.audits = missingAudit.stages.preflight.audits.filter(name => name !== 'audit:part2h');
  assert.throws(() => resolveCICommands(missingAudit), /Cobertura incompleta/);
  const missingScript = candidate();
  delete missingScript.scripts['test:critical-runtime'];
  assert.throws(() => resolveCICommands(missingScript), /Script inexistente/);
  const missingLegal = candidate();
  missingLegal.stages.preflight.commands = missingLegal.stages.preflight.commands.filter(command => command !== 'node scripts/auditar-legal-paginas.js');
  assert.equal(resolveCICommands(missingLegal).has('node scripts/auditar-legal-paginas.js'), false);
});

function runAuditor(file, input) {
  const filename = path.resolve('scripts', file);
  const nativeRequire = createRequire(filename);
  const messages = [];
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    __dirname: path.dirname(filename),
    require: name => name === './ci-commands.js'
      ? { readCICommands: () => resolveCICommands(input) } : nativeRequire(name),
    console: { log: (...args) => messages.push(args.join(' ')), error: (...args) => messages.push(args.join(' ')) },
    process: { cwd: () => process.cwd(), exit: code => { throw new Error(`exit ${code}: ${messages.join('\n')}`); } },
  }, { filename });
}

test('los auditores reales conservan sus rechazos si se elimina cobertura legal o accesibilidad', () => {
  for (const file of ['auditar-legal-paginas.js', 'auditar-final-barrido-parte-2h.js']) {
    assert.doesNotThrow(() => runAuditor(file, candidate()));
  }
  const noLegal = candidate();
  noLegal.stages.preflight.commands = noLegal.stages.preflight.commands.filter(command => command !== 'node scripts/auditar-legal-paginas.js');
  assert.throws(() => runAuditor('auditar-legal-paginas.js', noLegal), /workflow no ejecuta auditoría legal/);
  const noAccessibility = candidate();
  noAccessibility.stages.browser.commands = noAccessibility.stages.browser.commands.filter(command => command !== 'npm run test:phase10-a11y');
  assert.throws(() => runAuditor('auditar-final-barrido-parte-2h.js', noAccessibility), /Parte 2E/);
});
