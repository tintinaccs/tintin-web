import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const target = path.join(ROOT, 'scripts/apply-phase7-phase11-seo-publication.mjs');
const current = fs.readFileSync(target, 'utf8');
const before = "raw.includes('${')";
const after = "raw.includes('\\${')";

if (!current.includes(before) && !current.includes(after)) {
  throw new Error('No se encontró el literal dinámico del auditor de enlaces SEO.');
}

fs.writeFileSync(target, current.replace(before, after).replace(/\r\n?/g, '\n'), 'utf8');
fs.unlinkSync(SELF);
console.log('Generador SEO corregido: el literal ${ ya no se interpreta como interpolación.');
