import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(self), '..');
const target = path.join(root, 'scripts/build-diagnostic-manifest.js');
const before = fs.readFileSync(target, 'utf8');
const oldPattern = "if (/^(?:https?:|mailto:|tel:|javascript:|data:|blob:|\\/\\/)/i.test(value)) return null;";
const newPattern = "if (/^(?:node:|https?:|mailto:|tel:|javascript:|data:|blob:|\\/\\/)/i.test(value)) return null;";
if (!before.includes(oldPattern)) throw new Error('No se encontró el filtro de referencias externas del manifiesto.');
fs.writeFileSync(target, before.replace(oldPattern, newPattern), 'utf8');
fs.unlinkSync(self);
console.log('El manifiesto ignora módulos nativos node: como referencias externas.');
