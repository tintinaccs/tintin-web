/* =============================================================
   TINTIN — Fachada canónica de contenido + estructura

   ÚNICA entrada pública para consumidores de contenido/Visual Builder.

   Autoridades separadas por responsabilidad:
   - contrato-estructura-sitio.js: qué páginas/secciones existen y capacidades.
   - definiciones-contenido.js: campos de texto/enlaces y sus defaults seguros.

   Las raíces/orden estructurales SIEMPRE salen del contrato canónico. Las
   definiciones históricas de campos ya no pueden decidir qué sección existe,
   dónde está ni si puede moverse.
   ============================================================= */

import * as ContentFields from './definiciones-contenido.js';
import {
  SITE_PUBLIC_PAGE_IDS,
  SITE_STRUCTURE_CONTRACT,
  SITE_STRUCTURE_MODES,
  SITE_STRUCTURE_VERSION,
  getSiteStructurePage,
  getSiteStructureSection,
} from './contrato-estructura-sitio.js';

export { SITE_PUBLIC_PAGE_IDS, SITE_STRUCTURE_CONTRACT, SITE_STRUCTURE_MODES, SITE_STRUCTURE_VERSION, getSiteStructurePage, getSiteStructureSection };

export const CONTENT_MAX_LENGTH = ContentFields.CONTENT_MAX_LENGTH;
export const CONTENT_PAGE_IDS = Object.freeze([...ContentFields.CONTENT_PAGE_IDS]);
export const PAGE_PATH_TO_ID = ContentFields.PAGE_PATH_TO_ID;

export const getNested = ContentFields.getNested;
export const setNested = ContentFields.setNested;
export const mergeContent = ContentFields.mergeContent;
export const sanitizeContentText = ContentFields.sanitizeContentText;
export const detectContentPageId = ContentFields.detectContentPageId;

const LEGACY_CONTENT_ROUTE_ALIASES = Object.freeze({
  'index.html': '/',
  'about.html': '/about',
  'nosotros.html': '/about',
  'catalogo.html': '/catalogo',
  'collections.html': '/collections',
  'product.html': '/product',
  'checkout.html': '/checkout',
  'login.html': '/login',
  'perfil.html': '/perfil',
  'contact.html': '/contact',
  'envios.html': '/envios',
  'preguntas-frecuentes.html': '/preguntas-frecuentes',
  'cambios-devoluciones.html': '/cambios-devoluciones',
  'terminos.html': '/terminos',
  'privacidad.html': '/privacidad',
});

