/* =============================================================
   TINTIN — Fase 5: imágenes públicas sincronizadas

   settings/images controla únicamente imágenes globales/editoriales.
   Las imágenes de productos viven en products/{id}.imageUrl y las portadas
   de colecciones en collections/{slug}.image.
   ============================================================= */

import { onImagesUpdate, resolveSlotImage } from './imagenes.js?v=tintin-20260716-cloudinary-fix-1';
import { createSafeImage, sanitizeImageUrl } from './utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1';

if (!window.TintinImagesPhase5Booted) {
  window.TintinImagesPhase5Booted = true;

  const debugImageFlow = (...args) => {
    try {
      if (localStorage.getItem('tt_debug_images') === '1') console.debug(...args);
    } catch {}
  };

  const STATIC = Object.freeze({
    logo: 'assets-tintin/images/general/logo.png',
    placeholder: 'assets-tintin/images/general/placeholder-section.webp',
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
    // Última portada publicada: se muestra desde el primer parseo mientras
    // Firestore resuelve la configuración y luego se reemplaza si cambió.
    hero_bg_desktop: 'https://res.cloudinary.com/qnputaic/image/upload/f_auto,q_auto/v1784309046/tintin_media_6ea5859c12554fa9b576a84de5ec53c1_full.webp',
    hero_bg_tablet: 'https://res.cloudinary.com/qnputaic/image/upload/f_auto,q_auto/v1784315346/tintin_media_9cef2bfbeb1149cd908fc7b1ed81ea1a_full.webp',
    hero_bg_mobile: 'https://res.cloudinary.com/qnputaic/image/upload/f_auto,q_auto/v1784313313/tintin_media_d4980e04509c435681c1bb5e23dcbfc9_full.webp',
  });

  let images = {};
  let observer = null;
  let scheduled = false;
  // onImagesUpdate entrega el caché local en la primera llamada (síncrona,
  // puede estar vacío o desactualizado) y recién en la segunda llamada en
  // adelante entrega el snapshot real de Firestore. El hero se mantiene
  // el HTML ya trae la última portada publicada y no se oculta mientras llega
  // la confirmación; la segunda llamada solo puede reemplazarla de forma segura.
  let heroDataConfirmed = false;

  function revealHero() {
    const media = document.getElementById('tt-hero-media');
    if (media) media.classList.remove('tt-hero-pending');
  }

  // Revelar apenas Firestore confirma la URL no alcanza: la foto todavía
  // puede estar descargándose, y mientras tanto se ve el fondo de
  // .tt-hero-media (un parpadeo de color antes de la imagen real). Por eso
  // se espera también a que el <img> termine de cargar (o falle, para no
  // quedar colgado) antes de sacar .tt-hero-pending — así la transición es
  // directa al contenido final, nunca pasa por el fondo a la vista.
  function revealHeroWhenImageReady(image) {
    const picture = image.closest('picture');
    const activeSource = Array.from(picture?.querySelectorAll('source[srcset]') || [])
      .find(source => !source.media || window.matchMedia(source.media).matches);
    const requestedSrc = image.currentSrc || activeSource?.srcset || image.getAttribute('src');
    if (!requestedSrc) return;
    if (image.complete && image.naturalWidth > 0) {
      revealHero();
      return;
    }
    if (image.complete) return;
    if (image.dataset.ttHeroRevealBoundSrc === requestedSrc) return;
    image.dataset.ttHeroRevealBoundSrc = requestedSrc;

    const cleanup = () => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      delete image.dataset.ttHeroRevealBoundSrc;
    };
    const onLoad = () => {
      cleanup();
      revealHero();
    };
    const onError = () => {
      cleanup();
      // La ruta de respaldo del listener principal conserva una portada válida;
      // no reactivar el estado pendiente, porque eso volvería a mostrar el
      // fondo rosa durante un fallo transitorio de red.
      revealHero();
    };
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
  }

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
    // Igual que el hero: la primera entrega de onImagesUpdate es el caché
    // local (puede estar vacío o desactualizado). Insertar la imagen ya en esa
    // primera pasada mostraría el respaldo empaquetado y lo reemplazaría por
    // la imagen real configurada en Super Admin apenas confirme Firestore —
    // un parpadeo de "fondo ya establecido" seguido del fondo real. Se espera
    // a heroDataConfirmed para pintar una sola vez, directo al contenido final.
    if (!heroDataConfirmed) return;

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
      @media(max-width:1120px){#tt-hero-img{
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
    const media = document.getElementById('tt-hero-media');
    if (!image || !picture) return;

    ensureHeroStyle();
    // La primera entrega puede ser el caché local. El HTML ya trae una portada
    // publicada para evitar el frame rosa; Firestore la reemplaza si cambió.
    if (!heroDataConfirmed) {
      // El HTML ya trae la última portada válida; no la ocultamos mientras
      // llega Firestore para evitar un frame rosa entre loader y hero.
      revealHeroWhenImageReady(image);
      return;
    }
    // Cloudinary (subido desde Super Admin → Imágenes) es la fuente dinámica.
    // Si Firestore no tiene una URL o tarda en responder, se conserva la última
    // portada publicada embebida en HTML para que el primer paint sea inmediato.
    const desktop = resolveSlotImage(images, 'hero_bg', 'desktop') || absolute(STATIC.hero_bg_desktop);
    const tablet = resolveSlotImage(images, 'hero_bg', 'tablet') || absolute(STATIC.hero_bg_tablet);
    const mobile = resolveSlotImage(images, 'hero_bg', 'mobile') || absolute(STATIC.hero_bg_mobile);
    const signature = [desktop, tablet, mobile,
      images.hero_bg_desktop_size, images.hero_bg_desktop_pos,
      images.hero_bg_tablet_size, images.hero_bg_tablet_pos,
      images.hero_bg_mobile_size, images.hero_bg_mobile_pos,
    ].join('|');

    if (image.dataset.ttHeroPhase5Signature === signature) {
      debugImageFlow('[images-phase5] applyHero: sin cambios (misma firma), no se toca el DOM', { desktop, tablet, mobile });
      revealHeroWhenImageReady(image);
      return;
    }
    debugImageFlow('[images-phase5] applyHero: aplicando URLs nuevas', { desktop, tablet, mobile });

    let mobileSource = picture.querySelector('source[media*="767"]');
    let tabletSource = picture.querySelector('source[data-tt-hero-device="tablet"],source[media*="1023"],source[media*="1120"]');
    if (!mobileSource) {
      mobileSource = document.createElement('source');
      mobileSource.media = '(max-width: 767px)';
      mobileSource.dataset.ttHeroDevice = 'mobile';
      picture.insertBefore(mobileSource, picture.firstChild);
    }
    if (!tabletSource) {
      tabletSource = document.createElement('source');
      tabletSource.dataset.ttHeroDevice = 'tablet';
      picture.insertBefore(tabletSource, image);
    }
    tabletSource.media = '(max-width: 1120px)';
    const yaVisible = image.currentSrc && image.complete && image.naturalWidth > 0;
    const cambiaFuente = yaVisible && desktop && image.currentSrc !== desktop;

    const aplicarFuentes = () => {
      if (mobile) mobileSource.srcset = mobile; else mobileSource.removeAttribute('srcset');
      if (tablet) tabletSource.srcset = tablet; else tabletSource.removeAttribute('srcset');
      if (desktop) image.src = desktop; else image.removeAttribute('src');
    };

    if (cambiaFuente) {
      // El caché local pinta una imagen antes de que llegue la de Firestore.
      // Si difieren, cambiar el src en el acto muestra el salto. Se decodifica
      // la nueva fuera de pantalla y recien ahi se cambia, con un cruce corto.
      const previa = new Image();
      previa.decoding = 'async';
      previa.src = desktop;
      const cambiar = () => {
        image.style.transition = 'opacity 180ms ease';
        image.style.opacity = '0';
        window.setTimeout(() => {
          aplicarFuentes();
          requestAnimationFrame(() => { image.style.opacity = '1'; });
        }, 180);
      };
      if (previa.decode) previa.decode().then(cambiar).catch(cambiar);
      else { previa.onload = cambiar; previa.onerror = cambiar; }
    } else {
      aplicarFuentes();
    }

    if (!image.dataset.ttHeroPhase5ErrorBound) {
      image.dataset.ttHeroPhase5ErrorBound = '1';
      image.addEventListener('error', () => {
        // Si una URL dinámica falla, conserva la última portada válida en vez
        // de desmontar la imagen y revelar el fondo rosa.
        mobileSource.srcset = absolute(STATIC.hero_bg_mobile);
        tabletSource.srcset = absolute(STATIC.hero_bg_tablet);
        image.src = absolute(STATIC.hero_bg_desktop);
        media?.classList.remove('tt-hero-pending');
      });
    }

    ['desktop', 'tablet', 'mobile'].forEach(device => {
      const display = heroDisplay(images[`hero_bg_${device}_size`]);
      const position = String(images[`hero_bg_${device}_pos`] || 'center center');
      image.style.setProperty(`--tt-hero-fit-${device}`, display.fit);
      image.style.setProperty(`--tt-hero-scale-${device}`, display.scale);
      image.style.setProperty(`--tt-hero-pos-${device}`, position);
    });

    image.dataset.ttHeroPhase5Signature = signature;
    image.dataset.ttImagePhase5 = '1';
    revealHeroWhenImageReady(image);
  }

  function currentDevice() {
    if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
    if (window.matchMedia('(max-width: 1120px)').matches) return 'tablet';
    return 'desktop';
  }

  function applyLogos() {
    const src = resolveSlotImage(images, 'logo_main', currentDevice()) || absolute(STATIC.logo);
    document.querySelectorAll('.tt-logo-img,#tt-loader-logo,#tt-intro-logo').forEach(image => {
      if (!(image instanceof HTMLImageElement)) return;
      if (image.dataset.ttLogoPhase5Src === src && image.src === src) return;

      image.dataset.ttLogoPhase5Src = src;
      image.dataset.ttImagePhase5 = '1';
      // Cambiar el src de un <img> ya cargado lo deja en blanco hasta que baja
      // el nuevo: en el logo del loader eso se ve como un parpadeo. Se
      // decodifica primero y recien ahi se cambia.
      const enPantalla = image.currentSrc && image.complete && image.naturalWidth > 0;
      if (enPantalla && image.currentSrc !== src) {
        const previa = new Image();
        previa.decoding = 'async';
        previa.src = src;
        const cambiar = () => { image.src = src; };
        if (previa.decode) previa.decode().then(cambiar).catch(cambiar);
        else { previa.onload = cambiar; previa.onerror = cambiar; }
      } else {
        image.src = src;
      }
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

  let imagesUpdateCount = 0;
  onImagesUpdate(
    nextImages => {
      images = nextImages || {};
      imagesUpdateCount += 1;
      // La primera llamada es el caché local (posiblemente vacío o viejo); de
      // la segunda en adelante ya es el snapshot real de Firestore.
      if (imagesUpdateCount >= 2) heroDataConfirmed = true;
      debugImageFlow('[images-phase5] onImagesUpdate: datos recibidos de Firestore', {
        hero_bg_desktop: images.hero_bg_desktop || null,
        hero_bg_tablet: images.hero_bg_tablet || null,
        hero_bg_mobile: images.hero_bg_mobile || null,
      });
      scheduleApply();
      window.dispatchEvent(new CustomEvent('tintin:images-phase5-ready', {
        detail: { configured: Object.keys(images).filter(key => !key.endsWith('_size') && !key.endsWith('_pos')).length }
      }));
    },
    error => {
      // Un error de red no debe desmontar la portada ya visible: se conserva
      // el último banner publicado y se deja que el siguiente intento actualice.
      heroDataConfirmed = false;
      document.getElementById('tt-hero-media')?.classList.remove('tt-hero-pending');
      const heroImage = document.getElementById('tt-hero-img');
      if (heroImage) revealHeroWhenImageReady(heroImage);
      console.warn('[images-phase5] No se pudo actualizar desde Firestore:', error);
      scheduleApply();
      window.dispatchEvent(new CustomEvent('tintin:images-phase5-error', {
        detail: { error }
      }));
    }
  );
}
