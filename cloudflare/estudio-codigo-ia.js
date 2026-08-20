// =============================================================
// TINTIN — Estudio de Código: asistente IA de solo análisis
// No expone credenciales, no escribe GitHub y no publica.
// =============================================================

import { isTextFile, normalizeBranchName, normalizeCodePath, summarizeRisk } from './estudio-codigo-core.js';
import { getFile } from './estudio-codigo-github.js';

function resolveBranch(value) {
  const branch = String(value || '').trim();
  return !branch || branch === 'main' ? 'main' : normalizeBranchName(branch);
}

export async function analyzeWithCodeStudioAi(env, body = {}) {
  const endpointRaw = String(env.CODE_STUDIO_AI_ENDPOINT || '').trim();
  const token = String(env.CODE_STUDIO_AI_TOKEN || '').trim();
  const model = String(env.CODE_STUDIO_AI_MODEL || '').trim();
  const allowedHosts = String(env.CODE_STUDIO_AI_ALLOWED_HOSTS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  if (!endpointRaw || !token || !model) {
    throw Object.assign(new Error('Asistente IA todavía no está configurado'), { status: 503 });
  }

  let endpoint;
  try { endpoint = new URL(endpointRaw); } catch { throw new Error('Endpoint IA inválido'); }
  if (endpoint.protocol !== 'https:' || !allowedHosts.includes(endpoint.hostname.toLowerCase())) {
    throw new Error('Proveedor IA fuera de la allowlist');
  }

  const question = String(body.question || '').trim();
  if (question.length < 4 || question.length > 6000) throw new Error('Consulta IA inválida');
  const branch = resolveBranch(body.branch);
  const paths = [...new Set((Array.isArray(body.paths) ? body.paths : []).map(normalizeCodePath))].slice(0, 12);
  const files = [];
  for (const path of paths) {
    if (!isTextFile(path)) continue;
    const file = await getFile(env, { path, ref: branch });
    files.push({ path, sha: file.sha, content: file.content.slice(0, 50000) });
  }

  const context = files.map(file => `FILE ${file.path} SHA ${file.sha}\n${file.content}`).join('\n\n---\n\n');
  const system = [
    'Sos el asistente diagnóstico del Estudio de Código Tintin.',
    'Usá únicamente la evidencia entregada por GitHub y diferenciá hechos de hipótesis.',
    'No inventes archivos, pruebas ejecutadas, resultados, dependencias ni conexiones.',
    'No reveles secretos ni propongas evadir autenticación, permisos, CSP, checks o revisión humana.',
    'No podés aprobar, fusionar, desplegar ni publicar.',
    'Respondé con diagnóstico, propuesta, diff conceptual o código cuando corresponda, impacto, pruebas recomendadas y rollback.',
    'Si falta evidencia, indicá exactamente qué falta.'
  ].join(' ');

  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `${question}\n\nCONTEXTO GITHUB VERIFICADO:\n${context || '(sin archivos seleccionados)'}` }
      ],
      temperature: 0.1
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`Proveedor IA respondió ${response.status}`), { status: 502 });
  const text = String(data?.output_text || data?.choices?.[0]?.message?.content || data?.text || '').trim();
  if (!text) throw Object.assign(new Error('El proveedor IA no devolvió una propuesta utilizable'), { status: 502 });

  return {
    text: text.slice(0, 40000),
    branch,
    risk: summarizeRisk(paths),
    files: files.map(file => ({ path: file.path, sha: file.sha }))
  };
}
