import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPageSchema } from '../js/core/store/esquema-contenido.js';
import {
  VISUAL_SECTION_MIGRATIONS,
  resolveVisualSectionReference,
} from '../js/core/store/migraciones-secciones.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE_EXTENSIONS = new Set(['.js', '.mjs', '.html']);
const SCAN_ROOTS = ['js', 'cloudflare', 'functions', 'tests'];
const ALLOWED_LEGACY_FIXTURES = new Set([
  'js/core/store/migraciones-secciones.js',
  'tests/visual-builder/visual-builder-core.test.mjs',
]);

function walk(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relative];
  return fs.readdirSync(absolute).flatMap(name => walk(path.join(relative, name)));
}

const failures = [];
const migrationIds = [];

for (const [pageId, migrations] of Object.entries(VISUAL_SECTION_MIGRATIONS)) {
  const schema = getPageSchema(pageId);
  if (!schema) {
    failures.push(`La página ${pageId} tiene migraciones pero no existe en el esquema canónico.`);
    continue;
  }

  for (const [legacyId, migration] of Object.entries(migrations || {})) {
    migrationIds.push(legacyId);
    if (!migration?.target) failures.push(`${pageId}.${legacyId} no declara target.`);
    if (migration?.target === legacyId) failures.push(`${pageId}.${legacyId} apunta a sí misma.`);
    if (!migration?.reason) failures.push(`${pageId}.${legacyId} no explica por qué existe la migración.`);

    for (const key of ['order', 'anchor', 'style', 'content']) {
      if (typeof migration?.transfer?.[key] !== 'boolean') {
        failures.push(`${pageId}.${legacyId} no declara transfer.${key} explícitamente.`);
      }
    }

    for (const purpose of ['order', 'anchor', 'style', 'content']) {
      if (migration?.transfer?.[purpose] !== true) continue;
      const resolved = resolveVisualSectionReference(pageId, legacyId, purpose);
      if (!resolved || !schema.sections?.[resolved]) {
        failures.push(`${pageId}.${legacyId} (${purpose}) no termina en una sección canónica válida: ${resolved || '(vacío)'}.`);
      }
    }

    // Un recorrido independiente detecta ciclos aunque el resolver defensivo
    // los corte para evitar loops en producción.
    const visited = new Set();
    let current = legacyId;
    for (let depth = 0; depth < 32; depth += 1) {
      if (visited.has(current)) {
        failures.push(`${pageId}.${legacyId} forma un ciclo de migración en ${current}.`);
        break;
      }
      visited.add(current);
      const step = migrations?.[current];
      if (!step) break;
      current = String(step.target || '');
      if (!current) break;
    }
  }
}

const files = SCAN_ROOTS.flatMap(walk)
  .filter(relative => CODE_EXTENSIONS.has(path.extname(relative)))
  .filter(relative => !ALLOWED_LEGACY_FIXTURES.has(relative.replaceAll('\\', '/')));

for (const relative of files) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  for (const legacyId of migrationIds) {
    if (source.includes(legacyId)) {
      failures.push(`${relative} todavía referencia el ID legado ${legacyId}; conectalo al ID canónico o mové esa compatibilidad al registro de migraciones.`);
    }
  }
}

if (failures.length) {
  console.error('Auditoría de migraciones de secciones fallida:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Auditoría de migraciones de secciones OK (${migrationIds.length} IDs legados controlados).`);
