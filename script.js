/* ============================================================
   TINTIN ACCESORIOS & RELOJES — Main Script
   Vanilla JS, no frameworks, no external dependencies
   ============================================================ */

'use strict';

/* ──────────────────────────────────────
   PRODUCTS DATA
────────────────────────────────────── */
const PRODUCTS = [
  {
    id: 1,
    name: "RELOJ ALISSIA",
    cat: "RELOJES",
    price: 210000,
    badge: "Destacado",
    desc: "Reloj de la marca SKMEI de lujo con elegante esfera cuadrada. Correa de acero inoxidable plateado con detalles dorados. Resistente al agua, mecanismo japonés de precisión. El accesorio que todas desean.",
    variants: { color: ["Plateado", "Dorado", "Rosado"], material: ["Acero inoxidable"] },
    emoji: "⌚"
  },
  {
    id: 2,
    name: "RELOJ ALLEGRA",
    cat: "RELOJES",
    price: 70000,
    badge: "Nuevo",
    desc: "Reloj femenino minimalista con esfera redonda y correa de malla. Perfecto para el uso diario. Diseño limpio y versátil que combina con cualquier outfit. Mecanismo de cuarzo.",
    variants: { color: ["Plateado", "Dorado"], material: ["Acero inoxidable"] },
    emoji: "⌚"
  },
  {
    id: 3,
    name: "RELOJ AMARA",
    cat: "RELOJES",
    price: 160000,
    badge: "Destacado",
    desc: "Elegante reloj con esfera ovalada y brillantes incrustados. La combinación perfecta de sofisticación y feminidad. Correa de cuero sintético premium en varios colores.",
    variants: { color: ["Negro", "Marrón", "Nude"], material: ["Acero + cuero"] },
    emoji: "⌚"
  },
  {
    id: 4,
    name: "RELOJ ÁMBAR",
    cat: "RELOJES",
    price: 70000,
    badge: null,
    desc: "Reloj casual chic con detalles color ámbar. Esfera redonda con números romanos. Correa de pulsera ajustable. Ideal para looks diarios llenos de estilo.",
    variants: { color: ["Dorado ámbar", "Plateado"] },
    emoji: "⌚"
  },
  {
    id: 5,
    name: "RELOJ AMELIA",
    cat: "RELOJES",
    price: 70000,
    badge: "Nuevo",
    desc: "Reloj delicado y romántico con esfera floral. Diseño ultra femenino pensado para las amantes de los detalles. Correa de malla fina. Perfecto para regalo.",
    variants: { color: ["Rosa", "Dorado", "Blanco"] },
    emoji: "⌚"
  },
  {
    id: 6,
    name: "RELOJ AMELINE",
    cat: "RELOJES",
    price: 210000,
    badge: "Destacado",
    desc: "Reloj premium con dial de nácar y correa de acero dorado. Mecanismo suizo de alta precisión. El complemento ideal para ocasiones especiales y reuniones importantes.",
    variants: { color: ["Dorado rosa", "Plateado", "Dorado"] },
    emoji: "⌚"
  },
  {
    id: 7,
    name: "RELOJ AMETHYS",
    cat: "RELOJES",
    price: 180000,
    badge: null,
    desc: "Inspirado en las piedras preciosas, este reloj combina tonos violeta y detalles plateados. Esfera rectangular con cristales decorativos. Un statement piece para tu look.",
    variants: { color: ["Violeta", "Lila"] },
    emoji: "⌚"
  },
  {
    id: 8,
    name: "RELOJ ANABELLA",
    cat: "RELOJES",
    price: 180000,
    badge: "Destacado",
    desc: "Reloj clásico y atemporal con diseño elegante. Esfera blanca con índices dorados. Correa de acero inoxidable de malla milanesa. Waterproof hasta 3 ATM.",
    variants: { color: ["Blanco/Dorado", "Blanco/Plateado"] },
    emoji: "⌚"
  }
];

/* ──────────────────────────────────────
   UTILITIES
────────────────────────────────────── */

/**
 * Format a number as Guaraní: 210000 → "Gs. 210.000"
 */
function formatPrice(num) {
  return 'Gs. ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Out-of-stock (stock explicitly 0 or negative) products never show in
 *  featured/recommended/look-combinator spots — only in category browsing
 *  and search results (catalogo.html handles that separately). */
function isInStock(p) {
  return !(p.stock != null && Number(p.stock) <= 0);
}

/** Guards against malformed/incomplete product docs (no real name — e.g. a
 *  broken CSV row) leaking into the public storefront. */
function hasValidName(p) {
  return !!(p.name && String(p.name).trim());
}

function isFeaturable(p) {
  return p.active !== false && isInStock(p) && hasValidName(p);
}

/**
 * Get a product by ID
 */
function getProductById(id) {
  // Search dynamic Firestore products first (string id), then hardcoded (numeric id)
  const pool = window.PRODUCTS || PRODUCTS;
  return pool.find(p => String(p.id) === String(id)) || PRODUCTS.find(p => p.id === Number(id)) || null;
}

/* ──────────────────────────────────────
   PRODUCT IMAGES (stored in localStorage)
   Key: tt_product_images → { "1": "https://...", "2": "..." }
   Also checks tt_images for prod_{id} slots (new image management system)
────────────────────────────────────── */
function getProductImages() {
  try { return JSON.parse(localStorage.getItem('tt_product_images') || '{}'); } catch { return {}; }
}
function getImagesCache() {
  try { return JSON.parse(localStorage.getItem('tt_images') || '{}'); } catch { return {}; }
}
function getProductImage(id) {
  // 1. Firebase product imageUrl (highest priority)
  const product = getProductById(id);
  if (product) {
    const firebaseImg =
      product.imageUrl  ||
      product.image     ||
      product.img       ||
      product.photo     ||
      product.imageSrc  ||
      product.image_src ||
      product['Image Src'] ||
      product['Variant Image'];
    if (firebaseImg && String(firebaseImg).trim()) return firebaseImg;
  }
  // 2. Legacy localStorage caches (fallback only)
  const imgCache = getImagesCache();
  if (imgCache[`prod_${id}`]) return imgCache[`prod_${id}`];
  return getProductImages()[String(id)] || null;
}
function setProductImage(id, url) {
  const imgs = getProductImages();
  imgs[String(id)] = url;
  localStorage.setItem('tt_product_images', JSON.stringify(imgs));
}
window.setProductImage = setProductImage;

/**
 * Pick N unique random items from an array
 */
function pickRandom(arr, n) {
  const copy = [...arr];
  const result = [];
  while (result.length < n && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(i, 1)[0]);
  }
  return result;
}

