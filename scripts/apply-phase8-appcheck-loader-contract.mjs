import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'scripts/audit-app-check-bootstrap.js');
let source = fs.readFileSync(file, 'utf8');

const before = "read(file).includes('page-loader.js?v=tintin-20260730-appcheck-stable-4')";
const after = "read(file).includes('page-loader.js?v=tintin-20260730-phase8-ui-1')";

if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('No se encontró la huella histórica del loader en App Check.');
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
}

fs.rmSync(import.meta.filename);
console.log('Huella del loader actualizada en la auditoría de App Check.');
