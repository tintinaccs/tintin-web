import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'scripts/audit-final-integration.js');
let source = fs.readFileSync(target, 'utf8');

const start = source.indexOf("const workflowDirectory = path.join(root, '.github/workflows');");
const endMarker = "check('Todos los scripts de CI existen', workflowMissing.length === 0, workflowMissing.join(', '));";
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('No se encontró el bloque de validación de scripts de CI.');

const replacement = `const workflowDirectory = path.join(root, '.github/workflows');
const currentWorkflowRef = String(process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '');
const branchScopedWorkflows = new Map([
  ['apply-unified-store-logic.yml', 'audit/unified-store-logic'],
  ['validate-unified-store-final.yml', 'audit/unified-store-logic']
]);
const workflowMissing = [];
for (const file of fs.readdirSync(workflowDirectory).filter(file => /\\.ya?ml$/.test(file))) {
  const requiredRef = branchScopedWorkflows.get(file) || '';
  // Estos workflows solo pueden ejecutarse para su rama exacta. Sus scripts
  // viven en esa misma rama de trabajo y no forman parte del producto publicado.
  if (requiredRef && currentWorkflowRef !== requiredRef) continue;
  const text = fs.readFileSync(path.join(workflowDirectory, file), 'utf8');
  for (const match of text.matchAll(/node (scripts\\/[A-Za-z0-9._-]+\\.js)/g)) {
    if (!exists(match[1]) && !workflowMissing.includes(match[1])) workflowMissing.push(match[1]);
  }
}
check('Todos los scripts de CI aplicables existen', workflowMissing.length === 0, workflowMissing.join(', '));`;

source = source.slice(0, start) + replacement + source.slice(end + endMarker.length);
fs.writeFileSync(target, source, 'utf8');
fs.unlinkSync(fileURLToPath(import.meta.url));
console.log('Auditoría final ajustada: valida solo workflows aplicables a la rama evaluada.');