/* ──────────────────────────────────────
   CART — localStorage key: tt_cart
────────────────────────────────────── */
const CART_KEY = 'tt_cart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function showAddedToCart(productName) {
  let toast = document.getElementById('tt-added-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tt-added-toast';
    toast.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#b84c72;color:#fff;padding:12px 24px;border-radius:50px;font-size:0.82rem;font-weight:600;z-index:9999;opacity:0;transition:opacity .3s;white-space:nowrap;font-family:Poppins,sans-serif;box-shadow:0 4px 20px rgba(184,76,114,0.35)';
    document.body.appendChild(toast);
  }
  toast.textContent = `✓ ${productName} agregado al carrito`;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

function addToCart(productId) {
  const cart = getCart();
  const sid = String(productId);
  const existing = cart.find(item => String(item.id) === sid);
  let productName = '';
  if (existing) {
    existing.qty += 1;
    productName = existing.name;
  } else {
    const product = getProductById(productId);
    if (!product) return;
    const imgUrl = product.imageUrl || product.image || getProductImage(product.id);
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      qty: 1,
      cat: product.cat || product.category || '',
      imageUrl: imgUrl || ''
    });
    productName = product.name;
  }
  saveCart(cart);
  updateCartBadge();
  renderCart();
  openCart();
  showAddedToCart(productName);
}

function removeFromCart(productId) {
  const sid = String(productId);
  let cart = getCart().filter(item => String(item.id) !== sid);
  saveCart(cart);
  updateCartBadge();
  renderCart();
}

function updateQty(productId, delta) {
  const sid = String(productId);
  const cart = getCart();
  const item = cart.find(i => String(i.id) === sid);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart(cart);
  updateCartBadge();
  renderCart();
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function updateCartBadge() {
  const count = getCartCount();
  const text = count > 99 ? '99+' : String(count);
  ['cart-badge', 'cart-badge-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('hidden', count === 0);
  });
}

// Drop cart items whose product was deleted/deactivated, and refresh price/name/image
// from the live catalog so the cart never shows stale data. No-ops until real
// Firestore products have loaded (window.PRODUCTS unset).
function syncCartWithCatalog() {
  const pool = window.PRODUCTS;
  if (!pool || !pool.length) return getCart();
  const cart = getCart();
  const synced = cart
    .map(item => {
      const live = pool.find(p => String(p.id) === String(item.id));
      if (!live || live.active === false) return null;
      return { ...item, name: live.name, price: live.price, imageUrl: live.imageUrl || item.imageUrl };
    })
    .filter(Boolean);
  if (synced.length !== cart.length || synced.some((it, i) => it.price !== cart[i].price || it.name !== cart[i].name)) {
    saveCart(synced);
  }
  return synced;
}

