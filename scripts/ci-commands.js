const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

// Resolve the phased workflow without executing any audited command.
function resolveCICommands({ workflow, scripts, stages }) {
  const jobs = Object.fromEntries([...workflow.replace(/\r\n/g, '\n').matchAll(
    /^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:|(?![\s\S]))/gm
  )].map(match => [match[1], match[2]]));
  const gate = jobs.audit || '';
  assert.match(gate, /name: Repository audit/);
  assert.match(gate, /if:.*always\(\)/);
  assert.match(gate, /^        run: node scripts\/ci-result\.mjs\s*$/m);
  const dependencies = [...(gate.match(/^    needs:\n((?:      - [\w-]+\n)+)/m)?.[1] || '').matchAll(/- ([\w-]+)/g)].map(match => match[1]);
  const assigned = Object.values(stages).flatMap(stage => stage.audits.map(name => `npm run ${name}`));
  assert.deepEqual([...assigned].sort(), scripts['audit:final'].split(' && ').sort(), 'Cobertura incompleta de audit:final');
  const commands = new Set();
  function expand(command) {
    if (commands.has(command)) return;
    commands.add(command);
    for (const match of command.matchAll(/npm run ([\w:-]+)/g)) {
      assert.equal(typeof scripts[match[1]], 'string', `Script inexistente: ${match[1]}`);
      expand(scripts[match[1]]);
    }
  }
  for (const [name, stage] of Object.entries(stages)) {
    assert.ok(dependencies.includes(name), `Repository audit no depende de ${name}`);
    assert.ok(jobs[name], `Fase ausente: ${name}`);
    assert.doesNotMatch(jobs[name], /^    if:/m, `Fase obligatoria condicional: ${name}`);
    assert.match(jobs[name], new RegExp(`^        run: npm run ci:${name}\\s*$`, 'm'), `Fase desconectada: ${name}`);
    const runnerStep = jobs[name].split(/^      - /m).find(step => new RegExp(`^        run: npm run ci:${name}\\s*$`, 'm').test(step));
    assert.doesNotMatch(runnerStep, /^        (?:if|continue-on-error):/m, `Runner opcional: ${name}`);
    assert.doesNotMatch(jobs[name], /^    continue-on-error:/m, `Fase opcional: ${name}`);
    assert.equal(scripts[`ci:${name}`], `node scripts/ci-stage.mjs ${name}`, `Runner incorrecto: ${name}`);
    for (const command of [...stage.audits.map(audit => `npm run ${audit}`), ...stage.commands]) expand(command);
  }
  return commands;
}

function readCICommands(root) {
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
  return resolveCICommands({
    workflow: read('.github/workflows/auditar-tintin.yml'),
    scripts: JSON.parse(read('package.json')).scripts,
    stages: JSON.parse(read('config/ci-stages.json')),
  });
}

module.exports = { resolveCICommands, readCICommands };
