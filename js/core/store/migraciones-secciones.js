/* =============================================================
   TINTIN — Evolución segura de IDs de secciones

   Este contrato existe para que una versión vieja de una sección no pierda
   sus consumidores cuando la implementación canónica cambia de ID.

   Regla:
   - el ID actual vive en esquema-contenido.js;
   - todo ID anterior se declara acá con su sucesor;
   - cada tipo de dato se transfiere solo si es semánticamente compatible;
   - el resolver soporta cadenas (F1 -> F2 -> F) y evita ciclos silenciosos.
   ============================================================= */

const TRANSFER_KEYS = Object.freeze(['order', 'anchor', 'style', 'content']);

const migration = (target, transfer, reason) => Object.freeze({
  target,
  transfer: Object.freeze(Object.fromEntries(
    TRANSFER_KEYS.map(key => [key, transfer?.[key] === true])
  )),
  reason: String(reason || ''),
});

export const VISUAL_SECTION_MIGRATIONS = Object.freeze({
  index: Object.freeze({
    collections_header: migration(
      'collections_carousel',
      { order: true, anchor: true, style: false, content: false },
      'El encabezado independiente de colecciones fue reemplazado por el carrusel canónico de colecciones.'
    ),
    products_header: migration(
      'look',
      { order: true, anchor: true, style: false, content: false },
      'El encabezado independiente de productos fue reemplazado estructuralmente por la sección canónica Completá tu look.'
    ),
  }),
});

export function getVisualSectionMigration(pageId, sectionId) {
  return VISUAL_SECTION_MIGRATIONS?.[String(pageId || '')]?.[String(sectionId || '')] || null;
}

export function resolveVisualSectionReference(pageId, sectionId, purpose = 'order') {
  const requestedPurpose = TRANSFER_KEYS.includes(purpose) ? purpose : 'order';
  let current = String(sectionId || '');
  if (!current) return '';

  const visited = new Set();
  for (let depth = 0; depth < 32; depth += 1) {
    if (visited.has(current)) return current;
    visited.add(current);

    const step = getVisualSectionMigration(pageId, current);
    if (!step || step.transfer?.[requestedPurpose] !== true) return current;
    current = String(step.target || '');
    if (!current) return '';
  }
  return current;
}

function migrateRecord(pageId, raw, purpose) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const output = {};

  // La implementación canónica siempre gana si convive temporalmente con una
  // clave vieja en el mismo documento.
  Object.entries(source).forEach(([sectionId, value]) => {
    const resolved = resolveVisualSectionReference(pageId, sectionId, purpose);
    if (resolved === sectionId) output[sectionId] = value;
  });

  Object.entries(source).forEach(([sectionId, value]) => {
    const resolved = resolveVisualSectionReference(pageId, sectionId, purpose);
    if (resolved && resolved !== sectionId && !Object.prototype.hasOwnProperty.call(output, resolved)) {
      output[resolved] = value;
    }
  });

  return output;
}

export function migrateVisualConfigReferences(pageId, raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    ...source,
    sections: migrateRecord(pageId, source.sections, 'style'),
    sectionOrder: (Array.isArray(source.sectionOrder) ? source.sectionOrder : [])
      .map(sectionId => resolveVisualSectionReference(pageId, sectionId, 'order')),
    customBlocks: (Array.isArray(source.customBlocks) ? source.customBlocks : []).map(block => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) return block;
      return {
        ...block,
        afterSection: resolveVisualSectionReference(pageId, block.afterSection, 'anchor'),
      };
    }),
  };
}

export function migrateVisualContentReferences(pageId, raw = {}) {
  return migrateRecord(pageId, raw, 'content');
}
