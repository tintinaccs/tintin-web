#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = '0aa0e240e69dd02914405f470f1d2e5167243f02';
const VERSION = 'tintin-20260812-preview-arriba-real-1';

const copyFromValidated = rel => {
  const content = execFileSync('git', ['show', `${SOURCE}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
};

const replaceOne = (text, before, after, label) => {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: esperada 1 coincidencia, encontradas ${count}`);
  return text.replace(before, after);
};

// Recupera el layout pedido por la usuaria y el test de viewports ya validado.
for (const rel of [
  'css/admin/visual-studio-v2.css',
  'js/admin/appearance/editor-visual-admin.js',
  'package.json',
  'tests/visual-builder/apariencia-preview-abajo.spec.js',
  'scripts/auditar-admin-apariencia-unificada.js',
]) copyFromValidated(rel);

// Conserva de #418 el topbar accesible durante scroll y el clipping externo,
// sin volver al layout de tres columnas.
{
  const rel = 'css/admin/visual-studio-v2.css';
  const file = path.join(ROOT, rel);
  let text = fs.readFileSync(file, 'utf8');
  text = replaceOne(text, 'background:var(--vs-bg);overflow:hidden}', 'background:var(--vs-bg);overflow:clip}', 'overflow del estudio');
  text = replaceOne(text, '.visual-editor-topbar{position:sticky;top:0;', '.visual-editor-topbar{position:sticky;top:64px;', 'offset del topbar');
  text += '\n@media(max-width:720px){\n  .visual-studio-v2{overflow:hidden}\n  .visual-studio-v2 .visual-editor-topbar{position:relative;top:auto}\n}\n';
  fs.writeFileSync(file, text, 'utf8');
}

// Bump de caché del CSS dentro del runtime del editor.
{
  const rel = 'js/admin/appearance/editor-visual-admin.js';
  const file = path.join(ROOT, rel);
  let text = fs.readFileSync(file, 'utf8');
  text = replaceOne(text,
    'css/admin/visual-studio-v2.css?v=tintin-20260812-preview-dispositivos-reales-2',
    `css/admin/visual-studio-v2.css?v=${VERSION}`,
    'versión CSS del editor');
  fs.writeFileSync(file, text, 'utf8');
}

// Mantiene el JS de Borrados de #418 intacto; solo versiona el editor visual.
{
  const rel = 'admin.html';
  const file = path.join(ROOT, rel);
  let text = fs.readFileSync(file, 'utf8');
  text = replaceOne(text,
    'js/admin/appearance/editor-visual-admin.js?v=tintin-20260812-studio-tres-paneles-1',
    `js/admin/appearance/editor-visual-admin.js?v=${VERSION}`,
    'versión JS del editor en admin');
  if (!text.includes('js/admin/shopify-commerce-admin.js?v=tintin-20260812-trash-aislado-1')) {
    throw new Error('No se preservó el versionado de Borrados introducido por #418.');
  }
  fs.writeFileSync(file, text, 'utf8');
}

console.log('Combinación aplicada: Borrados de #418 + preview arriba + viewport real.');
