import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`No se encontró el contrato para ${label}.`);
  return source.replace(before, after);
}

// 1. El runtime de política debe ejecutarse antes de que products-store publique.
{
  const file = 'js/page-maintenance-loader.js';
  let source = read(file);
  source = replaceOnce(
    source,
    "function pathName() {",
    "import './phase7-catalog-policy.js?v=tintin-20260730-phase7-catalog-1';\n\nfunction pathName() {",
    'cargar la política de catálogo'
  );
  write(file, source);
}

// 2. Conservar búsqueda, variantes y descripción también en la caché pública.
{
  const file = 'js/products-store.js';
  let source = read(file);
  source = replaceOnce(
    source,
    "    destacado: !!d.destacado,\n    variants: sanitizeVariantData(d.variants || null),",
    "    destacado: !!d.destacado,\n    tags: Array.isArray(d.tags)\n      ? d.tags.map(tag => cleanText(tag, 60)).filter(Boolean).slice(0, 30)\n      : String(d.tags || '').split(',').map(tag => cleanText(tag, 60)).filter(Boolean).slice(0, 30),\n    variants: sanitizeVariantData(d.variants || null),",
    'mapear tags públicos'
  );
  source = replaceOnce(
    source,
    "    badge: product.badge,\n    imageUrl: product.imageUrl,\n    stock: product.stock,",
    "    badge: product.badge,\n    desc: product.desc,\n    description: product.description,\n    imageUrl: product.imageUrl,\n    imagesExtra: product.imagesExtra,\n    tags: product.tags,\n    variants: product.variants,\n    stock: product.stock,",
    'conservar campos en caché compacta'
  );
  source = replaceOnce(
    source,
    "function normalizeList(list) {\n  return list\n    .filter(Boolean)\n    .filter(p => p.active !== false && Boolean(p.name))\n    .sort((a, b) => a.name.localeCompare(b.name, 'es'));\n}",
    "function normalizeList(list) {\n  return list\n    .filter(Boolean)\n    .map(product => window.TintinCatalogPolicy?.normalizeProduct\n      ? window.TintinCatalogPolicy.normalizeProduct(product)\n      : product)\n    .filter(product => window.TintinCatalogPolicy?.isPurchasable\n      ? window.TintinCatalogPolicy.isPurchasable(product)\n      : product.active !== false && Boolean(product.name) && !(product.stock != null && Number(product.stock) <= 0))\n    .sort((a, b) => a.name.localeCompare(b.name, 'es'));\n}",
    'normalizar catálogo comprable'
  );
  source = replaceOnce(
    source,
    "  const product = mapProduct(snapshot.id, snapshot.data());\n  writeCached(`product:${id}`, product);\n  return product;",
    "  const product = mapProduct(snapshot.id, snapshot.data());\n  if (window.TintinCatalogPolicy?.isPurchasable && !window.TintinCatalogPolicy.isPurchasable(product)) return null;\n  writeCached(`product:${id}`, product);\n  return product;",
    'bloquear ficha directa no comprable'
  );
  source = replaceOnce(
    source,
    "    return snapshot.docs.map(item => compactProduct(mapProduct(item.id, item.data())));",
    "    return normalizeList(snapshot.docs.map(item => mapProduct(item.id, item.data())))\n      .map(compactProduct);",
    'filtrar productos relacionados'
  );
  source = replaceOnce(
    source,
    "        if (product.active === false || !product.name) {",
    "        if (product.active === false || !product.name ||\n            (window.TintinCatalogPolicy?.isPurchasable && !window.TintinCatalogPolicy.isPurchasable(product))) {",
    'cerrar acceso directo por listener'
  );
  write(file, source);
}

// 3. Catálogo: búsqueda completa y variantes siempre pasan por la ficha.
{
  const file = 'catalogo.html';
  let source = read(file);
  source = replaceOnce(
    source,
    "    normalizeSearch(p.category || p.cat).includes(q) ||\n    normalizeSearch(p.desc || p.description).includes(q)",
    "    normalizeSearch(p.category || p.cat).includes(q) ||\n    normalizeSearch(p.desc || p.description).includes(q) ||\n    normalizeSearch((p.tags || []).join(' ')).includes(q) ||\n    normalizeSearch(JSON.stringify(p.variants || {})).includes(q)",
    'buscar tags y variantes en catálogo'
  );
  source = replaceOnce(
    source,
    "    const inStock = isInStockCat(p);\n    const badgeHtml",
    "    const inStock = isInStockCat(p);\n    const hasVariants = window.TintinCatalogPolicy?.hasVariants\n      ? window.TintinCatalogPolicy.hasVariants(p)\n      : Boolean(p.variants && Object.values(p.variants).some(values => Array.isArray(values) && values.length));\n    const badgeHtml",
    'detectar variantes en tarjetas'
  );
  source = replaceOnce(
    source,
    "            <button type=\"button\" class=\"tt-card-btn tt-card-btn-cart\" data-pid=\"${safeId}\"${inStock ? '' : ' disabled aria-disabled=\"true\"'}>${inStock ? '+ Carrito' : 'Agotado'}</button>",
    "            ${hasVariants\n              ? `<a class=\"tt-card-btn tt-card-btn-cart\" href=\"${productHref}\">Elegir opciones</a>`\n              : `<button type=\"button\" class=\"tt-card-btn tt-card-btn-cart\" data-pid=\"${safeId}\"${inStock ? '' : ' disabled aria-disabled=\"true\"'}>${inStock ? '+ Carrito' : 'Agotado'}</button>`}",
    'evitar agregar variantes sin elegir'
  );
  write(file, source);
}

