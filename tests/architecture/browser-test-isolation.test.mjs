import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const configFile=fileURLToPath(new URL('../../playwright.config.js',import.meta.url));
function baseURL(overrides={}) {
  const env={...process.env};
  delete env.PLAYWRIGHT_BASE_URL;delete env.PERF_BASE_URL;
  return execFileSync(process.execPath,['-e','process.stdout.write(require(process.argv[1]).use.baseURL)',configFile],{cwd:root,env:{...env,...overrides},encoding:'utf8'});
}
test('las pruebas UI sin configuración explícita nunca toman producción como origen',()=>{
  assert.equal(baseURL(),'http://127.0.0.1:4173');
});
test('las mediciones remotas requieren un origen explícito y conservan su precedencia',()=>{
  assert.equal(baseURL({PERF_BASE_URL:'https://performance.example.invalid'}),'https://performance.example.invalid');
  assert.equal(baseURL({PERF_BASE_URL:'https://performance.example.invalid',PLAYWRIGHT_BASE_URL:'http://127.0.0.1:4179'}),'http://127.0.0.1:4179');
});
test('CI sirve el artefacto exacto antes de cualquier gate que incluya navegador',()=>{
  const workflow=fs.readFileSync(new URL('../../.github/workflows/auditar-tintin.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const jobs=Object.fromEntries([...workflow.matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:|^$\b|(?![\s\S]))/gm)].map(match=>[match[1],match[2]]));
  assert.ok(jobs.preflight.indexOf('Build exact public artifact')<jobs.preflight.indexOf('Reject generated artifact drift'));
  assert.match(jobs.commerce,/needs: preflight/);
  for(const name of ['commerce','admin','quality','browser']) {
    const job=jobs[name];
    assert.ok(job.indexOf('Serve exact commit for browser gates')<job.indexOf(`run: npm run ci:${name}`));
    assert.match(job,/PLAYWRIGHT_BASE_URL: http:\/\/127\.0\.0\.1:4173/);
    assert.match(job,/PERF_BASE_URL: http:\/\/127\.0\.0\.1:4173/);
    assert.match(job,/node scripts\/servidor-local-pruebas\.mjs 4173/);
    if(name!=='commerce') assert.match(job,/needs: commerce/);
  }
  assert.match(jobs.rules,/needs: commerce/);
  assert.match(jobs.audit,/name: Repository audit/);
  assert.match(jobs.audit,/if:.*always\(\)/);
  for(const name of ['preflight','commerce','admin','quality','browser','rules']) assert.match(jobs.audit,new RegExp(`- ${name}\\b`));
  assert.match(jobs.audit,/run: node scripts\/ci-result\.mjs/);
});
