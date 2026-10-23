import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');

const area = process.argv[2] || 'quick';
const profiles = {
  quick: {node: [], browser: []},
  checkout: {node: ['test:checkout-contract', 'test:paypal'], browser: ['tests/checkout/navigation-responsive.spec.js', 'tests/checkout/invoice-ui.spec.js']},
  header: {node: [], browser: ['tests/navigation/header-responsive.spec.js']},
  catalogo: {node: ['test:products-sync', 'test:cart-persistence'], browser: []},
  inicio: {node: [], browser: ['tests/ui-ux/home-styles-bundle.spec.js']},
};
if (!Object.hasOwn(profiles, area)) throw new Error(`Área desconocida: ${area}. Opciones: ${Object.keys(profiles).join(', ')}`);
if (process.env.CF_PAGES || process.env.CI_NEEDS) throw new Error('dev:check no sustituye el build ni el gate de publicación.');
const env = {...process.env, PLAYWRIGHT_BASE_URL:'http://127.0.0.1:4191', PERF_BASE_URL:'http://127.0.0.1:4191'};
function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {cwd:root, env, stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Falló ${command} ${args.join(' ')} (${result.status ?? result.signal})`);
}
let server;
try {
  run('npm', ['run', 'ci:preflight']);
  for (const script of profiles[area].node) run('npm', ['run', script]);
  if (profiles[area].browser.length) {
    server = spawn(process.execPath, ['scripts/servidor-local-pruebas.mjs', '4191'], {cwd:root, env, stdio:['ignore','pipe','inherit']});
    await Promise.race([
      once(server.stdout, 'data'),
      once(server, 'exit').then(([code]) => {throw new Error(`Servidor local terminó: ${code}`);}),
      new Promise((_, reject) => {const timer = setTimeout(() => reject(new Error('Servidor local sin respuesta')), 10000); timer.unref();}),
    ]);
    run(process.execPath, [createRequire(import.meta.url).resolve('@playwright/test/cli'), 'test', ...profiles[area].browser, '--project=chromium', '--retries=0', '--workers=1']);
  }
  console.log(`Edición ${area}: controles seleccionados aprobados. La publicación sigue requiriendo todas las fases de Repository audit.`);
} catch (error) {console.error(error.message); process.exitCode = 1;}
finally {server?.kill('SIGTERM');}
