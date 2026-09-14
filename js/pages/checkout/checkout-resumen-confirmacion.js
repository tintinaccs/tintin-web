const ESCAPED_SVG_PREFIX = /^\s*<svg\b[\s\S]*?<\/svg>\s*/i;

export function stripEscapedSvgPrefix(value) {
  const text = String(value ?? '');
  return text.replace(ESCAPED_SVG_PREFIX, '');
}

export function normalizeCheckoutConfirmationSummary(root = document) {
  if (!root?.querySelectorAll) return;

  root
    .querySelectorAll('#ck-confirm-summary .ck-summary-val, #ck-confirm-summary .ck-summary-total-val')
    .forEach(node => {
      const current = node.textContent || '';
      const normalized = stripEscapedSvgPrefix(current);
      if (normalized !== current) node.textContent = normalized;
    });
}

function attachCheckoutConfirmationSummaryNormalizer() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

  const summary = document.getElementById('ck-confirm-summary');
  if (!summary) return;

  normalizeCheckoutConfirmationSummary(document);

  const observer = new MutationObserver(() => {
    normalizeCheckoutConfirmationSummary(document);
  });

  observer.observe(summary, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachCheckoutConfirmationSummaryNormalizer, { once: true });
  } else {
    attachCheckoutConfirmationSummaryNormalizer();
  }
}
