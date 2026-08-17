/* Tintin shared navigation state machine. One modal, backdrop and scroll lock. */
(() => {
  'use strict';

  if (window.TintinSurfaceController) return;

  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  class SurfaceController {
    constructor() {
      this.state = 'idle';
      this.surface = 'none';
      this.registry = new Map();
      this.trigger = null;
      this.operation = 0;
      this.animations = new Set();
      this.lockedScrollY = 0;
      this.savedBodyStyles = null;
      this.savedHtmlStyles = null;
      this.inertState = new Map();
      this.breakpoint = this.getBreakpoint();
      this.backdrop = null;
      this.morphLayer = null;
      this.resizeFrame = 0;
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onResize = this.onResize.bind(this);
      document.addEventListener('keydown', this.onKeyDown);
      document.addEventListener('click', this.onClick, true);
      addEventListener('resize', this.onResize, { passive: true });
      addEventListener('orientationchange', this.onResize, { passive: true });
    }

    connect({ backdrop, morphLayer }) {
      this.backdrop = backdrop || null;
      this.morphLayer = morphLayer || null;
      if (this.backdrop && this.backdrop.dataset.ttControllerReady !== '1') {
        this.backdrop.dataset.ttControllerReady = '1';
        this.backdrop.addEventListener('click', () => this.close('backdrop'));
      }
      return this;
    }

    register(name, config) {
      if (!name || !config?.element) return this;
      this.registry.set(name, {
        modal: config.modal !== false,
        triggerSelector: config.triggerSelector || '',
        initialFocus: config.initialFocus || FOCUSABLE,
        ...config,
      });
      config.element.dataset.ttSurface = name;
      return this;
    }

    getBreakpoint() {
      if (innerWidth < 768) return 'mobile';
      if (innerWidth <= 1024) return 'tablet';
      return 'desktop';
    }

    onResize() {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => {
        const next = this.getBreakpoint();
        const changed = next !== this.breakpoint;
        this.breakpoint = next;
        if (this.surface === 'none') return;
        if (changed || this.surface === 'desktop-shop') {
          this.close('viewport', { restoreFocus: false });
        }
      });
    }

    cancelAnimations() {
      this.animations.forEach(animation => animation.cancel());
      this.animations.clear();
      this.morphLayer?.classList.remove('is-active');
    }

    async animateMorph(trigger, target, opening, token) {
      if (this.breakpoint !== 'desktop' || reduceMotion.matches || !trigger?.isConnected || !target?.isConnected || !this.morphLayer) return;
      const from = trigger.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      if (!from.width || !from.height || !to.width || !to.height) return;

      const layer = this.morphLayer;
      layer.classList.add('is-active');
      layer.style.width = `${to.width}px`;
      layer.style.height = `${to.height}px`;
      const start = `translate3d(${from.left}px,${from.top}px,0) scale(${Math.max(.02, from.width / to.width)},${Math.max(.02, from.height / to.height)})`;
      const end = `translate3d(${to.left}px,${to.top}px,0) scale(1,1)`;
      const animation = layer.animate(
        opening
          ? [{ transform: start, borderRadius: '999px', opacity: .72 }, { transform: end, borderRadius: '24px', opacity: .18 }]
          : [{ transform: end, borderRadius: '24px', opacity: .18 }, { transform: start, borderRadius: '999px', opacity: .72 }],
        {
          duration: opening ? 300 : 220,
          easing: opening ? 'cubic-bezier(.2,.82,.2,1)' : 'cubic-bezier(.4,0,.6,1)',
          fill: 'both',
        }
      );
      this.animations.add(animation);
      try {
        await animation.finished;
      } catch {}
      this.animations.delete(animation);
      if (token === this.operation) layer.classList.remove('is-active');
    }

    setExpanded(config, expanded) {
      if (!config?.triggerSelector) return;
      document.querySelectorAll(config.triggerSelector).forEach(control => {
        control.setAttribute('aria-expanded', String(expanded));
      });
    }

    setBackdrop(open, surface) {
      if (!this.backdrop) return;
      this.backdrop.classList.toggle('open', open);
      this.backdrop.hidden = !open;
      this.backdrop.dataset.surface = open ? surface : 'none';
    }

    lockScroll() {
      const html = document.documentElement;
      const body = document.body;
      if (!body || html.classList.contains('tt-surface-locked')) return;

      this.lockedScrollY = scrollY || html.scrollTop || 0;
      const bodyProperties = ['position', 'top', 'left', 'right', 'width', 'overflow', 'touchAction', 'paddingRight'];
      const htmlProperties = ['overflow', 'paddingRight'];
      this.savedBodyStyles = Object.fromEntries(bodyProperties.map(property => [property, body.style[property]]));
      this.savedHtmlStyles = Object.fromEntries(htmlProperties.map(property => [property, html.style[property]]));

      const scrollbarWidth = Math.max(0, innerWidth - html.clientWidth);
      html.classList.add('tt-surface-locked');
      html.style.overflow = 'hidden';
      if (scrollbarWidth) html.style.paddingRight = `${scrollbarWidth}px`;
      Object.assign(body.style, {
        position: 'fixed',
        top: `-${this.lockedScrollY}px`,
        left: '0',
        right: '0',
        width: '100%',
        overflow: 'hidden',
        touchAction: 'none',
      });
    }

    unlockScroll() {
      const html = document.documentElement;
      const body = document.body;
      if (!body || !html.classList.contains('tt-surface-locked')) return;

      html.classList.remove('tt-surface-locked');
      Object.entries(this.savedHtmlStyles || {}).forEach(([property, value]) => {
        html.style[property] = value;
      });
      Object.entries(this.savedBodyStyles || {}).forEach(([property, value]) => {
        body.style[property] = value;
      });

      const returnY = this.lockedScrollY;
      this.savedBodyStyles = null;
      this.savedHtmlStyles = null;
      requestAnimationFrame(() => window.scrollTo(0, returnY));
    }

    setBackgroundInert(activeElement, inert) {
      if (inert) {
        this.inertState.clear();
        [...document.body.children].forEach(node => {
          if (!(node instanceof HTMLElement) || node === activeElement || node.contains(activeElement) || node === this.backdrop || node === this.morphLayer || node.tagName === 'SCRIPT') return;
          this.inertState.set(node, node.inert);
          node.inert = true;
        });
        return;
      }

      this.inertState.forEach((value, node) => {
        if (node.isConnected) node.inert = value;
      });
      this.inertState.clear();
    }

    focusFirst(config) {
      const target = config.element.querySelector(config.initialFocus) || config.element;
      if (!target.hasAttribute('tabindex') && target === config.element) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }

    emit() {
      dispatchEvent(new CustomEvent('tintin:surface-change', {
        detail: { state: this.state, surface: this.surface },
      }));
    }

    async open(name, trigger = document.activeElement) {
      const config = this.registry.get(name);
      if (!config) return false;
      if (this.surface === name && (this.state === 'open' || this.state === 'opening')) return true;

      const token = ++this.operation;
      this.cancelAnimations();

      if (this.surface !== 'none') {
        const previousConfig = this.registry.get(this.surface);
        const preserveEnvironment = Boolean(previousConfig?.modal && config.modal);
        await this.close('switch', {
          restoreFocus: false,
          preserveOperation: true,
          preserveEnvironment,
        });
      }
      if (token !== this.operation) return false;

      this.state = 'opening';
      this.surface = name;
      this.trigger = trigger instanceof HTMLElement ? trigger : null;
      this.emit();
      await config.beforeOpen?.({ trigger: this.trigger, controller: this });
      if (token !== this.operation) return false;

      config.element.classList.add('open', 'tt-surface-preparing');
      config.element.closest('.tt-nav-dropdown')?.classList.add('open');
      config.element.setAttribute('aria-hidden', 'false');
      this.setExpanded(config, true);

      if (config.modal) {
        this.setBackdrop(true, name);
        this.lockScroll();
        this.setBackgroundInert(config.element, true);
      }

      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await this.animateMorph(this.trigger, config.element, true, token);
      if (token !== this.operation) return false;

      config.element.classList.remove('tt-surface-preparing');
      this.state = 'open';
      if (config.modal || this.trigger?.matches?.(':focus-visible')) this.focusFirst(config);
      config.afterOpen?.({ trigger: this.trigger, controller: this });
      this.emit();
      return true;
    }

    async close(reason = 'api', {
      restoreFocus = true,
      preserveOperation = false,
      preserveEnvironment = false,
    } = {}) {
      if (this.surface === 'none') return false;

      const token = preserveOperation ? this.operation : ++this.operation;
      this.cancelAnimations();
      const name = this.surface;
      const config = this.registry.get(name);
      const returnTarget = this.trigger;
      this.state = 'closing';
      this.emit();

      await config?.beforeClose?.({ reason, controller: this });
      if (!preserveOperation && token !== this.operation) return false;
      if (config) await this.animateMorph(returnTarget, config.element, false, token);

      if (config) {
        config.element.classList.remove('open', 'tt-surface-preparing');
        config.element.closest('.tt-nav-dropdown')?.classList.remove('open');
        config.element.setAttribute('aria-hidden', 'true');
        this.setExpanded(config, false);
        this.setBackgroundInert(config.element, false);
      }

      if (!preserveEnvironment) {
        this.setBackdrop(false, 'none');
        this.unlockScroll();
      }

      this.surface = 'none';
      this.state = 'idle';
      this.trigger = null;
      config?.afterClose?.({ reason, controller: this });
      if (restoreFocus && returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
      this.emit();
      return true;
    }

    toggle(name, trigger) {
      return this.surface === name ? this.close('toggle') : this.open(name, trigger);
    }

    onClick(event) {
      const target = event.target instanceof Element ? event.target : null;
      const closeButton = target?.closest('#btn-search-close,#btn-cart-close,#btn-account-close,#btn-close-sheet,#btn-tablet-close,#btn-notifications-close');
      if (closeButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.close('close-button');
        return;
      }

      if (target?.closest('[data-tt-surface] a[href]')) {
        this.close('navigate', { restoreFocus: false });
        return;
      }

      const trigger = target?.closest('#btn-tienda,#btn-menu-tablet,#tabbar-tienda,[data-nav-action="search"],#tabbar-search,[data-nav-action="cart"],#tabbar-cart,[data-nav-action="account"],[data-nav-action="notifications"],#tabbar-notifications');
      if (!trigger && this.surface !== 'none') {
        const openConfig = this.registry.get(this.surface);
        if (openConfig && !openConfig.modal && target && !openConfig.element.contains(target)) {
          this.close('outside', { restoreFocus: false });
        }
        return;
      }
      if (!trigger) return;

      const surface = trigger.id === 'btn-tienda' ? 'desktop-shop'
        : trigger.id === 'btn-menu-tablet' ? 'tablet-menu'
          : trigger.id === 'tabbar-tienda' ? 'mobile-shop'
            : trigger.matches('[data-nav-action="search"],#tabbar-search') ? 'search'
              : trigger.matches('[data-nav-action="cart"],#tabbar-cart') ? 'cart'
                : trigger.matches('[data-nav-action="notifications"],#tabbar-notifications') ? 'notifications'
                  : 'account';
      if (!this.registry.has(surface)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      this.toggle(surface, trigger);
    }

    onKeyDown(event) {
      if (this.surface === 'none') return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.close('escape');
        return;
      }
      if (event.key !== 'Tab') return;

      const config = this.registry.get(this.surface);
      if (!config?.modal) return;
      const nodes = [...config.element.querySelectorAll(FOCUSABLE)].filter(node => node.offsetParent !== null);
      if (!nodes.length) {
        event.preventDefault();
        config.element.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  window.TintinSurfaceController = new SurfaceController();
  document.documentElement.dataset.ttSurfaceController = 'ready';
  dispatchEvent(new CustomEvent('tintin:surface-controller-ready'));
})();
