import { onCollectionsUpdate } from '../collections/estado-colecciones.js?v=tintin-20261015-rendimiento-actions-1';

const IMAGE_BASE = '/assets-tintin/images/collections/';
const PLACEHOLDER = `${IMAGE_BASE}col-placeholder.webp`;
const SLUG_FILE_MAP = Object.freeze({ bolsos: 'bags' });
const COPIES = 5;
const GSAP_URL = '/js/vendor/gsap.min.js?v=3.13.0';
let gsapPromise = null;

function loadGsap() {
  if (window.gsap) return Promise.resolve(window.gsap);
  if (gsapPromise) return gsapPromise;
  gsapPromise = new Promise(resolve => {
    const script = document.createElement('script');
    script.src = GSAP_URL;
    script.async = true;
    script.onload = () => resolve(window.gsap || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return gsapPromise;
}

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function collectionHref(slug) {
  const normalized = clean(slug)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^bags?$/, 'bolsos')
    .replace(/^ear-cuffs?$/, 'earcuff')
    .replace(/^arm-cuffs?$/, 'armcuff')
    .replace(/^jewelry-box$/, 'joyeros');
  return `/catalogo?cat=${encodeURIComponent(normalized)}`;
}

const IMAGE_WIDTHS = [240, 480, 720, 960];
const IMAGE_SIZES = '(max-width: 640px) 34vw, (max-width: 1023px) 280px, 20vw';
const DELIVERY_KEYS = new Set(['c', 'w', 'h', 'f', 'q', 'g', 'e', 'dpr', 'ar', 'z', 'x', 'y', 'r', 'b', 'bo', 'fl', 't', 'l', 'u', 'o', 'a']);

function isDeliveryComponent(segment) {
  return segment.split(',').every(part => {
    const separator = part.indexOf('_');
    return separator > 0 && separator < part.length - 1 && DELIVERY_KEYS.has(part.slice(0, separator));
  });
}

function optimizedImage(url, width = null) {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.href);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (width && /(^|\.)cdn\.shopify\.com$/.test(parsed.hostname)) {
      parsed.searchParams.set('width', String(width));
    } else if (width && parsed.hostname === 'res.cloudinary.com' && parsed.pathname.includes('/image/upload/')) {
      // Encadenar conserva los recortes y transformaciones administrados.
      // No transformar URLs firmadas: cambiaría la firma de entrega.
      if (!/\/s--[^/]+--\//.test(parsed.pathname)) {
        const [prefix, delivery] = parsed.pathname.split('/image/upload/');
        const segments = delivery.split('/');
        let boundary = 0;
        while (boundary < segments.length - 1 && isDeliveryComponent(segments[boundary])) boundary += 1;
        segments.splice(boundary, 0, `c_limit,w_${width},f_auto,q_auto`);
        parsed.pathname = `${prefix}/image/upload/${segments.join('/')}`;
      }
    }
    return parsed.href;
  } catch {
    return '';
  }
}

function imageCandidates(collection) {
  const slug = clean(collection.slug);
  const localName = SLUG_FILE_MAP[slug] || slug;
  return [...new Set([
    optimizedImage(collection.image),
    optimizedImage(`${IMAGE_BASE}col-${localName}.webp`),
    optimizedImage(PLACEHOLDER)
  ].filter(Boolean))];
}

function createImage(collection) {
  const image = document.createElement('img');
  const candidates = imageCandidates(collection);
  let candidateIndex = 0;

  image.className = 'tt-collection-card__image';
  image.alt = `Colección ${clean(collection.name) || clean(collection.slug)}`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  image.width = 720;
  image.height = 900;

  const useNextCandidate = () => {
    const next = candidates[candidateIndex++];
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    if (next) {
      const responsive = IMAGE_WIDTHS.map(width => optimizedImage(next, width));
      // Los respaldos locales y las URLs firmadas conservan su fuente original.
      if (new Set(responsive).size > 1) {
        image.sizes = IMAGE_SIZES;
        image.srcset = responsive.map((src, index) => `${src} ${IMAGE_WIDTHS[index]}w`).join(', ');
      }
      image.src = optimizedImage(next, 480);
    }
    else image.remove();
  };

  image.addEventListener('error', useNextCandidate);
  useNextCandidate();
  return image;
}

