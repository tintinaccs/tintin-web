import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const policyPath = 'config/proteccion-flujos.json';
export function flowFileHash(bytes) {
  return crypto.createHash('sha256').update(Buffer.from(bytes).toString('utf8').replace(/\r\n?/g, '\n')).digest('hex');
}

export function checkProtectedFlows(baseline, candidate, readFile) {
  const errors = [];
  if (baseline?.schemaVersion !== 1 || !Object.keys(baseline.files || {}).length) throw new Error('Línea base de protección ausente o inválida.');
  if (candidate?.schemaVersion !== 1) return ['La política candidata no tiene el formato protegido.'];
  for (const [path, expected] of Object.entries(baseline.files)) {
    if (!/^[a-zA-Z0-9_.\/\[\]-]+$/.test(path) || path.split('/').includes('..') || path.startsWith('/') || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Entrada de protección inválida.');
    if (candidate.files?.[path] !== expected) errors.push(`Se intentó cambiar o retirar la protección de ${path}`);
    try {
      if (flowFileHash(readFile(path)) !== expected) errors.push(`Archivo protegido modificado: ${path}`);
    } catch { errors.push(`Archivo protegido eliminado o ilegible: ${path}`); }
  }
  for (const [id, files] of Object.entries(baseline.records || {})) {
    if (JSON.stringify(candidate.records?.[id]) !== JSON.stringify(files)) errors.push(`Se intentó retirar o cambiar el alcance del registro protegido ${id}`);
  }
  // Se pueden incorporar nuevos verdes, pero todas sus huellas deben ser reales.
  for (const [path, hash] of Object.entries(candidate.files || {})) {
    if (Object.hasOwn(baseline.files, path)) continue;
    if (!/^[a-zA-Z0-9_.\/\[\]-]+$/.test(path) || path.split('/').includes('..') || path.startsWith('/') || !/^[a-f0-9]{64}$/.test(hash)) { errors.push('Nueva entrada de protección inválida.'); continue; }
    try { if (flowFileHash(readFile(path)) !== hash) errors.push(`Huella nueva inválida: ${path}`); }
    catch { errors.push(`Archivo nuevo protegido ausente: ${path}`); }
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  try {
    const baseline = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    const remoteIndex = process.argv.indexOf('--remote-candidate');
    const index = remoteIndex >= 0 ? remoteIndex : process.argv.indexOf('--candidate');
    const candidateSha = index < 0 ? '' : process.argv[index + 1];
    if (index >= 0 && !/^[a-f0-9]{40}$/.test(candidateSha || '')) throw new Error('Se requiere un SHA completo de candidato.');
    let remoteFiles;
    if (remoteIndex >= 0) {
      const githubRead = async path => {
        const response = await fetch(`https://api.github.com/repos/tintinaccs/tintin-web/${path}`, {
          headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${process.env.GH_TOKEN || ''}` },
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error(`Lectura de candidato rechazada: HTTP ${response.status}`);
        return response.json();
      };
      // Sólo JSON y bytes: no se descarga ni ejecuta el árbol de trabajo candidato.
      const tree = await githubRead(`git/trees/${candidateSha}?recursive=1`);
      if (tree.truncated) throw new Error('Árbol candidato incompleto.');
      const blobs = new Map(tree.tree.filter(item => item.type === 'blob').map(item => [item.path, item.sha]));
      remoteFiles = new Map();
      const readBlob = async path => {
        const sha = blobs.get(path);
        if (!sha) throw new Error(`Archivo candidato ausente: ${path}`);
        const blob = await githubRead(`git/blobs/${sha}`);
        if (blob.encoding !== 'base64') throw new Error('Codificación candidata inválida.');
        remoteFiles.set(path, Buffer.from(blob.content, 'base64'));
      };
      await readBlob(policyPath);
      const policy = JSON.parse(remoteFiles.get(policyPath).toString('utf8'));
      const paths = [...new Set([...Object.keys(baseline.files), ...Object.keys(policy.files || {})])];
      if (paths.length > 1000) throw new Error('El candidato excede el límite de archivos protegidos.');
      for (let i = 0; i < paths.length; i += 8) await Promise.all(paths.slice(i, i + 8).map(readBlob));
    }
    const readFile = remoteFiles ? path => {
      if (!remoteFiles.has(path)) throw new Error('Archivo remoto ausente.');
      return remoteFiles.get(path);
    } : candidateSha
      ? path => execFileSync('git', ['show', `${candidateSha}:${path}`], { stdio: ['ignore', 'pipe', 'pipe'] })
      : path => fs.readFileSync(path);
    const candidate = JSON.parse(readFile(policyPath).toString('utf8'));
    const errors = checkProtectedFlows(baseline, candidate, readFile);
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`Protección de flujos: ${Object.keys(baseline.records).length} registros y ${Object.keys(baseline.files).length} archivos intactos.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
