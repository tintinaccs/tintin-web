#!/usr/bin/env node
'use strict';

/* =============================================================
   TINTIN — Auditoría de versionado de caché

   Los recursos css/js/mjs se sirven con cache immutable. Cada URL exacta
   (ruta + ?v=tag) debe representar siempre los mismos bytes.

   El baseline principal conserva el estado histórico consolidado. Para
   cambios pre-lanzamiento grandes se admite además un overlay pequeño de
   aprobaciones (`scripts/cache-version-approvals.json`) con VERSION + SHA256
   exactos. El overlay NO relaja la auditoría: si los bytes vuelven a cambiar
   con el mismo tag, vuelve a fallar. También permite retirar explícitamente
   entradas que ya no tienen ninguna referencia publicada.
   ============================================================= */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'cache-version-baseline.json');
const APPROVALS_PATH = path.join(ROOT, 'scripts', 'cache-version-approvals.json');

const HTML_FILES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

function walkDir(dir, exts) {
  const out = [];
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDir(rel, exts));
    else if (exts.some(ext => entry.name.endsWith(ext))) out.push(rel);
  }
  return out;
}

const JS_FILES = walkDir('js', ['.js', '.mjs']);
const VERSIONED_LITERAL_RE = /["']([^"'?]+\.(?:css|js|mjs))\?v=([A-Za-z0-9._-]+)["']/g;

