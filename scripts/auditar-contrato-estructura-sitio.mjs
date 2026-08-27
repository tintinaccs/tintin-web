import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function loadEsmLike(file, names) {
  const source = read(file)
    .replace(/\bexport\s+(?=(?:const|function)\b)/g, '');
  return vm.runInNewContext(`${source}\n;({ ${names.join(', ')} })`, { URL, Object, Array, String });
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

function lastCompound(selector) {
  const parts = selector.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  return parts.at(-1) || selector.trim();
}

function tagMatchesRoot(tag, rootSelector) {
  return String(rootSelector || '').split(',').some(alternative =>
    tagMatchesCompound(tag, lastCompound(alternative))
  );
}

function selectorExists(html, selector) {
  return String(selector || '').split(',').some(alternative => {
    const compound = lastCompound(alternative);
    const atoms = selectorAtoms(compound);
    const classChecks = atoms.classes.every(name =>
      new RegExp(`class=["'][^"']*\\b${escapeRegExp(name)}\\b[^"']*["']`, 'i').test(html)
    );
    const idChecks = atoms.ids.every(id =>
      new RegExp(`id=["']${escapeRegExp(id)}["']`, 'i').test(html)
    );
    const attrChecks = atoms.attrs.every(([name, value]) =>
      new RegExp(`${escapeRegExp(name)}=["']${escapeRegExp(value)}["']`, 'i').test(html)
    );
    const tagCheck = !atoms.tag || new RegExp(`<${escapeRegExp(atoms.tag)}\\b`, 'i').test(html);
    return classChecks && idChecks && attrChecks && tagCheck && Boolean(atoms.classes.length || atoms.ids.length || atoms.attrs.length || atoms.tag);
  });
}

function contentRootBelongsToStructure(contentRoot, structureRoot) {
  const normalizedContent = String(contentRoot || '').replace(/\s+/g, ' ').trim();
  const normalizedStructure = String(structureRoot || '').replace(/\s+/g, ' ').trim();
  if (!normalizedContent || !normalizedStructure) return false;
  if (normalizedContent === normalizedStructure) return true;
  return normalizedContent.startsWith(`${normalizedStructure} `)
    || normalizedContent.startsWith(`${normalizedStructure}>`)
    || normalizedContent.startsWith(`${normalizedStructure} >`);
}

const structure = loadEsmLike('js/core/store/contrato-estructura-sitio.js', [
  'SITE_STRUCTURE_VERSION', 'SITE_PUBLIC_PAGE_IDS', 'SITE_STRUCTURE_MODES', 'SITE_STRUCTURE_CONTRACT',
]);
const content = loadEsmLike('js/core/store/esquema-contenido.js', [
  'CONTENT_PAGE_IDS', 'SITE_CONTENT_SCHEMA', 'getPageSchema',
]);

const errors = [];
const notes = [];
const fail = message => errors.push(message);
const note = message => notes.push(message);

if (structure.SITE_STRUCTURE_VERSION < 1) fail('SITE_STRUCTURE_VERSION debe ser >= 1.');

const contractIds = Object.keys(structure.SITE_STRUCTURE_CONTRACT);
if (JSON.stringify(contractIds) !== JSON.stringify(structure.SITE_PUBLIC_PAGE_IDS)) {
  fail(`SITE_PUBLIC_PAGE_IDS no coincide con el orden/ids del contrato. ids=${JSON.stringify(contractIds)}`);
}

const allowedModes = new Set(Object.values(structure.SITE_STRUCTURE_MODES));
const seenPaths = new Map();

for (const pageId of structure.SITE_PUBLIC_PAGE_IDS) {
  const page = structure.SITE_STRUCTURE_CONTRACT[pageId];
  if (!page) {
    fail(`${pageId}: falta su contrato de página.`);
    continue;
  }
  if (!allowedModes.has(page.mode)) fail(`${pageId}: modo desconocido ${page.mode}.`);
  if (!page.path || !exists(page.path)) {
    fail(`${pageId}: la ruta física ${page.path || '(vacía)'} no existe.`);
    continue;
  }
  if (seenPaths.has(page.path)) fail(`${pageId}: comparte path ${page.path} con ${seenPaths.get(page.path)}.`);
  else seenPaths.set(page.path, pageId);

  const html = read(page.path);
  const sectionIds = new Set();
  const roots = new Set();

  for (const item of page.sections || []) {
    if (!item.id || !/^[a-z0-9_]+$/.test(item.id)) fail(`${pageId}: id de sección inválido ${item.id}.`);
    if (sectionIds.has(item.id)) fail(`${pageId}: id de sección duplicado ${item.id}.`);
    sectionIds.add(item.id);
    if (!item.root) fail(`${pageId}/${item.id}: falta root.`);
    if (roots.has(item.root)) fail(`${pageId}: dos secciones usan el mismo root ${item.root}.`);
    roots.add(item.root);
    if (!selectorExists(html, item.root)) fail(`${pageId}/${item.id}: root físico inexistente ${item.root}.`);
    if (item.operational && !item.reason) fail(`${pageId}/${item.id}: superficie operativa sin razón/contrato explícito.`);
    if (page.mode === 'protected' && (item.movable || item.hideable || item.visualEditable)) {
      fail(`${pageId}/${item.id}: una página protegida no puede exponer movimiento, ocultación o edición visual libre.`);
    }
    if (item.visualEditable === false && item.movable) {
      fail(`${pageId}/${item.id}: una superficie no editable visualmente no debe ser movible.`);
    }
  }

  if (page.hasFooter && !/class=["'][^"']*\btt-footer\b/i.test(html)) {
    fail(`${pageId}: el contrato exige footer pero .tt-footer no existe físicamente.`);
  }

  // En páginas editables/controladas, cada <section> nativa física debe estar
  // representada. Las páginas protegidas pueden tener subsecciones internas del
  // flujo (OTP, checkout, etc.) que deliberadamente se agrupan bajo una sola raíz.
  if (page.mode !== 'protected') {
    const physicalSections = [...html.matchAll(/<section\b[^>]*>/gi)].map(match => match[0]);
    for (const tag of physicalSections) {
      const matches = page.sections.filter(item => tagMatchesRoot(tag, item.root));
      if (matches.length === 0) fail(`${pageId}: <section> física sin contrato: ${tag.slice(0, 180)}`);
      if (matches.length > 1) fail(`${pageId}: <section> física coincide con varios contratos (${matches.map(item => item.id).join(', ')}): ${tag.slice(0, 160)}`);
    }
  }

  for (const legacyPath of page.legacyPaths || []) {
    if (!exists(legacyPath)) fail(`${pageId}: legacyPath declarado pero inexistente: ${legacyPath}.`);
  }
}

// El esquema de contenido puede ser un subconjunto de la estructura; nunca al
// revés. Esto permite registrar superficies operativas sin convertirlas en CMS.
for (const pageId of content.CONTENT_PAGE_IDS) {
  const contentPage = content.getPageSchema(pageId);
  const structurePage = structure.SITE_STRUCTURE_CONTRACT[pageId];
  if (!structurePage) {
    fail(`${pageId}: el sistema de contenido/Visual Builder conoce una página ausente del contrato estructural.`);
    continue;
  }
  if (contentPage?.path !== structurePage.path) {
    fail(`${pageId}: path distinto entre contenido (${contentPage?.path}) y estructura (${structurePage.path}).`);
  }
  for (const [sectionId, contentSection] of Object.entries(contentPage?.sections || {})) {
    if (contentSection.global) continue;
    const structuralSection = structurePage.sections.find(item => item.id === sectionId);
    if (!structuralSection) {
      fail(`${pageId}/${sectionId}: sección de contenido sin sección estructural canónica.`);
      continue;
    }
    if (!contentRootBelongsToStructure(contentSection.root, structuralSection.root)) {
      fail(`${pageId}/${sectionId}: root de contenido ${contentSection.root} no pertenece a la raíz estructural ${structuralSection.root}.`);
    }
  }
}

// Asegura que no volvamos a excluir páginas transaccionales/privadas del
// inventario general aunque sigan fuera del CMS libre.
for (const requiredProtected of ['checkout', 'login', 'perfil']) {
  const page = structure.SITE_STRUCTURE_CONTRACT[requiredProtected];
  if (page?.mode !== 'protected') fail(`${requiredProtected}: debe permanecer inventariada como página protegida.`);
}

notes.push(`Contrato estructural v${structure.SITE_STRUCTURE_VERSION}: ${contractIds.length} páginas públicas.`);
notes.push(`Páginas protegidas: ${contractIds.filter(id => structure.SITE_STRUCTURE_CONTRACT[id].mode === 'protected').join(', ')}.`);
notes.push('El esquema de contenido se valida como subconjunto; la estructura física ya no depende de que una sección tenga campos editables.');

for (const message of notes) console.log(`INFO — ${message}`);
if (errors.length) {
  errors.forEach(message => console.error(`ERROR — ${message}`));
  console.error(`\nAuditoría estructural global fallida: ${errors.length} problema(s).`);
  process.exit(1);
}

console.log('\nOK — contrato estructural global coherente con las páginas físicas y el esquema de contenido.');
