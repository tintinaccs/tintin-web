#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATED = '2891b8142c0fdc7e95223396aee4ee0479cb5a66';
const VERSION = 'tintin-20260812-preview-arriba-real-producto-1';
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(ROOT, rel), text, 'utf8');
const copyValidated = rel => write(rel, execFileSync('git', ['show', `${VALIDATED}:${rel}`], { cwd: ROOT, encoding: 'utf8' }));
const one = (text, before, after, label) => {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: esperada 1 coincidencia, encontradas ${count}`);
  return text.replace(before, after);
};

// #420 no modifica estos contratos; reutilizamos el árbol ya validado para
// layout pedido + viewports internos reales + prueba Playwright.
for (const rel of [
  'css/admin/visual-studio-v2.css',
  'tests/visual-builder/apariencia-preview-abajo.spec.js',
  'scripts/auditar-admin-apariencia-unificada.js',
  'package.json',
]) copyValidated(rel);

// Conserva TODO el editor de #420 (producto real aleatorio, Firestore, etc.)
// y solo apunta al CSS combinado con un tag de caché nuevo.
{
  const rel = 'js/admin/appearance/editor-visual-admin.js';
  let text = read(rel);
  text = one(text,
    'css/admin/visual-studio-v2.css?v=tintin-20260812-studio-tres-paneles-1',
    `css/admin/visual-studio-v2.css?v=${VERSION}`,
    'cache CSS editor');
  if (!text.includes("./preview-dynamic-targets.js?v=tintin-20260812-preview-dinamico-1")) {
    throw new Error('Se perdió la lógica de producto dinámico de #420.');
  }
  write(rel, text);
}

// Conserva admin.html de #420 y cambia únicamente el cache tag del editor.
{
  const rel = 'admin.html';
  let text = read(rel);
  text = one(text,
    'js/admin/appearance/editor-visual-admin.js?v=tintin-20260812-preview-producto-1',
    `js/admin/appearance/editor-visual-admin.js?v=${VERSION}`,
    'cache JS editor');
  if (!text.includes('js/admin/shopify-commerce-admin.js?v=tintin-20260812-trash-aislado-1')) {
    throw new Error('Se perdió el aislamiento de Borrados de #418.');
  }
  write(rel, text);
}

console.log('Combinación final aplicada sobre #420.');
