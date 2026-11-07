/* Orden de casillas del modo edición: funciones puras, sin DOM ni red. */
const TOP_ANCHOR = '__top__';

function movableSectionIds(schema, order, zone) {
  return order.filter(id => {
    const s = schema.sections[id];
    return s && s.movable === true && !s.global && (s.zone || 'main') === zone;
  });
}

/** Mueve una sección. `to` = 'up' | 'down' | 'top' | 'bottom'. Devuelve un nuevo sectionOrder. */
export function moveSection(schema, order, id, to) {
  const sectionSchema = schema.sections[id];
  if (!sectionSchema || sectionSchema.movable !== true || sectionSchema.global) return order;
  const zone = sectionSchema.zone || 'main';
  const movable = movableSectionIds(schema, order, zone);
  const from = movable.indexOf(id);
  if (from < 0) return order;
  const target = { up: from - 1, down: from + 1, top: 0, bottom: movable.length - 1 }[to];
  if (target === undefined || target < 0 || target >= movable.length || target === from) return order;
  const next = movable.slice();
  next.splice(from, 1);
  next.splice(target, 0, id);
  let cursor = 0;
  return order.map(item => (movable.includes(item) ? next[cursor++] : item));
}

function blockAnchors(schema, order) {
  const anchors = schema.allowTopBlocks === true ? [TOP_ANCHOR] : [];
  order.forEach(id => { if (schema.sections[id]?.blockAnchor) anchors.push(id); });
  return anchors;
}

/** Mueve un bloque personalizado. Devuelve un nuevo arreglo `customBlocks`. */
export function moveBlock(schema, order, blocks, blockId, to) {
  const index = blocks.findIndex(block => block.id === blockId);
  const anchors = blockAnchors(schema, order);
  if (index < 0 || !anchors.length) return blocks;
  const groups = new Map(anchors.map(anchor => [anchor, []]));
  blocks.forEach(block => {
    const anchor = groups.has(block.afterSection) ? block.afterSection : anchors.at(-1);
    groups.get(anchor).push({ ...block, afterSection: anchor });
  });
  const current = blocks[index].afterSection;
  let anchor = groups.has(current) ? current : anchors.at(-1);
  let list = groups.get(anchor);
  let position = list.findIndex(block => block.id === blockId);
  const [block] = list.splice(position, 1);
  const anchorIndex = anchors.indexOf(anchor);
  if (to === 'top') {
    anchor = anchors[0]; groups.get(anchor).unshift(block);
  } else if (to === 'bottom') {
    anchor = anchors.at(-1); groups.get(anchor).push(block);
  } else if (to === 'up') {
    if (position > 0) { list.splice(position - 1, 0, block); }
    else if (anchorIndex > 0) { anchor = anchors[anchorIndex - 1]; groups.get(anchor).push(block); }
    else list.splice(0, 0, block);
  } else if (to === 'down') {
    if (position < list.length) { list.splice(position + 1, 0, block); }
    else if (anchorIndex < anchors.length - 1) { anchor = anchors[anchorIndex + 1]; groups.get(anchor).unshift(block); }
    else list.push(block);
  } else list.splice(position, 0, block);
  block.afterSection = anchor;
  return anchors.flatMap(key => groups.get(key));
}

