import { normalizeImportKey, stableProductDocumentId } from './shopify-import-core.mjs';

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
      const examples = candidates.slice(0, 3).map(({ existing, reasons }) =>
        `«${String(existing.name || 'sin nombre')}» (${reasons.join(', ')}, ID ${String(existing.id || 'desconocido')})`,
      );
      const identityError = `Posible producto existente: ${examples.join(' · ')}. Confirmá si es el mismo antes de aplicar.`;
      return {
        ...record,
        identityStatus: 'REVIEW_REQUIRED',
        identityCandidates: candidates.map(({ existing, reasons }) => ({ id: String(existing.id || ''), name: String(existing.name || ''), reasons })),
        identityError,
        sourceDuplicate,
        errors: [...errors, identityError],
      };
    }

    return { ...record, sourceDuplicate, identityStatus: 'NEW' };
  });
}
