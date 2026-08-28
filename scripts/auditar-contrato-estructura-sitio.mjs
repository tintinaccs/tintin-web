import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function loadEsmLike(file, names) {
  const source = read(file).replace(/\bexport\s+(?=(?:const|function)\b)/g, '');
  return vm.runInNewContext(`${source}\n;({ ${names.join(', ')} })`, { URL, Object, Array, String, Set, Map });
}

function attrValue(tag, name) {
  const match = tag.match(new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
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

function lastCompound(selector) {
  const parts = selector.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  return parts.at(-1) || selector.trim();
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

function tagMatchesRoot(tag, rootSelector) {
  return String(rootSelector || '').split(',').some(selector => tagMatchesCompound(tag, lastCompound(selector)));
}

function selectorExists(html, selector) {
  return String(selector || '').split(',').some(alternative => {
    const atoms = selectorAtoms(lastCompound(alternative));
    if (atoms.tag && !new RegExp(`<${escapeRegExp(atoms.tag)}\\b`, 'i').test(html)) return false;
    if (atoms.classes.some(name => !new RegExp(`class=["'][^"']*\\b${escapeRegExp(name)}\\b[^"']*["']`, 'i').test(html))) return false;
    if (atoms.ids.some(id => !new RegExp(`id=["']${escapeRegExp(id)}["']`, 'i').test(html))) return false;
    if (atoms.attrs.some(([name, value]) => !new RegExp(`${escapeRegExp(name)}=["']${escapeRegExp(value)}["']`, 'i').test(html))) return false;
    return Boolean(atoms.tag || atoms.classes.length || atoms.ids.length || atoms.attrs.length);
  });
}

function normalizeSelector(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function contentRootCompatible(contentRoot, structuralSection) {
  const content = normalizeSelector(contentRoot);
  const canonical = normalizeSelector(structuralSection?.root);
  if (!content || !canonical) return false;
  if (content === canonical || content.startsWith(`${canonical} `) || content.startsWith(`${canonical}>`) || content.startsWith(`${canonical} >`)) return true;
  return (structuralSection?.legacyContentRoots || []).some(rootValue => normalizeSelector(rootValue) === content);
}

function walkFiles(dir, output = []) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return output;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) walkFiles(relative, output);
    else if (/\.(?:js|mjs)$/.test(entry.name)) output.push(relative);
  }
  return output;
}

const structure = loadEsmLike('js/core/store/contrato-estructura-sitio.js', [
  'SITE_STRUCTURE_VERSION', 'SITE_PUBLIC_PAGE_IDS', 'SITE_STRUCTURE_MODES', 'SITE_STRUCTURE_CONTRACT',
  'sanitizeSiteSectionOrder',
]);
const fields = loadEsmLike('js/core/store/definiciones-contenido.js', [
  'CONTENT_PAGE_IDS', 'PAGE_PATH_TO_ID', 'SITE_CONTENT_SCHEMA', 'getPageSchema',
]);
const gateway = read('js/core/store/esquema-contenido.js');
const visualCore = read('cloudflare/visual-builder-core.js');
const visualRuntime = read('js/core/store/editor-visual-runtime.js');
const visualAdmin = read('js/admin/appearance/editor-visual-admin.js');

const errors = [];
const notes = [];
const fail = message => errors.push(message);

if (structure.SITE_STRUCTURE_VERSION < 2) fail('SITE_STRUCTURE_VERSION debe ser >= 2 para soportar zonas seguras.');
if (!gateway.includes("from './definiciones-contenido.js'")) fail('La fachada debe importar las definiciones de campos aisladas.');
if (!gateway.includes("from './contrato-estructura-sitio.js'")) fail('La fachada debe importar el contrato estructural canónico.');
if (!gateway.includes('structural.root')) fail('La fachada debe proyectar el root desde el contrato estructural.');
if (!gateway.includes('SITE_STRUCTURE_MODES.protected')) fail('La fachada debe excluir las páginas protegidas del CMS libre.');
if (!gateway.includes('zone: structural.zone')) fail('La fachada debe proyectar la zona estructural al Visual Builder.');
if (!gateway.includes('blockAnchor: structural.blockAnchor')) fail('La fachada debe proyectar las anclas seguras al Visual Builder.');
if (!visualCore.includes("const zone = entries[cursor][1].zone || 'main'")) fail('El backend del Visual Builder debe sanear el orden por zona.');
if (!visualCore.includes('blockAnchor === true')) fail('El backend debe limitar los bloques a anclas explícitamente seguras.');
if (!visualRuntime.includes('sectionSchema.movable !== true')) fail('El runtime público debe ignorar secciones fijas al reordenar.');
if (!visualRuntime.includes('rootsById')) fail('El runtime debe conservar las referencias DOM antes de retirar nodos para reordenarlos.');
if (!visualAdmin.includes('row.dataset.zone')) fail('Superadmin debe etiquetar cada fila con su zona segura.');
if (!visualAdmin.includes("schema.visualEditable===false?'Protegida'")) fail('Superadmin debe identificar visualmente las superficies protegidas.');

const contractIds = Object.keys(structure.SITE_STRUCTURE_CONTRACT);
const declaredIds = [...structure.SITE_PUBLIC_PAGE_IDS];
if (new Set(contractIds).size !== new Set(declaredIds).size
  || contractIds.some(id => !declaredIds.includes(id))
  || declaredIds.some(id => !contractIds.includes(id))) {
  fail('SITE_PUBLIC_PAGE_IDS y SITE_STRUCTURE_CONTRACT deben contener exactamente las mismas páginas.');
}

const allowedModes = new Set(Object.values(structure.SITE_STRUCTURE_MODES));
const seenPaths = new Set();
for (const pageId of declaredIds) {
  const page = structure.SITE_STRUCTURE_CONTRACT[pageId];
  if (!page) { fail(`${pageId}: falta contrato.`); continue; }
  if (!allowedModes.has(page.mode)) fail(`${pageId}: modo inválido ${page.mode}.`);
  if (!page.path || !exists(page.path)) { fail(`${pageId}: path físico inexistente ${page.path}.`); continue; }
  if (seenPaths.has(page.path)) fail(`${pageId}: path duplicado ${page.path}.`);
  seenPaths.add(page.path);

  const html = read(page.path);
  const ids = new Set();
  const roots = new Set();
  const closedZones = new Set();
  let activeZone = '';
  for (const section of page.sections || []) {
    if (!/^[a-z0-9_]+$/.test(section.id || '')) fail(`${pageId}: id inválido ${section.id}.`);
    if (ids.has(section.id)) fail(`${pageId}: id duplicado ${section.id}.`);
    ids.add(section.id);
    if (roots.has(section.root)) fail(`${pageId}: root duplicado ${section.root}.`);
    roots.add(section.root);
    if (!selectorExists(html, section.root)) fail(`${pageId}/${section.id}: root inexistente ${section.root}.`);
    if (!section.zone) fail(`${pageId}/${section.id}: toda sección debe declarar zone.`);
    if (section.zone !== activeZone) {
      if (closedZones.has(section.zone)) fail(`${pageId}: la zona ${section.zone} reaparece después de otra zona.`);
      if (activeZone) closedZones.add(activeZone);
      activeZone = section.zone;
    }
    if (section.operational && !section.reason) fail(`${pageId}/${section.id}: superficie operativa sin razón.`);
    if (section.visualEditable === false && section.blockAnchor) fail(`${pageId}/${section.id}: una superficie no visual no puede ser ancla de bloques.`);
    if (!section.movable && section.hideable && section.visualEditable === false) fail(`${pageId}/${section.id}: una superficie totalmente protegida no debe poder ocultarse.`);
    if (page.mode === structure.SITE_STRUCTURE_MODES.protected && (section.movable || section.hideable || section.visualEditable || section.blockAnchor)) {
      fail(`${pageId}/${section.id}: página protegida expone capacidad CMS libre.`);
    }
  }

  if (page.mode === structure.SITE_STRUCTURE_MODES.protected && page.allowTopBlocks !== false) fail(`${pageId}: una página protegida no puede admitir bloques arriba.`);
  if (page.hasFooter && !/class=["'][^"']*\btt-footer\b/i.test(html)) fail(`${pageId}: falta footer declarado.`);

  if (page.mode !== structure.SITE_STRUCTURE_MODES.protected) {
    const physical = [...html.matchAll(/<section\b[^>]*>/gi)].map(match => match[0]);
    for (const tag of physical) {
      const matches = page.sections.filter(section => tagMatchesRoot(tag, section.root));
      if (matches.length === 0) fail(`${pageId}: <section> física sin contrato: ${tag.slice(0, 160)}`);
      if (matches.length > 1) fail(`${pageId}: <section> física ambigua (${matches.map(item => item.id).join(', ')}).`);
    }
  }

  const reversed = [...(page.sections || [])].reverse().map(section => section.id);
  const cleanOrder = structure.sanitizeSiteSectionOrder(pageId, reversed);
  (page.sections || []).filter(section => !section.movable).forEach(section => {
    if (cleanOrder.indexOf(section.id) !== page.sections.indexOf(section)) {
      fail(`${pageId}/${section.id}: una sección fija cambió de posición al sanear un orden manipulado.`);
    }
  });
}

for (const pageId of fields.CONTENT_PAGE_IDS) {
  const fieldPage = fields.getPageSchema(pageId);
  const structurePage = structure.SITE_STRUCTURE_CONTRACT[pageId];
  if (!structurePage) { fail(`${pageId}: campos sin página estructural.`); continue; }
  if (fieldPage?.path !== structurePage.path) fail(`${pageId}: path distinto entre campos y estructura.`);
  for (const [sectionId, fieldSection] of Object.entries(fieldPage?.sections || {})) {
    if (fieldSection.global) continue;
    const structural = structurePage.sections.find(section => section.id === sectionId);
    if (!structural) { fail(`${pageId}/${sectionId}: campos sin sección estructural.`); continue; }
    if (!contentRootCompatible(fieldSection.root, structural)) fail(`${pageId}/${sectionId}: root de campos no corresponde al root canónico ni a un legado declarado.`);
    if ((structural.legacyContentRoots || []).some(rootValue => normalizeSelector(rootValue) === normalizeSelector(fieldSection.root))) {
      notes.push(`${pageId}/${sectionId}: legado registrado ${fieldSection.root} → ${structural.root}.`);
    }
  }
}

for (const protectedId of ['checkout', 'login', 'perfil']) {
  if (structure.SITE_STRUCTURE_CONTRACT[protectedId]?.mode !== structure.SITE_STRUCTURE_MODES.protected) fail(`${protectedId}: debe seguir protegido.`);
  if (fields.CONTENT_PAGE_IDS.includes(protectedId)) fail(`${protectedId}: no debe entrar al CMS libre.`);
}

const product = structure.SITE_STRUCTURE_CONTRACT.product;
for (const protectedSectionId of ['product_detail', 'selection']) {
  const section = product?.sections?.find(item => item.id === protectedSectionId);
  if (!section || section.movable || section.visualEditable || section.blockAnchor) fail(`product/${protectedSectionId}: debe permanecer fijo, no visual y sin ancla libre.`);
}
for (const safeSectionId of ['benefits', 'related']) {
  const section = product?.sections?.find(item => item.id === safeSectionId);
  if (!section?.visualEditable || !section.blockAnchor) fail(`product/${safeSectionId}: debe estar disponible como superficie visual segura.`);
}

const directConsumers = walkFiles('js').concat(walkFiles('cloudflare'), walkFiles('functions'))
  .filter(file => file !== 'js/core/store/esquema-contenido.js' && file !== 'js/core/store/definiciones-contenido.js')
  .filter(file => read(file).includes('definiciones-contenido.js'));
if (directConsumers.length) fail(`Consumidores saltándose la fachada canónica: ${directConsumers.join(', ')}`);

console.log(`INFO — contrato estructural v${structure.SITE_STRUCTURE_VERSION}: ${declaredIds.length} páginas.`);
console.log('INFO — Checkout/Login/Perfil permanecen fuera del CMS libre.');
console.log('INFO — Visual Builder aplica zonas seguras; precio/stock/carrito/identidad/legal no son anclas libres.');
notes.forEach(message => console.log(`INFO — ${message}`));

if (errors.length) {
  errors.forEach(message => console.error(`ERROR — ${message}`));
  console.error(`\nAuditoría estructural global fallida: ${errors.length} problema(s).`);
  process.exit(1);
}

console.log('\nOK — una sola autoridad estructural con zonas seguras; definiciones de contenido aisladas como campos.');
