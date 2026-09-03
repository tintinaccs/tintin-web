#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESSION_VERSION = 'tintin-20260903-global-immediate-sync-1';
const SESSION_REF_RE = /(\/?js\/core\/auth\/proteccion-sesion\.js\?v=)[A-Za-z0-9._-]+/g;

// El auditor de caché recorre todos los HTML raíz, no sólo las páginas
// públicas. Por eso la versión de la sesión se normaliza sobre cualquier
// superficie que realmente la cargue (incluidos admin.html/admin-images.html),
// sin mantener una segunda lista manual que pueda quedar incompleta.
const HTML_FILES = fs.readdirSync(ROOT)
  .filter(name => name.endsWith('.html'))
  .sort();

let changed = 0;
let referenced = 0;
for (const page of HTML_FILES) {
  const file = path.join(ROOT, page);
  const before = fs.readFileSync(file, 'utf8');
  const matches = before.match(SESSION_REF_RE) || [];
  if (!matches.length) continue;
  referenced += 1;
  if (matches.length !== 1) {
    throw new Error(`${page}: se esperaba exactamente una referencia a proteccion-sesion.js y se encontraron ${matches.length}.`);
  }
  const after = before.replace(SESSION_REF_RE, `$1${SESSION_VERSION}`);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed += 1;
  }
}

if (!referenced) throw new Error('No se encontró ninguna superficie que cargue proteccion-sesion.js.');
console.log(`Versión de sesión sincronizada: ${SESSION_VERSION} (${changed}/${referenced} superficies actualizadas).`);
