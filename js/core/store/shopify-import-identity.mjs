import { normalizeImportKey, stableProductDocumentId } from './shopify-import-core.mjs?v=tintin-20261005-import-one-click-1';

function asRecord(record) {
  return record?.product ? record : { product: record, errors: [], warnings: [] };
}

function productHandle(product) {
  return normalizeImportKey(
    product?.shopifyHandle || product?.sourceMetadata?.handle || product?.handle || product?.slug || '',
  );
}

function productFingerprint(product) {
  return String(product?.importFingerprint || '').trim().toLowerCase();
}

function productName(product) {
  return normalizeImportKey(product?.name || '');
}

function productSkus(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return new Set(variants.map(variant => normalizeImportKey(variant?.sku)).filter(Boolean));
}

function candidateReason(imported, existing) {
  const reasons = [];
  if (productName(imported) && productName(imported) === productName(existing)) reasons.push('nombre');
  const importedSkus = productSkus(imported);
  const sharedSkus = [...productSkus(existing)].filter(sku => importedSkus.has(sku));
  if (sharedSkus.length) reasons.push(`SKU ${sharedSkus.join(', ')}`);
  return reasons;
}

function reviewSnapshot(product) {
  return { id: String(product?.id || ''), handle: productHandle(product), fingerprint: productFingerprint(product),
    name: productName(product), skus: [...productSkus(product)].sort(), price: product?.price ?? null,
    imageUrl: String(product?.imageUrl || '') };
}

function reviewKey(product, candidates) {
  return JSON.stringify({ source: reviewSnapshot(product),
    candidates: candidates.map(({ existing }) => reviewSnapshot(existing)).sort((a, b) => a.id.localeCompare(b.id)) });
}

/** Records an explicit operator decision; fresh reconciliation still validates it. */
export function confirmDistinctShopifyImport(sourceRecord) {
  const record = asRecord(sourceRecord);
  if (record.identityStatus !== 'REVIEW_REQUIRED' || !record.identityReviewKey || !record.identityCandidates?.length
    || !productHandle(record.product) || !productFingerprint(record.product)) {
    throw new Error('La identidad no permite confirmar un producto distinto.');
  }
  return { ...record, identityDecision: { type: 'CREATE_DISTINCT', reviewKey: record.identityReviewKey } };
}

/**
 * Reconciles a Shopify preview with a read-only Firestore catalog snapshot.
 * Exact Shopify identities are skipped to preserve the existing document ID.
 * Name/SKU-only matches block apply for an explicit human decision; they are
 * never auto-merged because those fields are not globally reliable identities.
 */
export function reconcileShopifyImportIdentities(records, existingProducts = []) {
  const catalog = Array.isArray(existingProducts) ? existingProducts : [];
  return (Array.isArray(records) ? records : []).map(sourceRecord => {
    const source = asRecord(sourceRecord);
    const sourceDuplicate = Object.hasOwn(source, 'sourceDuplicate')
      ? source.sourceDuplicate === true
      : source.duplicate === true && source.identityStatus !== 'MATCHED_EXISTING';
    const errors = (source.errors || []).filter(error => error !== source.identityError);
    const {
      identityStatus: _oldIdentityStatus,
      identityMessage: _oldIdentityMessage,
      identityError: _oldIdentityError,
      identityCandidates: _oldIdentityCandidates,
      identityReviewKey: _oldIdentityReviewKey,
      existingProductId: _oldExistingProductId,
      identityDuplicate: _oldIdentityDuplicate,
      sourceDuplicate: _oldSourceDuplicate,
      ...rest
    } = source;
    const record = { ...rest, errors, duplicate: sourceDuplicate };
    const product = record.product || {};
    const fingerprint = productFingerprint(product);
    const handle = productHandle(product);
    const deterministicId = fingerprint ? stableProductDocumentId(fingerprint) : '';

    const exactMatches = catalog.filter(existing => {
      const existingId = String(existing?.id || '');
      return (deterministicId && existingId === deterministicId)
        || (fingerprint && productFingerprint(existing) === fingerprint)
        || (handle && productHandle(existing) === handle);
    });

    if (exactMatches.length === 1) {
      const existing = exactMatches[0];
      return {
        ...record,
        duplicate: true,
        identityDuplicate: true,
        sourceDuplicate,
        identityStatus: 'MATCHED_EXISTING',
        existingProductId: String(existing.id || deterministicId),
        identityMessage: `Ya existe en el catálogo como «${String(existing.name || product.name || 'producto sin nombre')}»; se conserva su ID y no se sobrescribe.`,
      };
    }

    if (exactMatches.length > 1) {
      const identityError = 'El Handle o la identidad Shopify coincide con varios productos existentes; revisá el catálogo antes de importar.';
      return {
        ...record,
        identityStatus: 'REVIEW_REQUIRED',
        identityError,
        sourceDuplicate,
        errors: [...errors, identityError],
      };
    }

    const candidates = catalog
      .map(existing => ({ existing, reasons: candidateReason(product, existing) }))
      .filter(candidate => candidate.reasons.length);
    if (candidates.length) {
      const identityReviewKey = reviewKey(product, candidates);
      const confirmedDistinct = record.identityDecision?.type === 'CREATE_DISTINCT'
        && record.identityDecision.reviewKey === identityReviewKey;
      if (confirmedDistinct) return {
        ...record, sourceDuplicate, identityStatus: 'NEW_CONFIRMED_DISTINCT', identityReviewKey,
        identityMessage: 'Confirmado expresamente como otro producto. Se conserva el Handle nuevo y no se modifica el producto coincidente.',
      };
      const examples = candidates.slice(0, 3).map(({ existing, reasons }) =>
        `«${String(existing.name || 'sin nombre')}» (${reasons.join(', ')}, ID ${String(existing.id || 'desconocido')})`,
      );
      const identityError = `Posible producto existente: ${examples.join(' · ')}. Confirmá si es el mismo antes de aplicar.`;
      return {
        ...record,
        identityStatus: 'REVIEW_REQUIRED',
        identityCandidates: candidates.map(({ existing, reasons }) => ({ id: String(existing.id || ''), name: String(existing.name || ''),
          handle: productHandle(existing), price: existing.price ?? null, reasons })),
        identityReviewKey,
        identityError,
        sourceDuplicate,
        errors: [...errors, identityError],
      };
    }

    return { ...record, sourceDuplicate, identityStatus: 'NEW' };
  });
}
