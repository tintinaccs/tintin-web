const DEFAULT_METHODS = [
  {
    id: 'efectivo',
    kind: 'efectivo',
    title: 'Efectivo',
    description: 'Pagás al recibir el pedido (contra entrega)',
    icon: '💵',
    enabled: true,
    instructions: '',
    details: [],
    order: 0,
  },
  {
    id: 'transferencia',
    kind: 'transferencia',
    title: 'Transferencia bancaria',
    description: 'Envianos el comprobante por WhatsApp',
    icon: '🏦',
    enabled: true,
    instructions: 'Envianos el comprobante por WhatsApp al confirmar el pedido.',
    details: [],
    order: 1,
  },
];

export function cleanPaymentText(value, maxLength = 240) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function cleanPaymentMultiline(value, maxLength = 1200) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function paymentMethodId(value) {
  return cleanPaymentText(value, 60)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function paymentMethodKind(value) {
  return value === 'transferencia' ? 'transferencia' : 'efectivo';
}

function normalizeDetails(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .slice(0, 24)
    .map((entry, index) => ({
      id: paymentMethodId(entry?.id || `dato-${index + 1}`) || `dato-${index + 1}`,
      label: cleanPaymentText(entry?.label || '', 100),
      value: cleanPaymentMultiline(entry?.value || '', 800),
    }))
    .filter(entry => entry.label || entry.value);
}

export function normalizePaymentMethod(raw, fallbackId = '', fallbackOrder = 0) {
  const id = paymentMethodId(raw?.id || fallbackId);
  if (!id) return null;
  const kind = paymentMethodKind(raw?.kind || raw?.type);
  return {
    id,
    kind,
    title: cleanPaymentText(raw?.title || raw?.name || id, 100),
    description: cleanPaymentText(raw?.description || '', 240),
    icon: cleanPaymentText(raw?.icon || (kind === 'transferencia' ? '🏦' : '💵'), 12),
    enabled: raw?.enabled !== false,
    instructions: cleanPaymentMultiline(raw?.instructions || '', 1200),
    details: normalizeDetails(raw?.details),
    order: Number.isFinite(Number(raw?.order)) ? Math.max(0, Math.round(Number(raw.order))) : fallbackOrder,
  };
}

function legacyMethods(settings = {}) {
  const enabled = settings.paymentMethods || {};
  const accounts = settings.bankAccounts || {};
  return DEFAULT_METHODS.map(method => {
    if (method.id === 'efectivo') {
      return { ...method, enabled: enabled.efectivo !== false };
    }
    const details = [];
    if (accounts.ueno) details.push({ id: 'ueno', label: 'Ueno (Banco GNB)', value: accounts.ueno });
    if (accounts.atlas) details.push({ id: 'atlas', label: 'Atlas (Banco Nacional)', value: accounts.atlas });
    return {
      ...method,
      enabled: enabled.transferencia !== false,
      details,
    };
  });
}

export function normalizePaymentCatalog(settings = {}) {
  const source = settings.paymentMethodsCatalog;
  let entries = [];
  if (Array.isArray(source)) {
    entries = source.map((method, index) => [method?.id || `metodo-${index + 1}`, method]);
  } else if (source && typeof source === 'object') {
    entries = Object.entries(source);
  }
  const normalized = entries
    .map(([id, method], index) => normalizePaymentMethod(method, id, index))
    .filter(Boolean);
  const unique = [];
  const seen = new Set();
  for (const method of normalized.length ? normalized : legacyMethods(settings)) {
    if (seen.has(method.id)) continue;
    seen.add(method.id);
    unique.push(method);
  }
  return unique.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'es'));
}

export function paymentCatalogMap(methods) {
  const result = {};
  methods.forEach((method, index) => {
    const normalized = normalizePaymentMethod(method, method?.id, index);
    if (!normalized) return;
    result[normalized.id] = { ...normalized, order: index };
  });
  return result;
}

export function legacyPaymentMirrors(methods) {
  const normalized = methods.map((method, index) => normalizePaymentMethod(method, method?.id, index)).filter(Boolean);
  const enabledCash = normalized.some(method => method.enabled && method.kind === 'efectivo');
  const enabledTransfer = normalized.some(method => method.enabled && method.kind === 'transferencia');
  const firstTransfer = normalized.find(method => method.kind === 'transferencia');
  const details = firstTransfer?.details || [];
  return {
    paymentMethods: {
      efectivo: enabledCash,
      transferencia: enabledTransfer,
      pagopark: false,
    },
    bankAccounts: {
      ueno: details[0]?.value || '',
      atlas: details[1]?.value || '',
    },
  };
}

export function paymentMethodLabel(method) {
  return cleanPaymentText(method?.title || method?.id || 'Método de pago', 100);
}
