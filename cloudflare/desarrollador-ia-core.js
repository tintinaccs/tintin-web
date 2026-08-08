export const AI_JOB_STATES = Object.freeze(['queued', 'analyzing', 'implementing', 'testing', 'pr_open', 'completed', 'failed', 'cancelled']);
export const AI_JOB_PROGRESS = Object.freeze({ queued: 5, analyzing: 20, implementing: 50, testing: 75, pr_open: 90, completed: 100, failed: 100, cancelled: 100 });

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
const TRANSITIONS = Object.freeze({
  queued: ['analyzing', 'failed', 'cancelled'],
  analyzing: ['implementing', 'failed', 'cancelled'],
  implementing: ['testing', 'failed', 'cancelled'],
  testing: ['pr_open', 'failed', 'cancelled'],
  pr_open: ['completed', 'failed'], completed: [], failed: ['queued'], cancelled: ['queued']
});

export function featureIsEnabled(env = {}) {
  return /^(?:1|true|on)$/i.test(String(env.AI_DEVELOPER_ENABLED || '').trim());
}

export function cleanJobId(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{12,80}$/.test(id)) throw new Error('Identificador de trabajo inválido.');
  return id;
}

export function cleanPrompt(value) {
  const prompt = String(value || '').replace(/\u0000/g, '').trim();
  if (prompt.length < 12 || prompt.length > 6000) throw new Error('La solicitud debe tener entre 12 y 6.000 caracteres.');
  return prompt;
}

export function cleanFinding(value = {}) {
  const pick = (key, max = 800) => String(value?.[key] || '').replace(/\u0000/g, '').trim().slice(0, max);
  return { title: pick('title', 180), severity: pick('severity', 20), evidence: pick('evidence'), file: pick('file', 300), suggestion: pick('suggestion') };
}

export function transitionJob(current, next) {
  if (!AI_JOB_STATES.includes(current) || !AI_JOB_STATES.includes(next) || !TRANSITIONS[current].includes(next)) throw new Error(`Transición inválida: ${current} -> ${next}`);
  return { status: next, progress: AI_JOB_PROGRESS[next], terminal: TERMINAL.has(next) };
}

export function publicJob(job = {}) {
  return {
    id: String(job.id || ''), status: String(job.status || 'queued'), progress: Number(job.progress || 0),
    title: String(job.title || ''), createdAt: String(job.createdAt || ''), updatedAt: String(job.updatedAt || ''),
    prUrl: /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(String(job.prUrl || '')) ? job.prUrl : '',
    error: String(job.error || '').slice(0, 500)
  };
}
