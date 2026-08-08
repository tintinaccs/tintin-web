import { auth } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';

const endpoint = './api/ai-developer';
const $ = id => document.getElementById(id);
let initialized = false;

async function api(method, body) {
  const user = auth.currentUser;
  if (!user) throw new Error('La sesión no está disponible.');
  const response = await fetch(endpoint, {
    method,
    headers: { authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo conectar con Desarrollador IA.');
  return data;
}

function renderJobs(jobs = []) {
  const root = $('ai-developer-jobs');
  if (!root) return;
  root.replaceChildren();
  if (!jobs.length) {
    const empty = document.createElement('p'); empty.className = 'adm-ai-empty'; empty.textContent = 'Todavía no hay trabajos.'; root.append(empty); return;
  }
  jobs.forEach(job => {
    const item = document.createElement('article'); item.className = 'adm-ai-job';
    const heading = document.createElement('strong'); heading.textContent = job.title || job.id;
    const status = document.createElement('span'); status.textContent = `${job.status} · ${job.progress}%`;
    const progress = document.createElement('progress'); progress.max = 100; progress.value = Number(job.progress || 0); progress.setAttribute('aria-label', `Progreso ${job.progress}%`);
    item.append(heading, status, progress);
    if (job.prUrl) { const link = document.createElement('a'); link.href = job.prUrl; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Abrir pull request'; item.append(link); }
    if (job.error) { const error = document.createElement('small'); error.textContent = job.error; item.append(error); }
    root.append(item);
  });
}

async function refresh() {
  const status = $('ai-developer-status');
  try {
    const data = await api('GET');
    status.textContent = 'Conexión activa. Los cambios siempre pasan por rama, pruebas y PR.';
    renderJobs(data.jobs);
  } catch (error) { status.textContent = error.message; renderJobs([]); }
}

async function submit(event) {
  event.preventDefault();
  const prompt = $('ai-developer-prompt');
  const button = $('ai-developer-submit');
  button.disabled = true;
  try { await api('POST', { prompt: prompt.value, title: prompt.value.slice(0, 100) }); prompt.value = ''; await refresh(); }
  catch (error) { $('ai-developer-status').textContent = error.message; }
  finally { button.disabled = false; }
}

export function initAiDeveloper({ role } = {}) {
  if (initialized || role !== 'superadmin') return;
  initialized = true;
  $('ai-developer-form')?.addEventListener('submit', submit);
  $('ai-developer-refresh')?.addEventListener('click', refresh);
  window.addEventListener('tintin:ai-developer-finding', event => {
    const finding = event.detail || {};
    const prompt = $('ai-developer-prompt');
    if (prompt) prompt.value = `Corregir hallazgo confirmado: ${finding.title || ''}\nEvidencia: ${finding.evidence || ''}\nArchivo: ${finding.file || ''}\nSugerencia: ${finding.suggestion || ''}`.slice(0, 6000);
    location.hash = 'desarrollador-ia';
  });
  refresh();
}