// 4. Script compartido: una sola política para tarjetas, búsqueda, ficha y carrito.
{
  const file = 'script.js';
  let source = read(file);
  source = replaceOnce(
    source,
    "function isFeaturable(p) {\n  return p.active !== false && isInStock(p) && hasValidName(p);\n}",
    "function isFeaturable(p) {\n  if (window.TintinCatalogPolicy?.isPurchasable) return window.TintinCatalogPolicy.isPurchasable(p);\n  return p.active !== false && isInStock(p) && hasValidName(p) && Number.isFinite(Number(p.price)) && Number(p.price) > 0;\n}",
    'usar política comprable en tarjetas'
  );
  source = replaceOnce(
    source,
    "function syncCartWithCatalog() {\n  const pool = window.PRODUCTS;\n  if (!pool || !pool.length) return getCart();\n  const cart = getCart();\n  const synced = cart\n    .map(item => {\n      const live = pool.find(p => String(p.id) === String(item.id));\n      if (!live || live.active === false) return null;\n      return { ...item, name: live.name, price: live.price, imageUrl: live.imageUrl || item.imageUrl };\n    })\n    .filter(Boolean);\n  if (synced.length !== cart.length || synced.some((it, i) => it.price !== cart[i].price || it.name !== cart[i].name)) {\n    saveCart(synced);\n  }\n  return synced;\n}",
    "function syncCartWithCatalog() {\n  const pool = window.PRODUCTS;\n  if (!Array.isArray(pool)) return getCart();\n  if (window.TintinCatalogPolicy?.reconcileCart) {\n    return window.TintinCatalogPolicy.reconcileCart(pool);\n  }\n  const cart = getCart();\n  const synced = cart\n    .map(item => {\n      const live = pool.find(p => String(p.id) === String(item.id));\n      if (!live || !isFeaturable(live)) return null;\n      const max = live.stock == null ? 99 : Math.max(0, Number(live.stock));\n      return {\n        ...item,\n        name: live.name,\n        price: live.price,\n        qty: Math.max(1, Math.min(max || 1, Number(item.qty) || 1)),\n        imageUrl: live.imageUrl || item.imageUrl\n      };\n    })\n    .filter(Boolean);\n  if (JSON.stringify(synced) !== JSON.stringify(cart)) saveCart(synced);\n  return synced;\n}",
    'reconciliar carrito con catálogo'
  );
  source = replaceOnce(
    source,
    "      const q = input.value.trim().toLowerCase();",
    "      const q = input.value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().toLowerCase();",
    'normalizar búsqueda global'
  );
  source = replaceOnce(
    source,
    "      const matches = productPool.filter(p =>\n        String(p.name || '').toLowerCase().includes(q) ||\n        String(p.cat || p.category || '').toLowerCase().includes(q) ||\n        String(p.desc || '').toLowerCase().includes(q)\n      ).slice(0, SEARCH_RESULTS_LIMIT);",
    "      const searchable = value => String(value == null ? '' : value)\n        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();\n      const matches = productPool.filter(isFeaturable).filter(p =>\n        searchable(p.name).includes(q) ||\n        searchable(p.cat || p.category).includes(q) ||\n        searchable(p.desc || p.description).includes(q) ||\n        searchable((p.tags || []).join(' ')).includes(q) ||\n        searchable(JSON.stringify(p.variants || {})).includes(q)\n      ).slice(0, SEARCH_RESULTS_LIMIT);",
    'filtrar y ampliar búsqueda global'
  );
  source = replaceOnce(
    source,
    "function _renderProductDetail(product) {\n  const isSameProduct",
    "function _renderProductDetail(product) {\n  if (window.TintinCatalogPolicy?.isPurchasable && !window.TintinCatalogPolicy.isPurchasable(product)) {\n    _showProductNotFound();\n    return;\n  }\n  const isSameProduct",
    'proteger ficha por URL directa'
  );
  write(file, source);
}

