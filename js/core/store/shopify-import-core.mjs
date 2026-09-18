const ALLOWED_BODY_TAGS = new Set(['p', 'br', 'strong', 'em', 'ul', 'ol', 'li']);
const BLOCKED_BODY_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'style', 'link', 'svg', 'math', 'template', 'form']);
const SHOPIFY_STATUS = new Set(['active', 'draft', 'archived']);

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
  return { slug: '', suggestions: [], ambiguous: false };
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

function variantFromRow(row, parseNumber, parseStock) {
  const options = {};
  for (const [nameKey, valueKey] of [['option1 name', 'option1 value'], ['option2 name', 'option2 value'], ['option3 name', 'option3 value']]) {
    const name = cleanImportText(row?.[nameKey], 80);
    const value = cleanImportText(row?.[valueKey], 220);
    if (name && value && !/^default title$/i.test(value)) options[name] = value;
  }
  const sku = cleanImportText(firstShopifyValue(row, ['variant sku', 'sku']), 160);
  const priceRaw = firstShopifyValue(row, ['variant price', 'price', 'precio']);
  const stockRaw = firstShopifyValue(row, ['variant inventory qty', 'stock', 'inventory', 'inventario']);
  const image = safeImportUrl(firstShopifyValue(row, ['variant image']));
  const optionKey = Object.entries(options).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('|');
  // Price and image URL are not identity. Shopify repeats a variant row for
  // each gallery image; using either field here would multiply stock.
  const key = `${sku}|${optionKey}`;
  const variant = { ...options };
  if (sku) variant.sku = sku;
  if (priceRaw !== '') variant.price = Math.round(Math.max(0, numberValue(priceRaw, parseNumber)));
  if (stockRaw !== '') variant.stock = parseStock(stockRaw);
  if (image) variant.imageUrl = image;
  // Shopify may emit image-only rows when a product has a gallery. Those rows
  // belong to the product media plan, not to a synthetic zero-price variant.
  const hasVariantData = Object.keys(variant).some(key => key !== 'imageUrl');
  return { key: key === '||' ? '__default__' : key, variant: hasVariantData ? variant : null, stockRaw };
}

function imageFromRow(row) {
  return safeImportUrl(firstShopifyValue(row, [
    'image src', 'variant image', 'imageurl', 'image url', 'imagen url',
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
    const handle = cleanImportText(firstShopifyValue(row, ['handle', 'id', 'sku']) || title, 320);
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

    if (!grouped.has(handle)) {
      grouped.set(handle, {
        name: title || handle,
        category: collection.slug,
        _collectionSuggestions: collection.suggestions,
        _ambiguousCollection: collection.ambiguous,
        price: firstShopifyValue(row, ['variant price', 'price', 'precio']),
        priceBefore: firstShopifyValue(row, ['variant compare at price', 'compare at price', 'pricebefore', 'precio anterior']),
        stock: null,
        description: sanitizeShopifyBodyHtml(body),
        tags: normalizeImportTags(tags),
        active: status === 'active' || status === 'activo',
        source: 'shopify',
        sourceKey: handle,
        _images: [],
        _variants: [],
        _variantKeys: new Set(),
        _stockKeys: new Set(),
      });
    }

    const product = grouped.get(handle);
    if (!product.description && body) product.description = sanitizeShopifyBodyHtml(body);
    if (!product.category && collection.slug) product.category = collection.slug;
    if (!product._collectionSuggestions.length) product._collectionSuggestions = collection.suggestions;
    product._ambiguousCollection = product._ambiguousCollection || collection.ambiguous;
    if (image) product._images.push({ url: image, position: imagePosition });

    const variantInfo = variantFromRow(row, parseNumberFn, parseStockFn);
    if (variantInfo.variant && !product._variantKeys.has(variantInfo.key)) {
      product._variantKeys.add(variantInfo.key);
      product._variants.push(variantInfo.variant);
    }
    if (!product._stockKeys.has(variantInfo.key) && variantInfo.stockRaw !== '') {
      product._stockKeys.add(variantInfo.key);
      const parsedStock = parseStockFn(variantInfo.stockRaw);
      if (parsedStock !== null && Number.isFinite(parsedStock)) {
        product.stock = (product.stock ?? 0) + parsedStock;
      } else {
        product._invalidStock = true;
      }
    }
  });

  const products = [...grouped.values()].map(product => {
    const images = [...new Map(product._images
      .sort((a, b) => a.position - b.position)
      .map(item => [item.url, item.url])).values()];
    const primary = images[0] || '';
    const variants = product._variants;
    const output = {
      name: product.name,
      category: product.category,
      price: Math.round(Math.max(0, numberValue(product.price, parseNumberFn))),
      priceBefore: product.priceBefore === '' ? null : Math.round(Math.max(0, numberValue(product.priceBefore, parseNumberFn))),
      stock: product.stock,
      imageUrl: primary,
      imagesExtra: images.slice(1),
      description: product.description,
      tags: product.tags,
      variants,
      active: product.active,
      source: product.source,
      sourceMetadata: { platform: 'shopify', handle: product.sourceKey },
      importFingerprint: buildImportFingerprint(product.source, product.sourceKey),
      _collectionSuggestions: product._collectionSuggestions,
      _ambiguousCollection: product._ambiguousCollection,
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
    return { product: output, errors, warnings, duplicate: false };
  });

  return { products, invalidRows };
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
