#!/usr/bin/env node
'use strict';

/* =============================================================
   TINTIN — Auditoría de versionado de caché

   Los recursos css/js/mjs se sirven con cache immutable. Cada URL exacta
   (ruta + ?v=tag) debe representar siempre los mismos bytes y cada archivo
   debe pedirse con UNA sola URL en todo el sitio.

   Referencias auditadas:
   - Literales "ruta?v=tag" en los HTML de la raíz y en los JS de la raíz,
     js/, functions/ y cloudflare/.
   - Cargas dinámicas que arman el ?v= en tiempo de ejecución: importSibling,
     resolveAsset, versioned, css(), versionedJsModule, versionedSiteAsset,
     los estilos de recursos-navegacion.js, load(), new URL(...) +
     searchParams.set('v', ...) y plantillas `ruta?v=${CONSTANTE}`. Un
     mecanismo ?v= dinámico que este script no sabe resolver es un error:
     sin resolverlo no se puede auditar.

   Reglas:
   - Un archivo pedido con dos URLs distintas es un error: el navegador lo
     descarga dos veces y, si es un módulo ES, ejecuta dos instancias.
   - La línea base (baseline + overlay de aprobaciones) registra la huella
     de cada URL. Toda diferencia con el estado actual es un error:
       · bytes nuevos con el mismo tag: hay que subir el ?v= (la URL
         inmutable anterior ya puede estar cacheada en los navegadores);
       · mismos bytes con otro tag: bump innecesario, salvo que el archivo
         también se cargue dinámicamente (el tag compartido de un helper o
         la alineación de dos URLs lo exigen);
       · bytes nuevos con tag nuevo, o archivo nuevo: correcto, pero hay
         que registrarlo con "npm run cache-versioning:write" para que un
         cambio posterior de bytes bajo ese tag se detecte.
   - --write se niega a registrar mientras existan errores de los dos
     primeros tipos y conserva las entradas históricas ya no referenciadas.
   ============================================================= */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'cache-version-baseline.json');
const APPROVALS_PATH = path.join(ROOT, 'scripts', 'cache-version-approvals.json');
const WRITE_COMMAND = 'npm run cache-versioning:write';
const RERECORD_HINT = 'si ese tag todavía no se publicó en main, se puede volver a registrar desde main: '
  + 'git checkout origin/main -- scripts/cache-version-baseline.json scripts/cache-version-approvals.json && npm run cache-versioning:write';

const toPosix = file => file.split(path.sep).join('/');
const textCache = new Map();
function readText(file) {
  if (!textCache.has(file)) textCache.set(file, fs.readFileSync(path.join(ROOT, file), 'utf8'));
  return textCache.get(file);
}

const HTML_FILES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

function walkDir(dir, exts) {
  const out = [];
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDir(rel, exts));
    else if (exts.some(ext => entry.name.endsWith(ext))) out.push(toPosix(rel));
  }
  return out;
}

// Los .js de la raíz (tienda.js) y de cloudflare/ (inyectado por functions/) también piden módulos versionados.
const ROOT_JS_FILES = fs.readdirSync(ROOT).filter(f => /\.m?js$/.test(f) && !/\.config\.m?js$/.test(f));
const JS_FILES = [
  ...ROOT_JS_FILES,
  ...['js', 'functions', 'cloudflare'].flatMap(dir => walkDir(dir, ['.js', '.mjs'])),
];
const VERSIONED_LITERAL_RE = /["']([^"'?]+\.(?:css|js|mjs))\?v=([A-Za-z0-9._-]+)["']/g;
const VERSIONED_ASSET_RE = /\.(?:css|js|mjs)$/;

