const ALLOWED_BODY_TAGS = new Set(['p', 'br', 'strong', 'em', 'ul', 'ol', 'li']);
const BLOCKED_BODY_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'style', 'link', 'svg', 'math', 'template', 'form']);
const SHOPIFY_STATUS = new Set(['active', 'draft', 'archived']);
const PLAIN_TEXT_BREAK_TAGS = new Set(['p', 'div', 'br', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'table', 'section', 'article', 'blockquote', 'hr']);
const NAMED_ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', iexcl: '¡', iquest: '¿',
  laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', deg: '°',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·',
});
// Shopify "Continue selling when out of stock" / legacy "Variant Inventory
// Policy": the store keeps selling without a quantity limit.
const CONTINUE_SELLING = new Set(['continue', 'true', 'yes', 'si', 'verdadero']);
const NOT_PUBLISHED = new Set(['false', 'falso', 'no']);
const VARIANT_META_KEYS = new Set(['sku', 'price', 'stock', 'imageUrl']);

function asText(value) {
  return String(value == null ? '' : value);
}

export function cleanImportText(value, max = 500) {
  return asText(value)
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

export function normalizeImportKey(value) {
  return cleanImportText(value, 300)
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function safeImportUrl(value) {
  const candidate = cleanImportText(value, 2000);
  if (!candidate || /['"<>\u0000-\u001f\u007f]/.test(candidate)) return candidate ? null : '';
  try {
    const parsed = new URL(candidate, 'https://tintinaccesorios.pages.dev/');
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Shopify Body (HTML) is data, not executable admin markup. The importer
 * preserves the supported editorial tags and removes every attribute, so
 * event handlers, javascript: URLs, embeds and scripts cannot survive.
 */
export function sanitizeShopifyBodyHtml(value, max = 20000) {
  // Project every markup-looking token onto the small editorial allowlist.
  // A scanner is intentional here: partial multi-character regexes can leave
  // truncated comments or script-like input behind.
  const source = asText(value);
  let html = '';
  let cursor = 0;
  while (cursor < source.length && html.length < max) {
    const open = source.indexOf('<', cursor);
    if (open < 0) {
      html += source.slice(cursor);
      break;
    }
    html += source.slice(cursor, open);
    if (source.startsWith('<!--', open)) {
      const commentEnd = source.indexOf('-->', open + 4);
      cursor = commentEnd < 0 ? source.length : commentEnd + 3;
      continue;
    }
    const close = source.indexOf('>', open + 1);
    if (close < 0) break;
    const rawTag = source.slice(open + 1, close);
    const match = /^\s*(\/?)\s*([a-z0-9]+)\b/i.exec(rawTag);
    if (match) {
      const name = match[2].toLowerCase();
      if (BLOCKED_BODY_TAGS.has(name) && !match[1]) {
        const closingStart = source.toLowerCase().indexOf(`</${name}`, close + 1);
        if (closingStart < 0) {
          cursor = source.length;
          continue;
        }
        const closingEnd = source.indexOf('>', closingStart + name.length + 2);
        cursor = closingEnd < 0 ? source.length : closingEnd + 1;
        continue;
      }
      if (ALLOWED_BODY_TAGS.has(name)) html += `<${match[1] ? '/' : ''}${name}>`;
    }
    cursor = close + 1;
  }
  return html
    .replace(/\s{3,}/g, ' ')
    .trim()
    .slice(0, max);
}

function decodeHtmlEntities(value) {
  // Single pass: "&amp;lt;" becomes "&lt;", never "<".
  return value.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});/gi, (entity, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      const valid = code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
      return valid ? String.fromCodePoint(code) : entity;
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : entity;
  });
}

/**
 * The catalog stores descriptions as plain text (the storefront renders them
 * with textContent). Block tags become line breaks, list items become
 * bullets, blocked tags are dropped with their content and entities are
 * decoded once.
 */
export function shopifyBodyToPlainText(value, max = 4000) {
  const source = asText(value).slice(0, 100000);
  const tagPattern = /<\s*(\/?)\s*([a-z][a-z0-9]*)\b[^>]*>/iy;
  let text = '';
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('<', cursor);
    if (open < 0) {
      text += source.slice(cursor);
      break;
    }
    text += source.slice(cursor, open);
    if (source.startsWith('<!--', open)) {
      const commentEnd = source.indexOf('-->', open + 4);
      cursor = commentEnd < 0 ? source.length : commentEnd + 3;
      continue;
    }
    tagPattern.lastIndex = open;
    const match = tagPattern.exec(source);
    if (!match) {
      // A bare "<" in prose ("< 5 cm") is text, not markup.
      text += '<';
      cursor = open + 1;
      continue;
    }
    const name = match[2].toLowerCase();
    const close = open + match[0].length - 1;
    if (BLOCKED_BODY_TAGS.has(name) && !match[1]) {
      const closingStart = source.toLowerCase().indexOf(`</${name}`, close + 1);
      if (closingStart < 0) break;
      const closingEnd = source.indexOf('>', closingStart + name.length + 2);
      cursor = closingEnd < 0 ? source.length : closingEnd + 1;
      continue;
    }
    if (name === 'li') {
      if (!match[1]) text += '\n• ';
    } else if (PLAIN_TEXT_BREAK_TAGS.has(name)) text += '\n';
    cursor = close + 1;
  }
  return decodeHtmlEntities(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
    .split('\n')
    .map(line => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
    .trim();
}

export function normalizeImportTags(value) {
  const source = Array.isArray(value) ? value : asText(value).split(',');
  return [...new Set(source
    .map(item => cleanImportText(item, 120))
    .filter(Boolean))];
}

export function firstShopifyValue(row, names) {
  for (const name of names) {
    if (row?.[name] != null && asText(row[name]).trim() !== '') return row[name];
  }
  return '';
}

function collectionCandidates(collections) {
  return (Array.isArray(collections) ? collections : [])
    .map(item => ({
      slug: normalizeImportKey(item?.slug || item?.id || item),
      name: cleanImportText(item?.name || item, 160),
    }))
    .filter(item => item.slug);
}

export function resolveShopifyCollection({ explicit, type, tags, title }, collections) {
  const candidates = collectionCandidates(collections);
  const signals = [explicit, type, tags, title].map(normalizeImportKey).filter(Boolean);
  const directMatches = [...new Map(candidates
    .filter(item => signals.includes(item.slug) || signals.includes(normalizeImportKey(item.name)))
    .map(item => [item.slug, item])).values()];
  if (directMatches.length === 1) return { slug: directMatches[0].slug, suggestions: [], ambiguous: false };
  if (directMatches.length > 1) return { slug: '', suggestions: directMatches.map(item => item.slug), ambiguous: true };

  const matches = candidates.filter(item => signals.some(signal => signal.includes(item.slug) || item.slug.includes(signal)));
  const uniqueMatches = [...new Map(matches.map(item => [item.slug, item])).values()];
  if (uniqueMatches.length === 1) return { slug: uniqueMatches[0].slug, suggestions: [], ambiguous: false };
  if (uniqueMatches.length > 1) return { slug: '', suggestions: uniqueMatches.map(item => item.slug), ambiguous: true };

  // Last resort: the first word of the title ("Reloj Alissia", "Collar
  // Ismera") against single-word collections, tolerating Spanish plurals
  // (reloj/relojes, collar/collares, aro/aros).
  const titleForms = singularForms(titleGroupKey(title));
  const wordMatches = titleForms.length ? candidates.filter(item => [item.slug, normalizeImportKey(item.name)]
    .filter(key => key && !key.includes('-'))
    .some(key => singularForms(key).some(form => titleForms.includes(form)))) : [];
  const uniqueWordMatches = [...new Map(wordMatches.map(item => [item.slug, item])).values()];
  if (uniqueWordMatches.length === 1) return { slug: uniqueWordMatches[0].slug, suggestions: [], ambiguous: false };
  if (uniqueWordMatches.length > 1) return { slug: '', suggestions: uniqueWordMatches.map(item => item.slug), ambiguous: true };
  return { slug: '', suggestions: [], ambiguous: false };
}

/** First normalized word of a product title; groups products for collection mapping. */
export function titleGroupKey(title) {
  return normalizeImportKey(title).split('-')[0] || '';
}

function singularForms(word) {
  if (!word) return [];
  const forms = [word];
  if (word.length > 4 && word.endsWith('es')) forms.push(word.slice(0, -2));
  if (word.length > 3 && word.endsWith('s')) forms.push(word.slice(0, -1));
  return forms;
}

const COLLECTION_ERRORS = new Set(['La colección requiere confirmación', 'La colección no pudo mapearse']);

function recordGroup(record) {
  return record?.product?._group || titleGroupKey(record?.product?.name);
}

function needsCollectionChoice(record) {
  return Boolean(record?.product?._manualCollection || record?.errors?.some(error => COLLECTION_ERRORS.has(error)));
}

/**
 * Title groups ("cadena", "hoops") whose products the owner must assign to a
 * collection by hand, plus groups already assigned by hand so the choice can
 * be corrected before the job is created.
 */
export function pendingCollectionGroups(records) {
  const groups = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (!needsCollectionChoice(record)) continue;
    const group = recordGroup(record);
    if (!groups.has(group)) groups.set(group, { group, count: 0, category: '', suggestions: new Set(), sample: cleanImportText(record.product?.name, 180) });
    const entry = groups.get(group);
    entry.count += 1;
    if (record.product?._manualCollection) entry.category = record.product.category || '';
    (record.product?._collectionSuggestions || []).forEach(slug => entry.suggestions.add(slug));
  }
  return [...groups.values()]
    .map(entry => ({ ...entry, suggestions: [...entry.suggestions] }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}

/** Assigns one existing collection to every product of a title group; returns how many changed. */
export function assignGroupCollection(records, group, slug, collections) {
  const target = collectionCandidates(collections).find(item => item.slug === normalizeImportKey(slug));
  if (!target || !group) return 0;
  let changed = 0;
  for (const record of Array.isArray(records) ? records : []) {
    if (!needsCollectionChoice(record) || recordGroup(record) !== group) continue;
    record.product.category = target.slug;
    record.product._manualCollection = true;
    record.errors = (record.errors || []).filter(error => !COLLECTION_ERRORS.has(error));
    changed += 1;
  }
  return changed;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of asText(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildImportFingerprint(source, sourceKey) {
  return `${normalizeImportKey(source || 'shopify')}:${normalizeImportKey(sourceKey)}`.slice(0, 420);
}

export function stableProductDocumentId(importFingerprint) {
  const first = stableHash(importFingerprint);
  const second = stableHash(`${importFingerprint}:tintin`);
  return `imp_${first}${second}`;
}

function numberValue(value, parseNumber) {
  const parsed = parseNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function variantFromRow(row, parseNumber, parseStock, optionNames = []) {
  const options = {};
  for (let index = 0; index < 3; index += 1) {
    const nameKey = `option${index + 1} name`;
    const valueKey = `option${index + 1} value`;
    const name = cleanImportText(row?.[nameKey] || optionNames[index], 80);
    const value = cleanImportText(row?.[valueKey], 220);
    if (name && value && !/^default title$/i.test(value)) options[name] = value;
  }
  const sku = cleanImportText(firstShopifyValue(row, ['variant sku', 'sku']), 160);
  const priceRaw = firstShopifyValue(row, ['variant price', 'price', 'precio']);
  const stockRaw = firstShopifyValue(row, ['variant inventory qty', 'inventory quantity', 'stock', 'inventory', 'inventario']);
  const image = safeImportUrl(firstShopifyValue(row, ['variant image', 'variant image url']));
  const optionKey = Object.entries(options).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('|');
  // Price and image URL are not identity. Shopify repeats a variant row for
  // each gallery image; using either field here would multiply stock.
  const key = `${sku}|${optionKey}`;
  // Shopify may emit image-only rows when a product has a gallery. Those rows
  // belong to the product media plan, not to a synthetic zero-price variant.
  const hasVariantData = Boolean(Object.keys(options).length || sku || priceRaw !== '' || stockRaw !== '');
  let stock = null;
  let stockState = 'none';
  if (hasVariantData) {
    const trackerColumns = ['inventory tracker', 'variant inventory tracker'];
    const untracked = (trackerColumns.some(name => Object.prototype.hasOwnProperty.call(row || {}, name))
      && !cleanImportText(firstShopifyValue(row, trackerColumns), 80))
      || CONTINUE_SELLING.has(normalizeImportKey(firstShopifyValue(row, ['variant inventory policy', 'continue selling when out of stock'])));
    if (untracked) {
      stockState = 'untracked';
    } else if (stockRaw === '') {
      stockState = 'missing';
    } else {
      const numeric = parseNumber(stockRaw);
      // Shopify allows negative inventory after overselling; the catalog
      // floor is zero (agotado), not an invalid row.
      if (Number.isInteger(numeric) && numeric < 0) {
        stock = 0;
        stockState = 'negative';
      } else {
        stock = parseStock(stockRaw);
        stockState = 'counted';
      }
    }
  }
  const variant = { ...options };
  if (sku) variant.sku = sku;
  if (priceRaw !== '') variant.price = Math.round(Math.max(0, numberValue(priceRaw, parseNumber)));
  if (stockRaw !== '' || stockState === 'untracked') variant.stock = stock;
  if (image) variant.imageUrl = image;
  return { key: key === '||' ? '__default__' : key, variant: hasVariantData ? variant : null, stock, stockState };
}

function imageFromRow(row) {
  return safeImportUrl(firstShopifyValue(row, [
    'image src', 'variant image', 'imageurl', 'image url', 'product image url', 'variant image url', 'imagen url',
    'url imagen', 'url de imagen', 'image', 'foto', 'imagen',
  ]));
}

/**
 * Groups Shopify's one-product-many-rows export by Handle. Inventory is
 * counted once per unique variant key, never once per gallery row.
 */
export function groupShopifyRows(rows, collections, { parseNumber, parseStock }) {
  const grouped = new Map();
  const invalidRows = [];
  const parseNumberFn = parseNumber || (value => Number(value));
  const parseStockFn = parseStock || (value => Number(value));

  (Array.isArray(rows) ? rows : []).forEach((row, rowIndex) => {
    const title = cleanImportText(firstShopifyValue(row, ['title', 'name', 'nombre']), 240);
    const handle = cleanImportText(firstShopifyValue(row, ['url handle', 'handle', 'id', 'sku']) || title, 320);
    if (!handle) {
      invalidRows.push({ row: rowIndex + 2, error: 'Falta Handle/Título' });
      return;
    }
    const explicitCollection = firstShopifyValue(row, ['category', 'collection', 'categoría', 'categoria']);
    const type = firstShopifyValue(row, ['type', 'product type', 'tipo']);
    const tags = firstShopifyValue(row, ['tags', 'etiquetas']);
    const collection = resolveShopifyCollection({ explicit: explicitCollection, type, tags, title }, collections);
    const image = imageFromRow(row);
    const imagePosition = Number(firstShopifyValue(row, ['image position', 'image_position'])) || 999999;
    const body = firstShopifyValue(row, ['body (html)', 'body html', 'description', 'descripción', 'descripcion']);
    const status = cleanImportText(firstShopifyValue(row, ['status', 'estado']) || 'active', 40).toLowerCase();
    const published = normalizeImportKey(firstShopifyValue(row, ['published on online store', 'published']));

    if (!grouped.has(handle)) {
      grouped.set(handle, {
        name: title || handle,
        category: collection.slug,
        _collectionSuggestions: collection.suggestions,
        _ambiguousCollection: collection.ambiguous,
        price: firstShopifyValue(row, ['variant price', 'price', 'precio']),
        priceBefore: firstShopifyValue(row, ['variant compare at price', 'compare-at price', 'compare at price', 'pricebefore', 'precio anterior']),
        stock: null,
        description: sanitizeShopifyBodyHtml(body),
        descriptionText: shopifyBodyToPlainText(body),
        tags: normalizeImportTags(tags),
        active: (status === 'active' || status === 'activo') && !NOT_PUBLISHED.has(published),
        source: 'shopify',
        sourceKey: handle,
        _images: [],
        _variants: [],
        _optionNames: [],
        _variantKeys: new Set(),
        _stockKeys: new Set(),
        _missingStockKeys: new Set(),
        _negativeStock: false,
        _untrackedStock: false,
      });
    }

    const product = grouped.get(handle);
    if (!product.description && body) {
      product.description = sanitizeShopifyBodyHtml(body);
      product.descriptionText = shopifyBodyToPlainText(body);
    }
    if (!product.category && collection.slug) product.category = collection.slug;
    if (!product._collectionSuggestions.length) product._collectionSuggestions = collection.suggestions;
    product._ambiguousCollection = product._ambiguousCollection || collection.ambiguous;
    if (image) product._images.push({ url: image, position: imagePosition });

    // Shopify only supplies option names on the first row of each product.
    // Carry the names within that Handle, while values remain row-specific.
    for (let index = 0; index < 3; index += 1) {
      const name = cleanImportText(row?.[`option${index + 1} name`], 80);
      if (name) product._optionNames[index] = name;
    }
    const variantInfo = variantFromRow(row, parseNumberFn, parseStockFn, product._optionNames);
    if (variantInfo.variant && !product._variantKeys.has(variantInfo.key)) {
      product._variantKeys.add(variantInfo.key);
      product._variants.push(variantInfo.variant);
    }
    if (variantInfo.variant && !product._stockKeys.has(variantInfo.key)) {
      if (variantInfo.stockState === 'untracked') {
        product._untrackedStock = true;
      } else if (variantInfo.stockState === 'missing') {
        // A later row of the same variant may still carry the quantity.
        product._missingStockKeys.add(variantInfo.key);
      } else {
        product._stockKeys.add(variantInfo.key);
        product._missingStockKeys.delete(variantInfo.key);
        if (variantInfo.stockState === 'negative') product._negativeStock = true;
        if (variantInfo.stock !== null && Number.isFinite(variantInfo.stock)) {
          product.stock = (product.stock ?? 0) + variantInfo.stock;
        } else {
          product._invalidStock = true;
        }
      }
    }
  });

  const products = [...grouped.values()].map(product => {
    const images = [...new Map(product._images
      .sort((a, b) => a.position - b.position)
      .map(item => [item.url, item.url])).values()];
    const primary = images[0] || '';
    const variants = product._variants;
    // One untracked or quantity-less variant makes the product "Sin límite":
    // a partial sum would understate what Shopify lets customers buy.
    const unknownStock = product._untrackedStock || product._missingStockKeys.size > 0;
    const output = {
      name: product.name,
      category: product.category,
      price: Math.round(Math.max(0, numberValue(product.price, parseNumberFn))),
      priceBefore: product.priceBefore === '' ? null : Math.round(Math.max(0, numberValue(product.priceBefore, parseNumberFn))),
      stock: unknownStock ? null : product.stock,
      imageUrl: primary,
      imagesExtra: images.slice(1),
      description: product.description,
      descriptionText: product.descriptionText,
      tags: product.tags,
      variants,
      active: product.active,
      source: product.source,
      sourceMetadata: { platform: 'shopify', handle: product.sourceKey },
      importFingerprint: buildImportFingerprint(product.source, product.sourceKey),
      _collectionSuggestions: product._collectionSuggestions,
      _ambiguousCollection: product._ambiguousCollection,
      _group: titleGroupKey(product.name),
    };
    const errors = [];
    const warnings = [];
    if (!output.name) errors.push('Falta el título');
    if (!output.category) errors.push(output._ambiguousCollection ? 'La colección requiere confirmación' : 'La colección no pudo mapearse');
    if (!(output.price > 0)) errors.push('El precio debe ser mayor que cero');
    if (output.priceBefore != null && output.priceBefore <= output.price) warnings.push('El precio anterior no es mayor al precio actual');
    if (!output.imageUrl) warnings.push('Sin imagen principal');
    if (output.imagesExtra.length) warnings.push(`${output.imagesExtra.length} imagen(es) secundaria(s) detectada(s)`);
    if (product._invalidStock) errors.push('El stock contiene un valor inválido');
    if (product._untrackedStock) warnings.push('Shopify no controla el stock (o sigue vendiendo sin stock): queda Sin límite');
    else if (product._missingStockKeys.size) warnings.push('Sin cantidad de stock en el CSV: queda Sin límite');
    if (product._negativeStock) warnings.push('Stock negativo en Shopify: se importa como 0');
    if (!unknownStock && product._stockKeys.size > 1) warnings.push(`Stock sumado de ${product._stockKeys.size} variantes`);
    const variantPrices = new Set(variants.map(item => item.price).filter(value => Number.isFinite(value) && value > 0));
    if (variantPrices.size > 1) warnings.push(`Las variantes tienen precios distintos: se usa Gs. ${output.price.toLocaleString('es-PY')} para todas`);
    return { product: output, errors, warnings, duplicate: false };
  });

  return { products, invalidRows };
}

/**
 * Splits imported Shopify options into real selectable groups (two or more
 * distinct values) and descriptive attributes (a single value). Shopify uses
 * one-value options as product facts ("Material: Acero"); turning them into
 * selectors would force shoppers to click the only choice before buying.
 */
export function importVariantOptions(variants) {
  const values = new Map();
  for (const variant of Array.isArray(variants) ? variants : []) {
    if (!variant || typeof variant !== 'object') continue;
    for (const [rawKey, rawValue] of Object.entries(variant)) {
      if (VARIANT_META_KEYS.has(rawKey)) continue;
      const key = cleanImportText(rawKey, 60);
      const value = cleanImportText(rawValue, 120);
      if (!key || !value) continue;
      if (!values.has(key)) values.set(key, []);
      if (!values.get(key).includes(value)) values.get(key).push(value);
    }
  }
  const groups = {};
  const attributes = {};
  for (const [key, list] of values) {
    // The storefront joins a selection with "/", so a value may not carry one.
    const options = [...new Set(list.map(value => value.replace(/\s*\/\s*/g, ' - ')))].slice(0, 50);
    if (options.length > 1 && Object.keys(groups).length < 20) groups[key] = options;
    else attributes[key] = list.join(' · ');
  }
  return { groups, attributes };
}

/**
 * Catalog document for one grouped Shopify product, with the same limits the
 * Admin product form enforces. Timestamps are added by the writer.
 */
export function buildCatalogProductFromImport(product) {
  const source = product && typeof product === 'object' ? product : {};
  const price = Math.round(Number(source.price));
  const before = source.priceBefore == null || source.priceBefore === '' ? null : Math.round(Number(source.priceBefore));
  const stock = source.stock == null || !Number.isFinite(Number(source.stock))
    ? null
    : Math.min(1000000, Math.max(0, Math.round(Number(source.stock))));
  const { groups, attributes } = importVariantOptions(source.variants);
  const specs = { material: [], colorFinish: [], sizeFit: [] };
  const details = [];
  for (const [key, value] of Object.entries(attributes)) {
    const normalized = normalizeImportKey(key);
    if (normalized.includes('material')) specs.material.push(value);
    else if (normalized.includes('color')) specs.colorFinish.push(normalized === 'color' ? value : `${key}: ${value}`);
    else if (normalized.includes('talla') || normalized.includes('tamano')) specs.sizeFit.push(normalized === 'talla' ? value : `${key}: ${value}`);
    else details.push(`${key}: ${value}`);
  }
  const text = cleanImportText(source.descriptionText ?? shopifyBodyToPlainText(source.description), 4000);
  const description = [text, details.join('\n')].filter(Boolean).join('\n\n').slice(0, 4000).trim();
  const tags = [...new Set(normalizeImportTags(source.tags).map(tag => tag.slice(0, 60).trim()).filter(Boolean))].slice(0, 30);
  const handle = cleanImportText(source.sourceMetadata?.handle, 320);
  const data = {
    name: cleanImportText(source.name, 180),
    category: cleanImportText(source.category, 160),
    collection: null,
    price,
    priceBefore: Number.isFinite(before) && before > price && before <= 1e9 ? before : null,
    stock,
    imageUrl: safeImportUrl(source.imageUrl) || null,
    imagesExtra: (Array.isArray(source.imagesExtra) ? source.imagesExtra : []).map(safeImportUrl).filter(Boolean).slice(0, 12),
    tags,
    description,
    material: specs.material.join(' · ').slice(0, 240),
    measurements: '',
    colorFinish: specs.colorFinish.join(' · ').slice(0, 240),
    care: '',
    waterResistance: '',
    warranty: '',
    sizeFit: specs.sizeFit.join(' · ').slice(0, 240),
    packageContents: '',
    badge: null,
    active: source.active !== false,
    oferta: false,
    destacado: false,
    shopifyHandle: handle,
    source: 'shopify',
    sourceMetadata: { platform: 'shopify', handle },
    importFingerprint: cleanImportText(source.importFingerprint, 420),
  };
  if (Object.keys(groups).length) {
    data.variants = groups;
    if (source.variants.every(variant => Number.isInteger(variant.stock) && variant.stock >= 0)) {
      const seen = new Set();
      data.variantInventory = source.variants.map(variant => {
        const selection = Object.keys(groups).map(key => cleanImportText(variant[key], 120).replace(/\s*\/\s*/g, ' - ')).join(' / ');
        if (!selection || selection.length > 120 || seen.has(selection)) throw new Error('Opciones de variante ambiguas; revisá el producto antes de importar.');
        seen.add(selection);
        return { variant: selection, stock: Math.min(1000000, variant.stock) };
      });
    }
  }
  return data;
}

export function summarizeImportRecords(records) {
  return (Array.isArray(records) ? records : []).reduce((summary, record) => {
    if (record.errors?.length) summary.invalid += 1;
    else if (record.duplicate) summary.duplicate += 1;
    else summary.ready += 1;
    summary.images += 1 + (record.product?.imagesExtra?.length || 0);
    summary.variants += record.product?.variants?.length || 0;
    return summary;
  }, { ready: 0, duplicate: 0, invalid: 0, images: 0, variants: 0 });
}

export function chunkImportRecords(records, size = 50) {
  const output = [];
  for (let index = 0; index < records.length; index += size) output.push(records.slice(index, index + size));
  return output;
}

export const IMPORT_JOB_STATES = Object.freeze(['PREVIEW', 'READY', 'RUNNING', 'PAUSED', 'FAILED', 'COMPLETED', 'CANCELLED']);
export const MEDIA_JOB_STATES = Object.freeze(['PENDING', 'DOWNLOADING', 'VALIDATED', 'STORED', 'FAILED', 'SKIPPED']);
