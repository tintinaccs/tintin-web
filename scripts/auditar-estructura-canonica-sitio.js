'use strict';

/* =============================================================
   TINTIN — Auditoría de estructura canónica del sitio

   Objetivo: impedir que la estructura física del sitio y la estructura que
   consumen Super Admin / Visual Builder / runtime público / Cloudflare se
   separen silenciosamente.

   Esta primera barrera cubre Inicio, donde ya ocurrió la divergencia:
   - una sección nueva podía existir en index.html sin aparecer en Admin;
   - secciones retiradas podían seguir vivas en el esquema y en layouts guardados.

   El esquema seguro de contenido sigue siendo la autoridad canónica de las
   secciones nativas. Firestore guarda valores/configuración, no selectores ni
   HTML arbitrario. Los bloques dinámicos del Visual Builder se mantienen en su
   registro seguro independiente.
   ============================================================= */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadSchemaContract() {
  const source = read('js/core/store/esquema-contenido.js')
    .replace(/\bexport\s+(?=(?:const|function)\b)/g, '');

  return vm.runInNewContext(
    `${source}\n;({ CONTENT_PAGE_IDS, PAGE_PATH_TO_ID, SITE_CONTENT_SCHEMA, getPageSchema })`,
    { URL }
  );
}

function attrValue(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match ? match[2] : '';
}

function classes(tag) {
  return new Set(attrValue(tag, 'class').split(/\s+/).filter(Boolean));
}