function renderCart() {
  const body = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');
  const totalEl = document.getElementById('cart-total');
  if (!body) return;

  const cart = syncCartWithCatalog();

  if (cart.length === 0) {
    body.innerHTML = `
      <div class="tt-cart-empty">
        <div class="tt-cart-empty-icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#b84c72" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        </div>
        <div class="tt-cart-empty-text">Tu carrito está vacío.<br>¡Agregá algo hermoso!</div>
        <a href="checkout.html" class="tt-cart-goto-btn">IR A MI CARRITO →</a>
      </div>
    `;
    if (footer) footer.style.display = 'none';
    return;
  }

  body.innerHTML = cart.map(item => {
    const imgUrl = item.imageUrl || getProductImage(item.id);
    const imgHtml = imgUrl
      ? `<img src="${imgUrl}" alt="${item.name}" style="width:100%;height:100%;object-fit:contain;">`
      : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#fce4ec,#f5d4e0);display:flex;align-items:center;justify-content:center;"><svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%23e8a0b8' stroke-width='1.5'><path d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'/><circle cx='12' cy='13' r='4'/></svg></div>`;
    return `
    <div class="tt-cart-item" data-id="${item.id}">
      <div class="tt-cart-item-img">${imgHtml}</div>
      <div class="tt-cart-item-info">
        <div class="tt-cart-item-name">${item.name}</div>
        ${item.variant ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">${item.variant}</div>` : ''}
        <div class="tt-cart-item-price">${formatPrice(item.price)}</div>
        <div class="tt-cart-qty">
          <button class="tt-cart-qty-btn" onclick="updateQty('${item.id}', -1)" aria-label="Restar">−</button>
          <span class="tt-cart-qty-val">${item.qty}</span>
          <button class="tt-cart-qty-btn" onclick="updateQty('${item.id}', 1)" aria-label="Sumar">+</button>
        </div>
      </div>
      <button class="tt-cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Eliminar">✕</button>
    </div>
  `;
  }).join('');

  if (footer) {
    footer.style.display = 'block';
    footer.innerHTML = `
      <div class="tt-cart-subtotal">
        <span>Subtotal</span>
        <span>${formatPrice(getCartTotal())}</span>
      </div>
      <a href="checkout.html" class="tt-cart-checkout-btn" style="margin-top:12px;">
        Finalizar compra →
      </a>
      <button onclick="closeCart()" style="width:100%;margin-top:8px;padding:10px;background:none;border:1px solid #eee;border-radius:50px;font-size:0.78rem;color:#C86B86;cursor:pointer;font-family:inherit">
        Seguir comprando
      </button>
    `;
  }
  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
}

/* ──────────────────────────────────────
   SCROLL LOCK — tracks which panels are open
   so closing one panel doesn't unlock scroll
   while another is still open
────────────────────────────────────── */
const _scrollLockPanels = new Set();

function lockScroll(panelId) {
  _scrollLockPanels.add(panelId);
  document.body.style.overflow = 'hidden';
}

function unlockScroll(panelId) {
  _scrollLockPanels.delete(panelId);
  if (_scrollLockPanels.size === 0) {
    document.body.style.overflow = '';
  }
}

/* ──────────────────────────────────────
   CART DRAWER OPEN/CLOSE
────────────────────────────────────── */
function openCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
  lockScroll('cart');
}

function closeCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  unlockScroll('cart');
}

/* ──────────────────────────────────────
   WHATSAPP MESSAGE BUILDER
────────────────────────────────────── */
const WA_NUMBER = '595981299331';

function buildWAMessage() {
  const cart = getCart();
  if (cart.length === 0) return null;

  let msg = '¡Hola Tintin! 💕 Quiero hacer un pedido:\n\n';
  cart.forEach(item => {
    msg += `• ${item.name} × ${item.qty} = ${formatPrice(item.price * item.qty)}\n`;
  });
  msg += `\n*TOTAL: ${formatPrice(getCartTotal())}*\n\n`;
  msg += '¿Me podés confirmar disponibilidad y coordinar el envío? ¡Gracias!';
  return msg;
}

function goToCheckout() {
  const cart = getCart();
  if (!cart.length) {
    alert('Tu carrito está vacío. ¡Agregá productos primero!');
    return;
  }
  window.location.href = 'checkout.html';
}

function directWAProduct(product) {
  const msg = `¡Hola Tintin! 💕 Me interesa este producto:\n\n• ${product.name}\n  Precio: ${formatPrice(product.price)}\n\n¿Está disponible? ¡Gracias!`;
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank', 'noopener');
}

/* ──────────────────────────────────────
   HEADER SCROLL EFFECT
────────────────────────────────────── */
function initHeaderScroll() {
  const header = document.getElementById('tt-header');
  if (!header) return;

  function onScroll() {
    if (window.scrollY > 80) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ──────────────────────────────────────
   TIENDA DROPDOWN
────────────────────────────────────── */
function initDropdown() {
  const dropdown = document.getElementById('tienda-dropdown');
  const btn = document.getElementById('btn-tienda');
  if (!dropdown || !btn) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dropdown.classList.remove('open');
  });
}

/* ──────────────────────────────────────
   MOBILE MENU
────────────────────────────────────── */
function initMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const btnOpen = document.getElementById('btn-menu');
  const btnClose = document.getElementById('btn-mobile-close');
  const btnTienda = document.getElementById('btn-mobile-tienda');
  const mobileCats = document.getElementById('mobile-cats');

  if (!menu) return;

  function openMenu() {
    menu.classList.add('open');
    lockScroll('mobile-menu');
  }

  function closeMenu() {
    menu.classList.remove('open');
    unlockScroll('mobile-menu');
  }

  if (btnOpen) btnOpen.addEventListener('click', openMenu);
  if (btnClose) btnClose.addEventListener('click', closeMenu);

  if (btnTienda && mobileCats) {
    btnTienda.addEventListener('click', () => {
      const isOpen = mobileCats.classList.contains('open');
      mobileCats.classList.toggle('open', !isOpen);
      btnTienda.setAttribute('aria-expanded', String(!isOpen));
    });
  }


  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
  });
}

/* ──────────────────────────────────────
   SEARCH PANEL
────────────────────────────────────── */
function initSearch() {
  const panel = document.getElementById('search-panel');
  const input = document.getElementById('search-input');
  const btnOpen = document.getElementById('btn-search');
  const btnClose = document.getElementById('btn-search-close');
  const results = document.getElementById('search-results');
  const tabbarSearch = document.getElementById('tabbar-search');

  if (!panel) return;

  function openSearch() {
    panel.classList.add('open');
    if (input) input.focus();
  }

  function closeSearch() {
    panel.classList.remove('open');
    if (input) input.value = '';
    if (results) {
      results.style.display = 'none';
      results.innerHTML = '';
    }
  }

  if (btnOpen) btnOpen.addEventListener('click', openSearch);
  if (tabbarSearch) tabbarSearch.addEventListener('click', openSearch);
  if (btnClose) btnClose.addEventListener('click', closeSearch);

  document.addEventListener('keydown', (e) => {
    if (!panel.classList.contains('open')) return;
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = results.querySelectorAll('.tt-search-result-item');
      if (!items.length) return;
      const focused = results.querySelector('.tt-search-focus');
      let idx = focused ? Array.from(items).indexOf(focused) : -1;
      if (focused) focused.classList.remove('tt-search-focus');
      idx = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
      items[idx].classList.add('tt-search-focus');
      items[idx].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') {
      const focused = results.querySelector('.tt-search-focus');
      if (focused) focused.click();
    }
  });

  if (input && results) {
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        results.style.display = 'none';
        results.innerHTML = '';
        return;
      }

      const productPool = window.PRODUCTS || PRODUCTS;

      const matches = productPool.filter(p =>
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.cat || p.category || '').toLowerCase().includes(q) ||
        String(p.desc || '').toLowerCase().includes(q)
      );

      if (matches.length === 0) {
        results.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:0.9rem;">No encontramos productos con esa búsqueda.</div>';
      } else {
        results.innerHTML = matches.map(p => {
          const imgUrl = p.imageUrl || p.image || getProductImage(p.id);
          const thumb = imgUrl
            ? `<img src="${imgUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
            : '';
          return `
          <div class="tt-search-result-item" onclick="window.location.href='product.html?id=${p.id}'">
            <div class="tt-search-result-thumb">${thumb}</div>
            <div class="tt-search-result-info">
              <div class="tt-search-result-name">${p.name}</div>
              <div class="tt-search-result-price">${formatPrice(p.price)}</div>
            </div>
          </div>
        `;
        }).join('');
      }

      results.style.display = 'block';
    });
  }
}

