// TINTIN — niveles públicos de fidelidad.
// La entrada canónica son las compras válidas ya calculadas en users/{uid}.
export const DEFAULT_LOYALTY_TIERS = Object.freeze([
  { id: 'destacado', label: 'Cliente destacado', minPurchases: 20 },
  { id: 'frecuente', label: 'Cliente frecuente', minPurchases: 10 },
  { id: 'fiel', label: 'Cliente fiel', minPurchases: 5 },
]);

function safeThreshold(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function resolveCustomerTier(profile = {}, tiers = DEFAULT_LOYALTY_TIERS) {
  const count = Math.max(0, Math.floor(Number(profile.purchaseCount) || 0));
  const normalized = (Array.isArray(tiers) ? tiers : DEFAULT_LOYALTY_TIERS)
    .map((tier, index) => ({
      id: String(tier?.id || `tier-${index}`).replace(/[^a-z0-9_-]/gi, '').slice(0, 40),
      label: String(tier?.label || '').trim().slice(0, 60),
      minPurchases: safeThreshold(tier?.minPurchases, 1),
    }))
    .filter(tier => tier.id && tier.label)
    .sort((a, b) => b.minPurchases - a.minPurchases);
  return normalized.find(tier => count >= tier.minPurchases) || null;
}