function selectorAtoms(selector) {
  return {
    tag: (selector.trim().match(/^([a-z][a-z0-9-]*)/i) || [])[1]?.toLowerCase() || '',
    classes: [...selector.matchAll(/\.([A-Za-z0-9_-]+)/g)].map(match => match[1]),
    ids: [...selector.matchAll(/#([A-Za-z0-9_-]+)/g)].map(match => match[1]),
    attrs: [...selector.matchAll(/\[([A-Za-z0-9_-]+)=["']([^"']+)["']\]/g)].map(match => [match[1], match[2]]),
  };
}

function tagMatchesCompound(tag, compound) {
  const atoms = selectorAtoms(compound);
  const tagName = (tag.match(/^<\s*([a-z][a-z0-9-]*)/i) || [])[1]?.toLowerCase() || '';
  const tagClasses = classes(tag);
  if (atoms.tag && atoms.tag !== tagName) return false;
  if (atoms.classes.some(name => !tagClasses.has(name))) return false;
  if (atoms.ids.some(id => attrValue(tag, 'id') !== id)) return false;
  if (atoms.attrs.some(([name, value]) => attrValue(tag, name) !== value)) return false;
  return Boolean(atoms.tag || atoms.classes.length || atoms.ids.length || atoms.attrs.length);
}

function firstCompound(selector) {
  return selector.trim().split(/\s+(?:[>+~]\s*)?|\s*[>+~]\s*/)[0].trim();
}

function tagMatchesRoot(tag, rootSelector) {
  return String(rootSelector || '').split(',').some(alternative =>
    tagMatchesCompound(tag, firstCompound(alternative))
  );
}

function selectorExists(html, selector) {
  return String(selector || '').split(',').some(alternative => {
    const atoms = selectorAtoms(alternative);
    const classChecks = atoms.classes.every(name => new RegExp(`class=["'][^"']*(?:^|\\s)${name}(?:\\s|$)[^"']*["']`, 'i').test(html));
    const idChecks = atoms.ids.every(id => new RegExp(`id=["']${id}["']`, 'i').test(html));
    const attrChecks = atoms.attrs.every(([name, value]) => new RegExp(`${name}=["']${value}["']`, 'i').test(html));
    return classChecks && idChecks && attrChecks && Boolean(atoms.classes.length || atoms.ids.length || atoms.attrs.length || atoms.tag);
  });
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const contract = loadSchemaContract();
const indexHtml = read('index.html');
const adminContent = read('js/admin/content/gestion-contenido-admin.js');
const visualAdmin = read('js/admin/appearance/editor-visual-admin.js');
const visualRuntime = read('js/core/store/editor-visual-runtime.js');
const visualCore = read('cloudflare/visual-builder-core.js');

const indexSchema = contract.getPageSchema('index');
const indexSections = Object.entries(indexSchema?.sections || {});
const nativeIndexSections = indexSections.filter(([, schema]) => !schema.global);
const nativeIndexIds = nativeIndexSections.map(([id]) => id);
const indexSectionTags = [...indexHtml.matchAll(/<section\b[^>]*>/gi)].map(match => match[0]);

const resolvedDomOrder = [];
const unresolvedDomSections = [];
const ambiguousDomSections = [];

for (const tag of indexSectionTags) {
  const matches = nativeIndexSections.filter(([, schema]) => tagMatchesRoot(tag, schema.root));
  if (matches.length === 1) resolvedDomOrder.push(matches[0][0]);
  else if (matches.length === 0) unresolvedDomSections.push(tag.slice(0, 180));
  else ambiguousDomSections.push({ tag: tag.slice(0, 180), ids: matches.map(([id]) => id) });
}

check(
  'Inicio tiene un esquema canónico registrado',
  Boolean(indexSchema && indexSchema.path === 'index.html' && indexSchema.sections),
  'index debe existir en el esquema y apuntar a index.html.'
);

check(
  'Cada sección nativa registrada de Inicio existe físicamente',
  nativeIndexSections.every(([, schema]) => selectorExists(indexHtml, schema.root)),
  'Hay una sección fantasma en el esquema: su selector root ya no existe en index.html.'
);

check(
  'Cada <section> física de Inicio pertenece a una sección canónica',
  unresolvedDomSections.length === 0,
  `Hay secciones físicas no registradas en el esquema: ${unresolvedDomSections.join(' | ')}`
);

check(
  'Ninguna sección física de Inicio coincide con dos contratos distintos',
  ambiguousDomSections.length === 0,
  `Hay roots ambiguos: ${ambiguousDomSections.map(item => `${item.ids.join(',')} => ${item.tag}`).join(' | ')}`
);

check(
  'El orden canónico de Inicio coincide con el DOM actual',
  JSON.stringify(resolvedDomOrder) === JSON.stringify(nativeIndexIds),
  `Orden DOM=${JSON.stringify(resolvedDomOrder)}; esquema=${JSON.stringify(nativeIndexIds)}. Actualizá/reemplazá el contrato, no apiles una segunda versión.`
);

check(
  'Todas las secciones nativas de Inicio se pueden ocultar desde el sistema',
  nativeIndexSections.every(([, schema]) => schema.allowVisibility === true),
  'Una sección nativa de Inicio quedó fuera del control de visibilidad del Admin.'
);

check(
  'No quedan las secciones retiradas collections_header/products_header',
  !Object.prototype.hasOwnProperty.call(indexSchema.sections, 'collections_header') &&
    !Object.prototype.hasOwnProperty.call(indexSchema.sections, 'products_header'),
  'No dejes versiones retiradas dentro del contrato canónico.'
);

check(
  'Completá tu look está conectado al contrato canónico',
  indexSchema.sections.look?.root === '.tt-look-section' && indexSchema.sections.look?.allowVisibility === true,
  'La sección física #look-section debe aparecer en Superadmin/Visual Builder mediante el esquema compartido.'
);

check(
  'Superadmin Contenido consume el esquema canónico',
  /getPageSchema/.test(adminContent) && /esquema-contenido\.js/.test(adminContent),
  'Contenido no debe mantener una lista paralela de secciones.'
);

check(
  'Visual Builder Admin consume el esquema canónico',
  /getPageSchema/.test(visualAdmin) && /esquema-contenido\.js/.test(visualAdmin),
  'Visual Builder Admin no debe mantener una lista paralela de secciones nativas.'
);

check(
  'Runtime público consume el esquema canónico',
  /getPageSchema/.test(visualRuntime) && /esquema-contenido\.js/.test(visualRuntime),
  'El runtime público debe resolver el mismo contrato que el Admin.'
);

check(
  'Cloudflare sanea usando el mismo esquema canónico',
  /getPageSchema/.test(visualCore) && /esquema-contenido\.js/.test(visualCore),
  'El backend no debe aceptar una estructura distinta a la del Admin/runtime.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de estructura canónica fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de estructura canónica completada (${checks.length} comprobaciones).`);
console.log(`Inicio canónico: ${nativeIndexIds.join(' → ')}`);
