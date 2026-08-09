function githubHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
    'x-github-api-version': '2022-11-28'
  };
}

async function github(url, token, init = {}) {
  const response = await fetch(`https://api.github.com${url}`, { ...init, headers: { ...githubHeaders(token), ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${data?.message || 'error'}`);
  return data;
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export async function createComplexChangePr(env, proposal) {
  const token = String(env.GITHUB_TOKEN || '').trim();
  const repository = String(env.GITHUB_REPOSITORY || 'tintinaccs/tintin-web').trim();
  if (!token) throw new Error('GITHUB_TOKEN no está configurado para propuestas complejas.');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('GITHUB_REPOSITORY inválido.');
  const base = String(env.GITHUB_BASE_BRANCH || 'main').trim();
  const suffix = String(proposal.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 24).toLowerCase();
  const branch = `feature/tintin-ai-${suffix}`;
  const ref = await github(`/repos/${repository}/git/ref/heads/${encodeURIComponent(base)}`, token);
  await github(`/repos/${repository}/git/refs`, token, {
    method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: ref.object.sha })
  });
  const technical = proposal.result.technicalProposal || {};
  const markdown = [
    `# Propuesta TINTÍN AI Builder ${proposal.id}`,
    '', '## Solicitud', proposal.request, '', '## Objetivo', technical.objective || proposal.request,
    '', '## Alcance', ...(technical.scope || []).map(item => `- ${item}`),
    '', '## Exclusiones de seguridad', ...(technical.excluded || []).map(item => `- ${item}`),
    '', '## Criterios de aceptación', ...(technical.acceptance || []).map(item => `- ${item}`),
    '', '> Esta rama contiene solamente la propuesta técnica. La implementación requiere revisión humana antes de agregar código.'
  ].join('\n');
  const path = `docs/ai-builder-proposals/${proposal.id}.md`;
  await github(`/repos/${repository}/contents/${path}`, token, {
    method: 'PUT', body: JSON.stringify({ message: `docs: propuesta ${proposal.id} de TINTÍN AI Builder`, content: encodeBase64(markdown), branch })
  });
  const pr = await github(`/repos/${repository}/pulls`, token, {
    method: 'POST', body: JSON.stringify({
      title: `TINTÍN AI Builder: ${proposal.result.summary}`.slice(0, 240),
      head: branch,
      base,
      draft: true,
      body: `Propuesta técnica generada desde el Super Panel Admin.\n\nSolicitud: ${proposal.request}\n\nNo fusionar sin implementación, pruebas, preview y aprobación explícita.`
    })
  });
  const pagesProject = String(env.CLOUDFLARE_PAGES_PROJECT || '').trim();
  const previewUrl = pagesProject ? `https://${branch.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}.${pagesProject}.pages.dev` : '';
  return { branch, prUrl: pr.html_url, prNumber: pr.number, previewUrl };
}
