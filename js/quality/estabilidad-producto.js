/* TINTIN — estabilidad acotada de la ficha de Producto.
 * Mantiene abiertas las superficies informativas sin observar y reescribir
 * incondicionalmente los mismos atributos. Cada normalización es idempotente.
 */

const VERSION = 'tintin-20260831-product-stability-2';

function injectStyles() {
  if (document.getElementById('tt-product-stability-styles')) return;
  const style = document.createElement('style');
  style.id = 'tt-product-stability-styles';
  style.textContent = `
    @media (max-width:767px){
      #tt-tabbar{isolation:isolate!important}
      #tt-tabbar .tt-mobile-nav-halo{z-index:0!important;top:1px!important;box-shadow:0 6px 16px rgba(139,38,66,.10)!important}
      #tt-tabbar .tt-mobile-nav-indicator{z-index:1!important;bottom:4px!important}
      #tt-tabbar .tt-tabbar-btn{position:relative!important;z-index:2!important}
      #tt-tabbar .tt-tabbar-btn.active,#tt-tabbar .tt-tabbar-btn[aria-expanded="true"]{z-index:3!important}
      #tt-tabbar .tt-tabbar-btn.active svg,#tt-tabbar .tt-tabbar-btn.active .tt-tabbar-avatar,
      #tt-tabbar .tt-tabbar-btn[aria-expanded="true"] svg,#tt-tabbar .tt-tabbar-btn[aria-expanded="true"] .tt-tabbar-avatar{
        transform:translateY(-3px) scale(1.06)!important
      }
      #tt-tabbar .tt-notification-badge,#tt-tabbar .tt-cart-badge{z-index:5!important}
    }

    body[data-tt-product-stable="1"] #specs-trigger,
    body[data-tt-product-stable="1"] .tt-mobile-accordion-trigger{display:none!important}
    body[data-tt-product-stable="1"] #product-specifications,
    body[data-tt-product-stable="1"] #product-reviews,
    body[data-tt-product-stable="1"] .tt-related-section,
    body[data-tt-product-stable="1"] #related-grid{visibility:visible!important;max-height:none!important;opacity:1!important;transform:none!important}
    body[data-tt-product-stable="1"] #product-specifications[hidden],
    body[data-tt-product-stable="1"] #product-reviews[hidden],
    body[data-tt-product-stable="1"] .tt-related-section[hidden],
    body[data-tt-product-stable="1"] #related-grid[hidden]{display:block!important}
    body[data-tt-product-stable="1"] .tt-specs-block[data-collapsed],
    body[data-tt-product-stable="1"] .tt-related-section[data-collapsed]{overflow:visible!important}
    body[data-tt-product-stable="1"] .tt-related-heading{cursor:default!important;user-select:text!important}
    body[data-tt-product-stable="1"] .tt-related-slot button,
    body[data-tt-product-stable="1"] .tt-related-slot .tt-btn,
    body[data-tt-product-stable="1"] .tt-related-slot [class*="add"]{white-space:nowrap!important;word-break:keep-all!important;overflow-wrap:normal!important}
    body[data-tt-product-stable="1"] .tt-related-section{margin-top:clamp(32px,5vw,72px)!important}
    body[data-tt-product-stable="1"] .tt-related-grid{align-items:stretch!important}
    body[data-tt-product-stable="1"] .tt-product-social-bar,
    body[data-tt-product-stable="1"] #product-reviews{scroll-margin-top:96px}
    @media(max-width:767px){
      body[data-tt-product-stable="1"] .tt-related-section{margin-top:28px!important}
      body[data-tt-product-stable="1"] .tt-related-header{align-items:center!important;gap:12px!important}
      body[data-tt-product-stable="1"] .tt-product-social-bar{gap:6px!important}
    }
  `;
  document.head.appendChild(style);
}

function setDataIfChanged(element, key, value) {
  if (!(element instanceof HTMLElement) || element.dataset[key] === value) return false;
  element.dataset[key] = value;
  return true;
}

function setAttributeIfChanged(element, name, value) {
  if (!(element instanceof Element) || element.getAttribute(name) === value) return false;
  element.setAttribute(name, value);
  return true;
}

function forceVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  let changed = false;
  if (element.hasAttribute('hidden')) {
    element.removeAttribute('hidden');
    changed = true;
  }
  for (const property of ['display', 'max-height', 'opacity']) {
    if (!element.style.getPropertyValue(property)) continue;
    element.style.removeProperty(property);
    changed = true;
  }
  return changed;
}

function needsNormalization(record) {
  const target = record.target;
  if (!(target instanceof HTMLElement)) return false;
  if (record.attributeName === 'hidden') {
    return target.matches('#product-specifications,#product-reviews,.tt-related-section,#related-grid')
      && target.hasAttribute('hidden');
  }
  if (record.attributeName === 'data-collapsed') {
    return target.matches('.tt-specs-block,.tt-related-section')
      && target.dataset.collapsed !== 'false';
  }
  return false;
}

function stabilizeProduct() {
  if (!document.getElementById('product-detail')) return;
  injectStyles();
  if (document.body.dataset.ttProductStable !== '1') document.body.dataset.ttProductStable = '1';

  let queued = false;
  const openAll = () => {
    const specsBlock = document.querySelector('.tt-specs-block');
    const specs = document.getElementById('product-specifications');
    const reviews = document.getElementById('product-reviews');
    const related = document.querySelector('.tt-related-section');
    const relatedGrid = document.getElementById('related-grid');
    setDataIfChanged(specsBlock, 'collapsed', 'false');
    setDataIfChanged(related, 'collapsed', 'false');
    [specs, reviews, related, relatedGrid].forEach(forceVisible);
    setAttributeIfChanged(document.getElementById('specs-trigger'), 'aria-expanded', 'true');
  };

  const scheduleNormalization = records => {
    if (!records.some(needsNormalization) || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      openAll();
    });
  };

  openAll();
  const observer = new MutationObserver(scheduleNormalization);
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'data-collapsed'],
  });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });

  document.addEventListener('click', event => {
    const community = event.target.closest?.('[data-open-community]');
    if (!community) return;
    event.preventDefault();
    openAll();
    document.getElementById('product-reviews')?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', stabilizeProduct, { once: true });
} else {
  stabilizeProduct();
}

window.TintinProductStability = Object.freeze({ version: VERSION });