/* ──────────────────────────────────────
   CART EVENTS
────────────────────────────────────── */
function initCartEvents() {
  const btnCart = document.getElementById('btn-cart');
  const tabbarCart = document.getElementById('tabbar-cart');
  const btnClose = document.getElementById('btn-cart-close');
  const overlay = document.getElementById('cart-overlay');
  const btnWA = document.getElementById('btn-cart-wa');

  if (btnCart) btnCart.addEventListener('click', openCart);
  if (tabbarCart) tabbarCart.addEventListener('click', openCart);
  if (btnClose) btnClose.addEventListener('click', closeCart);
  if (overlay) overlay.addEventListener('click', closeCart);
  // btnWA (btn-cart-wa) is now rendered dynamically as a link in renderCart()

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCart();
  });

  // Delegated click for "add to cart" buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tt-add-to-cart');
    if (btn) {
      const id = btn.dataset.id;
      if (id) addToCart(id);
    }
  });
}

/* ──────────────────────────────────────
   SKELETON LOADING STATE
────────────────────────────────────── */
function _showProductsSkeleton(containerId, count = 4) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = Array.from({ length: count }, () => `
    <div class="tt-product-card tt-skeleton-card" aria-hidden="true">
      <div class="tt-product-img tt-skeleton-img"></div>
      <div class="tt-product-info">
        <div class="tt-skeleton-line" style="width:40%;height:10px;margin-bottom:8px;"></div>
        <div class="tt-skeleton-line" style="width:80%;height:14px;margin-bottom:8px;"></div>
        <div class="tt-skeleton-line" style="width:50%;height:12px;margin-bottom:16px;"></div>
        <div class="tt-skeleton-line" style="width:100%;height:32px;border-radius:50px;"></div>
      </div>
    </div>
  `).join('');
}

/* ──────────────────────────────────────
   RENDER PRODUCTS GRID
────────────────────────────────────── */
function _onProductImgError(img) {
  img.style.display = 'none';
  img.insertAdjacentHTML('afterend', '<div class="tt-prod-placeholder tt-prod-ph-svg"></div>');
}
window._onProductImgError = _onProductImgError;

