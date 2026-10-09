/* TINTIN — Estabilidad final de superficies públicas.
 * No crea autoridades paralelas: solo fortalece las superficies ya renderizadas
 * por Producto, Perfil y el shell modular de navegación. */

const VERSION = 'tintin-20260829-final-stability-1-brand-runtime-20261004-1';
const path = window.location.pathname.replace(/\/+$/, '') || '/';

function injectStyles() {
  if (document.getElementById('tt-final-stability-styles')) return;
  const style = document.createElement('style');
  style.id = 'tt-final-stability-styles';
  style.textContent = `
    /* Header mobile: una sola jerarquía visual, sin capas compitiendo. */
    @media (max-width:767px){
      #tt-tabbar{isolation:isolate!important}
      #tt-tabbar .tt-mobile-nav-halo{z-index:0!important;box-shadow:0 6px 16px rgba(139,38,66,.10)!important}
      #tt-tabbar .tt-mobile-nav-indicator{z-index:1!important;bottom:4px!important}
      #tt-tabbar .tt-tabbar-btn{position:relative!important;z-index:2!important}
      #tt-tabbar .tt-tabbar-btn.active,#tt-tabbar .tt-tabbar-btn[aria-expanded="true"]{z-index:3!important}
      #tt-tabbar .tt-tabbar-btn.active svg,#tt-tabbar .tt-tabbar-btn.active .tt-tabbar-avatar,
      #tt-tabbar .tt-tabbar-btn[aria-expanded="true"] svg,#tt-tabbar .tt-tabbar-btn[aria-expanded="true"] .tt-tabbar-avatar{
        transform:scale(1.06)!important
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
  if (!document.querySelector('.perfil-wrap') || document.body.dataset.ttProfileBound === '1') return;
  document.body.dataset.ttProfileBound = '1';

  const wrap = document.querySelector('.perfil-wrap');
  const hero = wrap.querySelector('.tt-profile-hero');
  const tabs = wrap.querySelector('.tt-profile-tabs');
  const photoButton = wrap.querySelector('.tt-profile-photo-btn');
  const photoInput = document.getElementById('perfil-photo-input');
  if (!hero || !tabs) return;
  if (photoButton && photoInput) {
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
        const [{ db }, authApi, firestoreApi, sessionApi] = await Promise.all([
          import('../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1'),
          import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
          import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
          import('../core/auth/coordinador-sesion.js?v=tintin-20261009-first-render-1'),
        ]);
        const snapshot = await sessionApi.waitForSession();
        if (snapshot.status === sessionApi.AUTH_STATES.UNKNOWN) throw new Error('No pudimos verificar tu sesión. Volvé a intentar en unos segundos.');
        const user = snapshot.user;
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
        form.append('allowed_formats', signed.allowedFormats);
        form.append('overwrite', 'true');
        const upload = await fetch(signed.uploadUrl, { method: 'POST', body: form });
        const uploaded = await upload.json().catch(() => ({}));
        if (!upload.ok || !uploaded.secure_url) throw new Error(uploaded.error?.message || 'No se pudo subir la foto.');
        const photoURL = String(uploaded.secure_url);
        await authApi.updateProfile(user, { photoURL });
        await firestoreApi.setDoc(firestoreApi.doc(db, 'users', user.uid), {
          avatarURL: photoURL,
          // Se conserva por compatibilidad de paneles antiguos. Las pantallas
          // nuevas priorizan avatarURL sólo cuando fue una elección explícita.
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
  const panels = new Map([...wrap.querySelectorAll('[data-profile-panel]')]
    .map(panel => [panel.dataset.profilePanel, panel]));
  const requestedPanel = location.hash.replace('#', '');
  const initialPanel = panels.has(requestedPanel) ? requestedPanel : 'datos';

  function activate(id) {
    panels.forEach((panel, key) => { panel.hidden = key !== id; });
    tabs.querySelectorAll('[data-profile-tab]').forEach(button => button.setAttribute('aria-selected', button.dataset.profileTab === id ? 'true' : 'false'));
    history.replaceState(null, '', id === 'resumen' ? '/perfil' : `/perfil#${id}`);
  }
  tabs.addEventListener('click', event => {
    const button = event.target.closest?.('[data-profile-tab]');
    if (button) activate(button.dataset.profileTab);
  });

  window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(panels.has(id))activate(id);});

  function updateSummary() {
    const countText = document.getElementById('perfil-purchase-count')?.textContent?.trim() || '—';
    const count = /^\d+$/.test(countText) ? String(Number(countText)) : '—';
    const spent = textOf('#perfil-total-spent', '—');
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

  void import('../pages/profile/estado-pedidos-perfil.js?v=tintin-20261009-first-render-1')
    .catch(error => console.warn('[Perfil] Pedidos pendientes:', error?.code || error?.message));
  activate(initialPanel);
}

function boot() {
  injectStyles();
  if (path === '/product' || path === '/product.html') stabilizeProduct();
  if (path === '/perfil' || path === '/perfil.html') void enhanceProfile();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

window.TintinFinalPublicStability = Object.freeze({ version: VERSION });
