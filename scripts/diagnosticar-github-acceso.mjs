import fs from 'node:fs';
import vm from 'node:vm';

// Sonda temporal sólo GET; no crea checks, no aprueba y no modifica recursos.
const source = fs.readFileSync(new URL('./mantenimiento-flujos-github.mjs', import.meta.url), 'utf8');
const formatter = source.slice(source.indexOf('const githubFailure ='), source.indexOf('const api ='));
const context = vm.createContext({});
vm.runInContext(`${formatter}\nglobalThis.format = githubFailure;`, context);
for (const path of ['pulls/1071', 'git/ref/heads/main', 'environments/protected-flow-maintenance']) {
  const response = await fetch(`https://api.github.com/repos/tintinaccs/tintin-web/${path}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${process.env.GH_TOKEN || ''}`,
      'X-GitHub-Api-Version': '2026-03-10' }, signal: AbortSignal.timeout(30000),
  });
  console.log(response.ok ? `GET ${path}: HTTP ${response.status}` : await context.format(response, path, 'GET'));
}