function createCard(collection, accessible, collectionIndex) {
  const label = clean(collection.name) || clean(collection.slug);
  const link = document.createElement('a');
  const media = document.createElement('div');
  const content = document.createElement('div');
  const title = document.createElement('h3');

  link.className = 'tt-collection-card';
  link.href = collectionHref(collection.slug);
  link.dataset.collectionSlug = clean(collection.slug);
  link.dataset.collectionIndex = String(collectionIndex);
  link.setAttribute('aria-label', `Ver colección ${label}`);
  if (!accessible) {
    link.setAttribute('aria-hidden', 'true');
    link.tabIndex = -1;
  }

  media.className = 'tt-collection-card__media';
  media.appendChild(createImage(collection));
  content.className = 'tt-collection-card__content';
  title.className = 'tt-collection-card__title';
  title.textContent = label;
  content.append(title);
  link.append(media, content);
  return link;
}

class InfiniteCollectionCarousel {
  constructor(viewport) {
    this.viewport = viewport;
    this.track = viewport.querySelector('[data-collection-carousel-track]');
    this.previousButton = document.querySelector('[data-collection-carousel-prev]');
    this.nextButton = document.querySelector('[data-collection-carousel-next]');
    this.pagination = document.querySelector('[data-collection-carousel-pagination]');
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.collections = [];
    this.cards = [];
    this.cardGeometry = [];
    this.inView = !('IntersectionObserver' in window);
    this.motionGeneration = 0;
    this.gsap = null;
    this.offset = 0;
    this.targetOffset = 0;
    this.baseWidth = 0;
    this.autoInterval = 2;
    this.autoElapsed = 0;
    this.dragging = false;
    this.pointerId = null;
    this.lastPointerX = 0;
    this.lastPointerTime = 0;
    this.dragDistance = 0;
    this.pointerDownCard = null;
    this.velocity = 0;
    this.paused = false;
    this.suppressClickUntil = 0;
    this.resizeTimer = 0;
    this.activeCollectionIndex = -1;
    this.tick = this.tick.bind(this);
    this.bindStaticEvents();
    if ('IntersectionObserver' in window) {
      this.visibilityObserver = new IntersectionObserver(entries => {
        this.inView = entries.some(entry => entry.isIntersecting);
        if (this.inView && !this.gsap) this.enhanceMotion();
      });
      this.visibilityObserver.observe(viewport);
    }
  }