function collectFromHtml(file) {
  const text = readText(file);
  const found = [];
  for (const match of text.matchAll(VERSIONED_LITERAL_RE)) {
    const ref = match[1];
    if (ref.startsWith('http://') || ref.startsWith('https://')) continue;
    found.push({ localPath: ref.replace(/^\.?\//, ''), tag: match[2], query: '', sourceFile: file, via: 'literal' });
  }
  return found;
}

function collectFromJs(file) {
  const text = readText(file);
  const found = [];
  for (const match of text.matchAll(VERSIONED_LITERAL_RE)) {
    const ref = match[1];
    if (ref.startsWith('http://') || ref.startsWith('https://')) continue;
    const resolved = ref.startsWith('.')
      ? path.relative(ROOT, path.resolve(ROOT, path.dirname(file), ref))
      : ref.replace(/^\.?\//, '');
    found.push({ localPath: toPosix(resolved), tag: match[2], query: '', sourceFile: file, via: 'literal' });
  }
  return found;
}

/* ---------- Cargas dinámicas ---------- */

const LOADER_FILE = 'js/cargador-pagina.js';
const QUALITY_FILE = 'js/quality/calidad-interfaz.js';
const SHELL_FILE = 'js/components/navigation/compartido/configuracion.js';
const NAV_ASSETS_FILE = 'js/components/navigation/compartido/recursos-navegacion.js';
const MAINTENANCE_FILE = 'js/cargador-mantenimiento-pagina.js';
// Archivos que definen un helper ?v=: su mecanismo interno se audita a través de las llamadas.
const HELPER_DEFINING_FILES = new Set([LOADER_FILE, QUALITY_FILE, SHELL_FILE, NAV_ASSETS_FILE, MAINTENANCE_FILE]);

// Helpers que agregan ?v= a una ruta. Las llamadas con ruta literal se resuelven más abajo; con una
// ruta no literal no se sabe qué URL piden, así que solo se admiten las llamadas listadas en allowed
// (sus rutas salen de tuplas que sí se resuelven).
const HELPERS = [
  { name: 'importSibling', files: [LOADER_FILE] },
  { name: 'resolveAsset', files: [LOADER_FILE] },
  { name: 'versioned', files: [QUALITY_FILE], allowed: ["versioned('../../css/'+file,f[2])"] },
  { name: 'load', files: [MAINTENANCE_FILE] },
  { name: 'versionedJsModule' },
  { name: 'versionedSiteAsset', allowed: ['versionedSiteAsset(path)'] },
];

const SHIM_NAMES = ['navegacion-compartida', 'navegacion-movil', 'navegacion-escritorio', 'navegacion-tableta'];
const SOURCE_FILES = [...HTML_FILES, ...JS_FILES];

// Archivos con un mecanismo ?v= dinámico que no se ejecuta. Cada excepción verifica su motivo.
const DYNAMIC_IGNORED = {
  'js/quality/correccion-auditoria-pagina.js': {
    reason: 'versionUrl() y versionLocalCssLinks() están definidas pero nunca se llaman; las demás concatenaciones ?v= son de imágenes',
    verify(text) {
      const lines = text.split('\n');
      const deadLine = lines.findIndex(line => line.includes('function versionLocalCssLinks('));
      const callLines = re => lines.flatMap((line, index) => [...line.matchAll(re)].map(() => index));
      return deadLine >= 0
        && callLines(/(?<!function )\bversionLocalCssLinks\(/g).length === 0
        && callLines(/(?<!function )\bversionUrl\(/g).every(index => index === deadLine);
    },
  },
  ...Object.fromEntries(SHIM_NAMES.map(name => [`js/components/navigation/compatibilidad/${name}.js`, {
    reason: 'adaptador IIFE heredado que ninguna página ni módulo carga; su import() nunca se ejecuta',
    verify(text, file) {
      const mention = new RegExp(`(?<![\\w-])${name}\\.js`);
      return SOURCE_FILES.every(source => source === file || !mention.test(readText(source)));
    },
  }])),
};

const dynamicProblems = [];
const handledMarkers = new Set();

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function constValue(text, name, file) {
  const match = text.match(new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*'([^']+)'`));
  if (!match) dynamicProblems.push(`${file}: no se pudo leer el valor literal de ${name}.`);
  return match ? match[1] : null;
}

function collectDynamic() {
  const found = [];
  const push = (baseDir, ref, tag, sourceFile, via) => {
    const [file, query = ''] = ref.replace(/^\//, '').split('?');
    if (!tag || !VERSIONED_ASSET_RE.test(file)) return;
    const localPath = toPosix(path.relative(ROOT, path.resolve(ROOT, baseDir, file)));
    found.push({ localPath, tag, query, sourceFile, via });
  };

  // cargador-pagina.js: importSibling() resuelve contra js/ y resolveAsset() contra la raíz.
  {
    const text = readText(LOADER_FILE);
    const tag = constValue(text, 'TT_CACHE_VERSION', LOADER_FILE);
    for (const m of text.matchAll(/importSibling\('([^']+)'/g)) push('js', m[1], tag, LOADER_FILE, 'importSibling');
    for (const m of text.matchAll(/resolveAsset\('([^']+)'\s*(,\s*false\s*)?\)/g)) {
      if (!m[2]) push('.', m[1], tag, LOADER_FILE, 'resolveAsset');
    }
  }
  // calidad-interfaz.js: versioned() resuelve contra js/quality y las tuplas de css() contra css/.
  {
    const text = readText(QUALITY_FILE);
    const tag = constValue(text, 'TT_CACHE_VERSION', QUALITY_FILE);
    for (const m of text.matchAll(/versioned\('([^']+)'\)/g)) push('js/quality', m[1], tag, QUALITY_FILE, 'versioned');
    for (const m of text.matchAll(/\['tt-[^']+','([^']+\.css)'(?:,'([^']+)')?\]/g)) {
      push('css', m[1], m[2] || tag, QUALITY_FILE, 'css()');
    }
  }
  // configuracion.js: versionedJsModule() resuelve contra js/ y versionedSiteAsset() contra la raíz, ambos con SHELL_VERSION.
  const shellTag = constValue(readText(SHELL_FILE), 'SHELL_VERSION', SHELL_FILE);
  for (const file of JS_FILES) {
    const text = readText(file);
    for (const m of text.matchAll(/versionedJsModule\('([^']+)'\)/g)) push('js', m[1], shellTag, file, 'versionedJsModule');
    for (const m of text.matchAll(/versionedSiteAsset\('([^']+)'\)/g)) push('.', m[1], shellTag, file, 'versionedSiteAsset');
  }
  // recursos-navegacion.js: tuplas [id, ruta desde la raíz, CONSTANTE].
  {
    const text = readText(NAV_ASSETS_FILE);
    for (const m of text.matchAll(/\['[^']+', '([^']+)', (\w+)\]/g)) {
      push('.', m[1], constValue(text, m[2], NAV_ASSETS_FILE), NAV_ASSETS_FILE, 'ensureStylesheet');
    }
  }
  // cargador-mantenimiento-pagina.js: load(archivo[, 'tag' | CONSTANTE]) resuelve contra js/.
  {
    const text = readText(MAINTENANCE_FILE);
    const defaultTag = text.match(/function load\(file, version = '([^']+)'\)/)?.[1];
    if (!defaultTag) dynamicProblems.push(`${MAINTENANCE_FILE}: no se pudo leer el tag por defecto de load().`);
    for (const m of text.matchAll(/\bload\('([^']+)'(?:,\s*(?:'([^']+)'|(\w+)))?\)/g)) {
      push('js', m[1], m[2] || (m[3] ? constValue(text, m[3], MAINTENANCE_FILE) : defaultTag), MAINTENANCE_FILE, 'load');
    }
  }
  for (const file of JS_FILES) {
    if (DYNAMIC_IGNORED[file] || HELPER_DEFINING_FILES.has(file)) continue;
    const text = readText(file);
    // const url = new URL('relativa', scriptUrl | import.meta.url); url.searchParams.set('v', 'tag' | CONSTANTE)
    for (const m of text.matchAll(/const (\w+) = new URL\('([^']+)', (?:scriptUrl|import\.meta\.url)\);/g)) {
      const setRe = new RegExp(`\\b${m[1]}\\.searchParams\\.set\\('v', (?:'([^']+)'|(\\w+))\\)`);
      const rest = text.slice(m.index);
      const set = rest.match(setRe);
      if (!set) continue;
      handledMarkers.add(`${file}#${m.index + set.index + m[1].length + 1}`);
      push(path.dirname(file), m[2], set[1] || constValue(text, set[2], file), file, 'new URL');
    }
    // `ruta?v=${CONSTANTE}` usada como href: se resuelve desde la raíz salvo que empiece con "."
    for (const m of text.matchAll(/`([^`$?]+)\?v=\$\{(\w+)\}`/g)) {
      handledMarkers.add(`${file}#${m.index + 1 + m[1].length}`);
      push(m[1].startsWith('.') ? path.dirname(file) : '.', m[1], constValue(text, m[2], file), file, 'plantilla');
    }
  }
  return found;
}

function checkHelperCalls() {
  for (const helper of HELPERS) {
    const callRe = new RegExp(`(?<![\\w.$])${helper.name}\\(`, 'g');
    for (const file of helper.files || JS_FILES) {
      const text = readText(file);
      for (const m of text.matchAll(callRe)) {
        if (/function\s+$/.test(text.slice(Math.max(0, m.index - 12), m.index))) continue;
        const args = text.slice(m.index + m[0].length);
        if (/^\s*'[^'\n]*'\s*[,)]/.test(args)) continue;
        const call = text.slice(m.index, text.indexOf(')', m.index) + 1);
        if (helper.allowed?.includes(call)) continue;
        dynamicProblems.push(`${file}:${lineOf(text, m.index)}: ${call.slice(0, 80)} arma el ?v= con una ruta no literal; no se puede auditar qué URL pide.`);
      }
    }
  }
}

const DYNAMIC_MARKER_RE = /searchParams\.set\(\s*['"]v['"]|\?v=\$\{|['"?&]v=['"]\s*\+/g;
const IMAGE_BEFORE_RE = /\.(?:png|jpe?g|webp|svg|gif|ico|avif)$/i;

function checkUnknownMechanisms() {
  for (const [file, rule] of Object.entries(DYNAMIC_IGNORED)) {
    if (!fs.existsSync(path.join(ROOT, file))) continue;
    if (!rule.verify(readText(file), file)) {
      dynamicProblems.push(`${file}: la excepción de DYNAMIC_IGNORED ya no se cumple (${rule.reason}). Resolvé su ?v= o actualizá la excepción.`);
    }
  }
  for (const file of JS_FILES) {
    if (HELPER_DEFINING_FILES.has(file) || DYNAMIC_IGNORED[file]) continue;
    const text = readText(file);
    for (const m of text.matchAll(DYNAMIC_MARKER_RE)) {
      if (IMAGE_BEFORE_RE.test(text.slice(Math.max(0, m.index - 8), m.index))) continue;
      if (handledMarkers.has(`${file}#${m.index}`)) continue;
      dynamicProblems.push(`${file}:${lineOf(text, m.index)}: mecanismo ?v= dinámico no auditable ("${m[0]}"). Usá un literal "ruta?v=tag", uno de los helpers auditados o documentalo en DYNAMIC_IGNORED con su motivo.`);
    }
  }
}

function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  const header = Buffer.from(`blob ${body.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(body).digest('hex');
}

const literalReferences = [
  ...HTML_FILES.flatMap(collectFromHtml),
  ...JS_FILES.flatMap(collectFromJs),
];
const dynamicReferences = collectDynamic();
checkHelperCalls();
checkUnknownMechanisms();
const references = [...literalReferences, ...dynamicReferences];
const dynamicPaths = new Set(dynamicReferences.map(ref => ref.localPath));

if (!literalReferences.length || !dynamicReferences.length) {
  console.error('No se encontraron referencias con ?v= — revisar las expresiones regulares del script.');
  process.exit(1);
}

const describe = ref => `"${ref.query ? `${ref.query}&` : ''}${ref.tag}" (${ref.sourceFile}${ref.via === 'literal' ? '' : `, ${ref.via}`})`;
const byPath = new Map();
const inconsistencies = [];
for (const ref of references) {
  if (!fs.existsSync(path.join(ROOT, ref.localPath))) {
    console.error(`Referencia rota: ${ref.sourceFile} apunta a "${ref.localPath}", que no existe.`);
    process.exit(1);
  }
  const existing = byPath.get(ref.localPath);
  if (existing && (existing.tag !== ref.tag || existing.query !== ref.query)) {
    inconsistencies.push(
      `"${ref.localPath}" se referencia con tags distintos: ${describe(existing)} vs ${describe(ref)}. Dos URLs = dos descargas y, en módulos JS, dos instancias.`
    );
  } else if (!existing) {
    byPath.set(ref.localPath, ref);
  }
}

if (inconsistencies.length || dynamicProblems.length) {
  if (inconsistencies.length) {
    console.error('Inconsistencias de versión de caché encontradas:\n' + inconsistencies.map(m => `  - ${m}`).join('\n'));
  }
  if (dynamicProblems.length) {
    console.error('Cargas dinámicas con ?v= no auditables:\n' + dynamicProblems.map(m => `  - ${m}`).join('\n'));
  }
  process.exit(1);
}

const expected = {};
for (const [localPath, ref] of [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const canonicalText = fs.readFileSync(path.join(ROOT, localPath), 'utf8').replace(/\r\n/g, '\n');
  expected[localPath] = {
    version: ref.tag,
    sha256: crypto.createHash('sha256').update(canonicalText, 'utf8').digest('hex'),
    gitBlobSha: gitBlobSha(canonicalText),
  };
}

const mode = process.argv.includes('--write') ? 'write' : 'check';

if (mode === 'check' && !fs.existsSync(BASELINE_PATH)) {
  console.error(`No existe scripts/cache-version-baseline.json. Corré "${WRITE_COMMAND}" y commiteá el resultado.`);
  process.exit(1);
}

const baseline = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) : {};
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
  const sha256 = String(info?.sha256 || '');
  const blobSha = String(info?.gitBlobSha || '');
  const validSha256 = /^[a-f0-9]{64}$/.test(sha256);
  const validBlobSha = /^[a-f0-9]{40}$/.test(blobSha);
  if (!info || typeof info.version !== 'string' || (!validSha256 && !validBlobSha)) {
    console.error(`Aprobación inválida para "${localPath}": requiere version y sha256 (64 hex) o gitBlobSha (40 hex).`);
    process.exit(1);
  }

  const current = expected[localPath];
  if (!current) {
    console.error(`Aprobación obsoleta: "${localPath}" ya no está referenciado con ?v=.`);
    process.exit(1);
  }
  if (validBlobSha && current.gitBlobSha !== blobSha) {
    console.error(`Aprobación de Git blob no coincide para "${localPath}": esperado ${blobSha}, actual ${current.gitBlobSha}.`);
    process.exit(1);
  }
  if (validSha256 && current.sha256 !== sha256) {
    console.error(`Aprobación SHA-256 no coincide para "${localPath}": esperado ${sha256}, actual ${current.sha256}.`);
    process.exit(1);
  }

  committed[localPath] = { version: info.version, sha256: current.sha256 };
}

// problems: nunca se registran. unregistered: cambios correctos que la línea base todavía no conoce.
const problems = [];
const unregistered = [];
for (const [localPath, info] of Object.entries(expected)) {
  const before = committed[localPath];
  if (!before) {
    unregistered.push(`NUEVO sin registrar: "${localPath}" (tag "${info.version}", sha256 ${info.sha256}, gitBlobSha ${info.gitBlobSha}).`);
    continue;
  }

  const sameVersion = before.version === info.version;
  const sameBytes = before.sha256 === info.sha256;
  if (sameVersion && sameBytes) continue;

  if (sameVersion) {
    problems.push(`CONTENIDO CAMBIÓ SIN BUMP DE VERSIÓN: "${localPath}" sigue con el tag "${info.version}" pero cambió de ${before.sha256} a ${info.sha256}. Subí el ?v= antes de deployar (${RERECORD_HINT}).`);
  } else if (sameBytes && !dynamicPaths.has(localPath)) {
    problems.push(`Bump de versión innecesario: "${localPath}" cambió de "${before.version}" a "${info.version}" con el mismo sha256 ${info.sha256}.`);
  } else if (sameBytes) {
    unregistered.push(`ALINEACIÓN SIN REGISTRAR: "${localPath}" pasó de "${before.version}" a "${info.version}" con los mismos bytes (también se carga dinámicamente con ese tag).`);
  } else {
    unregistered.push(`BUMP SIN REGISTRAR: "${localPath}" pasó de "${before.version}" a "${info.version}" con bytes nuevos.`);
  }
}

for (const localPath of approvals.removed) {
  if (expected[localPath]) {
    problems.push(`Remoción inválida: "${localPath}" sigue estando referenciado.`);
  }
}

// El baseline es histórico deliberadamente: una URL inmutable que dejó de
// estar referenciada debe seguir registrada para detectar una reutilización
// futura del mismo path + tag con bytes distintos. Por eso las entradas
// históricas no son un error y --write las conserva.
const historicalOnly = Object.keys(committed).filter(localPath => !expected[localPath]);

if (mode === 'write') {
  if (problems.length) {
    console.error(`No se registró nada: ${problems.length} problema(s) que un registro ocultaría:\n` + problems.map(m => `  - ${m}`).join('\n'));
    process.exit(1);
  }
  const snapshot = { ...committed };
  for (const [localPath, info] of Object.entries(expected)) snapshot[localPath] = { version: info.version, sha256: info.sha256 };
  const sorted = Object.fromEntries(Object.entries(snapshot).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  if (fs.existsSync(APPROVALS_PATH)) {
    fs.writeFileSync(APPROVALS_PATH, JSON.stringify({ approved: {}, removed: [] }, null, 2) + '\n', 'utf8');
  }
  unregistered.forEach(item => console.log(`  + ${item}`));
  console.log(`Baseline de versionado de caché actualizada: ${Object.keys(expected).length} archivos referenciados, ${unregistered.length} registrados ahora, ${historicalOnly.length} históricos conservados.`);
  process.exit(0);
}

if (problems.length || unregistered.length) {
  const lines = [...problems];
  if (unregistered.length) {
    lines.push(...unregistered, `Registrá los cambios anteriores con "${WRITE_COMMAND}" y commiteá scripts/cache-version-baseline.json: sin ese registro, un cambio posterior de bytes bajo el tag nuevo no se detectaría.`);
  }
  console.error(`Auditoría de versionado de caché: ${problems.length + unregistered.length} problema(s):\n` + lines.map(m => `  - ${m}`).join('\n'));
  process.exit(1);
}

if (historicalOnly.length) {
  console.log(`Baseline histórico conservado: ${historicalOnly.length} entrada(s) ya no referenciadas.`);
}
console.log(`Auditoría de versionado de caché: correcta (${Object.keys(expected).length} archivos versionados, ${dynamicReferences.length} cargas dinámicas resueltas; ninguna URL inmutable reutilizada con bytes distintos ni archivo pedido con dos URLs).`);