function renderProductsGrid(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = products.map(p => {
    const badgeClass = p.badge === 'Nuevo' ? 'nuevo' : '';
    const badgeHTML = p.badge ? `<span class="tt-product-badge ${badgeClass}">${p.badge}</span>` : '';
    const imgUrl = p.imageUrl || p.image || getProductImage(p.id);
    const imgContent = imgUrl
      ? `<img src="${imgUrl}" alt="${p.name}" class="tt-product-img-real" loading="lazy" onerror="_onProductImgError(this)">`
      : `<div class="tt-prod-placeholder tt-prod-ph-svg"></div>`;
    return `
      <div class="tt-product-card" data-id="${p.id}">
        <div class="tt-product-img">
          ${badgeHTML}
          ${imgContent}
        </div>
        <div class="tt-product-info">
          <div class="tt-product-cat">${p.cat}</div>
          <div class="tt-product-name">${p.name}</div>
          <div class="tt-product-price">${formatPrice(p.price)}</div>
          <div class="tt-product-actions">
            <a href="product.html?id=${p.id}" class="tt-btn tt-btn-sm">Ver producto</a>
            <button class="tt-btn tt-btn-sm tt-btn-outline tt-add-to-cart" data-id="${p.id}" aria-label="Agregar al carrito">+ Carrito</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ──────────────────────────────────────
   COMPLETÁ TU LOOK COMBINATOR
────────────────────────────────────── */
let currentCombo = [];

function renderLookCombo() {
  const grid = document.getElementById('look-grid');
  if (!grid) return;

 const productPool = (window.PRODUCTS || PRODUCTS).filter(isFeaturable);
  currentCombo = pickRandom(productPool, 3);

  grid.innerHTML = currentCombo.map(p => {
    const imgUrl = p.imageUrl || p.image || getProductImage(p.id);
    const imgContent = imgUrl
      ? `<img src="${imgUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('tt-look-card-img-ph')">`
      : '';
    return `
    <div class="tt-look-card">
      <a href="product.html?id=${p.id}" class="tt-look-card-inner">
        <div class="tt-look-card-img${imgUrl ? '' : ' tt-look-card-img-ph'}">${imgContent}</div>
        <div class="tt-look-card-body">
          <div class="tt-look-card-name">${p.name}</div>
          <div class="tt-look-card-price">${formatPrice(p.price)}</div>
        </div>
      </a>
      <div class="tt-look-card-foot">
        <button class="tt-btn tt-btn-sm tt-add-to-cart" data-id="${p.id}" style="width:100%;">+ Agregar al carrito</button>
      </div>
    </div>`;
  }).join('');
}

function initLookCombinator() {
  const btnOtra    = document.getElementById('btn-otra-combo');
  const btnAdd     = document.getElementById('btn-add-combo');
  const lookActions = document.getElementById('look-actions');
  const lookSection = document.getElementById('look-section');

  const productPool = window.PRODUCTS || PRODUCTS;
  if (!productPool || productPool.length === 0) {
    if (lookSection) lookSection.style.display = 'none';
    return;
  }

  renderLookCombo();
  if (lookActions) lookActions.style.display = '';

  if (btnOtra) {
    btnOtra.addEventListener('click', () => {
      renderLookCombo();
    });
  }

  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      if (currentCombo.length === 0) return;
      currentCombo.forEach(p => {
        const cart = getCart();
        const existing = cart.find(i => String(i.id) === String(p.id));
        if (existing) {
          existing.qty += 1;
        } else {
          const imgUrl = p.imageUrl || p.image || getProductImage(p.id);
          cart.push({
            id: p.id,
            name: p.name,
            price: p.price,
            qty: 1,
            cat: p.cat || p.category || '',
            imageUrl: imgUrl || ''
          });
        }
        saveCart(cart);
      });
      updateCartBadge();
      renderCart();
      openCart();
    });
  }
}

/* ──────────────────────────────────────
   PRODUCT DETAIL PAGE
────────────────────────────────────── */
function initProductPage() {
  if (!document.getElementById('product-detail')) return;
  if (window._productPageRendered) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { _showProductNotFound(); return; }

  const immediate = getProductById(id);
  if (immediate) {
    window._productPageRendered = true;
    _renderProductDetail(immediate);
  } else {
    // Wait for Firebase products to load via tintin:products-loaded event
    function onProductsLoaded() {
      window.removeEventListener('tintin:products-loaded', onProductsLoaded);
      const p = getProductById(id);
      if (p) { window._productPageRendered = true; _renderProductDetail(p); }
      else _showProductNotFound();
    }
    window.addEventListener('tintin:products-loaded', onProductsLoaded);
    // Fallback: if Firebase never fires (offline / no products), show not-found after 5s
    setTimeout(() => {
      if (!window._productPageRendered) {
        window.removeEventListener('tintin:products-loaded', onProductsLoaded);
        _showProductNotFound();
      }
    }, 5000);
  }
}

function _showProductNotFound() {
  const loading = document.getElementById('product-loading');
  const notFound = document.getElementById('product-not-found');
  const grid = document.getElementById('product-grid');
  if (loading) loading.style.display = 'none';
  if (grid) grid.style.display = 'none';
  if (notFound) notFound.style.display = '';
}

function _renderProductDetail(product) {
  const loading = document.getElementById('product-loading');
  const notFound = document.getElementById('product-not-found');
  const grid = document.getElementById('product-grid');
  if (loading) loading.style.display = 'none';
  if (notFound) notFound.style.display = 'none';
  if (grid) grid.style.display = '';

  document.title = `${product.name} | TINTIN Accesorios & Relojes`;

  const bc = document.getElementById('breadcrumb-product');
  if (bc) bc.textContent = product.name;

  // Basic info
  const nameEl = document.getElementById('product-name');
  const priceEl = document.getElementById('product-price');
  const catEl = document.getElementById('product-cat');
  const descEl = document.getElementById('product-desc');
  const badgeEl = document.getElementById('product-badge-label');
  const statusEl = document.getElementById('product-status');

  if (nameEl) nameEl.textContent = product.name;
  if (priceEl) priceEl.textContent = formatPrice(product.price);
  if (catEl) catEl.textContent = (product.category || product.cat || '').toUpperCase();
  if (descEl) {
    // desc may be HTML from Shopify
    if (product.desc && /<[a-z][\s\S]*>/i.test(product.desc)) {
      descEl.innerHTML = product.desc;
    } else {
      descEl.textContent = product.desc || '';
    }
  }
  if (badgeEl) {
    if (product.badge) { badgeEl.textContent = product.badge; badgeEl.style.display = 'inline-block'; }
    else badgeEl.style.display = 'none';
  }

  // Stock status
  const stock = (product.stock !== null && product.stock !== undefined) ? Number(product.stock) : null;
  if (statusEl) {
    if (stock !== null && stock <= 0) {
      statusEl.textContent = 'Sin stock';
      statusEl.style.background = '#fce4ec';
      statusEl.style.color = '#b84c72';
      statusEl.style.setProperty('--dot-color', '#b84c72');
    } else {
      statusEl.textContent = '● Disponible';
    }
  }

  // Gallery
  const mainImgUrl = product.imageUrl || product.image || getProductImage(product.id) || '';
  const extraImages = Array.isArray(product.imagesExtra) ? product.imagesExtra : [];
  const allImages = mainImgUrl ? [mainImgUrl, ...extraImages] : extraImages;

  const galleryMain = document.getElementById('gallery-main');
  if (galleryMain) {
    if (mainImgUrl) {
      galleryMain.innerHTML = `<img src="${mainImgUrl}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
    } else {
      galleryMain.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#e8a0b8" stroke-width="1"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
      galleryMain.style.display = 'flex';
      galleryMain.style.alignItems = 'center';
      galleryMain.style.justifyContent = 'center';
    }
  }

  // Thumbs — only show if more than 1 image
  const thumbsEl = document.getElementById('gallery-thumbs');
  if (thumbsEl && allImages.length > 1) {
    thumbsEl.style.display = '';
    thumbsEl.innerHTML = allImages.map((url, i) => `
      <div class="tt-gallery-thumb${i === 0 ? ' active' : ''}" data-src="${url}" onclick="_galleryThumbClick(this)">
        <img src="${url}" alt="Vista ${i + 1}" class="tt-gallery-thumb-img" style="object-fit:cover;width:100%;height:100%;">
      </div>
    `).join('');
  }

  // Variants
  const variantsContainer = document.getElementById('product-variants');
  if (variantsContainer) {
    if (product.variants && Object.keys(product.variants).length) {
      variantsContainer.innerHTML = Object.entries(product.variants).map(([key, values]) => `
        <div class="tt-product-variants" data-variant-key="${key}">
          <div class="tt-variant-label">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
          <div class="tt-variant-options" id="variants-${key}">
            ${Array.isArray(values) ? values.map(v => `
              <button class="tt-variant-option" onclick="selectVariant(this)">${v}</button>
            `).join('') : ''}
          </div>
        </div>
      `).join('');
    } else {
      variantsContainer.innerHTML = '';
    }
  }

  // Quantity selector
  let qty = 1;
  const maxQty = stock !== null ? stock : 99;
  const qtyVal = document.getElementById('qty-val');
  const qtyMinus = document.getElementById('btn-qty-minus');
  const qtyPlus = document.getElementById('btn-qty-plus');
  const qtyStock = document.getElementById('qty-stock');

  if (qtyVal) qtyVal.textContent = qty;
  if (qtyStock) {
    if (stock !== null && stock <= 10 && stock > 0) qtyStock.textContent = `Solo ${stock} disponibles`;
    else if (stock !== null && stock <= 0) qtyStock.textContent = 'Sin stock';
    else qtyStock.textContent = '';
  }

  function updateQtyUI() {
    if (qtyVal) qtyVal.textContent = qty;
    if (qtyMinus) qtyMinus.disabled = qty <= 1;
    if (qtyPlus) qtyPlus.disabled = qty >= maxQty;
  }
  updateQtyUI();

  if (qtyMinus) qtyMinus.addEventListener('click', () => { if (qty > 1) { qty--; updateQtyUI(); } });
  if (qtyPlus) qtyPlus.addEventListener('click', () => { if (qty < maxQty) { qty++; updateQtyUI(); } });

  // Trust badges
  const trustEl = document.getElementById('product-trust-badges');
  if (trustEl) {
    const cat = (product.category || product.cat || '').toLowerCase();
    const isWatch = cat.includes('reloj') || cat.includes('watch');
    const badges = [
      { icon: '🚚', text: 'Entrega en todo Paraguay' },
      { icon: '✅', text: 'Productos originales garantizados' },
      { icon: '💬', text: 'Atención personalizada por WhatsApp' },
      ...(isWatch ? [{ icon: '⌚', text: 'Ajuste de malla incluido' }] : [{ icon: '🎀', text: 'Empaque especial de regalo' }]),
    ];
    trustEl.innerHTML = badges.map(b => `
      <div class="tt-trust-badge-item">
        <span class="tt-trust-badge-icon">${b.icon}</span>
        <span class="tt-trust-badge-text">${b.text}</span>
      </div>
    `).join('');
  }

  // WA button
  const btnWA = document.getElementById('btn-product-wa');
  if (btnWA) {
    btnWA.onclick = () => directWAProduct(product);
    btnWA.href = undefined;
  }

  // Share buttons
  const shareEl = document.getElementById('product-share');
  if (shareEl) {
    const shareUrl = window.location.href;
    const shareText = `¡Mirá este accesorio de TINTIN! ${product.name} — ${formatPrice(product.price)}`;
    const waHref = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    let html = `<span class="tt-share-label">Compartir</span>`;
    if (navigator.share) {
      html += `<button class="tt-share-btn" id="btn-native-share">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Compartir
      </button>`;
    }
    html += `<a href="${waHref}" target="_blank" rel="noopener" class="tt-share-btn tt-share-btn-wa">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.096.543 4.09 1.5 5.828L0 24l6.343-1.475A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.868 0-3.636-.498-5.17-1.37l-.371-.21-3.768.877.895-3.669-.231-.389C2.51 15.583 2 13.84 2 12 2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
      WhatsApp
    </a>`;
    html += `<button class="tt-share-btn" id="btn-copy-link">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
      Copiar enlace
    </button>`;
    shareEl.innerHTML = html;

    const btnNative = document.getElementById('btn-native-share');
    if (btnNative) btnNative.addEventListener('click', () => {
      navigator.share({ title: product.name, text: shareText, url: shareUrl }).catch(() => {});
    });

    const btnCopy = document.getElementById('btn-copy-link');
    if (btnCopy) btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(shareUrl).then(() => {
        const orig = btnCopy.innerHTML;
        btnCopy.textContent = '✓ ¡Copiado!';
        setTimeout(() => { btnCopy.innerHTML = orig; }, 2000);
      }).catch(() => {});
    });
  }

  // Gallery: click to open lightbox
  if (galleryMain && allImages.length > 0) {
    let _lbIdx = 0;
    galleryMain.addEventListener('click', () => _openLightbox(allImages, _lbIdx));
    // Update index when thumb changes
    const thumbsContainer = document.getElementById('gallery-thumbs');
    if (thumbsContainer) {
      const origThumbClick = window._galleryThumbClick;
      window._galleryThumbClick = (el) => {
        if (origThumbClick) origThumbClick(el);
        const thumbs = thumbsContainer.querySelectorAll('.tt-gallery-thumb');
        thumbs.forEach((t, i) => { if (t === el || t.contains(el)) _lbIdx = i; });
      };
    }
  }

  // Helper: get selected variant string
  function getSelectedVariant() {
    if (!variantsContainer || !product.variants || !Object.keys(product.variants).length) return null;
    const parts = [];
    variantsContainer.querySelectorAll('.tt-variant-options').forEach(group => {
      const active = group.querySelector('.tt-variant-option.active');
      if (active) parts.push(active.textContent.trim());
    });
    return parts.length ? parts.join(' / ') : null;
  }

  // Helper: validate variants selected
  function validateVariants() {
    if (!product.variants || !Object.keys(product.variants).length) return true;
    let valid = true;
    variantsContainer.querySelectorAll('.tt-variant-options').forEach(group => {
      const active = group.querySelector('.tt-variant-option.active');
      if (!active) {
        valid = false;
        const existing = group.nextElementSibling;
        if (existing && existing.classList.contains('tt-variant-required-msg')) return;
        const msg = document.createElement('span');
        msg.className = 'tt-variant-required-msg';
        msg.textContent = 'Por favor seleccioná una opción';
        group.classList.add('tt-variant-required');
        group.parentNode.insertBefore(msg, group.nextSibling);
        setTimeout(() => { group.classList.remove('tt-variant-required'); msg.remove(); }, 2500);
      }
    });
    return valid;
  }

  // Add to cart
  const btnAdd = document.getElementById('btn-product-add-cart');
  if (btnAdd) {
    if (stock !== null && stock <= 0) {
      btnAdd.disabled = true;
      btnAdd.textContent = 'Sin stock';
      btnAdd.style.opacity = '0.5';
    }
    btnAdd.addEventListener('click', () => {
      if (!validateVariants()) return;
      const variantStr = getSelectedVariant();
      _addToCartWithQty(product, qty, variantStr);
      _showProductToast(product.name);
    });
  }

  // Buy now
  const btnBuyNow = document.getElementById('btn-product-buy-now');
  if (btnBuyNow) {
    if (stock !== null && stock <= 0) {
      btnBuyNow.disabled = true;
      btnBuyNow.style.opacity = '0.5';
    }
    btnBuyNow.addEventListener('click', () => {
      if (!validateVariants()) return;
      const variantStr = getSelectedVariant();
      _addToCartWithQty(product, qty, variantStr);
      window.location.href = 'checkout.html';
    });
  }

  // Related products — same category first
  const pool = (window.PRODUCTS || PRODUCTS).filter(p => String(p.id) !== String(product.id) && isFeaturable(p));
  const sameCat = pool.filter(p => (p.category || p.cat) === (product.category || product.cat));
  const others  = pool.filter(p => (p.category || p.cat) !== (product.category || product.cat));
  const related = [...pickRandom(sameCat, 4), ...pickRandom(others, 4 - Math.min(sameCat.length, 4))].slice(0, 4);
  renderProductsGrid('related-grid', related);
}