// 5. Admin: validar límites y transformar variantes separadas por comas.
{
  const file = 'js/admin-app.js';
  let source = read(file);
  source = replaceOnce(
    source,
    "  const price = parseInt(document.getElementById('prod-price').value, 10);\n\n  if (!name || !category || !price) {\n    errEl.textContent = 'Nombre, categoría y precio son obligatorios.';",
    "  const price = Number(document.getElementById('prod-price').value);\n  const stockRaw = document.getElementById('prod-stock').value.trim();\n  const stockValue = stockRaw === '' ? null : Number(stockRaw);\n  const priceBeforeRaw = document.getElementById('prod-price-before').value.trim();\n  const priceBeforeValue = priceBeforeRaw === '' ? null : Number(priceBeforeRaw);\n  const categoryExists = _allCollections.some(collection => collection.slug === category);\n\n  if (!name || !category || !categoryExists || !Number.isInteger(price) || price <= 0 || price > 1000000000) {\n    errEl.textContent = !categoryExists && category\n      ? 'La colección elegida ya no existe. Actualizá la lista y seleccioná otra.'\n      : 'Nombre, colección y un precio entero mayor a cero son obligatorios.';",
    'validar identidad y precio'
  );
  source = replaceOnce(
    source,
    "  errEl.style.display = 'none';\n\n  const btn = document.getElementById('prod-save-btn');",
    "  if (stockValue != null && (!Number.isInteger(stockValue) || stockValue < 0 || stockValue > 1000000)) {\n    errEl.textContent = 'El stock debe ser un número entero entre 0 y 1.000.000, o quedar vacío si no se controla.';\n    errEl.style.display = '';\n    return false;\n  }\n  if (priceBeforeValue != null && (!Number.isInteger(priceBeforeValue) || priceBeforeValue <= price || priceBeforeValue > 1000000000)) {\n    errEl.textContent = 'El precio anterior debe ser un entero mayor al precio actual, o quedar vacío.';\n    errEl.style.display = '';\n    return false;\n  }\n  errEl.style.display = 'none';\n\n  const btn = document.getElementById('prod-save-btn');",
    'validar stock y precio anterior'
  );
  source = replaceOnce(
    source,
    "      const val = line.slice(idx + 1).trim();\n      if (!key || !val) return;\n      if (!vObj[key]) vObj[key] = [];\n      if (!vObj[key].includes(val)) vObj[key].push(val);",
    "      const values = line.slice(idx + 1).split(',').map(value => value.trim()).filter(Boolean);\n      if (!key || !values.length || key.length > 60) return;\n      if (!vObj[key]) vObj[key] = [];\n      values.forEach(value => {\n        const safeValue = value.slice(0, 120);\n        if (safeValue && !vObj[key].includes(safeValue) && vObj[key].length < 50) vObj[key].push(safeValue);\n      });",
    'separar variantes por comas'
  );
  source = replaceOnce(
    source,
    "    if (Object.keys(vObj).length) variantsParsed = vObj;",
    "    if (Object.keys(vObj).length > 20) {\n      errEl.textContent = 'Un producto puede tener hasta 20 grupos de variantes.';\n      errEl.style.display = '';\n      btn.textContent = 'Guardar producto'; btn.disabled = false;\n      return false;\n    }\n    if (Object.keys(vObj).length) {\n      variantsParsed = vObj;\n      document.getElementById('prod-variants-text').value = Object.entries(vObj)\n        .flatMap(([key, values]) => values.map(value => `${key}: ${value}`)).join('\\n');\n    }",
    'limitar y normalizar variantes'
  );
  source = replaceOnce(
    source,
    "  const tagsRaw = document.getElementById('prod-tags').value.trim();\n  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];\n\n  const priceBefore = parseInt(document.getElementById('prod-price-before').value) || null;",
    "  const tagsRaw = document.getElementById('prod-tags').value.trim();\n  const tags = [...new Set(tagsRaw ? tagsRaw.split(',').map(tag => tag.trim().slice(0, 60)).filter(Boolean) : [])].slice(0, 30);\n  document.getElementById('prod-tags').value = tags.join(', ');",
    'normalizar tags'
  );
  source = replaceOnce(
    source,
    "    priceBefore,",
    "    priceBefore: priceBeforeValue,",
    'usar precio anterior validado'
  );
  source = replaceOnce(
    source,
    "    stock: (() => {\n      const raw = document.getElementById('prod-stock').value.trim();\n      if (raw === '') return null;\n      const n = parseInt(raw);\n      return Number.isNaN(n) ? null : n;\n    })(),",
    "    stock: stockValue,",
    'usar stock validado'
  );
  source = replaceOnce(
    source,
    "    ...(variantsParsed ? { variants: variantsParsed } : {}),\n    updatedAt: serverTimestamp(),",
    "    ...(variantsParsed ? { variants: variantsParsed } : (_isEdit ? { variants: deleteField() } : {})),\n    updatedAt: serverTimestamp(),",
    'eliminar variantes antiguas al limpiar'
  );
  write(file, source);
}

// 6. Registrar auditoría dedicada y conectarla al cierre integral.
{
  const file = 'package.json';
  const pkg = JSON.parse(read(file));
  pkg.scripts['audit:phase7-catalog'] = 'node scripts/audit-phase7-catalog.js';
  if (!pkg.scripts['audit:final'].includes('audit:phase7-catalog')) {
    pkg.scripts['audit:final'] += ' && npm run audit:phase7-catalog';
  }
  write(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

// El transformador es solo de consolidación; no forma parte del producto final.
fs.rmSync(import.meta.filename);
console.log('Fase 7 aplicada: catálogo, ficha, variantes, carrito y Admin sincronizados.');
