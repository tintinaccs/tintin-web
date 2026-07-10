/**
 * TINTIN — Site Content Sync
 * Reads text saved from Super Admin → Contenido (site_content/{pageId} in Firestore)
 * and applies it live to the public page. Real-time via onSnapshot: edits in
 * Super Admin show up on the public site immediately, no reload needed.
 */
import { db } from './firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function withBreaks(text) {
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean).join('<br>');
}

function setText(el, value) {
  if (el && value) el.textContent = value;
}

function setHtml(el, value) {
  if (el && value) el.innerHTML = withBreaks(value);
}

function applyIndex(data) {
  const hero = data.hero || {};
  setText(document.querySelector('.tt-hero-eyebrow'), hero.eyebrow || 'Bienvenidas a TINTIN');
  setHtml(document.querySelector('.tt-hero-title'), hero.title);
  setText(document.querySelector('.tt-hero-subtitle'), hero.subtitle);
  const heroLinks = document.querySelectorAll('.tt-hero-actions a');
  if (heroLinks[1]) {
    setText(heroLinks[1], hero.btnText);
    if (hero.btnHref) heroLinks[1].setAttribute('href', hero.btnHref);
  }

  const trust = data.trust || {};
  const trustBar = document.querySelector('.tt-trust-bar');
  if (trustBar) trustBar.style.display = trust.visible === false ? 'none' : '';
  const trustItems = Array.isArray(trust.items) ? trust.items : null;
  if (trustItems) {
    document.querySelectorAll('.tt-trust-item').forEach((el, i) => {
      const item = trustItems[i];
      if (!item) return;
      setText(el.querySelector('.tt-trust-title'), item.label);
      setText(el.querySelector('.tt-trust-desc'), item.desc);
    });
  }

  const bag = data.editorial_bag || {};
  const bagSection = document.querySelector('.tt-editorial-content');
  if (bagSection) {
    const bagWrap = bagSection.closest('.tt-editorial');
    if (bagWrap) bagWrap.closest('section').style.display = bag.visible === false ? 'none' : '';
    setHtml(bagSection.querySelector('.tt-editorial-title'), bag.title);
    setText(bagSection.querySelector('.tt-editorial-eyebrow'), bag.eyebrow);
    setText(bagSection.querySelector('.tt-editorial-desc'), bag.body);
    const btn = bagSection.querySelector('a.tt-btn');
    if (btn) {
      setText(btn, bag.btnText);
      if (bag.btnHref) btn.setAttribute('href', bag.btnHref);
    }
  }

  const watches = data.editorial_relojes || {};
  const watchSection = document.querySelector('.tt-watch-feature-content');
  if (watchSection) {
    const watchWrap = watchSection.closest('.tt-watch-feature');
    if (watchWrap) watchWrap.closest('section').style.display = watches.visible === false ? 'none' : '';
    setHtml(watchSection.querySelector('.tt-watch-title'), watches.title);
    setText(watchSection.querySelector('.tt-watch-eyebrow'), watches.eyebrow);
    setText(watchSection.querySelector('.tt-watch-desc'), watches.body);
    const btn = watchSection.querySelector('a.tt-btn');
    if (btn) {
      setText(btn, watches.btnText);
      if (watches.btnHref) btn.setAttribute('href', watches.btnHref);
    }
  }

  const footer = data.footer || {};
  setText(document.querySelector('.tt-footer-bottom'), footer.copy);
  setText(document.querySelector('.tt-footer-wa-text'), footer.waText);
  // El número de WhatsApp ya NO se maneja acá — única fuente:
  // settings/general.whatsappNumber (ver js/whatsapp.js), no más
  // site_content/index.footer.waHref. El logo del footer tampoco: es texto
  // (wordmark), no imagen — a propósito, distinto del logo del header.
}

function applyNosotros(data) {
  // Real content lives on about.html — nosotros.html is a redirect stub
  const hero = data.hero || {};
  setHtml(document.querySelector('.tt-page-hero-title'), hero.title);
  setText(document.querySelector('.tt-page-hero-sub'), hero.desc);

  const historia = data.historia || {};
  setText(document.querySelector('.tt-about-subtitle'), historia.eyebrow);
  setText(document.querySelector('.tt-about-greeting'), historia.title);
}

function applyCatalogo(data) {
  // Only override the generic header — a selected ?cat= filter sets its own title/label
  if (new URLSearchParams(location.search).get('cat')) return;
  const header = data.header || {};
  setText(document.getElementById('cat-titulo'), header.title);
  setText(document.getElementById('cat-subtitulo'), header.desc || header.eyebrow);
}

/** Shared by pages whose only editable content is the .tt-page-hero title/subtitle */
function applyGenericPageHero(data) {
  const header = data.header || {};
  setHtml(document.querySelector('.tt-page-hero-title'), header.title);
  setText(document.querySelector('.tt-page-hero-sub'), header.desc);
}

const PAGE_APPLIERS = {
  index: applyIndex,
  nosotros: applyNosotros,
  catalogo: applyCatalogo,
  contact: applyGenericPageHero,
  faq: applyGenericPageHero,
  cambios: applyGenericPageHero,
  envios: applyGenericPageHero,
  collections: applyGenericPageHero,
};

export function initSiteContent(pageId) {
  const applier = PAGE_APPLIERS[pageId];
  if (!applier) return;
  onSnapshot(doc(db, 'site_content', pageId), snap => {
    if (!snap.exists()) return;
    try { applier(snap.data() || {}); } catch (e) { console.warn('[site-content] apply failed:', e); }
  }, e => console.warn('[site-content] listener failed:', e));
}
