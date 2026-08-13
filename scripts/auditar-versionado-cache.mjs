#!/usr/bin/env node
'use strict';

/* =============================================================
   TINTIN — Auditoría de versionado de caché

   Por qué existe: css/js/mjs se sirven con
   `Cache-Control: public, max-age=31536000, immutable` (ver _headers).
   Esa política es correcta SOLO si cada URL exacta (ruta + `?v=tag`)
   representa siempre los mismos bytes para siempre — es la promesa que
   le hacemos al navegador con "immutable". Si alguien edita
   styles.css y se olvida de subir su `?v=`, la URL sigue siendo la
   misma pero el contenido cambió: el navegador nunca vuelve a pedirla
   (por diseño de "immutable"), y la única forma de ver el cambio es un
   hard refresh que vacíe la caché a mano. Ese es el bug de fondo detrás
   de "tengo que apretar Ctrl+Shift+R para ver lo nuevo".

   Qué hace este script: sigue el mismo patrón que
   scripts/generar-csp-cloudflare.js (generar vs. --check). Escanea todas
   las referencias `?v=tag` a archivos locales (.css/.js/.mjs) en los
   .html de la raíz y en los imports de js/**, calcula el sha256 real de
   cada archivo referenciado y compara contra
   scripts/cache-version-baseline.json (comprometido en git).

   - Si el sha256 real difiere del que quedó guardado bajo el mismo
     `?v=tag`: el contenido cambió sin subir la versión → FALLA. Esto es
     lo que hay que corregir subiendo el tag de versión donde corresponda
     y volviendo a correr con --write.
   - Si una misma ruta aparece con dos tags distintos en el propio
     repositorio: inconsistencia entre páginas → FALLA.
   - `--write` regenera scripts/cache-version-baseline.json con el
     estado actual (para usar después de subir un tag a propósito, antes
     de commitear).
   ============================================================= */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'cache-version-baseline.json');

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

// Sin anclar a href=/src=/from — un archivo puede quedar versionado dentro
// de un new URL(...), un link.href = '...' suelto, o cualquier otro string
// literal. Cualquier "ruta.css?v=tag" o "ruta.js?v=tag" entre comillas cuenta,
// sea cual sea la sintaxis que lo rodea.
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
  // Git conserva estos recursos como texto LF, pero core.autocrlf puede
  // materializarlos como CRLF en Windows. El baseline debe representar el
  // contenido canónico del repositorio para ser reproducible en CI/Linux.
  const canonicalText = fs.readFileSync(path.join(ROOT, localPath), 'utf8').replace(/\r\n/g, '\n');
  expected[localPath] = {
    version: ref.tag,
    sha256: crypto.createHash('sha256').update(canonicalText, 'utf8').digest('hex'),
  };
}

const mode = process.argv.includes('--write') ? 'write' : 'check';

if (mode === 'write') {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(expected, null, 2) + '\n', 'utf8');
  console.log(`Baseline de versionado de caché actualizada: ${Object.keys(expected).length} archivos.`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE_PATH)) {
  console.error('No existe scripts/cache-version-baseline.json. Corré "npm run cache-versioning:write" y commiteá el resultado.');
  process.exit(1);
}

const committed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

const problems = [];
for (const [localPath, info] of Object.entries(expected)) {
  const before = committed[localPath];
  if (!before) {
    problems.push(`NUEVO sin aprobar en baseline: "${localPath}" (tag "${info.version}"). Corré npm run cache-versioning:write y commiteá scripts/cache-version-baseline.json.`);
    continue;
  }
  if (before.version === info.version && before.sha256 !== info.sha256) {
    problems.push(`CONTENIDO CAMBIÓ SIN BUMP DE VERSIÓN: "${localPath}" sigue con el tag "${info.version}" pero su contenido ya no coincide con lo publicado bajo ese tag. Los navegadores lo tienen cacheado como inmutable — subí el "?v=" en todos los lugares que lo referencian antes de deployar.`);
  } else if (before.version !== info.version && before.sha256 === info.sha256) {
    problems.push(`Bump de versión innecesario: "${localPath}" cambió de tag ("${before.version}" → "${info.version}") pero el contenido es idéntico. No es un error de caché, pero desperdicia una descarga para todas las visitantes. Corré npm run cache-versioning:write para aceptarlo si es intencional.`);
  } else if (before.version !== info.version || before.sha256 !== info.sha256) {
    // Bump legítimo: mismo path, nuevo tag Y nuevo contenido. Falta aprobar en baseline.
    problems.push(`Bump sin aprobar en baseline: "${localPath}" (tag "${before.version}" → "${info.version}"). Corré npm run cache-versioning:write y commiteá scripts/cache-version-baseline.json.`);
  }
}

for (const localPath of Object.keys(committed)) {
  if (!expected[localPath]) {
    problems.push(`Entrada obsoleta en baseline (ya nadie referencia "${localPath}"). Corré npm run cache-versioning:write para limpiarla.`);
  }
}

if (problems.length) {
  console.error(`Auditoría de versionado de caché: ${problems.length} problema(s):\n` + problems.map(m => `  - ${m}`).join('\n'));
  process.exit(1);
}

console.log(`Auditoría de versionado de caché: correcta (${Object.keys(expected).length} archivos versionados, todos consistentes con su ?v=).`);