function _galleryThumbClick(thumb) {
  const thumbsEl = document.getElementById('gallery-thumbs');
  const galleryMain = document.getElementById('gallery-main');
  if (thumbsEl) thumbsEl.querySelectorAll('.tt-gallery-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
  const src = thumb.dataset.src;
  if (galleryMain && src) {
    const img = galleryMain.querySelector('img');
    if (img) img.src = src;
    else galleryMain.innerHTML = `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`;
  }
}
window._galleryThumbClick = _galleryThumbClick;

function _addToCartWithQty(product, qty, variantStr) {
  const cart = getCart();
  const sid = String(product.id);
  const existing = cart.find(item => String(item.id) === sid && item.variant === (variantStr || undefined));
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, 99);
  } else {
    const imgUrl = product.imageUrl || product.image || getProductImage(product.id) || '';
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      qty,
      cat: product.category || product.cat || '',
      imageUrl: imgUrl,
      ...(variantStr ? { variant: variantStr } : {}),
    });
  }
  saveCart(cart);
  updateCartBadge();
  renderCart();
}
window._addToCartWithQty = _addToCartWithQty;

function _showProductToast(productName) {
  const toast = document.getElementById('tt-added-toast');
  const toastText = document.getElementById('tt-added-toast-text');
  if (!toast) return;
  if (toastText) toastText.textContent = `${productName} agregado al carrito`;
  toast.style.display = '';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => { toast.style.display = 'none'; }, 5000);
}
window._showProductToast = _showProductToast;

