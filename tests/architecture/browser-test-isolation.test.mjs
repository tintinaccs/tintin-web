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
  const build=workflow.indexOf('- name: Reject generated artifact drift');
  const server=workflow.indexOf('- name: Serve exact commit for browser gates');
  const mixed=workflow.indexOf('- name: Full static contract');
  const browser=workflow.indexOf('- name: Browser, accessibility, SEO and performance gates');
  assert.ok(build>=0&&build<server&&server<mixed&&mixed<browser);
  assert.match(workflow,/    env:\n      PLAYWRIGHT_BASE_URL: http:\/\/127\.0\.0\.1:4173\n      PERF_BASE_URL: http:\/\/127\.0\.0\.1:4173/);
  assert.match(workflow,/node scripts\/servidor-local-pruebas\.mjs 4173/);
});
