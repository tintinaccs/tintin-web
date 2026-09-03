/* TINTIN — Estabilidad final de superficies públicas.
 * No crea autoridades paralelas: solo fortalece las superficies ya renderizadas
 * por Producto, Perfil y el shell modular de navegación. */

const VERSION = 'tintin-20260829-final-stability-1';
const path = window.location.pathname.replace(/\/+$/, '') || '/';

function injectStyles() {
  if (document.getElementById('tt-final-stability-styles')) return;
  const style = document.createElement('style');
  style.id = 'tt-final-stability-styles';
  style.textContent = `
    /* Header mobile: una sola jerarquía visual, sin capas compitiendo. */
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

    /* Producto: el contenido informativo nunca depende de un acordeón. */
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
    body[data-tt-product-stable="1"] .tt-product-social-bar{scroll-margin-top:96px}
    body[data-tt-product-stable="1"] #product-reviews{scroll-margin-top:96px}
    @media(max-width:767px){
      body[data-tt-product-stable="1"] .tt-related-section{margin-top:28px!important}
      body[data-tt-product-stable="1"] .tt-related-header{align-items:center!important;gap:12px!important}
      body[data-tt-product-stable="1"] .tt-product-social-bar{gap:6px!important}
    }

    /* Perfil v2: una sola página, organizada por pestañas. */
    body[data-tt-profile-v2="1"]{background:#fff7fa!important}
    body[data-tt-profile-v2="1"] .perfil-wrap{max-width:1080px!important;padding-inline:clamp(16px,4vw,36px)!important}
    .tt-profile-hero{background:#fff;border:1px solid var(--border);border-radius:22px;padding:22px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:18px;box-shadow:0 12px 34px rgba(85,34,53,.06)}
    .tt-profile-hero-main{display:flex;align-items:center;gap:16px;min-width:0}
    .tt-profile-avatar-actions{display:flex;flex-direction:column;gap:7px;align-items:flex-start}
    .tt-profile-photo-btn{border:1px solid #eac7d4;background:#fff;color:#9e4062;border-radius:999px;padding:7px 11px;font:700 10px/1 Montserrat;letter-spacing:.05em;text-transform:uppercase;cursor:pointer}
    .tt-profile-photo-btn:disabled{opacity:.55;cursor:wait}
    .tt-profile-meta{min-width:0}
    .tt-profile-meta .perfil-name{text-transform:none!important;letter-spacing:-.02em!important;font-size:clamp(20px,3vw,30px)!important}
    .tt-profile-meta-extra{margin-top:6px;font-size:12px;color:var(--text-muted);display:flex;gap:8px;flex-wrap:wrap}
    .tt-profile-tabs{position:sticky;top:8px;z-index:30;display:flex;gap:6px;overflow-x:auto;padding:7px;background:rgba(255,255,255,.96);border:1px solid #ecd4dd;border-radius:16px;margin:0 0 18px;box-shadow:0 8px 24px rgba(83,33,52,.07);scrollbar-width:none}
    .tt-profile-tabs::-webkit-scrollbar{display:none}
    .tt-profile-tab{position:relative;flex:0 0 auto;border:0;background:transparent;color:#6d5b62;border-radius:11px;padding:11px 14px;font:700 11px/1 Montserrat;cursor:pointer;white-space:nowrap}
    .tt-profile-tab[aria-selected="true"]{background:#fde8f0;color:#8b2642}
    .tt-profile-tab-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:6px;border-radius:999px;background:#a3154b;color:#fff;font-size:9px;vertical-align:1px}
    .tt-profile-panel[hidden]{display:none!important}
    .tt-profile-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .tt-profile-summary-card{background:#fff;border:1px solid #ecd9e1;border-radius:16px;padding:18px;min-width:0}
    .tt-profile-summary-card span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#9a7f89;font-weight:700;margin-bottom:6px}
    .tt-profile-summary-card strong{font-size:15px;color:#392d32;overflow-wrap:anywhere}
    body[data-tt-profile-v2="1"] .perfil-card{border-radius:18px!important;border:1px solid #ead7df!important;box-shadow:none!important;margin-bottom:14px!important}
    body[data-tt-profile-v2="1"] .perfil-body{padding:clamp(18px,3vw,26px)!important}
    body[data-tt-profile-v2="1"] .perfil-input{background:#fff!important;border-color:#e4d3da!important}
    @media(max-width:720px){
      .tt-profile-hero{align-items:flex-start;padding:16px}
      .tt-profile-hero-main{align-items:flex-start}
      .tt-profile-summary{grid-template-columns:1fr}
      .tt-profile-tabs{top:6px;border-radius:13px}
      .tt-profile-tab{padding:10px 12px}
    }
  `;
  document.head.appendChild(style);
}

