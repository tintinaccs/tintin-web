/* =============================================================
   TINTIN — Fase 5: imágenes públicas sincronizadas

   settings/images controla únicamente imágenes globales/editoriales.
   Las imágenes de productos viven en products/{id}.imageUrl y las portadas
   de colecciones en collections/{slug}.image.
   ============================================================= */

import { onImagesUpdate, resolveSlotImage } from './images.js';
import { createSafeImage, sanitizeImageUrl } from './image-utils.js';

if (!window.TintinImagesPhase5Booted) {
  window.TintinImagesPhase5Booted = true;

  const STATIC = Object.freeze({
    logo: 'assets-tintin/images/general/logo.png',
    placeholder: 'assets-tintin/images/general/placeholder-section.webp',
    hero: {
      desktop: 'assets-tintin/images/home/hero-banner/hero-banner-desktop.webp',
      tablet: 'assets-tintin/images/home/hero-banner/hero-banner-tablet.webp',
      mobile: 'assets-tintin/images/home/hero-banner/hero-banner-mobile.webp',
    },
    edit_bolsos: {
      desktop: 'assets-tintin/images/home/editorial-bolsos/editorial-bolsos-desktop.webp',
      tablet: 'assets-tintin/images/home/editorial-bolsos/editorial-bolsos-tablet.webp',
      mobile: 'assets-tintin/images/home/editorial-bolsos/editorial-bolsos-mobile.webp',
      alt: 'Colección Bags Tintin',
    },
    edit_relojes: {
      desktop: 'assets-tintin/images/home/editorial-relojes/editorial-relojes-desktop.webp',
      tablet: 'assets-tintin/images/home/editorial-relojes/editorial-relojes-tablet.webp',
      mobile: 'assets-tintin/images/home/editorial-relojes/editorial-relojes-mobile.webp',
      alt: 'Nueva colección de relojes Tintin',
    },
    about_foto: {
      desktop: 'assets-tintin/images/nosotros/foto-principal/foto-principal-desktop.webp',
      tablet: 'assets-tintin/images/nosotros/foto-principal/foto-principal-tablet.webp',
      mobile: 'assets-tintin/images/nosotros/foto-principal/foto-principal-mobile.webp',
      alt: 'Tintin Accesorios y Relojes',
    },
  });

  let images = {};
  let observer = null;
  let scheduled = false;

  function absolute(value) {
    return sanitizeImageUrl(value);
  }

  function mark(node) {
    node.dataset.ttImagePhase5 = '1';
    return node;
  }

  // Cascada por dispositivo (custom desktop/tablet/mobile con reutilización
  // automática, resuelta por resolveSlotImage) y solo al final el respaldo
  // estático empaquetado — así una sola imagen cargada en desktop ya se ve
  // en tablet/mobile sin que la sección quede nunca vacía.
  function resolvedSlotUrls(slotId, fallback) {
    return {
      desktop: resolveSlotImage(images, slotId, 'desktop') || absolute(fallback.desktop),
      tablet: resolveSlotImage(images, slotId, 'tablet') || absolute(fallback.tablet),
      mobile: resolveSlotImage(images, slotId, 'mobile') || absolute(fallback.mobile),
    };
  }

  function buildResponsivePicture(slotId, fallback) {
    const urls = resolvedSlotUrls(slotId, fallback);
    const picture = mark(document.createElement('picture'));
    const mobile = document.createElement('source');
    const tablet = document.createElement('source');
    const image = createSafeImage({
      src: urls.desktop,
      fallbackUrls: [absolute(fallback.desktop), STATIC.placeholder],
      alt: fallback.alt,
      fit: 'cover',
      marker: 'ttImagePhase5',
    });

    // Sin `type`: el formato real depende de lo que el navegador de quien
    // subió la imagen pudo codificar (WebP o el original), no siempre WebP.
    mobile.media = '(max-width: 767px)';
    mobile.srcset = urls.mobile;
    tablet.media = '(max-width: 1023px)';
    tablet.srcset = urls.tablet;

    image.style.width = '100%';
    image.style.height = '100%';
    image.style.display = 'block';
    picture.style.width = '100%';
    picture.style.height = '100%';
    picture.style.display = 'block';
    picture.append(mobile, tablet, image);
    return picture;
  }

  function slotSignature(slotId, urls) {
    return `${slotId}:${urls.desktop}|${urls.tablet}|${urls.mobile}`;
  }

  function slotIsCurrent(target, signature) {
    return target.dataset.ttImagePhase5Signature === signature &&
      Boolean(target.querySelector(':scope > [data-tt-image-phase5="1"]'));
  }

  function applyContentSlot(target) {
    const slotId = target.dataset.imgSlot;
    const fallback = STATIC[slotId];
    if (!fallback) return;

    const urls = resolvedSlotUrls(slotId, fallback);
    const signature = slotSignature(slotId, urls);
    if (slotIsCurrent(target, signature)) return;

    target.replaceChildren(buildResponsivePicture(slotId, fallback));
    target.dataset.ttImagePhase5Signature = signature;
  }

  function heroDisplay(size) {
    const value = String(size || 'cover');
    if (value === 'contain') return { fit: 'contain', scale: '1' };
    if (value === 'auto') return { fit: 'none', scale: '1' };
    if (/^(?:80|60|50|40)%$/.test(value)) {
      return { fit: 'contain', scale: String(Number(value.slice(0, -1)) / 100) };
    }
    return { fit: 'cover', scale: '1' };
  }

  function ensureHeroStyle() {
    if (document.getElementById('tt-images-phase5-style')) return;
    const style = document.createElement('style');
    style.id = 'tt-images-phase5-style';
    style.textContent = `
      #tt-hero-img{
        object-fit:var(--tt-hero-fit-desktop,cover)!important;
        object-position:var(--tt-hero-pos-desktop,center center)!important;
        transform:scale(var(--tt-hero-scale-desktop,1));
        transform-origin:var(--tt-hero-pos-desktop,center center);
      }
      @media(max-width:1023px){#tt-hero-img{
        object-fit:var(--tt-hero-fit-tablet,cover)!important;
        object-position:var(--tt-hero-pos-tablet,center center)!important;
        transform:scale(var(--tt-hero-scale-tablet,1));
        transform-origin:var(--tt-hero-pos-tablet,center center);
      }}
      @media(max-width:767px){#tt-hero-img{
        object-fit:var(--tt-hero-fit-mobile,cover)!important;
        object-position:var(--tt-hero-pos-mobile,center center)!important;
        transform:scale(var(--tt-hero-scale-mobile,1));
        transform-origin:var(--tt-hero-pos-mobile,center center);
      }}
    `;
    document.head.appendChild(style);
  }

  function applyHero() {
    const image = document.getElementById('tt-hero-img');
    const picture = image?.closest('picture');
    if (!image || !picture) return;

    ensureHeroStyle();
    const desktop = resolveSlotImage(images, 'hero_bg', 'desktop') || absolute(STATIC.hero.desktop);
    const tablet = resolveSlotImage(images, 'hero_bg', 'tablet') || absolute(STATIC.hero.tablet);
    const mobile = resolveSlotImage(images, 'hero_bg', 'mobile') || absolute(STATIC.hero.mobile);
    const signature = [desktop, tablet, mobile,
      images.hero_bg_desktop_size, images.hero_bg_desktop_pos,
      images.hero_bg_tablet_size, images.hero_bg_tablet_pos,
      images.hero_bg_mobile_size, images.hero_bg_mobile_pos,
    ].join('|');

    if (image.dataset.ttHeroPhase5Signature === signature) return;

    let mobileSource = picture.querySelector('source[media*="767"]');
    let tabletSource = picture.querySelector('source[media*="1023"]');
    if (!mobileSource) {
      mobileSource = document.createElement('source');
      mobileSource.media = '(max-width: 767px)';
      picture.insertBefore(mobileSource, picture.firstChild);
    }
    if (!tabletSource) {
      tabletSource = document.createElement('source');
      tabletSource.media = '(max-width: 1023px)';
      picture.insertBefore(tabletSource, image);
    }
    mobileSource.srcset = mobile;
    tabletSource.srcset = tablet;
    image.src = desktop;

    ['desktop', 'tablet', 'mobile'].forEach(device => {
      const display = heroDisplay(images[`hero_bg_${device}_size`]);
      const position = String(images[`hero_bg_${device}_pos`] || 'center center');
      image.style.setProperty(`--tt-hero-fit-${device}`, display.fit);
      image.style.setProperty(`--tt-hero-scale-${device}`, display.scale);
      image.style.setProperty(`--tt-hero-pos-${device}`, position);
    });

    image.dataset.ttHeroPhase5Signature = signature;
    image.dataset.ttImagePhase5 = '1';
  }

  function currentDevice() {
    if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
    if (window.matchMedia('(max-width: 1023px)').matches) return 'tablet';
    return 'desktop';
  }

  function applyLogos() {
    const src = resolveSlotImage(images, 'logo_main', currentDevice()) || absolute(STATIC.logo);
    document.querySelectorAll('.tt-logo-img,#tt-loader-logo,#tt-intro-logo').forEach(image => {
      if (!(image instanceof HTMLImageElement)) return;
      if (image.dataset.ttLogoPhase5Src === src && image.src === src) return;

      image.dataset.ttLogoPhase5Src = src;
      image.dataset.ttImagePhase5 = '1';
      image.src = src;
      if (!image.dataset.ttLogoPhase5ErrorBound) {
        image.dataset.ttLogoPhase5ErrorBound = '1';
        image.addEventListener('error', () => {
          const fallback = absolute(STATIC.logo);
          if (image.src !== fallback) image.src = fallback;
          else image.style.display = 'none';
        });
      }
      image.style.removeProperty('display');
    });
  }

  function applyAll() {
    scheduled = false;
    applyHero();
    applyLogos();
    document.querySelectorAll('[data-img-slot]').forEach(applyContentSlot);
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyAll);
  }

  function bootDomObserver() {
    applyAll();
    if (observer || !document.body) return;
    observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDomObserver, { once: true });
  } else {
    bootDomObserver();
  }

  // El logo puede tener una imagen distinta por dispositivo (igual que el
  // resto de los slots); a diferencia del hero/editorial (que usan <picture>
  // con <source media>, resueltos por el propio navegador sin JS), el logo
  // es un <img> simple reutilizado en header/loader/intro, así que su
  // dispositivo activo se vuelve a resolver al cruzar un breakpoint.
  ['(max-width: 767px)', '(max-width: 1023px)'].forEach(query => {
    const mql = window.matchMedia(query);
    const listener = () => applyLogos();
    if (mql.addEventListener) mql.addEventListener('change', listener);
    else if (mql.addListener) mql.addListener(listener);
  });

  onImagesUpdate(
    nextImages => {
      images = nextImages || {};
      scheduleApply();
      window.dispatchEvent(new CustomEvent('tintin:images-phase5-ready', {
        detail: { configured: Object.keys(images).filter(key => !key.endsWith('_size') && !key.endsWith('_pos')).length }
      }));
    },
    error => {
      console.warn('[images-phase5] No se pudo actualizar desde Firestore:', error);
      scheduleApply();
      window.dispatchEvent(new CustomEvent('tintin:images-phase5-error', {
        detail: { error }
      }));
    }
  );
}
