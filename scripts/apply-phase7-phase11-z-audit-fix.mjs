import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const target = path.join(ROOT, 'scripts/audit-phase11-seo.js');
const current = fs.readFileSync(target, 'utf8');
const oldLine = "  ...fs.readdirSync(root).filter(file => /\\.(?:html|js|json|xml|txt)$/.test(file)),";
const newLine = "  ...fs.readdirSync(root).filter(file => file !== 'diagnostic-manifest.json' && /\\.(?:html|js|json|xml|txt)$/.test(file)),";
if (!current.includes(oldLine) && !current.includes(newLine)) {
  throw new Error('No se encontró el inventario de archivos activos de Fase 11.');
}
fs.writeFileSync(target, current.replace(oldLine, newLine).replace(/\r\n?/g, '\n'), 'utf8');
fs.unlinkSync(SELF);
console.log('Auditoría SEO ajustada para evaluar fuentes activas y no el manifiesto previo.');
