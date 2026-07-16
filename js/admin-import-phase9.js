/* =============================================================
   TINTIN — Fase 9: importación, copias y cierre de despliegue

   Mantiene los exportadores históricos, oculta los importadores inseguros y
   agrega un flujo nuevo con validación, vista previa, detección de duplicados,
   categorías reales y escrituras por lotes auditadas.
   ============================================================= */

import { auth, db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SUPER_ADMIN } from './roles.js?v=tintin-20260716-cloudinary-fix-1';
import { getDocsPaginated } from './firestore-pagination.js?v=tintin-20260716-cloudinary-fix-1';

if (!window.TintinAdminImportPhase9Booted) {
  window.TintinAdminImportPhase9Booted = true;

  const PROJECT_ID = 'tintin-accesorios';
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_IMPORT_ROWS = 1000;
  const BATCH_SIZE = 350;
  const state = {
    user: null,
    collections: [],
    existingProducts: [],
    records: [],
    fileName: '',
    source: '',
    busy: false,
    ui: null,
  };

  const text = value => String(value == null ? '' : value);
  const lower = value => text(value).trim().toLocaleLowerCase('es');

  function node(tag, className = '', value = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== '') element.textContent = value;
    return element;
  }

  function toast(message, error = false) {
    const element = document.getElementById('adm-toast');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('phase9-error', error);
    element.classList.add('show');
    clearTimeout(element._phase9Timer);
    element._phase9Timer = setTimeout(() => element.classList.remove('show'), 3600);
  }

  function isSuperAdmin() {
    return Boolean(state.user && lower(state.user.email) === SUPER_ADMIN);
  }

  function cleanText(value, max = 500) {
    return text(value)
      .replace(/\u0000/g, '')
      .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, max);
  }

  function stripHtml(value, max = 4000) {
    const template = document.createElement('template');
    template.innerHTML = text(value);
    return cleanText(template.content.textContent || '', max).replace(/\s+/g, ' ').trim();
  }

  function normalizeKey(value) {
    return lower(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180);
  }

  function productKey(product) {
    return `${normalizeKey(product.name)}::${normalizeKey(product.category)}`;
  }

  function safeUrl(value) {
    const candidate = cleanText(value, 1500);
    if (!candidate) return '';
    if (/['"<>\u0000-\u001f\u007f]/.test(candidate)) return null;
    try {
      const parsed = new URL(candidate, window.location.href);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      return parsed.href;
    } catch {
      return null;
    }
  }

  function numberValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const raw = text(value).trim().replace(/\s/g, '');
    if (!raw) return 0;
    const normalized = raw.includes(',') && raw.includes('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function integerValue(value) {
    return Math.max(0, Math.floor(numberValue(value)));
  }

  function sanitizeTags(value) {
    const list = Array.isArray(value) ? value : text(value).split(',');
    return [...new Set(list.map(item => cleanText(item, 80)).filter(Boolean))].slice(0, 30);
  }

  function sanitizeVariants(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 100).map(variant => {
      if (!variant || typeof variant !== 'object' || Array.isArray(variant)) return null;
      const safe = {};
      Object.entries(variant).slice(0, 20).forEach(([key, item]) => {
        const safeKey = cleanText(key, 60);
        if (!safeKey) return;
        if (safeKey === 'price') safe.price = Math.max(0, numberValue(item));
        else if (safeKey === 'imageUrl') {
          const url = safeUrl(item);
          if (url) safe.imageUrl = url;
        } else safe[safeKey] = cleanText(item, 220);
      });
      return Object.keys(safe).length ? safe : null;
    }).filter(Boolean);
  }

  function currentCategorySlugs() {
    return new Set(state.collections.map(item => cleanText(item.slug || item.id, 120)).filter(Boolean));
  }

  function categoryFromSignals(type, tags, title) {
    const signals = [type, tags, title].map(lower).join(' ');
    if (!signals) return '';
    const candidates = state.collections.map(collectionItem => ({
      slug: cleanText(collectionItem.slug || collectionItem.id, 120),
      name: cleanText(collectionItem.name || '', 160),
    })).filter(item => item.slug);

    const exactTokens = new Set(signals.split(/[^a-záéíóúüñ0-9]+/i).filter(Boolean));
    const exact = candidates.find(item =>
      exactTokens.has(lower(item.slug)) || exactTokens.has(lower(item.name))
    );
    if (exact) return exact.slug;

    const contains = candidates.find(item =>
      signals.includes(lower(item.slug)) || (item.name && signals.includes(lower(item.name)))
    );
    return contains?.slug || '';
  }

  function normalizeProduct(raw, meta = {}) {
    const name = cleanText(raw?.name ?? raw?.title, 180);
    const category = cleanText(raw?.category ?? raw?.collection, 120);
    const rawImage = raw?.imageUrl ?? raw?.image ?? '';
    const imageUrl = safeUrl(rawImage);
    const price = Math.round(Math.max(0, numberValue(raw?.price)));
    const stock = integerValue(raw?.stock);
    const sourceKey = cleanText(meta.sourceKey || raw?.importFingerprint || raw?.id || `${name}-${category}`, 300);
    const source = cleanText(meta.source || raw?.source || 'json', 80) || 'json';

    const product = {
      name,
      category,
      price,
      priceBefore: raw?.priceBefore == null ? null : Math.round(Math.max(0, numberValue(raw.priceBefore))),
      stock,
      imageUrl: imageUrl || '',
      imagesExtra: (Array.isArray(raw?.imagesExtra) ? raw.imagesExtra : [])
        .map(safeUrl).filter(Boolean).slice(0, 20),
      description: stripHtml(raw?.description ?? raw?.body ?? '', 4000),
      tags: sanitizeTags(raw?.tags),
      variants: sanitizeVariants(raw?.variants),
      active: raw?.active !== false && lower(raw?.status) !== 'draft' && lower(raw?.status) !== 'archived',
      oferta: Boolean(raw?.oferta),
      destacado: Boolean(raw?.destacado),
      source,
      importFingerprint: `${normalizeKey(source)}:${normalizeKey(sourceKey)}`,
    };

    const errors = [];
    const warnings = [];
    if (!product.name) errors.push('Falta el nombre');
    if (!product.category) errors.push('Falta la colección');
    if (!currentCategorySlugs().has(product.category)) errors.push('La colección no existe');
    if (!(product.price > 0)) errors.push('El precio debe ser mayor que cero');
    if (rawImage && imageUrl === null) errors.push('La URL de imagen no es segura');
    if (product.priceBefore != null && product.priceBefore <= product.price) {
      warnings.push('El precio anterior no es mayor al precio actual');
    }
    if (!product.imageUrl) warnings.push('Sin imagen principal');

    return { product, errors, warnings, duplicate: false };
  }

  function parseCsv(textValue) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const input = text(textValue).replace(/^\uFEFF/, '');

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      const next = input[index + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(cell);
        cell = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && next === '\n') index += 1;
        row.push(cell);
        cell = '';
        if (row.some(value => text(value).trim())) rows.push(row);
        row = [];
      } else {
        cell += char;
      }
    }
    row.push(cell);
    if (row.some(value => text(value).trim())) rows.push(row);
    if (quoted) throw new Error('El CSV termina dentro de un campo entre comillas.');
    return rows;
  }

  function csvObjects(textValue) {
    const rows = parseCsv(textValue);
    if (rows.length < 2) throw new Error('El CSV no contiene filas de productos.');
    const headers = rows[0].map(value => lower(value));
    return rows.slice(1).map(values => {
      const object = {};
      headers.forEach((header, index) => { if (header) object[header] = values[index] ?? ''; });
      return object;
    });
  }

  function first(object, names) {
    for (const name of names) {
      if (object[name] != null && text(object[name]).trim() !== '') return object[name];
    }
    return '';
  }

  function productsFromCsv(textValue) {
    const rows = csvObjects(textValue);
    const grouped = new Map();

    rows.forEach((row, index) => {
      const title = first(row, ['title', 'name', 'nombre']);
      const handle = first(row, ['handle', 'id', 'sku']) || `${title}-${index + 1}`;
      const groupKey = cleanText(handle, 300);
      if (!groupKey) return;
      const type = first(row, ['type', 'product type', 'tipo']);
      const tags = first(row, ['tags', 'etiquetas']);
      const category = first(row, ['category', 'collection', 'categoría', 'categoria']) || categoryFromSignals(type, tags, title);
      const price = first(row, ['variant price', 'price', 'precio']);
      const stock = first(row, ['variant inventory qty', 'stock', 'inventory', 'inventario']);
      const image = first(row, ['image src', 'variant image', 'imageurl', 'image url', 'image', 'foto', 'imagen']);
      const description = first(row, ['body (html)', 'body html', 'description', 'descripción', 'descripcion']);
      const status = first(row, ['status', 'estado']) || 'active';

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          name: title || handle,
          category,
          price,
          priceBefore: first(row, ['variant compare at price', 'compare at price', 'pricebefore', 'precio anterior']),
          stock: 0,
          imageUrl: image,
          imagesExtra: [],
          description,
          tags,
          variants: [],
          active: lower(status) === 'active' || lower(status) === 'activo',
          _sourceKey: groupKey,
        });
      }

      const product = grouped.get(groupKey);
      product.stock += integerValue(stock);
      if (!product.price && numberValue(price)) product.price = price;
      if (!product.imageUrl && image) product.imageUrl = image;
      else if (image && image !== product.imageUrl && !product.imagesExtra.includes(image)) product.imagesExtra.push(image);
      if (!product.description && description) product.description = description;
      if (!product.category && category) product.category = category;

      const variant = {};
      [['option1 name', 'option1 value'], ['option2 name', 'option2 value'], ['option3 name', 'option3 value']]
        .forEach(([nameKey, valueKey]) => {
          const key = cleanText(row[nameKey], 60);
          const value = cleanText(row[valueKey], 220);
          if (key && value && lower(value) !== 'default title') variant[key] = value;
        });
      const sku = cleanText(first(row, ['variant sku', 'sku']), 120);
      if (sku) variant.sku = sku;
      if (numberValue(price)) variant.price = Math.round(numberValue(price));
      const variantImage = safeUrl(first(row, ['variant image']));
      if (variantImage) variant.imageUrl = variantImage;
      if (Object.keys(variant).some(key => !['price', 'sku', 'imageUrl'].includes(key))) product.variants.push(variant);
    });

    return [...grouped.values()].map(item => {
      const sourceKey = item._sourceKey;
      delete item._sourceKey;
      return normalizeProduct(item, { source: 'shopify-csv', sourceKey });
    });
  }

  function productsFromJson(textValue) {
    const parsed = JSON.parse(textValue);
    const list = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed?.data?.products) ? parsed.data.products : null);
    if (!list) throw new Error('El JSON debe ser un array de productos o una copia Tintin con data.products.');
    return list.map((item, index) => normalizeProduct(item, {
      source: parsed?.format === 'tintin-operational-backup' ? 'tintin-backup' : 'json',
      sourceKey: item?.id || item?.importFingerprint || `${item?.name || 'producto'}-${index + 1}`,
    }));
  }

  function markDuplicates(records) {
    const known = new Set();
    state.existingProducts.forEach(product => {
      if (product.importFingerprint) known.add(`fingerprint:${product.importFingerprint}`);
      known.add(`product:${productKey(product)}`);
    });
    records.forEach(record => {
      const fingerprint = `fingerprint:${record.product.importFingerprint}`;
      const key = `product:${productKey(record.product)}`;
      record.duplicate = known.has(fingerprint) || known.has(key);
      known.add(fingerprint);
      known.add(key);
    });
    return records;
  }

  function toPlain(value) {
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    if (Array.isArray(value)) return value.map(toPlain);
    if (typeof value === 'object') {
      const output = {};
      Object.entries(value).forEach(([key, item]) => { output[key] = toPlain(item); });
      return output;
    }
    return text(value);
  }

  async function readCollection(name) {
    const snapshot = await getDocsPaginated(collection(db, name), {
      pageSize: 500,
      maxDocs: 20000
    });
    if (snapshot.truncated) {
      throw new Error(`La colección ${name} supera el límite seguro de 20.000 documentos.`);
    }
    return snapshot.docs.map(item => ({ id: item.id, ...toPlain(item.data()) }));
  }

  function downloadJson(fileName, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportOperationalBackup() {
    if (!isSuperAdmin() || state.busy) return;
    state.busy = true;
    state.ui.backup.disabled = true;
    state.ui.backup.textContent = 'Preparando copia…';
    try {
      const [products, collectionsData, siteContent, settings, rolePermissions] = await Promise.all([
        readCollection('products'),
        readCollection('collections'),
        readCollection('site_content'),
        readCollection('settings'),
        readCollection('rolePermissions'),
      ]);
      const backup = {
        format: 'tintin-operational-backup',
        schemaVersion: 1,
        projectId: PROJECT_ID,
        exportedAt: new Date().toISOString(),
        exportedBy: state.user.email,
        excludes: ['users', 'orders', 'carts', 'auditLog', 'emailLogs'],
        counts: {
          products: products.length,
          collections: collectionsData.length,
          siteContent: siteContent.length,
          settings: settings.length,
          rolePermissions: rolePermissions.length,
        },
        data: { products, collections: collectionsData, siteContent, settings, rolePermissions },
      };
      downloadJson(`tintin-copia-operativa-${new Date().toISOString().slice(0, 10)}.json`, backup);
      toast('Copia operativa descargada');
    } catch (error) {
      console.error('[phase9] backup failed:', error);
      toast('No se pudo generar la copia: ' + error.message, true);
    } finally {
      state.busy = false;
      state.ui.backup.disabled = false;
      state.ui.backup.textContent = 'Descargar copia operativa';
    }
  }

  function counts() {
    return state.records.reduce((accumulator, record) => {
      if (record.errors.length) accumulator.invalid += 1;
      else if (record.duplicate) accumulator.duplicate += 1;
      else accumulator.ready += 1;
      return accumulator;
    }, { ready: 0, duplicate: 0, invalid: 0 });
  }

  function statusLabel(record) {
    if (record.errors.length) return { text: record.errors.join(' · '), className: 'invalid' };
    if (record.duplicate) return { text: 'Duplicado — no se importará', className: 'duplicate' };
    if (record.warnings.length) return { text: `Listo · ${record.warnings.join(' · ')}`, className: 'warning' };
    return { text: 'Listo para importar', className: 'ready' };
  }

  function renderPreview() {
    const ui = state.ui;
    const summary = counts();
    ui.summary.textContent = state.records.length
      ? `${state.fileName}: ${state.records.length} producto(s) · ${summary.ready} listos · ${summary.duplicate} duplicados · ${summary.invalid} inválidos`
      : 'Seleccioná un archivo CSV o JSON para comenzar.';
    ui.tableBody.replaceChildren();
    ui.preview.hidden = !state.records.length;
    ui.importButton.disabled = !summary.ready || state.busy;

    state.records.slice(0, MAX_IMPORT_ROWS).forEach((record, index) => {
      const row = document.createElement('tr');
      const numberCell = node('td', '', String(index + 1));
      const nameCell = node('td', '', record.product.name || '—');
      const categoryCell = document.createElement('td');
      const select = node('select', 'adm-select phase9-category-select');
      const placeholder = node('option', '', 'Elegir colección…');
      placeholder.value = '';
      select.appendChild(placeholder);
      state.collections.forEach(collectionItem => {
        const slug = cleanText(collectionItem.slug || collectionItem.id, 120);
        if (!slug) return;
        const option = node('option', '', collectionItem.name || slug);
        option.value = slug;
        option.selected = record.product.category === slug;
        select.appendChild(option);
      });
      select.addEventListener('change', () => {
        record.product.category = select.value;
        record.errors = record.errors.filter(error => !['Falta la colección', 'La colección no existe'].includes(error));
        if (!select.value) record.errors.push('Falta la colección');
        else if (!currentCategorySlugs().has(select.value)) record.errors.push('La colección no existe');
        markDuplicates(state.records);
        renderPreview();
      });
      categoryCell.appendChild(select);
      const priceCell = node('td', '', `Gs. ${Number(record.product.price || 0).toLocaleString('es-PY')}`);
      const stockCell = node('td', '', String(record.product.stock));
      const status = statusLabel(record);
      const statusCell = document.createElement('td');
      statusCell.appendChild(node('span', `phase9-status is-${status.className}`, status.text));
      row.append(numberCell, nameCell, categoryCell, priceCell, stockCell, statusCell);
      ui.tableBody.appendChild(row);
    });
  }

  async function refreshReferenceData() {
    const [collectionsSnapshot, productsSnapshot] = await Promise.all([
      getDocsPaginated(collection(db, 'collections'), { pageSize: 100, maxDocs: 1000 }),
      getDocsPaginated(collection(db, 'products'), { pageSize: 500, maxDocs: 20000 }),
    ]);
    if (collectionsSnapshot.truncated || productsSnapshot.truncated) {
      throw new Error('La base supera el límite seguro de referencia para validar duplicados.');
    }
    state.collections = collectionsSnapshot.docs
      .map(item => ({ id: item.id, ...item.data(), slug: item.data().slug || item.id }))
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    state.existingProducts = productsSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async function processFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return toast('El archivo supera el límite de 5 MB.', true);
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'json'].includes(extension)) return toast('Usá un archivo .csv o .json.', true);

    state.ui.drop.classList.add('is-loading');
    state.ui.summary.textContent = 'Analizando archivo…';
    try {
      await refreshReferenceData();
      const content = await file.text();
      let records = extension === 'csv' ? productsFromCsv(content) : productsFromJson(content);
      if (records.length > MAX_IMPORT_ROWS) {
        records = records.slice(0, MAX_IMPORT_ROWS);
        toast(`El archivo tenía más de ${MAX_IMPORT_ROWS} productos. Se revisarán solamente los primeros ${MAX_IMPORT_ROWS}.`, true);
      }
      state.records = markDuplicates(records);
      state.fileName = file.name;
      state.source = extension === 'csv' ? 'shopify-csv' : 'json';
      renderPreview();
    } catch (error) {
      console.error('[phase9] parse failed:', error);
      state.records = [];
      state.fileName = '';
      renderPreview();
      toast('No se pudo leer el archivo: ' + error.message, true);
    } finally {
      state.ui.drop.classList.remove('is-loading');
      state.ui.input.value = '';
    }
  }

  async function importReadyProducts() {
    if (!isSuperAdmin() || state.busy) return;
    const ready = state.records.filter(record => !record.errors.length && !record.duplicate);
    if (!ready.length) return toast('No hay productos nuevos y válidos para importar.', true);
    if (!confirm(`¿Importar ${ready.length} producto(s) nuevos?\n\nLos duplicados e inválidos se omitirán. No se sobrescribe ningún producto existente.`)) return;

    state.busy = true;
    state.ui.importButton.disabled = true;
    state.ui.importButton.textContent = 'Importando…';
    state.ui.progress.hidden = false;
    let completed = 0;

    try {
      for (let start = 0; start < ready.length; start += BATCH_SIZE) {
        const chunk = ready.slice(start, start + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(record => {
          const reference = doc(collection(db, 'products'));
          batch.set(reference, {
            ...record.product,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: state.user.email,
            importedAt: serverTimestamp(),
            importedBy: state.user.email,
          });
        });
        batch.set(doc(collection(db, 'auditLog')), {
          action: 'importar_productos',
          targetType: 'producto',
          targetId: '',
          targetLabel: state.fileName,
          details: `Importación segura Fase 9: ${chunk.length} producto(s) desde ${state.source}`,
          bulk: true,
          bulkCount: chunk.length,
          actorEmail: state.user.email,
          actorRole: 'superadmin',
          phase: 9,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        completed += chunk.length;
        state.ui.progressBar.style.width = `${Math.round((completed / ready.length) * 100)}%`;
        state.ui.progressText.textContent = `${completed} de ${ready.length} importados`;
      }
      toast(`${completed} productos importados sin sobrescribir existentes`);
      await refreshReferenceData();
      markDuplicates(state.records);
      renderPreview();
    } catch (error) {
      console.error('[phase9] import failed:', error);
      toast(`La importación se detuvo después de ${completed} producto(s): ${error.message}`, true);
      await refreshReferenceData().catch(() => {});
      markDuplicates(state.records);
      renderPreview();
    } finally {
      state.busy = false;
      state.ui.importButton.textContent = 'Importar productos válidos y nuevos';
      state.ui.progress.hidden = true;
      state.ui.progressBar.style.width = '0%';
      state.ui.progressText.textContent = '';
      renderPreview();
    }
  }

  function hideLegacyImporters(section) {
    [...section.querySelectorAll('.adm-card')].forEach(card => {
      const title = lower(card.querySelector('.adm-card-title')?.textContent);
      if (title.includes('importar csv de shopify') || title.includes('importar json manual')) {
        card.hidden = true;
        card.dataset.phase9LegacyImporter = 'disabled';
      }
    });
  }

  function buildPanel() {
    const section = document.getElementById('section-importar');
    if (!section || document.getElementById('phase9-import-card')) return;
    hideLegacyImporters(section);

    const card = node('div', 'adm-card phase9-card');
    card.id = 'phase9-import-card';
    const head = node('div', 'adm-card-head phase9-head');
    const titleWrap = node('div');
    titleWrap.append(
      node('div', 'adm-card-title', 'Fase 9 — Copias e importación segura'),
      node('p', 'phase9-subtitle', 'Descargá una copia operativa y revisá cada producto antes de escribir en Firestore.')
    );
    const project = node('span', 'phase9-project', PROJECT_ID);
    head.append(titleWrap, project);

    const body = node('div', 'adm-card-body');
    const statusGrid = node('div', 'phase9-release-grid');
    [
      ['Sitio público', 'GitHub Pages · automático'],
      ['Firebase', 'Spark · reglas solamente'],
      ['Cloud Functions', 'No usadas en producción'],
      ['Correos', 'Apps Script externo · revisión manual'],
    ].forEach(([label, value]) => {
      const item = node('div', 'phase9-release-item');
      item.append(node('strong', '', label), node('span', '', value));
      statusGrid.appendChild(item);
    });

    const backupWrap = node('div', 'phase9-backup-wrap');
    const backupText = node('div');
    backupText.append(
      node('strong', '', 'Copia operativa sin datos de clientas'),
      node('p', '', 'Incluye productos, colecciones, contenido, configuración y permisos. Excluye usuarios, pedidos, carritos y auditoría.')
    );
    const backup = node('button', 'adm-btn adm-btn-outline', 'Descargar copia operativa');
    backup.type = 'button';
    backup.addEventListener('click', exportOperationalBackup);
    backupWrap.append(backupText, backup);

    const drop = node('div', 'phase9-drop');
    drop.tabIndex = 0;
    drop.setAttribute('role', 'button');
    drop.setAttribute('aria-label', 'Seleccionar archivo CSV o JSON');
    drop.append(
      node('strong', '', 'Arrastrá un CSV de Shopify o un JSON de productos'),
      node('span', '', 'Máximo 5 MB y 1.000 productos. Primero se muestra una vista previa; nada se guarda automáticamente.')
    );
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json,application/json,text/csv';
    input.hidden = true;
    drop.appendChild(input);

    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    });
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('is-dragging'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
    drop.addEventListener('drop', event => {
      event.preventDefault();
      drop.classList.remove('is-dragging');
      processFile(event.dataTransfer.files?.[0]);
    });
    input.addEventListener('change', () => processFile(input.files?.[0]));

    const summary = node('div', 'phase9-summary', 'Seleccioná un archivo CSV o JSON para comenzar.');
    const preview = node('div', 'phase9-preview');
    preview.hidden = true;
    const tableWrap = node('div', 'adm-table-wrap');
    const table = node('table', 'adm-table phase9-table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['#', 'Producto', 'Colección', 'Precio', 'Stock', 'Estado'].forEach(label => headerRow.appendChild(node('th', '', label)));
    thead.appendChild(headerRow);
    const tableBody = document.createElement('tbody');
    table.append(thead, tableBody);
    tableWrap.appendChild(table);

    const actions = node('div', 'phase9-actions');
    const clear = node('button', 'adm-btn adm-btn-outline', 'Limpiar archivo');
    clear.type = 'button';
    clear.addEventListener('click', () => {
      state.records = [];
      state.fileName = '';
      state.source = '';
      renderPreview();
    });
    const importButton = node('button', 'adm-btn adm-btn-primary', 'Importar productos válidos y nuevos');
    importButton.type = 'button';
    importButton.disabled = true;
    importButton.addEventListener('click', importReadyProducts);
    actions.append(clear, importButton);

    const progress = node('div', 'phase9-progress');
    progress.hidden = true;
    const progressTrack = node('div', 'phase9-progress-track');
    const progressBar = node('div', 'phase9-progress-bar');
    progressTrack.appendChild(progressBar);
    const progressText = node('small');
    progress.append(progressTrack, progressText);

    preview.append(tableWrap, actions, progress);
    body.append(statusGrid, backupWrap, drop, summary, preview);
    card.append(head, body);
    section.insertBefore(card, section.firstChild);

    state.ui = { section, card, backup, drop, input, summary, preview, tableBody, importButton, progress, progressBar, progressText };
    renderPreview();
  }

  function injectStyles() {
    if (document.getElementById('phase9-import-styles')) return;
    const style = document.createElement('style');
    style.id = 'phase9-import-styles';
    style.textContent = `
      .phase9-card{border:1.5px solid #e6b6c7}.phase9-head{align-items:flex-start;gap:12px}.phase9-subtitle{font-size:12px;color:var(--adm-muted);margin:5px 0 0}.phase9-project{font:700 11px Montserrat;background:#f8edf2;color:#a64068;border-radius:999px;padding:6px 10px}
      .phase9-release-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}.phase9-release-item{display:flex;flex-direction:column;gap:4px;padding:12px;background:#fafafa;border:1px solid var(--adm-border);border-radius:10px}.phase9-release-item strong{font-size:11px;text-transform:uppercase;letter-spacing:.04em}.phase9-release-item span{font-size:11px;color:var(--adm-muted);line-height:1.45}
      .phase9-backup-wrap{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border:1px solid var(--adm-border);border-radius:12px;margin-bottom:16px}.phase9-backup-wrap p{margin:4px 0 0;font-size:11px;color:var(--adm-muted);line-height:1.5}
      .phase9-drop{display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center;padding:30px 18px;border:2px dashed #d9a2b7;border-radius:14px;background:#fff8fa;cursor:pointer;transition:.18s}.phase9-drop span{font-size:11px;color:var(--adm-muted);max-width:620px}.phase9-drop.is-dragging,.phase9-drop.is-loading{background:#fce7ef;border-color:#b84c72}.phase9-summary{font-size:12px;font-weight:600;margin:14px 0;color:var(--adm-text)}
      .phase9-preview{margin-top:10px}.phase9-table td{vertical-align:middle}.phase9-category-select{min-width:150px;font-size:11px}.phase9-status{display:inline-block;max-width:280px;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:700;line-height:1.35}.phase9-status.is-ready{background:#e8f5e9;color:#28763b}.phase9-status.is-warning{background:#fff6da;color:#805e00}.phase9-status.is-duplicate{background:#eef1f5;color:#5b6570}.phase9-status.is-invalid{background:#ffebee;color:#aa2632}.phase9-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:14px}
      .phase9-progress{margin-top:12px}.phase9-progress-track{height:8px;background:#eee;border-radius:999px;overflow:hidden}.phase9-progress-bar{height:100%;width:0;background:var(--adm-primary);transition:width .2s}.phase9-progress small{display:block;margin-top:5px;color:var(--adm-muted)}.adm-toast.phase9-error{background:#a52828!important}
      @media(max-width:850px){.phase9-release-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.phase9-release-grid{grid-template-columns:1fr}.phase9-backup-wrap{align-items:stretch;flex-direction:column}.phase9-backup-wrap button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
    buildPanel();
    onAuthStateChanged(auth, user => {
      state.user = user;
      if (!user || lower(user.email) !== SUPER_ADMIN) {
        if (state.ui?.card) state.ui.card.hidden = true;
        return;
      }
      if (state.ui?.card) state.ui.card.hidden = false;
      refreshReferenceData().catch(error => console.warn('[phase9] initial reference load failed:', error));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
