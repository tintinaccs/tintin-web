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
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const count = getCartCount();
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderCart() {
  const body = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');
  const totalEl = document.getElementById('cart-total');
  if (!body) return;

  const cart = getCart();

  if (cart.length === 0) {
    body.innerHTML = `
      <div class="tt-cart-empty">
        <div class="tt-cart-empty-icon">🛍️</div>
        <div class="tt-cart-empty-text">Tu carrito está vacío.<br>¡Agregá algo hermoso!</div>
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
      <a href="checkout.html" class="tt-btn w-full" style="display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;margin-top:12px">
        Finalizar compra →
      </a>
      <button onclick="closeCart()" style="width:100%;margin-top:8px;padding:10px;background:none;border:1px solid #eee;border-radius:50px;font-size:0.78rem;color:#888;cursor:pointer;font-family:inherit">
        Seguir comprando
      </button>
    `;
  }
  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
}

/* ──────────────────────────────────────
   CART DRAWER OPEN/CLOSE
────────────────────────────────────── */
function openCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
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

function checkoutWhatsApp() {
  const msg = buildWAMessage();
  if (!msg) {
    alert('Tu carrito está vacío. ¡Agregá productos primero!');
    return;
  }
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank', 'noopener');
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
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    menu.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (btnOpen) btnOpen.addEventListener('click', openMenu);
  if (btnClose) btnClose.addEventListener('click', closeMenu);

  if (btnTienda && mobileCats) {
    btnTienda.addEventListener('click', () => {
      const isOpen = mobileCats.style.display !== 'none';
      mobileCats.style.display = isOpen ? 'none' : 'grid';
      btnTienda.textContent = isOpen ? 'TIENDA ▾' : 'TIENDA ▴';
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
    setTimeout(() => input && input.focus(), 150);
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
    if (e.key === 'Escape' && panel.classList.contains('open')) closeSearch();
  });

  if (input && results) {
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        results.style.display = 'none';
        results.innerHTML = '';
        return;
      }

      const matches = PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.cat.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q)
      );

      if (matches.length === 0) {
        results.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:0.9rem;">No encontramos productos con esa búsqueda.</div>';
      } else {
        results.innerHTML = matches.map(p => `
          <div class="tt-search-result-item" onclick="window.location.href='product.html?id=${p.id}'">
            <div class="tt-search-result-thumb"></div>
            <div class="tt-search-result-info">
              <div class="tt-search-result-name">${p.name}</div>
              <div class="tt-search-result-price">${formatPrice(p.price)}</div>
            </div>
          </div>
        `).join('');
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
   RENDER PRODUCTS GRID
────────────────────────────────────── */
function renderProductsGrid(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = products.map(p => {
    const badgeClass = p.badge === 'Nuevo' ? 'nuevo' : '';
    const badgeHTML = p.badge ? `<span class="tt-product-badge ${badgeClass}">${p.badge}</span>` : '';
    const imgUrl = p.imageUrl || p.image || getProductImage(p.id);
    const imgContent = imgUrl
      ? `<img src="${imgUrl}" alt="${p.name}" class="tt-product-img-real" loading="lazy" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div class=\\"tt-prod-placeholder tt-prod-ph-svg\\"></div>')">`
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
            <button class="tt-btn-icon tt-add-to-cart" data-id="${p.id}" data-id-str="${p.id}" aria-label="Agregar al carrito">+</button>
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

  currentCombo = pickRandom(PRODUCTS, 3);

  grid.innerHTML = currentCombo.map(p => {
    const imgUrl = p.imageUrl || p.image || getProductImage(p.id);
    const imgContent = imgUrl
      ? `<img src="${imgUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('tt-look-card-img-ph')">`
      : '';
    return `
    <div class="tt-look-card">
      <div class="tt-look-card-img${imgUrl ? '' : ' tt-look-card-img-ph'}">${imgContent}</div>
      <div class="tt-look-card-body">
        <div class="tt-look-card-name">${p.name}</div>
        <div class="tt-look-card-price">${formatPrice(p.price)}</div>
      </div>
    </div>`;
  }).join('');
}

function initLookCombinator() {
  const btnOtra = document.getElementById('btn-otra-combo');
  const btnAdd = document.getElementById('btn-add-combo');

  renderLookCombo();

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
        const existing = cart.find(i => i.id === p.id);
        if (existing) {
          existing.qty += 1;
        } else {
          cart.push({ id: p.id, name: p.name, price: p.price, qty: 1, cat: p.cat });
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
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const product = getProductById(id);

  if (!product) {
    const container = document.getElementById('product-detail');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:80px 0;">
          <div style="font-size:3rem;margin-bottom:16px;">😢</div>
          <h2 style="font-family:var(--font-heading);color:var(--pink-dark);margin-bottom:12px;">Producto no encontrado</h2>
          <p style="color:var(--text-sec);margin-bottom:24px;">Este producto no existe o ya no está disponible.</p>
          <a href="collections.html" class="tt-btn">Ver catálogo completo</a>
        </div>
      `;
    }
    return;
  }

  // Update page title
  document.title = `${product.name} | TINTIN Accesorios & Relojes`;

  // Update breadcrumb
  const breadcrumbProduct = document.getElementById('breadcrumb-product');
  if (breadcrumbProduct) breadcrumbProduct.textContent = product.name;

  // Update product info
  const nameEl = document.getElementById('product-name');
  const priceEl = document.getElementById('product-price');
  const catEl = document.getElementById('product-cat');
  const descEl = document.getElementById('product-desc');
  const badgeEl = document.getElementById('product-badge-label');

  if (nameEl) nameEl.textContent = product.name;
  if (priceEl) priceEl.textContent = formatPrice(product.price);
  if (catEl) catEl.textContent = product.cat;
  if (descEl) descEl.textContent = product.desc;

  // Badge
  if (badgeEl && product.badge) {
    badgeEl.textContent = product.badge;
    badgeEl.style.display = 'inline-block';
  } else if (badgeEl) {
    badgeEl.style.display = 'none';
  }

  // Variants
  const variantsContainer = document.getElementById('product-variants');
  if (variantsContainer && product.variants) {
    variantsContainer.innerHTML = Object.entries(product.variants).map(([key, values]) => `
      <div class="tt-product-variants">
        <div class="tt-variant-label">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
        <div class="tt-variant-options">
          ${values.map((v, i) => `
            <button class="tt-variant-option${i === 0 ? ' active' : ''}"
              onclick="selectVariant(this)">${v}</button>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // Gallery — use Firebase imageUrl first, then localStorage fallback
  const galleryMain = document.getElementById('gallery-main-emoji');
  if (galleryMain) {
    const storedImg = product.imageUrl || product.image || getProductImage(product.id);
    if (storedImg) {
      galleryMain.innerHTML = '';
      const img = document.createElement('img');
      img.src = storedImg;
      img.alt = product.name;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;';
      galleryMain.parentElement.style.position = 'relative';
      galleryMain.parentElement.appendChild(img);
    } else {
      galleryMain.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e8a0b8" stroke-width="1.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
      galleryMain.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg,#fce4ec,#f5d4e0);';
    }
  }

  // Add to cart button
  const btnAdd = document.getElementById('btn-product-add-cart');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      addToCart(product.id);
    });
  }

  // Buy now button (add to cart + go to checkout)
  const btnBuyNow = document.getElementById('btn-product-buy-now');
  if (btnBuyNow) {
    btnBuyNow.addEventListener('click', () => {
      addToCart(product.id);
      window.location.href = 'checkout.html';
    });
  }

  // WhatsApp direct button (secondary / support)
  const btnWA = document.getElementById('btn-product-wa');
  if (btnWA) {
    btnWA.addEventListener('click', () => {
      directWAProduct(product);
    });
  }

  // Related products
  const relatedProducts = PRODUCTS.filter(p => p.id !== product.id);
  const related = pickRandom(relatedProducts, 4);
  renderProductsGrid('related-grid', related);
}

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

  document.querySelectorAll('.tt-trust-item, .tt-product-card, .tt-review-card, .tt-look-card, .tt-coll-card, .tt-coll-page-card').forEach(el => {
    el.classList.add('reveal');
    observer.observe(el);
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
  updateCartBadge();
  renderCart();

  // Homepage specific
  if (document.getElementById('products-grid')) {
    renderProductsGrid('products-grid', PRODUCTS);
  }

  if (document.getElementById('look-grid')) {
    initLookCombinator();
  }

  // Contact page
  if (document.getElementById('contact-form')) {
    initContactForm();
  }

  // Gallery thumbs (product page)
  if (document.querySelector('.tt-gallery-thumb')) {
    initGalleryThumbs();
  }

  // Collections page — render related cards if container exists
  if (document.getElementById('colls-products-grid')) {
    renderProductsGrid('colls-products-grid', PRODUCTS);
  }

  // Scroll reveal
  setTimeout(initScrollReveal, 100);
});

/* expose for inline onclick usage and module re-render */
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQty = updateQty;
window.openCart = openCart;
window.closeCart = closeCart;
window.checkoutWhatsApp = checkoutWhatsApp;
window.initProductPage = initProductPage;
window.selectVariant = selectVariant;
window.formatPrice = formatPrice;
window.directWAProduct = directWAProduct;
window.renderProductsGrid = renderProductsGrid;
window.renderCart = renderCart;
window.initLookCombinator = initLookCombinator;
window.PRODUCTS = PRODUCTS;
