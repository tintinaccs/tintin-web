import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const target = path.join(path.dirname(self), 'apply-phase7-phase9-hardening.mjs');
let source = fs.readFileSync(target, 'utf8');

const replacements = [
  ["${item?.name || 'producto'}-${index + 1}", "\\${item?.name || 'producto'}-\\${index + 1}"],
  ['${Math.round((completed / ready.length) * 100)}', '\\${Math.round((completed / ready.length) * 100)}'],
  ['${completed} de ${ready.length} importados', '\\${completed} de \\${ready.length} importados'],
  ['${completed} productos importados sin sobrescribir existentes', '\\${completed} productos importados sin sobrescribir existentes'],
  ['${completed} productos importados en Firestore. ${sheetsSyncFailures} quedan pendientes de sincronizar con Sheets.', '\\${completed} productos importados en Firestore. \\${sheetsSyncFailures} quedan pendientes de sincronizar con Sheets.'],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`No se encontró la interpolación esperada: ${before}`);
  source = source.split(before).join(after);
}

fs.writeFileSync(target, source, 'utf8');
fs.unlinkSync(self);
console.log('Plantillas literales del aplicador Fase 9 corregidas.');