function forceVisible(element) {
  if (!(element instanceof HTMLElement)) return;
  element.hidden = false;
  element.removeAttribute('hidden');
  element.style.removeProperty('display');
  element.style.removeProperty('max-height');
  element.style.removeProperty('opacity');
}

function stabilizeProduct() {
  document.body.dataset.ttProductStable = '1';
  const openAll = () => {
    const specsBlock = document.querySelector('.tt-specs-block');
    const specs = document.getElementById('product-specifications');
    const reviews = document.getElementById('product-reviews');
    const related = document.querySelector('.tt-related-section');
    if (specsBlock) specsBlock.dataset.collapsed = 'false';
    if (related) related.dataset.collapsed = 'false';
    [specs, reviews, related, document.getElementById('related-grid')].forEach(forceVisible);
    document.getElementById('specs-trigger')?.setAttribute('aria-expanded', 'true');
  };
  openAll();
  const observer = new MutationObserver(openAll);
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'data-collapsed', 'style'] });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });

  document.addEventListener('click', event => {
    const community = event.target.closest?.('[data-open-community]');
    if (!community) return;
    event.preventDefault();
    openAll();
    document.getElementById('product-reviews')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
}

function textOf(selector, fallback = '—') {
  const value = document.querySelector(selector)?.textContent?.trim();
  return value || fallback;
}

async function enhanceProfile() {
  if (!document.querySelector('.perfil-wrap') || document.body.dataset.ttProfileV2 === '1') return;
  document.body.dataset.ttProfileV2 = '1';

  const wrap = document.querySelector('.perfil-wrap');
  const back = wrap?.querySelector('.perfil-back');
  const identityCard = document.getElementById('perfil-nombre')?.closest('.perfil-card');
  const locationCard = document.getElementById('perfil-location-content')?.closest('.perfil-card');
  const accountCard = document.getElementById('perfil-metodo')?.closest('.perfil-card');
  const ordersCard = document.getElementById('perfil-orders-card');
  const favoritesCard = document.getElementById('perfil-favorites-card');
  const roleCard = document.getElementById('perfil-role-card');
  const helpCard = wrap?.querySelector('.perfil-wa-box')?.closest('.perfil-card');
  const quickCard = [...(wrap?.querySelectorAll('.perfil-card') || [])].find(card => card.querySelector('a[href="/catalogo"]') && card.querySelector('a[href="/checkout"]'));
  const accountActions = document.getElementById('btn-logout')?.closest('.perfil-card');
  if (!wrap || !identityCard || !back) return;

  const oldHeader = identityCard.querySelector('.perfil-header');
  const hero = document.createElement('section');
  hero.className = 'tt-profile-hero';
  hero.setAttribute('aria-label', 'Resumen de mi cuenta');
  const heroMain = document.createElement('div');
  heroMain.className = 'tt-profile-hero-main';
  if (oldHeader) {
    const avatar = oldHeader.querySelector('#perfil-avatar');
    const meta = oldHeader.querySelector('div:last-child');
    const avatarActions = document.createElement('div');
    avatarActions.className = 'tt-profile-avatar-actions';
    if (avatar) avatarActions.appendChild(avatar);
    const photoButton = document.createElement('button');
    photoButton.type = 'button';
    photoButton.className = 'tt-profile-photo-btn';
    photoButton.textContent = 'Cambiar foto';
    const photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/jpeg,image/png,image/webp';
    photoInput.hidden = true;
    photoInput.id = 'perfil-photo-input';
    avatarActions.append(photoButton, photoInput);
    if (meta) {
      meta.classList.add('tt-profile-meta');
      const extra = document.createElement('div');
      extra.className = 'tt-profile-meta-extra';
      extra.innerHTML = '<span>Cuenta Tintin</span><span aria-hidden="true">•</span><span>Perfil privado</span>';
      meta.appendChild(extra);
    }
    heroMain.append(avatarActions);
    if (meta) heroMain.append(meta);
    oldHeader.remove();

    photoButton.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 5 * 1024 * 1024) {
        window.alert('Elegí una imagen JPG, PNG o WEBP de hasta 5 MB.');
        photoInput.value = '';
        return;
      }
      photoButton.disabled = true;
      photoButton.textContent = 'Subiendo…';
      try {
        const [{ auth, db }, authApi, firestoreApi] = await Promise.all([
          import('../core/firebase/firebase.js?v=tintin-20260903-auth-persistence-1'),
          import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
          import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
        ]);
        if (typeof auth.authStateReady === 'function') await auth.authStateReady();
        const user = auth.currentUser;
        if (!user) throw new Error('Tu sesión ya no está disponible.');
        const token = await user.getIdToken(true);
        const signedResponse = await fetch('/api/profile-avatar-upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType: file.type, size: file.size }),
        });
        const signed = await signedResponse.json().catch(() => ({}));
        if (!signedResponse.ok || !signed.uploadUrl) throw new Error(signed.error || 'No se pudo preparar la subida.');
        const form = new FormData();
        form.append('file', file);
        form.append('api_key', signed.apiKey);
        form.append('timestamp', String(signed.timestamp));
        form.append('signature', signed.signature);
        form.append('public_id', signed.publicId);
        form.append('overwrite', 'true');
        const upload = await fetch(signed.uploadUrl, { method: 'POST', body: form });
        const uploaded = await upload.json().catch(() => ({}));
        if (!upload.ok || !uploaded.secure_url) throw new Error(uploaded.error?.message || 'No se pudo subir la foto.');
        const photoURL = String(uploaded.secure_url);
        await authApi.updateProfile(user, { photoURL });
        await firestoreApi.setDoc(firestoreApi.doc(db, 'users', user.uid), {
          photoURL,
          updatedAt: firestoreApi.serverTimestamp(),
        }, { merge: true });
        const avatar = document.getElementById('perfil-avatar');
        if (avatar) {
          avatar.textContent = '';
          const img = document.createElement('img');
          img.src = photoURL;
          img.alt = 'Foto de perfil';
          avatar.appendChild(img);
        }
        document.dispatchEvent(new CustomEvent('tintin:profile-photo-updated', { detail: { photoURL } }));
      } catch (error) {
        console.error('[Perfil] Foto:', error);
        window.alert(error?.message || 'No se pudo actualizar tu foto.');
      } finally {
        photoInput.value = '';
        photoButton.disabled = false;
        photoButton.textContent = 'Cambiar foto';
      }
    });
  }
  hero.appendChild(heroMain);
  back.insertAdjacentElement('afterend', hero);

  const tabs = document.createElement('nav');
  tabs.className = 'tt-profile-tabs';
  tabs.setAttribute('aria-label', 'Secciones de mi perfil');
  hero.insertAdjacentElement('afterend', tabs);

  const host = document.createElement('div');
  host.className = 'tt-profile-panels';
  tabs.insertAdjacentElement('afterend', host);

  const definitions = [
    { id: 'resumen', label: 'Resumen', nodes: [] },
    { id: 'datos', label: 'Mis datos', nodes: [identityCard, locationCard] },
    { id: 'pedidos', label: 'Pedidos', nodes: [ordersCard] },
    { id: 'favoritos', label: 'Favoritos', nodes: [favoritesCard] },
    { id: 'cuenta', label: 'Cuenta y seguridad', nodes: [accountCard, roleCard, accountActions] },
    { id: 'ayuda', label: 'Ayuda', nodes: [helpCard, quickCard] },
  ];

  const summary = document.createElement('section');
  summary.className = 'tt-profile-summary';
  summary.innerHTML = `
    <div class="tt-profile-summary-card"><span>Pedidos</span><strong data-profile-summary-orders>0</strong></div>
    <div class="tt-profile-summary-card"><span>Total comprado</span><strong data-profile-summary-spent>Gs. 0</strong></div>
    <div class="tt-profile-summary-card"><span>Ubicación</span><strong data-profile-summary-location>Sin ubicación guardada</strong></div>`;

  const panels = new Map();
  definitions.forEach((definition, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tt-profile-tab';
    button.dataset.profileTab = definition.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    button.textContent = definition.label;
    if (definition.id === 'pedidos') {
      const badge = document.createElement('span');
      badge.className = 'tt-profile-tab-badge';
      badge.dataset.profileOrdersBadge = '1';
      badge.hidden = true;
      button.appendChild(badge);
    }
    tabs.appendChild(button);

    const panel = document.createElement('section');
    panel.className = 'tt-profile-panel';
    panel.dataset.profilePanel = definition.id;
    panel.setAttribute('role', 'tabpanel');
    panel.hidden = index !== 0;
    if (definition.id === 'resumen') panel.appendChild(summary);
    definition.nodes.filter(Boolean).forEach(node => panel.appendChild(node));
    host.appendChild(panel);
    panels.set(definition.id, panel);
  });

  function activate(id) {
    panels.forEach((panel, key) => { panel.hidden = key !== id; });
    tabs.querySelectorAll('[data-profile-tab]').forEach(button => button.setAttribute('aria-selected', button.dataset.profileTab === id ? 'true' : 'false'));
    history.replaceState(null, '', id === 'resumen' ? '/perfil' : `/perfil#${id}`);
  }
  tabs.addEventListener('click', event => {
    const button = event.target.closest?.('[data-profile-tab]');
    if (button) activate(button.dataset.profileTab);
  });

  function updateSummary() {
    const count = Math.max(0, Number(document.getElementById('perfil-purchase-count')?.textContent?.replace(/\D/g, '') || 0));
    const spent = textOf('#perfil-total-spent', 'Gs. 0');
    const location = document.getElementById('perfil-location-content')?.textContent?.replace(/\s+/g, ' ').trim() || 'Sin ubicación guardada';
    const countNode = document.querySelector('[data-profile-summary-orders]');
    const spentNode = document.querySelector('[data-profile-summary-spent]');
    const locationNode = document.querySelector('[data-profile-summary-location]');
    if (countNode) countNode.textContent = String(count);
    if (spentNode) spentNode.textContent = spent;
    if (locationNode) locationNode.textContent = location.slice(0, 90);
  }
  const summaryObserver = new MutationObserver(updateSummary);
  [document.getElementById('perfil-purchase-count'), document.getElementById('perfil-total-spent'), document.getElementById('perfil-location-content'), document.getElementById('perfil-orders-list')]
    .filter(Boolean).forEach(node => summaryObserver.observe(node, { childList: true, subtree: true, characterData: true }));
  updateSummary();
  window.addEventListener('pagehide', () => summaryObserver.disconnect(), { once: true });

  await import('../pages/profile/estado-pedidos-perfil.js?v=tintin-20260829-final-stability-1');
  const initial = location.hash.replace('#', '');
  if (panels.has(initial)) activate(initial);
}

function boot() {
  injectStyles();
  if (path === '/product' || path === '/product.html') stabilizeProduct();
  if (path === '/perfil' || path === '/perfil.html') void enhanceProfile();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

window.TintinFinalPublicStability = Object.freeze({ version: VERSION });