function selectVariant(btn) {
  const group = btn.closest('.tt-variant-options');
  if (!group) return;
  group.querySelectorAll('.tt-variant-option').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ──────────────────────────────────────
   GALLERY THUMBS (product page)
────────────────────────────────────── */
function initGalleryThumbs() {
  const thumbs = document.querySelectorAll('.tt-gallery-thumb');
  thumbs.forEach((thumb, i) => {
    thumb.addEventListener('click', () => {
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
}

/* ──────────────────────────────────────
   LIGHTBOX
────────────────────────────────────── */
let _lbImages = [], _lbCur = 0;

function _openLightbox(images, startIdx) {
  _lbImages = images.filter(Boolean);
  if (!_lbImages.length) return;
  _lbCur = startIdx || 0;

  let lb = document.getElementById('tt-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'tt-lightbox';
    lb.className = 'tt-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-label', 'Imagen ampliada');
    lb.innerHTML = `
      <button class="tt-lightbox-close" id="lb-close" aria-label="Cerrar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <button class="tt-lightbox-nav tt-lightbox-prev" id="lb-prev" aria-label="Anterior">‹</button>
      <img class="tt-lightbox-img" id="lb-img" src="" alt="Vista de producto" draggable="false">
      <button class="tt-lightbox-nav tt-lightbox-next" id="lb-next" aria-label="Siguiente">›</button>
      <div class="tt-lightbox-counter" id="lb-counter"></div>
    `;
    document.body.appendChild(lb);

    document.getElementById('lb-close').addEventListener('click', _closeLightbox);
    lb.addEventListener('click', (e) => { if (e.target === lb) _closeLightbox(); });
    document.getElementById('lb-prev').addEventListener('click', (e) => { e.stopPropagation(); _lbNav(-1); });
    document.getElementById('lb-next').addEventListener('click', (e) => { e.stopPropagation(); _lbNav(1); });

    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') _closeLightbox();
      if (e.key === 'ArrowLeft') _lbNav(-1);
      if (e.key === 'ArrowRight') _lbNav(1);
    });

    // Swipe support (mobile)
    let _tsx = 0;
    lb.addEventListener('touchstart', (e) => { _tsx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - _tsx;
      if (Math.abs(dx) > 50) _lbNav(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  _lbUpdate();
  requestAnimationFrame(() => lb.classList.add('open'));
  document.body.style.overflow = 'hidden';
}

function _lbUpdate() {
  const img = document.getElementById('lb-img');
  const counter = document.getElementById('lb-counter');
  const prev = document.getElementById('lb-prev');
  const next = document.getElementById('lb-next');
  if (img) img.src = _lbImages[_lbCur];
  if (counter) counter.textContent = _lbImages.length > 1 ? `${_lbCur + 1} / ${_lbImages.length}` : '';
  if (prev) prev.style.display = _lbImages.length > 1 ? '' : 'none';
  if (next) next.style.display = _lbImages.length > 1 ? '' : 'none';
}

function _lbNav(dir) {
  _lbCur = (_lbCur + dir + _lbImages.length) % _lbImages.length;
  _lbUpdate();
}

function _closeLightbox() {
  const lb = document.getElementById('tt-lightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}

/* ──────────────────────────────────────
   BACK TO TOP
────────────────────────────────────── */
function initBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'tt-back-to-top';
  btn.setAttribute('aria-label', 'Volver al inicio');
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
  document.body.appendChild(btn);
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 320);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ──────────────────────────────────────
   FAQ ACCORDION
────────────────────────────────────── */
function initFaqAccordion() {
  document.querySelectorAll('.tt-faq-item').forEach(item => {
    const q = item.querySelector('.tt-faq-q');
    if (!q) return;
    q.setAttribute('role', 'button');
    q.setAttribute('tabindex', '0');
    const toggle = () => {
      const isOpen = item.classList.contains('tt-faq-open');
      document.querySelectorAll('.tt-faq-item.tt-faq-open').forEach(i => i.classList.remove('tt-faq-open'));
      if (!isOpen) item.classList.add('tt-faq-open');
    };
    q.addEventListener('click', toggle);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
}

/* ──────────────────────────────────────
   CONTACT FORM
────────────────────────────────────── */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = form.querySelector('#f-nombre').value.trim();
    const email = form.querySelector('#f-email').value.trim();
    const tel = form.querySelector('#f-tel').value.trim();
    const msg = form.querySelector('#f-msg').value.trim();

    if (!nombre || !msg) {
      alert('Por favor completá al menos tu nombre y tu mensaje.');
      return;
    }

    const waMsg = `¡Hola Tintin! 💕 Me contacto desde el formulario del sitio:\n\n*Nombre:* ${nombre}\n*Email:* ${email || 'No indicado'}\n*Teléfono:* ${tel || 'No indicado'}\n\n*Mensaje:*\n${msg}`;
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;
    window.open(url, '_blank', 'noopener');

    form.reset();
    const success = document.getElementById('form-success');
    if (success) {
      success.style.display = 'block';
      setTimeout(() => { success.style.display = 'none'; }, 5000);
    }
  });
}

/* ──────────────────────────────────────
   SCROLL REVEAL (simple fade-in)
────────────────────────────────────── */
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;

  const style = document.createElement('style');
  style.textContent = `
    .reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
    .reveal.visible { opacity: 1; transform: translateY(0); }
  `;
  document.head.appendChild(style);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll([
    '.tt-trust-item',
    '.tt-product-card',
    '.tt-review-card',
    '.tt-look-card',
    '.tt-coll-card',
    '.tt-coll-page-card',
    '.tt-editorial-item',
    '.tt-editorial-card',
    '.tt-look-item',
    '.tt-featured-item',
  ].join(',')).forEach(el => {
    if (el.classList.contains('reveal')) return;
    el.classList.add('reveal');
    observer.observe(el);
  });
}

/* ──────────────────────────────────────
   COLLECTIONS BOTTOM SHEET
────────────────────────────────────── */
function initCollectionsSheet() {
  const sheet = document.getElementById('collections-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  if (!sheet) return;
  function openSheet() {
    sheet.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    lockScroll('collections-sheet');
  }
  function closeSheet() {
    sheet.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    unlockScroll('collections-sheet');
  }
  const closeBtn = document.getElementById('btn-close-sheet');
  if (closeBtn) closeBtn.addEventListener('click', closeSheet);
  if (backdrop) backdrop.addEventListener('click', closeSheet);
  const tiendaTab = document.getElementById('tabbar-tienda');
  if (tiendaTab) tiendaTab.addEventListener('click', e => { e.preventDefault(); openSheet(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet();
  });
}

/* ──────────────────────────────────────
   MAIN INIT
────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Core functionality on all pages
  initHeaderScroll();
  initDropdown();
  initMobileMenu();
  initSearch();
  initCartEvents();
  initCollectionsSheet();
  updateCartBadge();
  renderCart();

  // Homepage specific — show skeleton while Firebase loads, fallback to hardcoded after 4s
  if (document.getElementById('products-grid')) {
    _showProductsSkeleton('products-grid');
    setTimeout(() => {
      const grid = document.getElementById('products-grid');
      if (grid && grid.querySelector('.tt-skeleton-card')) {
        renderProductsGrid('products-grid', (window.PRODUCTS || PRODUCTS).filter(isFeaturable).slice(0, 6));
      }
    }, 4000);
  }

  if (document.getElementById('look-grid')) {
    initLookCombinator();
  }

  // Contact page
  if (document.getElementById('contact-form')) {
    initContactForm();
  }

  // Product page
  if (document.getElementById('product-detail')) {
    initProductPage();
  }

  // Gallery thumbs (product page)
  if (document.querySelector('.tt-gallery-thumb')) {
    initGalleryThumbs();
  }

  // Collections page — show skeleton while Firebase loads
  if (document.getElementById('colls-products-grid')) {
    _showProductsSkeleton('colls-products-grid');
  }

  // Scroll reveal
  setTimeout(initScrollReveal, 100);
  // Back to top
  initBackToTop();
  // FAQ accordion
  initFaqAccordion();
});

/* expose for inline onclick usage and module re-render */
window.addEventListener('tintin:products-loaded', () => {
  renderCart();
  updateCartBadge();
  if (document.getElementById('products-grid')) {
    renderProductsGrid('products-grid', (window.PRODUCTS || PRODUCTS).filter(isFeaturable).slice(0, 6));
  }

  if (document.getElementById('colls-products-grid')) {
    renderProductsGrid('colls-products-grid', (window.PRODUCTS || PRODUCTS).filter(isFeaturable));
  }

  if (document.getElementById('look-grid')) {
    renderLookCombo();
  }

  if (document.getElementById('product-detail')) {
    initProductPage();
  }

  renderCart();
});

/* expose for inline onclick usage and module re-render */
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQty = updateQty;
window.openCart = openCart;
window.closeCart = closeCart;
window.goToCheckout = goToCheckout;
window.initProductPage = initProductPage;
window.selectVariant = selectVariant;
window.formatPrice = formatPrice;
window.directWAProduct = directWAProduct;
window.renderProductsGrid = renderProductsGrid;
window.renderCart = renderCart;
window.updateCartBadge = updateCartBadge;
window.initLookCombinator = initLookCombinator;
// NOTE: do NOT seed window.PRODUCTS with the hardcoded fallback array here.
// window.PRODUCTS must only ever hold real Firestore data (set by products-store.js)
// so pages that check `if (window.PRODUCTS && window.PRODUCTS.length)` don't mistake
// the offline sample data for a real, loaded catalog.

// Re-render badge and drawer on external cart changes (cart-sync.js events)
window.addEventListener('tt_cart_updated', () => {
  updateCartBadge();
  renderCart();
});

/* ──────────────────────────────────────
   SCROLL REVEAL — IntersectionObserver
────────────────────────────────────── */
(function initScrollReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('tt-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.tt-reveal').forEach(el => observer.observe(el));

  // Also observe dynamically added elements after products load
  document.addEventListener('tintin:products-loaded', () => {
    document.querySelectorAll('.tt-reveal:not(.tt-visible)').forEach(el => observer.observe(el));
  });
})();