  bindStaticEvents() {
    this.previousButton?.addEventListener('click', () => this.moveByCard(1));
    this.nextButton?.addEventListener('click', () => this.moveByCard(-1));
    this.viewport.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.moveByCard(1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.moveByCard(-1);
      }
    });
    this.viewport.addEventListener('pointerdown', event => this.onPointerDown(event));
    this.viewport.addEventListener('pointermove', event => this.onPointerMove(event));
    this.viewport.addEventListener('pointerup', event => this.onPointerUp(event));
    this.viewport.addEventListener('pointercancel', event => this.onPointerUp(event));
    this.viewport.addEventListener('click', event => {
      const card = event.target instanceof Element ? event.target.closest('.tt-collection-card') : null;
      // Un arrastre termina con un click sintético en algunos navegadores.
      // Solo ese click se cancela; el click normal queda en manos del <a>.
      if (card && Date.now() < this.suppressClickUntil) event.preventDefault();
    }, true);
    this.viewport.addEventListener('mouseenter', () => { this.paused = true; });
    this.viewport.addEventListener('mouseleave', () => { this.paused = false; });
    this.viewport.addEventListener('focusin', () => { this.paused = true; });
    this.viewport.addEventListener('focusout', () => { this.paused = false; });
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden; });
    window.addEventListener('resize', () => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.measure(true), 140);
    }, { passive: true });
    const handleMotionPreference = () => this.render();
    if (typeof this.reducedMotion.addEventListener === 'function') {
      this.reducedMotion.addEventListener('change', handleMotionPreference);
    } else {
      this.reducedMotion.addListener(handleMotionPreference);
    }
  }

  setCollections(collections) {
    this.collections = Array.isArray(collections) ? collections.filter(item => clean(item?.slug)) : [];
    this.render();
  }

  async enhanceMotion() {
    if (!this.inView || this.gsap || this.reducedMotion.matches || this.collections.length <= 1) return;
    const generation = ++this.motionGeneration;
    const gsap = await loadGsap();
    if (generation !== this.motionGeneration || !this.inView || !gsap || !this.collections.length || this.reducedMotion.matches) return;
    this.gsap = gsap;
    this.viewport.classList.remove('tt-collection-carousel__viewport--native');
    requestAnimationFrame(() => {
      if (generation !== this.motionGeneration || !this.gsap || this.reducedMotion.matches || !this.cards.length) return;
      this.measure(false);
      this.gsap.ticker.add(this.tick);
    });
  }

  showState(message, kind = 'status') {
    this.destroyMotion();
    const state = document.createElement('div');
    state.className = 'tt-collection-carousel__state';
    state.setAttribute('role', kind);
    state.textContent = message;
    this.track.replaceChildren(state);
    // Sin tarjetas no hay nada que recorrer: se ocultan las flechas y el
    // aviso queda centrado en lugar de pegado a la izquierda.
    this.viewport.closest('.tt-collection-carousel')?.classList.add('tt-collection-carousel--state');
  }

  render() {
    this.destroyMotion();
    if (!this.collections.length) {
      this.showState('No hay colecciones disponibles todavía.');
      return;
    }

    this.viewport.closest('.tt-collection-carousel')?.classList.remove('tt-collection-carousel--state');
    const reduced = this.reducedMotion.matches;
    const fragment = document.createDocumentFragment();
    const copyCount = reduced || this.collections.length === 1 ? 1 : COPIES;
    const accessibleCopy = reduced ? 0 : Math.floor(copyCount / 2);

    for (let copy = 0; copy < copyCount; copy += 1) {
      this.collections.forEach((collection, collectionIndex) => {
        fragment.appendChild(createCard(collection, copy === accessibleCopy, collectionIndex));
      });
    }

    this.track.replaceChildren(fragment);
    this.track.setAttribute('aria-live', 'off');
    this.cards = [...this.track.querySelectorAll('.tt-collection-card')];
    this.renderPagination();
    this.offset = 0;
    this.targetOffset = 0;
    this.autoElapsed = 0;

    if (reduced || this.collections.length === 1) {
      this.track.style.transform = '';
      return;
    }

    this.viewport.classList.add('tt-collection-carousel__viewport--native');
    this.enhanceMotion();
  }

  destroyMotion() {
    this.motionGeneration += 1;
    if (this.gsap) this.gsap.ticker.remove(this.tick);
    this.gsap = null;
    this.cards = [];
    this.cardGeometry = [];
    this.baseWidth = 0;
    this.track.style.transform = '';
    this.viewport.classList.remove('is-dragging');
  }

  renderPagination() {
    if (!this.pagination) return;
    const dots = this.collections.map((_collection, index) => {
      const dot = document.createElement('span');
      dot.className = 'tt-collection-carousel__dot';
      dot.dataset.collectionIndex = String(index);
      return dot;
    });
    this.pagination.replaceChildren(...dots);
    this.activeCollectionIndex = -1;
    this.updatePagination(0);
  }

  updatePagination(index) {
    if (!this.pagination || index === this.activeCollectionIndex) return;
    this.activeCollectionIndex = index;
    this.pagination.querySelectorAll('.tt-collection-carousel__dot').forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === index);
    });
  }

  measure(preserveProgress) {
    if (!this.cards.length || this.reducedMotion.matches) return;
    const first = this.cards[0];
    const nextSetFirst = this.cards[this.collections.length];
    if (!first || !nextSetFirst) return;

    const previousWidth = this.baseWidth;
    const progress = previousWidth ? this.offset / previousWidth : -2;
    this.baseWidth = nextSetFirst.offsetLeft - first.offsetLeft;
    if (!this.baseWidth) return;

    this.offset = preserveProgress && previousWidth ? progress * this.baseWidth : -2 * this.baseWidth;
    this.targetOffset = this.offset;
    // Medir antes de escribir transforms evita recalcular layout por tarjeta
    // en cada frame; volver a medir al cambiar viewport o colecciones.
    this.viewportWidth = this.viewport.clientWidth;
    this.cardGeometry = this.cards.map(card => ({
      card, left: card.offsetLeft, width: card.offsetWidth,
      image: card.querySelector('.tt-collection-card__image'),
    }));
    this.applyTransforms();
  }

  wrap(value) {
    if (!this.baseWidth) return value;
    const minimum = -3 * this.baseWidth;
    const maximum = -1 * this.baseWidth;
    let next = value;
    while (next < minimum) next += this.baseWidth;
    while (next >= maximum) next -= this.baseWidth;
    return next;
  }

  tick(_time, deltaMs) {
    if (!this.inView || document.hidden || !this.baseWidth || this.reducedMotion.matches) return;
    const seconds = Math.min(deltaMs, 40) / 1000;

    if (!this.dragging) {
      if (!this.paused) {
        this.autoElapsed += seconds;
        if (this.autoElapsed >= this.autoInterval) {
          this.autoElapsed %= this.autoInterval;
          const card = this.cards[0];
          const gap = parseFloat(getComputedStyle(this.track).gap) || 0;
          this.targetOffset -= (card?.offsetWidth || 280) + gap;
        }
      }
      this.targetOffset += this.velocity * seconds;
      this.velocity *= Math.pow(0.035, seconds);
      this.offset += (this.targetOffset - this.offset) * Math.min(1, seconds * 11);
    }

    this.offset = this.wrap(this.offset);
    this.targetOffset = this.wrap(this.targetOffset);
    this.applyTransforms();
  }

  applyTransforms() {
    this.gsap?.set(this.track, { x: this.offset, force3D: true });
    const viewportWidth = this.viewportWidth;
    if (!viewportWidth) return;
    const viewportCenter = viewportWidth / 2;

    this.cardGeometry.forEach(({ left, width, image }) => {
      const cardCenter = left + this.offset + (width / 2);
      if (cardCenter < -width || cardCenter > viewportWidth + width) return;
      const distance = Math.max(-1, Math.min(1, (cardCenter - viewportCenter) / viewportWidth));
      if (image) this.gsap?.set(image, { xPercent: distance * -3.5, scale: 1.04, force3D: true });
    });

    const centeredCard = this.cardGeometry.reduce((closest, { card, left, width }) => {
      const center = left + this.offset + (width / 2);
      const distance = Math.abs(center - viewportCenter);
      return !closest || distance < closest.distance ? { card, distance } : closest;
    }, null);
    if (centeredCard) this.updatePagination(Number(centeredCard.card.dataset.collectionIndex));
  }

  moveByCard(direction) {
    if (this.reducedMotion.matches || !this.gsap) {
      const card = this.track.querySelector('.tt-collection-card');
      this.viewport.scrollBy({ left: direction * -(card?.offsetWidth || 280), behavior: 'smooth' });
      return;
    }
    const card = this.cards[0];
    const gap = parseFloat(getComputedStyle(this.track).gap) || 0;
    this.targetOffset += direction * ((card?.offsetWidth || 300) + gap);
    this.velocity = 0;
  }

  onPointerDown(event) {
    if (this.reducedMotion.matches || !this.gsap || event.pointerType === 'mouse' && event.button !== 0) return;
    this.pointerDownCard = event.target instanceof Element
      ? event.target.closest('.tt-collection-card')
      : null;
    this.dragging = true;
    this.pointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerTime = performance.now();
    this.dragDistance = 0;
    this.velocity = 0;
    this.viewport.classList.add('is-dragging');
    this.viewport.setPointerCapture(event.pointerId);
  }

  onPointerMove(event) {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    const now = performance.now();
    const deltaX = event.clientX - this.lastPointerX;
    const deltaTime = Math.max(8, now - this.lastPointerTime);
    this.dragDistance += Math.abs(deltaX);
    this.offset = this.wrap(this.offset + deltaX);
    this.targetOffset = this.offset;
    this.velocity = (deltaX / deltaTime) * 1000;
    this.lastPointerX = event.clientX;
    this.lastPointerTime = now;
    this.applyTransforms();
  }

  onPointerUp(event) {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    const card = this.pointerDownCard;
    const wasTap = event.type === 'pointerup' && this.dragDistance <= 7;
    this.dragging = false;
    this.pointerId = null;
    this.pointerDownCard = null;
    this.viewport.classList.remove('is-dragging');
    if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId);
    if (!wasTap) {
      if (this.dragDistance > 7) this.suppressClickUntil = Date.now() + 260;
      return;
    }

    // El track puede avanzar entre pointerdown y click. Si eso ocurre, el
    // click sintético cae sobre el viewport y el <a> nunca recibe activación.
    // Conservamos la tarjeta original para que mouse, touch y pen naveguen
    // de forma determinista; el teclado sigue usando la navegación nativa.
    if (card?.href) {
      this.suppressClickUntil = Date.now() + 260;
      window.location.assign(card.href);
    }
  }
}

const viewport = document.querySelector('[data-collection-carousel]');
if (viewport && !window.TintinHomeCollectionCarousel) {
  const carousel = new InfiniteCollectionCarousel(viewport);
  window.TintinHomeCollectionCarousel = carousel;
  onCollectionsUpdate(
    collections => carousel.setCollections(collections),
    () => carousel.showState('No pudimos cargar las colecciones. Intentá de nuevo más tarde.', 'alert')
  );
}
