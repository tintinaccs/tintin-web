(function () {
  'use strict';

  const path = String(window.location.pathname || '').toLowerCase();
  if (!/(^|\/)product(?:\.html)?$/.test(path)) return;

  const id = String(new URLSearchParams(window.location.search).get('id') || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return;
  if (window.__TintinPublicProductPrimeStarted === id) return;
  window.__TintinPublicProductPrimeStarted = id;

  const TIMEOUT_MS = 3500;

  function cleanText(value, maxLength) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  function cleanMultiline(value, maxLength) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  function normalizePrice(value) {
    const number = Number(String(value == null ? 0 : value).replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeProduct(item) {
    const data = item && typeof item.data === 'object' ? item.data : {};
    const category = cleanText(
      data.category || data.collectionSlug || data.collection || data.cat || data.Type ||
        data.type || data['Product Category'] || data.Category || '',
      120
    );
    const description = cleanMultiline(
      data.description || data.desc || data['Body (HTML)'] || '',
      4000
    );
    const rawExtra = Array.isArray(data.imagesExtra)
      ? data.imagesExtra
      : Array.isArray(data.images)
        ? data.images
        : [];

    return {
      ...data,
      id: String(item.id || ''),
      name: cleanText(data.name || data.title || data.Title || data.handle || data.Handle || '', 180),
      cat: category,
      category,
      price: normalizePrice(data.price || data.Price || data['Variant Price'] || 0),
      priceBefore: data.priceBefore != null ? Number(data.priceBefore) : null,
      badge: cleanText(data.badge || (data.oferta ? 'Oferta' : ''), 60) || null,
      desc: description,
      description,
      material: cleanText(data.material || '', 240),
      measurements: cleanText(data.measurements || '', 240),
      colorFinish: cleanText(data.colorFinish || '', 240),
      care: cleanMultiline(data.care || '', 500),
      waterResistance: cleanText(data.waterResistance || '', 240),
      warranty: cleanText(data.warranty || '', 240),
      sizeFit: cleanText(data.sizeFit || '', 240),
      packageContents: cleanMultiline(data.packageContents || '', 500),
      imageUrl: String(
        data.imageUrl || data.image || data.img || data.photo || data.imageSrc ||
          data.image_src || data['Image Src'] || data['Variant Image'] || ''
      ).trim(),
      imagesExtra: rawExtra.filter(value => typeof value === 'string' && value.trim()).slice(0, 12),
      stock: data.stock ?? data['Variant Inventory Qty'] ?? null,
      active: data.active !== false,
      oferta: Boolean(data.oferta),
      destacado: Boolean(data.destacado),
      tags: Array.isArray(data.tags)
        ? data.tags.map(tag => cleanText(tag, 60)).filter(Boolean).slice(0, 30)
        : String(data.tags || '').split(',').map(tag => cleanText(tag, 60)).filter(Boolean).slice(0, 30),
      variants: data.variants && typeof data.variants === 'object' ? data.variants : null,
      collectionOrder: Number.isFinite(Number(data.collectionOrder)) ? Number(data.collectionOrder) : 9999
    };
  }

  function handOffProducts(products, source) {
    window.PRODUCTS = products;
    const product = products[0] || null;

    if (product && typeof window._renderProductDetail === 'function' && document.getElementById('product-detail')) {
      window._renderProductDetail(product);
    } else if (!product && typeof window._showProductNotFound === 'function' && document.getElementById('product-detail')) {
      window._showProductNotFound();
    }

    window.dispatchEvent(new CustomEvent('tintin:products-loaded', {
      detail: { products, source }
    }));
  }

  async function primeProduct() {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = window.setTimeout(() => controller?.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(
        '/api/public-catalog?resource=products&id=' + encodeURIComponent(id),
        {
          method: 'GET',
          credentials: 'omit',
          cache: 'default',
          ...(controller ? { signal: controller.signal } : {})
        }
      );
      if (!response.ok) throw new Error('API pública de producto respondió ' + response.status);
      const payload = await response.json();
      if (!payload?.ok || payload.resource !== 'products' || !Array.isArray(payload.items)) {
        throw new Error('Respuesta pública de producto inválida');
      }

      if (!payload.items.length) {
        handOffProducts([], 'edge-product-missing');
        return [];
      }

      const product = normalizeProduct(payload.items[0]);
      if (!product.id || !product.name || product.active === false || product.price <= 0) {
        handOffProducts([], 'edge-product-unavailable');
        return [];
      }

      handOffProducts([product], 'edge-product-prime');
      return [product];
    } catch (error) {
      // No sustituye al runtime normal de productos: si el edge falla, la
      // ruta existente de Firestore/App Check conserva sus propios fallbacks.
      console.warn('[ProductPrime] El edge no pudo adelantar la ficha.', error);
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  window.__TintinPublicProductPrimePromise = primeProduct();
})();
