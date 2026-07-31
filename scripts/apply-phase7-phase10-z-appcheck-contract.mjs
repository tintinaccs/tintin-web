import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const target = path.join(ROOT, 'scripts/audit-app-check-bootstrap.js');
const current = fs.readFileSync(target, 'utf8');
const oldVersion = 'page-loader.js?v=tintin-20260730-phase8-ui-1';
const newVersion = 'page-loader.js?v=tintin-20260731-phase10-a11y-1';

if (!current.includes(oldVersion) && !current.includes(newVersion)) {
  throw new Error('No se encontró el contrato de versión del loader en App Check.');
}

fs.writeFileSync(target, current.split(oldVersion).join(newVersion).replace(/\r\n?/g, '\n'), 'utf8');
fs.unlinkSync(SELF);
console.log('Contrato de App Check alineado con el loader accesible de Fase 10.');
