import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../..', import.meta.url));
test('Inspect y publish verifican 541 archivos con menos de 50 solicitudes y seis blobs remotos', () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tintin-guard-budget-'));
const git = (...args) => cp.execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const object = bytes => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex');
const write = (name, data) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), data); };
try {
  for (const name of ['mantenimiento-flujos-github.mjs', 'mantenimiento-flujos-core.mjs', 'auditar-proteccion-flujos.mjs', 'leer-blobs-mantenimiento.mjs']) {
    write(`scripts/${name}`, fs.readFileSync(path.join(root, 'scripts', name)));
  }
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config/mantenimiento-flujos.json')));
  write('config/mantenimiento-flujos.json', JSON.stringify(config));
  const baseline = { schemaVersion: 1, files: {}, records: { probe: ['js/data0334.js'] } };
  for (let i = 0; i < 541; i++) {
    const name = `js/data${String(i).padStart(4, '0')}.js`;
    const bytes = `export const fixture = ${i};\n`;
    write(name, bytes); baseline.files[name] = hash(bytes);
  }
  const policyPath = 'config/proteccion-flujos.json';
  write(policyPath, JSON.stringify(baseline));
  git('init', '-q'); git('add', '.');
  git('-c', 'user.name=Offline probe', '-c', 'user.email=probe@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Trusted isolated fixture');
  const baseSha = git('rev-parse', 'HEAD'), headSha = 'b'.repeat(40);
  const baseTree = git('ls-tree', '-r', 'HEAD').split('\n').map(line => {
    const [meta, name] = line.split('\t'); const [mode, type, sha] = meta.split(' '); return { path: name, mode, type, sha };
  });
  const candidate = structuredClone(baseline), modified = 'export const fixture = "changed";\n';
  candidate.files['js/data0334.js'] = hash(modified);
  const plan = { schemaVersion: 1, baseCommit: baseSha, reason: 'Corregir el consumo de solicitudes con una prueba aislada.',
    files: [{ path: 'js/data0334.js', oldHash: baseline.files['js/data0334.js'], newHash: candidate.files['js/data0334.js'] }], affectedRecords: ['probe'] };
  const replacements = { 'js/data0334.js': modified, [policyPath]: JSON.stringify(candidate), 'config/mantenimiento-flujos-plan.json': JSON.stringify(plan) };
  const remoteBlobs = {};
  const tree = baseTree.map(entry => ({ ...entry }));
  for (const [name, bytes] of Object.entries(replacements)) {
    const entry = { path: name, mode: '100644', type: 'blob', sha: object(bytes) };
    const index = tree.findIndex(item => item.path === name); if (index < 0) tree.push(entry); else tree[index] = entry;
    remoteBlobs[entry.sha] = { encoding: 'base64', size: Buffer.byteLength(bytes), content: Buffer.from(bytes).toString('base64') };
  }
  for (const entry of baseTree) {
    const bytes = fs.readFileSync(path.join(dir, entry.path));
    remoteBlobs[entry.sha] = { encoding: 'base64', size: bytes.length, content: bytes.toString('base64') };
  }
  const responses = {
    'pulls/1083': { state: 'open', base: { repo: { full_name: config.repository }, ref: 'main', sha: baseSha }, head: { sha: headSha } },
    'git/ref/heads/main': { object: { sha: baseSha } },
    [`git/trees/${baseSha}?recursive=1`]: { truncated: false, tree: baseTree },
    [`git/trees/${headSha}?recursive=1`]: { truncated: false, tree },
    [`environments/${config.environment}`]: { name: config.environment, id: 789, can_admins_bypass: false,
      deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
      protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { type: 'User', id: config.reviewerIds[0] } }] }] },
    'actions/runs/123/approvals': [{ state: 'approved', environments: [{ id: 789 }], user: { type: 'User', id: config.reviewerIds[0] } }],
  };
  const checks = config.requiredChecks.map((check, i) => ({ id: i+1, name: check.name, app: { id: check.appId }, head_sha: headSha,
    status: 'completed', conclusion: 'success', details_url: `https://github.com/${config.repository}/actions/runs/${i+10}/job/${i+20}` }));
  responses[`commits/${headSha}/check-runs?filter=latest&per_page=100&page=1`] = { check_runs: checks };
  config.requiredChecks.forEach((check, i) => { if (check.workflowPath) responses[`actions/runs/${i+10}`] = {
    path: check.workflowPath, event: check.workflowEvent, head_sha: headSha, head_repository: { full_name: config.repository } }; });
  const mockPath = path.join(dir, 'mock.mjs'), statePath = path.join(dir, 'requests.json');
  write('responses.json', JSON.stringify({ responses, remoteBlobs }));
  write('mock.mjs', `import fs from 'node:fs';
const {responses,remoteBlobs}=JSON.parse(fs.readFileSync('responses.json'));
globalThis.fetch=async (url,options)=>{
 const endpoint=url.slice('https://api.github.com/repos/tintinaccs/tintin-web/'.length);
 const state=JSON.parse(fs.readFileSync('requests.json'));state.total++;if(endpoint.startsWith('git/blobs/'))state.blobs++;
 fs.writeFileSync('requests.json',JSON.stringify(state));
 if(state.total>1000)return new Response('{}',{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-limit':'1000'}});
 let data=endpoint==='check-runs'&&options.method==='POST'?{id:1}:responses[endpoint];
 if(endpoint.startsWith('git/blobs/'))data=remoteBlobs[endpoint.slice(10)];
 if(!data)throw Error('Unexpected offline endpoint: '+endpoint);
 return new Response(JSON.stringify(data),{status:200});
};\n`);
  const env = { ...process.env, GH_TOKEN: '', PR_NUMBER: '1083', CANDIDATE_SHA: headSha, GITHUB_REPOSITORY: config.repository,
    GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_OUTPUT: path.join(dir, 'outputs.txt'), GITHUB_STEP_SUMMARY: path.join(dir, 'summary.txt'), APPROVAL_RESULT: 'success' };
  const run = () => ['inspect', 'publish'].map(mode => cp.spawnSync(process.execPath, ['--import', pathToFileURL(mockPath).href, 'scripts/mantenimiento-flujos-github.mjs', mode], { cwd: dir, env, encoding: 'utf8' }));
  fs.writeFileSync(statePath, JSON.stringify({ total: 0, blobs: 0 }));
  const fixed = run(), fixedRequests = JSON.parse(fs.readFileSync(statePath));
  assert.deepEqual(fixed.map(result => result.status), [0, 0], fixed.map(result => result.stderr || result.stdout).join('\n')); assert.equal(fixedRequests.blobs, 6);
  assert.ok(fixedRequests.total < 50);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

});
