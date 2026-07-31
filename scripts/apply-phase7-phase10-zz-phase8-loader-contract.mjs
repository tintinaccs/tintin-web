import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const target = path.join(ROOT, 'scripts/audit-phase8-ui-ux.js');
const current = fs.readFileSync(target, 'utf8');
const oldContract = "html.includes('js/page-loader.js?v=tintin-20260730-phase8-ui-1')";
const newContract = "html.includes('js/page-loader.js?v=tintin-20260731-phase10-a11y-1')";

if (!current.includes(oldContract) && !current.includes(newContract)) {
  throw new Error('No se encontró la expectativa HTML de page-loader en la auditoría de Fase 8.');
}

fs.writeFileSync(target, current.split(oldContract).join(newContract).replace(/\r\n?/g, '\n'), 'utf8');
fs.unlinkSync(SELF);
console.log('Auditoría de Fase 8 alineada con el loader accesible de Fase 10.');
