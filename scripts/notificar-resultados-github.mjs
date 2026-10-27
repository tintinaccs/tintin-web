import { readFileSync, appendFileSync } from 'node:fs';

// The payload is data; no branch content, artifact or log is executed.
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const repository = process.env.GITHUB_REPOSITORY;
const apiRoot = process.env.GITHUB_API_URL || 'https://api.github.com';
const request = async (path, method = 'GET', body) => {
  const response = await fetch(`${apiRoot}/repos/${repository}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
  return response.json();
};
const list = async path => {
  const rows = [];
  for (let page = 1; ; page++) {
    const batch = await request(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
};
const run = event.workflow_run;
const pr = event.pull_request;
if (!run && !pr) throw new Error('Unsupported event');
const marker = run ? `<!-- github-result:${run.id}:${run.run_attempt} -->` : `<!-- github-pr-closed:${pr.number} -->`;
const status = run ? run.conclusion : pr.merged ? 'merged' : 'closed_without_merge';
const url = run ? run.html_url : pr.html_url;
const sha = run ? run.head_sha : pr.head.sha;
// JSON quoting prevents titles containing newlines/mentions from changing the message.
const title = JSON.stringify(run ? run.name : `PR #${pr.number}`).replaceAll('@', '@\u200b');
const body = `${marker}\nResultado GitHub: **${status}**\n\n${title}\n\nSHA: \`${sha}\`\n${run ? `Run: ${run.id} · intento: ${run.run_attempt}\n` : ''}\n[Ver resultado](${url})\n\nEste recibo corresponde a esa ejecución; no certifica otras comprobaciones ni el merge del PR.`;
let targets = pr ? [pr.number] : (run.pull_requests || []).map(item => item.number);
if (run && !targets.length && run.head_repository?.full_name === repository) {
  const linked = await request(`commits/${encodeURIComponent(sha)}/pulls`);
  targets = linked.filter(item => item.head.sha === sha || item.merge_commit_sha === sha).map(item => item.number);
}
if (!targets.length) {
  const title = 'Registro de resultados de GitHub Actions';
  const issues = await list('issues?state=open&creator=github-actions%5Bbot%5D');
  let issue = issues.find(item => !item.pull_request && item.title === title);
  if (!issue) issue = await request('issues', 'POST', { title, body: 'Recibos automáticos de workflows sin PR asociado. Suscribirse a este issue para recibir los avisos en GitHub. La entrega a Codex requiere un receptor de eventos conectado.' });
  targets = [issue.number];
}
for (const number of new Set(targets)) {
  const comments = await list(`issues/${number}/comments`);
  if (!comments.some(item => item.user?.login === 'github-actions[bot]' && item.body?.includes(marker))) {
    await request(`issues/${number}/comments`, 'POST', { body });
  }
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, body + '\n');