function collectFromHtml(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const found = [];
  for (const match of text.matchAll(VERSIONED_LITERAL_RE)) {
    const ref = match[1];
    if (ref.startsWith('http://') || ref.startsWith('https://')) continue;
    found.push({ localPath: ref.replace(/^\.?\//, ''), tag: match[2], sourceFile: file });
  }
  return found;
}

function collectFromJs(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const found = [];
  for (const match of text.matchAll(VERSIONED_LITERAL_RE)) {
    const ref = match[1];
    if (ref.startsWith('http://') || ref.startsWith('https://')) continue;
    const resolved = ref.startsWith('.')
      ? path.relative(ROOT, path.resolve(ROOT, path.dirname(file), ref))
      : ref.replace(/^\.?\//, '');
    found.push({ localPath: resolved.split(path.sep).join('/'), tag: match[2], sourceFile: file });
  }
  return found;
}

const references = [
  ...HTML_FILES.flatMap(collectFromHtml),
  ...JS_FILES.flatMap(collectFromJs),
];

if (!references.length) {
  console.error('No se encontraron referencias con ?v= — revisar las expresiones regulares del script.');
  process.exit(1);
}

const byPath = new Map();
const inconsistencies = [];
for (const ref of references) {
  if (!fs.existsSync(path.join(ROOT, ref.localPath))) {
    console.error(`Referencia rota: ${ref.sourceFile} apunta a "${ref.localPath}", que no existe.`);
    process.exit(1);
  }
  const existing = byPath.get(ref.localPath);
  if (existing && existing.tag !== ref.tag) {
    inconsistencies.push(
      `"${ref.localPath}" se referencia con tags distintos: "${existing.tag}" (${existing.sourceFile}) vs "${ref.tag}" (${ref.sourceFile})`
    );
  } else if (!existing) {
    byPath.set(ref.localPath, ref);
  }
}

if (inconsistencies.length) {
  console.error('Inconsistencias de versión de caché encontradas:\n' + inconsistencies.map(m => `  - ${m}`).join('\n'));
  process.exit(1);
}

const expected = {};
for (const [localPath, ref] of [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const canonicalText = fs.readFileSync(path.join(ROOT, localPath), 'utf8').replace(/\r\n/g, '\n');
  expected[localPath] = {
    version: ref.tag,
    sha256: crypto.createHash('sha256').update(canonicalText, 'utf8').digest('hex'),
  };
}

const mode = process.argv.includes('--write') ? 'write' : 'check';

if (mode === 'write') {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(expected, null, 2) + '\n', 'utf8');
  if (fs.existsSync(APPROVALS_PATH)) {
    fs.writeFileSync(APPROVALS_PATH, JSON.stringify({ approved: {}, removed: [] }, null, 2) + '\n', 'utf8');
  }
  console.log(`Baseline de versionado de caché actualizada: ${Object.keys(expected).length} archivos.`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE_PATH)) {
  console.error('No existe scripts/cache-version-baseline.json. Corré "npm run cache-versioning:write" y commiteá el resultado.');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
let approvals = { approved: {}, removed: [] };
if (fs.existsSync(APPROVALS_PATH)) {
  try {
    approvals = JSON.parse(fs.readFileSync(APPROVALS_PATH, 'utf8'));
  } catch (error) {
    console.error(`No se pudo leer ${path.relative(ROOT, APPROVALS_PATH)}: ${error.message}`);
    process.exit(1);
  }
}

if (!approvals || typeof approvals !== 'object' || Array.isArray(approvals)) {
  console.error('cache-version-approvals.json debe ser un objeto JSON.');
  process.exit(1);
}
if (!approvals.approved || typeof approvals.approved !== 'object' || Array.isArray(approvals.approved)) {
  console.error('cache-version-approvals.json: "approved" debe ser un objeto.');
  process.exit(1);
}
if (!Array.isArray(approvals.removed)) {
  console.error('cache-version-approvals.json: "removed" debe ser un array.');
  process.exit(1);
}

const committed = { ...baseline };
for (const localPath of approvals.removed) delete committed[localPath];
for (const [localPath, info] of Object.entries(approvals.approved)) {
  if (!info || typeof info.version !== 'string' || !/^[a-f0-9]{64}$/.test(String(info.sha256 || ''))) {
    console.error(`Aprobación inválida para "${localPath}": requiere version y sha256 hexadecimal de 64 caracteres.`);
    process.exit(1);
  }
  committed[localPath] = { version: info.version, sha256: info.sha256 };
}

const problems = [];
for (const [localPath, info] of Object.entries(expected)) {
  const before = committed[localPath];
  if (!before) {
    problems.push(`NUEVO sin aprobar: "${localPath}" (tag "${info.version}", sha256 ${info.sha256}). Agregalo al baseline/overlay con su hash exacto.`);
    continue;
  }
  if (before.version === info.version && before.sha256 !== info.sha256) {
    problems.push(`CONTENIDO CAMBIÓ SIN BUMP DE VERSIÓN: "${localPath}" sigue con el tag "${info.version}" pero cambió de ${before.sha256} a ${info.sha256}. Subí el ?v= antes de deployar.`);
  } else if (before.version !== info.version && before.sha256 === info.sha256) {
    problems.push(`Bump de versión innecesario: "${localPath}" cambió de "${before.version}" a "${info.version}" con el mismo sha256 ${info.sha256}.`);
  } else if (before.version !== info.version || before.sha256 !== info.sha256) {
    problems.push(`Bump sin aprobar: "${localPath}" ("${before.version}" → "${info.version}", sha256 ${info.sha256}). Aprobalo con ese hash exacto en baseline/overlay.`);
  }
}

for (const localPath of Object.keys(committed)) {
  if (!expected[localPath]) {
    problems.push(`Entrada obsoleta aprobada (ya nadie referencia "${localPath}"). Retirala del baseline o declarala en approvals.removed.`);
  }
}

for (const localPath of Object.keys(approvals.approved)) {
  if (!expected[localPath]) {
    problems.push(`Aprobación obsoleta: "${localPath}" ya no está referenciado.`);
  }
}
for (const localPath of approvals.removed) {
  if (expected[localPath]) {
    problems.push(`Remoción inválida: "${localPath}" sigue estando referenciado.`);
  }
}

if (problems.length) {
  console.error(`Auditoría de versionado de caché: ${problems.length} problema(s):\n` + problems.map(m => `  - ${m}`).join('\n'));
  process.exit(1);
}

console.log(`Auditoría de versionado de caché: correcta (${Object.keys(expected).length} archivos versionados; baseline + aprobaciones exactas consistentes).`);
