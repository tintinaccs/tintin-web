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
    if (!/^[a-zA-Z0-9_.\/-]+$/.test(path) || path.split('/').includes('..') || path.startsWith('/') || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Entrada de protección inválida.');
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
    if (!/^[a-zA-Z0-9_.\/-]+$/.test(path) || path.split('/').includes('..') || path.startsWith('/') || !/^[a-f0-9]{64}$/.test(hash)) { errors.push('Nueva entrada de protección inválida.'); continue; }
    try { if (flowFileHash(readFile(path)) !== hash) errors.push(`Huella nueva inválida: ${path}`); }
    catch { errors.push(`Archivo nuevo protegido ausente: ${path}`); }
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  try {
    const baseline = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    const index = process.argv.indexOf('--candidate');
    const candidateSha = index < 0 ? '' : process.argv[index + 1];
    if (index >= 0 && !/^[a-f0-9]{40}$/.test(candidateSha || '')) throw new Error('Se requiere un SHA completo de candidato.');
    const readFile = candidateSha
      ? path => execFileSync('git', ['show', `${candidateSha}:${path}`], { stdio: ['ignore', 'pipe', 'pipe'] })
      : path => fs.readFileSync(path);
    const candidate = JSON.parse(readFile(policyPath).toString('utf8'));
    const errors = checkProtectedFlows(baseline, candidate, readFile);
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`Protección de flujos: ${Object.keys(baseline.records).length} registros y ${Object.keys(baseline.files).length} archivos intactos.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
