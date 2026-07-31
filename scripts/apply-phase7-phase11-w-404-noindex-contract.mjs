import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const target = path.join(ROOT, 'scripts/audit-aux-pages.js');
const current = fs.readFileSync(target, 'utf8');
const oldCheck = '/<meta name="robots" content="noindex">/.test(notFound)';
const newCheck = '/<meta\\s+name="robots"\\s+content="[^"]*\\bnoindex\\b[^"]*">/i.test(notFound)';

if (!current.includes(oldCheck) && !current.includes(newCheck)) {
  throw new Error('No se encontró el contrato robots del 404.');
}

fs.writeFileSync(target, current.replace(oldCheck, newCheck).replace(/\r\n?/g, '\n'), 'utf8');
fs.unlinkSync(SELF);
console.log('Auditoría 404 actualizada: acepta cualquier directiva robots que contenga noindex.');
