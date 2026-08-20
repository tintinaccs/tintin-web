// =============================================================
// TINTIN — Estudio de Código: asistente IA de solo análisis
// No expone credenciales, no escribe GitHub y no publica.
// =============================================================

import { isTextFile, normalizeBranchName, normalizeCodePath, summarizeRisk, validateChanges } from './estudio-codigo-core.js';
import { getFile } from './estudio-codigo-github.js';

function resolveBranch(value) {
  const branch = String(value || '').trim();
  return !branch || branch === 'main' ? 'main' : normalizeBranchName(branch);
}

export function parseStructuredProposal(text, files) {
  const fenced = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  let data;
  try { data = JSON.parse(fenced || text); } catch {
    return { summary: String(text || '').slice(0, 40000), diagnosis: [], impact: [], tests: [], rollback: '', changes: [] };
  }
  const known = new Map(files.map(file => [file.path, file]));
  const requested = Array.isArray(data?.changes) ? data.changes.slice(0, 12) : [];
  const candidates = [];
  for (const item of requested) {
    let path;
    try { path = normalizeCodePath(item?.path); } catch { continue; }
    const source = known.get(path);
    if (!source || typeof item?.content !== 'string' || item.content === source.content) continue;
    candidates.push({ path, operation: 'update', content: item.content, baseSha: source.sha });
  }
  const changes = candidates.length ? validateChanges(candidates) : [];
  const cleanList = value => (Array.isArray(value) ? value : []).slice(0, 30).map(item => String(item || '').slice(0, 1000)).filter(Boolean);
  return {
    summary: String(data?.summary || data?.resumen || '').slice(0, 8000),
    diagnosis: cleanList(data?.diagnosis || data?.diagnostico),
    impact: cleanList(data?.impact || data?.impacto),
    tests: cleanList(data?.tests || data?.pruebas),
    rollback: String(data?.rollback || '').slice(0, 4000),
    changes
  };
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
    files.push({ path, sha: file.sha, content: file.content.slice(0, 120000) });
  }

  const context = files.map(file => `FILE ${file.path} SHA ${file.sha}\n${file.content}`).join('\n\n---\n\n');
  const system = [
    'Sos el asistente diagnóstico del Estudio de Código Tintin.',
    'Usá únicamente la evidencia entregada por GitHub y diferenciá hechos de hipótesis.',
    'No inventes archivos, pruebas ejecutadas, resultados, dependencias ni conexiones.',
    'No reveles secretos ni propongas evadir autenticación, permisos, CSP, checks o revisión humana.',
    'No podés aprobar, fusionar, desplegar ni publicar.',
    'Respondé exclusivamente como JSON válido, sin Markdown.',
    'Usá esta forma: {"summary":"...","diagnosis":["..."],"impact":["..."],"tests":["..."],"rollback":"...","changes":[{"path":"ruta existente","content":"archivo completo modificado"}]}.',
    'Solo podés proponer updates de archivos entregados. Cada content debe contener el archivo completo, nunca fragmentos.',
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

  const proposal = parseStructuredProposal(text, files);

  return {
    text: proposal.summary || text.slice(0, 40000),
    proposal,
    branch,
    risk: summarizeRisk(paths),
    files: files.map(file => ({ path: file.path, sha: file.sha }))
  };
}
