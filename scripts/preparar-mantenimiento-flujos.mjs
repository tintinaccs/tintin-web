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
  const config = JSON.parse(execFileSync('git', ['show', `${baseSha}:config/mantenimiento-flujos.json`], { encoding: 'utf8' }));
  const allowControlUpdates = config.automaticControlMaintenance === true;
  const candidate = structuredClone(baseline);
  const files = [], removedFiles = [];
  for (const path of paths) {
    if (!Object.hasOwn(baseline.files, path) || (!allowControlUpdates && controlPath(path))) throw new Error(`Ruta no autorizable mediante mantenimiento: ${path}`);
    if (!fs.existsSync(path)) { removedFiles.push({ path, oldHash: baseline.files[path] }); delete candidate.files[path]; continue; }
    const newHash = flowFileHash(fs.readFileSync(path));
    if (newHash === baseline.files[path]) throw new Error(`Ruta sin cambios: ${path}`);
    candidate.files[path] = newHash;
    files.push({ path, oldHash: baseline.files[path], newHash });
  }
  const byPath = (x, y) => x.path.localeCompare(y.path, 'en');
  files.sort(byPath); removedFiles.sort(byPath);
  const affectedRecords = Object.entries(baseline.records).filter(([, recordPaths]) =>
    recordPaths.some(path => paths.includes(path))).map(([id]) => id).sort();
  const plan = { schemaVersion: 1, baseCommit: baseSha, reason, files, affectedRecords, ...(removedFiles.length ? { removedFiles } : {}) };
  const changedPaths = execFileSync('git', ['diff', '--name-only', baseSha, '--'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  inspectMaintenance({ baseline, candidate, baseSha, plan, changedPaths, allowControlUpdates, readFile: path => fs.readFileSync(path) });
  fs.writeFileSync(policyPath, `${JSON.stringify(candidate, null, 2)}\n`);
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`Plan preparado: ${files.length} archivos renovados, ${removedFiles.length} retirados, ${affectedRecords.length} registros afectados. La validación y publicación automáticas requieren CI del SHA final.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
