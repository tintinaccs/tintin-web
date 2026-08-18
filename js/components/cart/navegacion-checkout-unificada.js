const CHECKOUT_PATH = '/checkout';
const CHECKOUT_FLOW = 'tintin-unified-20260818-1';

function unifiedCheckoutUrl() {
  const url = new URL(CHECKOUT_PATH, window.location.origin);
  url.searchParams.set('flow', CHECKOUT_FLOW);
  return `${url.pathname}${url.search}`;
}

function isCheckoutHref(anchor) {
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  try {
    const url = new URL(anchor.href, window.location.href);
    return url.origin === window.location.origin
      && (url.pathname === '/checkout' || url.pathname === '/checkout.html');
  } catch {
    return false;
  }
}

function readCart() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem('tt_cart') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function selectedVariant() {
  const parts = [...document.querySelectorAll('#product-variants .tt-variant-options')]
    .map(group => group.querySelector('.tt-variant-option.active')?.textContent?.trim() || '')
    .filter(Boolean);
  return parts.join(' / ');
}

function validateProductVariants() {
  const groups = [...document.querySelectorAll('#product-variants .tt-variant-options')];
  const missing = groups.find(group => !group.querySelector('.tt-variant-option.active'));
  if (!missing) return true;

  missing.classList.add('tt-variant-required');
  let message = missing.nextElementSibling;
  if (!message?.classList.contains('tt-variant-required-msg')) {
    message = document.createElement('span');
    message.className = 'tt-variant-required-msg';
    message.textContent = 'Por favor seleccioná una opción';
    missing.parentNode?.insertBefore(message, missing.nextSibling);
  }
  missing.querySelector('.tt-variant-option')?.focus();
  window.setTimeout(() => {
    missing.classList.remove('tt-variant-required');
    message?.remove();
  }, 2500);
  return false;
}

async function handleBuyNow(button) {
  if (button.disabled || button.dataset.ttUnifiedBusy === '1') return;
  if (!validateProductVariants()) return;

  const productId = new URLSearchParams(window.location.search).get('id');
  const product = (window.PRODUCTS || []).find(item => String(item?.id) === String(productId));
  const addWithQty = window._addToCartWithQty;
  if (!product || typeof addWithQty !== 'function') {
    console.warn('[CheckoutUnificado] El producto todavía no está listo para comprar.');
    return;
  }

  const qty = Math.max(1, Number.parseInt(document.getElementById('qty-val')?.textContent || '1', 10) || 1);
  const variant = selectedVariant();
  button.dataset.ttUnifiedBusy = '1';
  button.disabled = true;

  try {
    const result = await addWithQty(product, qty, variant || '');
    if (result?.item || result?.changed) window.location.assign(unifiedCheckoutUrl());
  } catch (error) {
    console.error('[CheckoutUnificado] No se pudo preparar la compra directa.', error);
  } finally {
    delete button.dataset.ttUnifiedBusy;
    button.disabled = product.stock != null && Number(product.stock) <= 0;
  }
}

function navigateIfCartHasItems() {
  if (!readCart().length) {
    window.alert('Tu carrito está vacío. ¡Agregá productos primero!');
    return false;
  }
  window.location.assign(unifiedCheckoutUrl());
  return true;
}

function normalizeCheckoutAnchors(root = document) {
  root.querySelectorAll?.('a[href]').forEach(anchor => {
    if (!isCheckoutHref(anchor)) return;
    anchor.href = unifiedCheckoutUrl();
    anchor.dataset.ttUnifiedCheckout = '1';
  });
}

function installCheckoutNavigation() {
  normalizeCheckoutAnchors();

  // Cubrimos también botones/enlaces creados después por el carrito lateral.
  document.addEventListener('click', event => {
    const buyNow = event.target.closest?.('#btn-product-buy-now');
    if (buyNow) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void handleBuyNow(buyNow);
      return;
    }

    const selectionCheckout = event.target.closest?.('#tinsel-checkout-btn');
    if (selectionCheckout) {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigateIfCartHasItems();
      return;
    }

    const anchor = event.target.closest?.('a[href]');
    if (!isCheckoutHref(anchor)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(unifiedCheckoutUrl());
  }, true);

  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (!(node instanceof Element)) return;
      if (node.matches?.('a[href]') && isCheckoutHref(node)) {
        node.href = unifiedCheckoutUrl();
        node.dataset.ttUnifiedCheckout = '1';
      }
      normalizeCheckoutAnchors(node);
    }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.TintinCheckoutNavigation = Object.freeze({
    url: unifiedCheckoutUrl,
    go: navigateIfCartHasItems,
    flow: CHECKOUT_FLOW,
  });

  document.documentElement.dataset.ttCheckoutNavigation = CHECKOUT_FLOW;
}

installCheckoutNavigation();

export { CHECKOUT_FLOW, unifiedCheckoutUrl, installCheckoutNavigation };
