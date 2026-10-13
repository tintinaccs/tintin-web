const URL_PATTERN = /(?:https?:)?\/\/[^\s"'<>()[\]{}]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

function shopifyHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return host === 'shopify.com' || host.endsWith('.shopify.com')
    || host === 'myshopify.com' || host.endsWith('.myshopify.com');
}

/** Find any remaining Shopify-hosted URL in public catalog records. */
export function findShopifyHostedUrls(records, { baseUrl = 'https://tintinaccesorios.pages.dev' } = {}) {
  const references = [];
  const visit = (value, path) => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(URL_PATTERN)) {
        const raw = match[0].replace(TRAILING_PUNCTUATION, '');
        try {
          const parsed = new URL(raw.startsWith('//') ? `https:${raw}` : raw, baseUrl);
          if (shopifyHost(parsed.hostname)) references.push({ path, url: raw, host: parsed.hostname.toLowerCase() });
        } catch {}
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) visit(child, path ? `${path}.${key}` : key);
    }
  };
  visit(records, '');
  return references;
}

export function assertNoShopifyHostedUrls(records, options) {
  const references = findShopifyHostedUrls(records, options);
  if (!references.length) return { ok: true, references: [] };
  return { ok: false, references };
}
