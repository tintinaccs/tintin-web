import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const plan = JSON.parse(fs.readFileSync('config/ci-stages.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const stage = process.argv[2];
if (!Object.hasOwn(plan, stage)) throw new Error(`Fase desconocida: ${stage}`);
const original = pkg.scripts['audit:final'].split(' && ');
const assigned = Object.values(plan).flatMap(group => group.audits.map(name => `npm run ${name}`));
if (JSON.stringify([...original].sort()) !== JSON.stringify([...assigned].sort())) {
  throw new Error('config/ci-stages.json debe distribuir todas las comprobaciones de audit:final exactamente una vez.');
}
fs.mkdirSync('artifacts/ci', { recursive: true });
const timings = [];
for (const command of [...plan[stage].audits.map(name => `npm run ${name}`), ...plan[stage].commands]) {
  console.log(`\n::group::${stage}: ${command}`);
  const start = performance.now();
  const result = spawnSync(command, { shell: true, stdio: 'inherit', env: process.env });
  const seconds = Number(((performance.now() - start) / 1000).toFixed(3));
  timings.push({ command, seconds, status: result.status, signal: result.signal });
  fs.writeFileSync(`artifacts/ci/${stage}.json`, JSON.stringify(timings, null, 2) + '\n');
  console.log(`${seconds}s — ${command}\n::endgroup::`);
  if (result.status !== 0 || result.error) {
    console.error(`::error::Fase ${stage} falló. Reproducir: ${command}`);
    process.exit(result.status || 1);
  }
}
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### ${stage}\n\n| Comprobación | Segundos |\n|---|---:|\n` + timings.map(t => `| \`${t.command}\` | ${t.seconds} |`).join('\n') + '\n');
}
