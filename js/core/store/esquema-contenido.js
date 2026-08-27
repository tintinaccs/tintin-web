/* =============================================================
   TINTIN — Fachada canónica de contenido + estructura

   ÚNICA entrada pública para consumidores de contenido/Visual Builder.

   Autoridades separadas por responsabilidad:
   - contrato-estructura-sitio.js: páginas, secciones, zonas y capacidades.
   - definiciones-contenido.js: campos de texto/enlaces y defaults seguros.

   Las raíces/orden estructurales SIEMPRE salen del contrato canónico. Las
   definiciones históricas de campos no pueden decidir qué sección existe,
   dónde está, en qué zona vive ni si puede moverse.
   ============================================================= */

import * as ContentFields from './definiciones-contenido.js';
import {
  SITE_PUBLIC_PAGE_IDS,
  SITE_STRUCTURE_CONTRACT,
  SITE_STRUCTURE_MODES,
  SITE_STRUCTURE_VERSION,
  getSiteStructurePage,
  getSiteStructureSection,
  getSiteSectionZone,
  getMovableSiteSectionIds,
  getProtectedSiteSectionIds,
  getVisualBlockAnchorIds,
  isTopVisualAnchorAllowed,
  sanitizeSiteSectionOrder,
} from './contrato-estructura-sitio.js';

export {
  SITE_PUBLIC_PAGE_IDS,
  SITE_STRUCTURE_CONTRACT,
  SITE_STRUCTURE_MODES,
  SITE_STRUCTURE_VERSION,
  getSiteStructurePage,
  getSiteStructureSection,
  getSiteSectionZone,
  getMovableSiteSectionIds,
  getProtectedSiteSectionIds,
  getVisualBlockAnchorIds,
  isTopVisualAnchorAllowed,
  sanitizeSiteSectionOrder,
};

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
    zone: structural.zone,
    movable: structural.movable === true,
    hideable: structural.hideable === true,
    visualEditable: structural.visualEditable === true,
    blockAnchor: structural.blockAnchor === true,
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
    blockAnchor: false,
    structural: false,
    kind: 'global',
    zone: 'global',
  });
}

export function getPageSchema(pageIdValue) {
  const pageId = String(pageIdValue || '').trim().toLowerCase();
  if (!CONTENT_PAGE_IDS.includes(pageId)) return null;

  const structure = getSiteStructurePage(pageId);
  const contentPage = contentDefinitionPage(pageId);
  if (!structure || !contentPage || structure.mode === SITE_STRUCTURE_MODES.protected) return null;

  const sections = {};
  structure.sections.forEach(structural => {
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
    allowTopBlocks: isTopVisualAnchorAllowed(pageId),
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
  return (getSiteStructurePage(pageId)?.sections || []).map(section => section.id);
}

export function getBuilderVisualSectionIds(pageId) {
  return (getSiteStructurePage(pageId)?.sections || []).filter(section => section.visualEditable).map(section => section.id);
}
