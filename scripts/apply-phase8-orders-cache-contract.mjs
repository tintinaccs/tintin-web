import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'scripts/audit-admin-orders.js');
let source = fs.readFileSync(file, 'utf8');

const before = "    /TT_CACHE_VERSION = 'tintin-20260730-appcheck-stable-4'/.test(read('js/page-loader.js')),";
const after = "    /TT_CACHE_VERSION = 'tintin-20260730-phase8-ui-1'/.test(read('js/page-loader.js')),";

if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('No se encontró el contrato histórico de caché del panel.');
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
}

fs.rmSync(import.meta.filename);
console.log('Contrato de caché del panel actualizado para Fase 8.');
