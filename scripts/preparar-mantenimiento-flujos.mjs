import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { flowFileHash } from './auditar-proteccion-flujos.mjs';
import { controlPath, inspectMaintenance, planPath, policyPath } from './mantenimiento-flujos-core.mjs';

// Uso: node scripts/preparar-mantenimiento-flujos.mjs SHA_BASE "motivo" ruta1 ruta2
// Calcula huellas reales. No aprueba, no ejecuta pruebas y no publica cambios.
try {
  const [baseSha, reason, ...paths] = process.argv.slice(2);
  if (!/^[a-f0-9]{40}$/.test(baseSha || '') || !reason || reason.trim().length < 20 || !paths.length ||
      new Set(paths).size !== paths.length) throw new Error('Se requieren SHA base, motivo de al menos 20 caracteres y rutas únicas.');
  const baseline = JSON.parse(execFileSync('git', ['show', `${baseSha}:${policyPath}`], { encoding: 'utf8' }));
  const candidate = structuredClone(baseline);
  const files = paths.map(path => {
    if (!Object.hasOwn(baseline.files, path) || controlPath(path)) throw new Error(`Ruta no autorizable mediante mantenimiento: ${path}`);
    const newHash = flowFileHash(fs.readFileSync(path));
    if (newHash === baseline.files[path]) throw new Error(`Ruta sin cambios: ${path}`);
    candidate.files[path] = newHash;
    return { path, oldHash: baseline.files[path], newHash };
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const affectedRecords = Object.entries(baseline.records).filter(([, recordPaths]) =>
    recordPaths.some(path => paths.includes(path))).map(([id]) => id).sort();
  const plan = { schemaVersion: 1, baseCommit: baseSha, reason, files, affectedRecords };
  const changedPaths = execFileSync('git', ['diff', '--name-only', baseSha, '--'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  inspectMaintenance({ baseline, candidate, baseSha, plan, changedPaths, readFile: path => fs.readFileSync(path) });
  fs.writeFileSync(policyPath, `${JSON.stringify(candidate, null, 2)}\n`);
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`Plan preparado: ${files.length} archivos, ${affectedRecords.length} registros afectados. Falta CI y aprobación humana del SHA final.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
