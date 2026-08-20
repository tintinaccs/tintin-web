// =============================================================
// TINTIN — Estudio de Código: cliente GitHub App exclusivamente backend
// =============================================================

import {
  CODE_STUDIO_MAIN_BRANCH,
  normalizeBranchName,
  normalizeCodePath,
  normalizeSha,
  sanitizePullRequestBody,
  sanitizePullRequestTitle,
  validateChanges
} from './estudio-codigo-core.js';

const API = 'https://api.github.com';
const TOKEN_SKEW_SECONDS = 30;
const installationTokenCache = new Map();

function base64UrlFromBytes(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let index = 0; index < view.length; index += 1) binary += String.fromCharCode(view[index]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlFromString(value) {
  return base64UrlFromBytes(new TextEncoder().encode(String(value)));
}

function pemToDer(pem) {
  const base64 = String(pem || '').replace(/\\n/g, '\n').replace(/-{5}(?:BEGIN|END)[^-]+-{5}/g, '').replace(/\s+/g, '');
  if (!base64) throw new Error('La clave privada de GitHub App no está configurada');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function githubAppJwt(env) {
  const appId = String(env.CODE_STUDIO_GITHUB_APP_ID || '').trim();
  const privateKeyPem = String(env.CODE_STUDIO_GITHUB_APP_PRIVATE_KEY || '').trim();
  if (!/^\d{2,20}$/.test(appId) || !privateKeyPem) throw new Error('GitHub App todavía no está configurada');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - TOKEN_SKEW_SECONDS, exp: now + 540, iss: appId };
  const signingInput = `${base64UrlFromString(JSON.stringify(header))}.${base64UrlFromString(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlFromBytes(signature)}`;
}

export function getCodeStudioRepo(env = {}) {
  const raw = String(env.CODE_STUDIO_GITHUB_REPOSITORY || 'tintinaccs/tintin-web').trim();
  const match = raw.match(/^([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})$/);
  if (!match) throw new Error('CODE_STUDIO_GITHUB_REPOSITORY es inválido');
  return { owner: match[1], repo: match[2], fullName: raw };
}

async function installationToken(env) {
  const installationId = String(env.CODE_STUDIO_GITHUB_INSTALLATION_ID || '').trim();
  if (!/^\d{2,30}$/.test(installationId)) throw new Error('Instalación de GitHub App no configurada');
  const cached = installationTokenCache.get(installationId);
  const now = Date.now();
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;

  const jwt = await githubAppJwt(env);
  const response = await fetch(`${API}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${jwt}`,
      'user-agent': 'tintin-code-studio',
      'x-github-api-version': '2022-11-28'
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) throw new Error(`GitHub App no pudo obtener token de instalación (${response.status})`);
  const expiresAt = Date.parse(data.expires_at || '') || now + 50 * 60_000;
  installationTokenCache.set(installationId, { token: String(data.token), expiresAt });
  return String(data.token);
}

async function githubRequest(env, pathname, options = {}) {
  const token = await installationToken(env);
  const response = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
      'user-agent': 'tintin-code-studio',
      'x-github-api-version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 500) }; }
  if (!response.ok) {
    const error = new Error(`GitHub respondió ${response.status}: ${String(data?.message || 'sin detalle').slice(0, 300)}`);
    error.status = response.status;
    error.github = data;
    throw error;
  }
  return { data, headers: response.headers };
}

function repoPath(env, suffix = '') {
  const { owner, repo } = getCodeStudioRepo(env);
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
}

export async function getRepositoryState(env) {
  const repo = (await githubRequest(env, repoPath(env))).data;
  const branch = (await githubRequest(env, repoPath(env, `/branches/${encodeURIComponent(CODE_STUDIO_MAIN_BRANCH)}`))).data;
  return {
    repository: repo.full_name,
    defaultBranch: repo.default_branch,
    private: Boolean(repo.private),
    mainSha: branch?.commit?.sha || '',
    mainProtected: Boolean(branch?.protected),
    appConfigured: true
  };
}

export async function getTree(env, { ref = CODE_STUDIO_MAIN_BRANCH, path = '' } = {}) {
  const safeRef = String(ref || CODE_STUDIO_MAIN_BRANCH).trim();
  const safePath = path ? normalizeCodePath(path) : '';
  const suffix = safePath ? `/contents/${safePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(safeRef)}` : `/contents?ref=${encodeURIComponent(safeRef)}`;
  const data = (await githubRequest(env, repoPath(env, suffix))).data;
  if (!Array.isArray(data)) throw new Error('La ruta solicitada no es una carpeta');
  return data
    .filter(item => item?.type === 'dir' || item?.type === 'file')
    .map(item => ({
      name: item.name,
      path: item.path,
      type: item.type,
      sha: item.sha,
      size: Number(item.size || 0)
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
}

export async function getFile(env, { path, ref = CODE_STUDIO_MAIN_BRANCH } = {}) {
  const safePath = normalizeCodePath(path);
  const safeRef = String(ref || CODE_STUDIO_MAIN_BRANCH).trim();
  const data = (await githubRequest(env, repoPath(env, `/contents/${safePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(safeRef)}`))).data;
  if (data?.type !== 'file' || !data.sha) throw new Error('GitHub no devolvió un archivo');
  if (data.encoding !== 'base64') throw new Error('Formato de archivo no soportado');
  const binary = atob(String(data.content || '').replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const content = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return { path: safePath, sha: data.sha, size: Number(data.size || bytes.byteLength), content };
}

export async function searchCode(env, { query, perPage = 50 } = {}) {
  const { fullName } = getCodeStudioRepo(env);
  const q = `${String(query || '').trim()} repo:${fullName}`;
  const limit = Math.max(1, Math.min(100, Number(perPage) || 50));
  const data = (await githubRequest(env, `/search/code?q=${encodeURIComponent(q)}&per_page=${limit}`)).data;
  return (data?.items || []).map(item => ({ name: item.name, path: item.path, sha: item.sha, url: item.html_url }));
}

export async function createWorkspaceBranch(env, { branch, expectedMainSha } = {}) {
  const safeBranch = normalizeBranchName(branch);
  const expected = normalizeSha(expectedMainSha, 'SHA esperado de main');
  const state = await getRepositoryState(env);
  if (normalizeSha(state.mainSha, 'SHA actual de main') !== expected) {
    const error = new Error('main cambió desde que abriste el Estudio; sincronizá antes de crear la rama');
    error.status = 409;
    throw error;
  }
  await githubRequest(env, repoPath(env, '/git/refs'), {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${safeBranch}`, sha: expected })
  });
  return { branch: safeBranch, sha: expected };
}

export async function getBranchHead(env, branch) {
  const safeBranch = branch === CODE_STUDIO_MAIN_BRANCH ? CODE_STUDIO_MAIN_BRANCH : normalizeBranchName(branch);
  const data = (await githubRequest(env, repoPath(env, `/git/ref/heads/${encodeURIComponent(safeBranch)}`))).data;
  return normalizeSha(data?.object?.sha, 'SHA de rama');
}

async function getCommit(env, sha) {
  return (await githubRequest(env, repoPath(env, `/git/commits/${normalizeSha(sha)}`))).data;
}

async function createBlob(env, content) {
  const data = (await githubRequest(env, repoPath(env, '/git/blobs'), {
    method: 'POST',
    body: JSON.stringify({ content: String(content ?? ''), encoding: 'utf-8' })
  })).data;
  return normalizeSha(data?.sha, 'SHA de blob');
}

async function verifyBaseFileShas(env, branch, changes) {
  for (const change of changes) {
    if (change.operation === 'create') {
      try {
        await getFile(env, { path: change.path, ref: branch });
        const error = new Error(`El archivo ${change.path} ya existe en la rama remota`);
        error.status = 409;
        throw error;
      } catch (error) {
        if (error?.status === 404) continue;
        if (/ya existe/.test(error?.message || '')) throw error;
        if (error?.status && error.status !== 404) throw error;
      }
      continue;
    }
    const current = await getFile(env, { path: change.path, ref: branch });
    if (normalizeSha(current.sha, `SHA actual de ${change.path}`) !== change.baseSha) {
      const error = new Error(`Conflicto remoto en ${change.path}; no se sobrescribió nada`);
      error.status = 409;
      throw error;
    }
  }
}

export async function commitWorkspaceChanges(env, { branch, expectedHeadSha, changes, message } = {}) {
  const safeBranch = normalizeBranchName(branch);
  const expectedHead = normalizeSha(expectedHeadSha, 'SHA esperado de rama');
  const safeChanges = validateChanges(changes);
  const currentHead = await getBranchHead(env, safeBranch);
  if (currentHead !== expectedHead) {
    const error = new Error('La rama remota cambió; el commit fue cancelado para conservar tus cambios locales');
    error.status = 409;
    throw error;
  }
  await verifyBaseFileShas(env, safeBranch, safeChanges);
  const parent = await getCommit(env, currentHead);
  const tree = [];
  for (const change of safeChanges) {
    if (change.operation === 'delete') {
      tree.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
    } else {
      const blobSha = await createBlob(env, change.content);
      tree.push({ path: change.path, mode: '100644', type: 'blob', sha: blobSha });
    }
  }
  const newTree = (await githubRequest(env, repoPath(env, '/git/trees'), {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree })
  })).data;
  const commit = (await githubRequest(env, repoPath(env, '/git/commits'), {
    method: 'POST',
    body: JSON.stringify({ message: String(message), tree: newTree.sha, parents: [currentHead] })
  })).data;
  const commitSha = normalizeSha(commit?.sha, 'SHA de commit');
  const headBeforeRefUpdate = await getBranchHead(env, safeBranch);
  if (headBeforeRefUpdate !== currentHead) {
    const error = new Error('La rama cambió durante el guardado; el commit quedó huérfano y no se publicó en la rama');
    error.status = 409;
    throw error;
  }
  await githubRequest(env, repoPath(env, `/git/refs/heads/${safeBranch.split('/').map(encodeURIComponent).join('/')}`), {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSha, force: false })
  });
  return { branch: safeBranch, previousHeadSha: currentHead, commitSha, files: safeChanges.map(change => change.path) };
}

export async function compareBranch(env, { branch } = {}) {
  const safeBranch = normalizeBranchName(branch);
  const data = (await githubRequest(env, repoPath(env, `/compare/${encodeURIComponent(CODE_STUDIO_MAIN_BRANCH)}...${safeBranch.split('/').map(encodeURIComponent).join('/')}`))).data;
  return {
    status: data.status,
    aheadBy: data.ahead_by,
    behindBy: data.behind_by,
    mergeBaseSha: data.merge_base_commit?.sha || '',
    commits: (data.commits || []).map(commit => ({ sha: commit.sha, message: commit.commit?.message || '', url: commit.html_url })),
    files: (data.files || []).map(file => ({ filename: file.filename, status: file.status, additions: file.additions, deletions: file.deletions, changes: file.changes, patch: file.patch || '' }))
  };
}

export async function openPullRequest(env, { branch, title, body = '' } = {}) {
  const safeBranch = normalizeBranchName(branch);
  const data = (await githubRequest(env, repoPath(env, '/pulls'), {
    method: 'POST',
    body: JSON.stringify({
      title: sanitizePullRequestTitle(title),
      body: sanitizePullRequestBody(body),
      head: safeBranch,
      base: CODE_STUDIO_MAIN_BRANCH,
      draft: false
    })
  })).data;
  return { number: data.number, url: data.html_url, state: data.state, headSha: data.head?.sha || '', baseSha: data.base?.sha || '' };
}

export async function getPullRequest(env, number) {
  const prNumber = Number(number);
  if (!Number.isInteger(prNumber) || prNumber < 1) throw new Error('Número de PR inválido');
  const data = (await githubRequest(env, repoPath(env, `/pulls/${prNumber}`))).data;
  return {
    number: data.number,
    url: data.html_url,
    state: data.state,
    draft: Boolean(data.draft),
    mergeable: data.mergeable,
    mergeableState: data.mergeable_state,
    headRef: data.head?.ref || '',
    headSha: data.head?.sha || '',
    baseRef: data.base?.ref || '',
    baseSha: data.base?.sha || ''
  };
}

export async function getChecks(env, sha) {
  const safeSha = normalizeSha(sha, 'SHA para checks');
  const data = (await githubRequest(env, repoPath(env, `/commits/${safeSha}/check-runs?per_page=100`))).data;
  return (data?.check_runs || []).map(run => ({
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    startedAt: run.started_at,
    completedAt: run.completed_at
  }));
}

export async function listHistory(env, { branch = CODE_STUDIO_MAIN_BRANCH, path = '', perPage = 30 } = {}) {
  const params = new URLSearchParams({ sha: String(branch || CODE_STUDIO_MAIN_BRANCH), per_page: String(Math.max(1, Math.min(100, Number(perPage) || 30))) });
  if (path) params.set('path', normalizeCodePath(path));
  const data = (await githubRequest(env, repoPath(env, `/commits?${params.toString()}`))).data;
  return (data || []).map(commit => ({
    sha: commit.sha,
    message: commit.commit?.message || '',
    author: commit.commit?.author?.name || '',
    date: commit.commit?.author?.date || '',
    url: commit.html_url
  }));
}

export async function getDeploymentState(env, sha) {
  const safeSha = normalizeSha(sha, 'SHA de despliegue');
  const deployments = (await githubRequest(env, repoPath(env, `/deployments?sha=${safeSha}&per_page=20`))).data;
  const result = [];
  for (const deployment of deployments || []) {
    const statuses = (await githubRequest(env, repoPath(env, `/deployments/${deployment.id}/statuses?per_page=10`))).data;
    const latest = Array.isArray(statuses) ? statuses[0] : null;
    result.push({
      id: deployment.id,
      environment: deployment.environment,
      ref: deployment.ref,
      sha: deployment.sha,
      state: latest?.state || 'pending',
      environmentUrl: latest?.environment_url || '',
      logUrl: latest?.log_url || ''
    });
  }
  return result;
}

export async function mergePullRequestWithHumanApproval(env, { number, expectedHeadSha, approvalToken } = {}) {
  const requiredToken = String(env.CODE_STUDIO_HUMAN_APPROVAL_SECRET || '').trim();
  if (!requiredToken || String(approvalToken || '') !== requiredToken) {
    const error = new Error('La publicación requiere una aprobación humana externa al asistente');
    error.status = 403;
    throw error;
  }
  const pr = await getPullRequest(env, number);
  const expected = normalizeSha(expectedHeadSha, 'SHA esperado del PR');
  if (normalizeSha(pr.headSha, 'SHA actual del PR') !== expected) {
    const error = new Error('El PR cambió después de la aprobación; hay que revisarlo de nuevo');
    error.status = 409;
    throw error;
  }
  const checks = await getChecks(env, expected);
  const blocking = checks.filter(check => check.status !== 'completed' || !['success', 'neutral', 'skipped'].includes(check.conclusion));
  if (!checks.length || blocking.length) {
    const error = new Error('No se puede fusionar: los checks todavía no están completamente verdes');
    error.status = 409;
    throw error;
  }
  const data = (await githubRequest(env, repoPath(env, `/pulls/${Number(number)}/merge`), {
    method: 'PUT',
    body: JSON.stringify({ sha: expected, merge_method: 'squash' })
  })).data;
  return { merged: Boolean(data.merged), sha: data.sha || '', message: data.message || '' };
}