function canonicalizeLegacyContentHref(value) {
  const href = String(value || '').trim();
  const match = href.match(/^(?:\.\/|\/)?([^/?#]+\.html)([?#][A-Za-z0-9_=&%+.#:-]*)?$/i);
  if (!match) return href;
  const route = LEGACY_CONTENT_ROUTE_ALIASES[match[1].toLowerCase()];
  return route ? `${route}${match[2] || ''}` : href;
}

export function sanitizeContentHref(value, fallback = '') {
  const safe = ContentFields.sanitizeContentHref(value, fallback);
  return canonicalizeLegacyContentHref(safe);
}

/*
 * La fachada es la última frontera antes de Admin/runtime/Cloudflare. Además
 * de delegar las migraciones históricas de bajo nivel, vuelve a garantizar la
 * forma pública canónica del título del Hero. Es una defensa idempotente: si
 * la capa interna ya lo normalizó no cambia nada; si una versión interna vieja
 * reaparece, la salida pública sigue siendo correcta.
 */
export function normalizeContentValue(pageId, sectionId, key, value) {
  const normalized = ContentFields.normalizeContentValue(pageId, sectionId, key, value);
  const text = String(normalized == null ? '' : normalized);
  if (pageId === 'index' && sectionId === 'hero' && key === 'title') {
    return text.replace(/\bTÚ ESTILO\b/g, 'TU ESTILO');
  }
  return normalized;
}

function contentDefinitionPage(pageId) {
  return ContentFields.getPageSchema(pageId);
}

function contentDefinitionSection(pageId, sectionId) {
  return contentDefinitionPage(pageId)?.sections?.[sectionId] || null;
}

function globalContentSections(pageId) {
  return Object.entries(contentDefinitionPage(pageId)?.sections || {})
    .filter(([, section]) => section?.global === true);
}

/*
 * Compatibilidad segura con el runtime de orden actual:
 *
 * El constructor vigente puede reordenar un conjunto continuo de secciones.
 * Si una página contiene una barrera estructural fija (checkout interno,
 * detalle comercial, cuerpo legal, etc.), solo exponemos al constructor el
 * prefijo editable anterior a la PRIMERA barrera. De esta forma ninguna
 * sección editable puede saltar por encima de una superficie protegida.
 *
 * La Tarea 5 podrá ampliar el editor por zonas sin cambiar la autoridad: esta
 * decisión siempre deriva del mismo contrato estructural.
 */
function builderSafeStructuralSections(pageId) {
  const page = getSiteStructurePage(pageId);
  if (!page || page.mode === SITE_STRUCTURE_MODES.protected) return [];
  const firstBarrier = page.sections.findIndex(section => !section.movable || !section.visualEditable);
  const limit = firstBarrier < 0 ? page.sections.length : firstBarrier;
  return page.sections.slice(0, limit).filter(section => section.movable && section.visualEditable);
}

function projectStructuralSection(pageId, structural) {
  const content = contentDefinitionSection(pageId, structural.contentSectionId || structural.id);
  return Object.freeze({
    label: structural.label,
    root: structural.root,
    fields: Object.freeze([...(content?.fields || [])]),
    allowVisibility: structural.hideable === true,
    global: false,
    structural: true,
    kind: structural.kind,
    movable: structural.movable === true,
    hideable: structural.hideable === true,
    visualEditable: structural.visualEditable === true,
    operational: structural.operational === true,
    reason: structural.reason || '',
    contentRoot: content?.root || structural.root,
    legacyContentRoots: Object.freeze([...(structural.legacyContentRoots || [])]),
  });
}

function projectGlobalSection(section) {
  return Object.freeze({
    ...section,
    fields: Object.freeze([...(section.fields || [])]),
    movable: false,
    hideable: false,
    visualEditable: true,
    structural: false,
    kind: 'global',
  });
}

export function getPageSchema(pageIdValue) {
  const pageId = String(pageIdValue || '').trim().toLowerCase();
  if (!CONTENT_PAGE_IDS.includes(pageId)) return null;

  const structure = getSiteStructurePage(pageId);
  const contentPage = contentDefinitionPage(pageId);
  if (!structure || !contentPage || structure.mode === SITE_STRUCTURE_MODES.protected) return null;

  const sections = {};
  builderSafeStructuralSections(pageId).forEach(structural => {
    sections[structural.id] = projectStructuralSection(pageId, structural);
  });
  globalContentSections(pageId).forEach(([sectionId, section]) => {
    sections[sectionId] = projectGlobalSection(section);
  });

  return Object.freeze({
    label: structure.label,
    path: structure.path,
    mode: structure.mode,
    structureVersion: SITE_STRUCTURE_VERSION,
    sections: Object.freeze(sections),
  });
}

export function getSectionSchema(pageId, sectionId) {
  return getPageSchema(pageId)?.sections?.[sectionId] || null;
}

export const SITE_CONTENT_SCHEMA = Object.freeze(Object.fromEntries(
  CONTENT_PAGE_IDS.map(pageId => [pageId, getPageSchema(pageId)]).filter(([, page]) => Boolean(page))
));

export function getSectionDefaults(pageId, sectionId) {
  const schema = getSectionSchema(pageId, sectionId);
  if (!schema) return {};
  const output = {};
  if (schema.allowVisibility) output.visible = true;
  schema.fields.forEach(item => setNested(output, item.key, item.default ?? ''));
  return output;
}

export function getPageDefaults(pageId) {
  const page = getPageSchema(pageId);
  if (!page) return {};
  return Object.fromEntries(
    Object.keys(page.sections).map(sectionId => [sectionId, getSectionDefaults(pageId, sectionId)])
  );
}

export function sanitizeSection(pageId, sectionId, sectionValue = {}) {
  const schema = getSectionSchema(pageId, sectionId);
  if (!schema) return {};
  const clean = {};
  if (schema.allowVisibility) clean.visible = sectionValue.visible !== false;
  schema.fields.forEach(item => {
    const raw = getNested(sectionValue, item.key);
    const fallback = item.default ?? '';
    const normalizedRaw = normalizeContentValue(pageId, sectionId, item.key, raw == null ? fallback : raw);
    const value = item.type === 'href'
      ? sanitizeContentHref(raw == null ? fallback : raw, fallback)
      : sanitizeContentText(normalizedRaw, item.maxLength);
    setNested(clean, item.key, value);
  });
  return clean;
}

export function getContentFieldDefinition(pageId, sectionId) {
  return contentDefinitionSection(pageId, sectionId);
}

export function getBuilderSafeSectionIds(pageId) {
  return builderSafeStructuralSections(pageId).map(section => section.id);
}
