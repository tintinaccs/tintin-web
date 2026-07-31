(function () {
  'use strict';

  // El sitio oficial vive en Cloudflare Pages. Conserva ruta, parámetros y hash
  // cuando alguien llega desde el dominio histórico de GitHub Pages.
  if (window.location.hostname === 'tintinaccs.github.io') {
    try {
      const strippedPath = window.location.pathname.replace(/^\/tintin-web\/?/, '/');
      window.location.replace(
        'https://tintinaccesorios.pages.dev' +
        strippedPath +
        window.location.search +
        window.location.hash
      );
      return;
    } catch {}
  }

  if (window.TintinLoader) return;

  if (document.head && !document.getElementById('tt-cloudinary-preconnect')) {
    const preconnect = document.createElement('link');
    preconnect.id = 'tt-cloudinary-preconnect';
    preconnect.rel = 'preconnect';
    preconnect.href = 'https://res.cloudinary.com';
    preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);

    const dnsPrefetch = document.createElement('link');
    dnsPrefetch.rel = 'dns-prefetch';
    dnsPrefetch.href = 'https://res.cloudinary.com';
    document.head.appendChild(dnsPrefetch);
  }

  const documentElement = document.documentElement;
  const path = (window.location.pathname || '').toLowerCase();
  const isOwnGuardPage =
    path.endsWith('/admin.html') ||
    path.endsWith('/admin') ||
    path.endsWith('/login.html') ||
    path.endsWith('/login');
  const isLoginPage =
    path.endsWith('/login.html') ||
    path.endsWith('/login');
  const isAdminImagesPage =
    path.endsWith('/admin-images.html') ||
    path.endsWith('/admin-images');

  if (isLoginPage) {
    try {
      const url = new URL(window.location.href);
      const from = url.searchParams.get('from') || '';
      const unsafeFrom =
        /^(?:[a-z][a-z0-9+.-]*:|\/\/|\\)/i.test(from) ||
        from.includes('..');
      if (from && unsafeFrom) {
        url.searchParams.delete('from');
        window.history.replaceState(null, '', url.href);
      }
    } catch {}
  }

  const isLocalDevelopment =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]';
  const storeGateRequired =
    !isOwnGuardPage &&
    !(isLocalDevelopment && window.TT_DISABLE_STORE_GATE === true);

  documentElement.classList.add('tt-initializing');
  if (storeGateRequired) {
    documentElement.classList.add('tt-store-gate-pending');
  }

  const TT_CACHE_VERSION = 'tintin-20260731-loader-brand-1';
  const MIN_SHOW_MS = 900;
  const STORE_GATE_TIMEOUT_MS = 9000;
  const SAFETY_MS = 11000;
  const START = Date.now();
  const SCRIPT_SRC = document.currentScript && document.currentScript.src;

  let scrollLockCount = 0;
  let savedScrollY = 0;
  let previousBodyStyle = null;
  let previousHtmlStyle = null;
  let hidden = false;
  let contentReady = false;
  let logoReady = false;
  let inserted = false;
  let hideGen = 0;
  let gateResolved = !storeGateRequired;
  let gateEmergencyShown = false;
  let runtimeBooted = false;

  function versionUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      parsed.searchParams.set('v', TT_CACHE_VERSION);
      return parsed.href;
    } catch {
      return url + (url.includes('?') ? '&' : '?') + 'v=' + TT_CACHE_VERSION;
    }
  }

  function resolveAsset(assetPath, withVersion = true) {
    let url = assetPath;
    try {
      if (SCRIPT_SRC) url = new URL('../' + assetPath, SCRIPT_SRC).href;
    } catch {}
    return withVersion ? versionUrl(url) : url;
  }

  function currentPath() {
    return (window.location.pathname || '').toLowerCase();
  }

  const POST_LOGIN_GREETING_KEY = 'tt_post_login_greeting';
  const POST_LOGIN_GREETING_MAX_AGE_MS = 8000;

  function consumePostLoginGreeting() {
    try {
      const raw = window.sessionStorage.getItem(POST_LOGIN_GREETING_KEY);
      if (!raw) return null;
      window.sessionStorage.removeItem(POST_LOGIN_GREETING_KEY);
      const data = JSON.parse(raw);
      if (!data || typeof data.title !== 'string' || !data.title.trim()) return null;
      if (
        typeof data.ts !== 'number' ||
        Date.now() - data.ts > POST_LOGIN_GREETING_MAX_AGE_MS
      ) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  const postLoginGreeting = consumePostLoginGreeting();
  const DEFAULT_LOGO_SRC = resolveAsset(
    'assets-tintin/images/general/tintin-loader-brand.svg'
  );
  const LOGO_SRC = DEFAULT_LOGO_SRC;

  const CSS = [
    'html.tt-scroll-locked,html.tt-scroll-locked body{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}',
    'body.tt-scroll-locked{position:fixed!important;left:0!important;right:0!important;width:100%!important;overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}',
    'html.tt-store-gate-pending,html.tt-store-gate-blocked{background:#FFADD1!important}',
    'html.tt-store-gate-pending body> *:not(#tt-loader):not(#tt-store-closed-overlay),html.tt-store-gate-blocked body> *:not(#tt-loader):not(#tt-store-closed-overlay){visibility:hidden!important;pointer-events:none!important;user-select:none!important}',
    'html.tt-store-gate-pending body,html.tt-store-gate-blocked body{overflow:hidden!important;overscroll-behavior:none!important}',
    '#tt-store-closed-overlay{visibility:visible!important;pointer-events:auto!important;user-select:auto!important}',
    '#tt-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#FFADD1;transition:opacity .01s linear,visibility .01s linear;overflow:hidden;overscroll-behavior:none;touch-action:none;padding:max(18px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));box-sizing:border-box}',
    '#tt-loader.tt-out{opacity:0;visibility:hidden;pointer-events:none}',
    '#tt-loader-spin-wrap{--tt-loader-brand-width:clamp(210px,21vw,270px);--tt-loader-spinner-size:46px;--tt-loader-spinner-border:9px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:min(100%,360px);max-width:calc(100vw - 36px);box-sizing:border-box;text-align:center}',
    '#tt-loader-logo{position:relative;z-index:1;display:block;width:var(--tt-loader-brand-width);max-width:100%;height:auto;object-fit:contain;opacity:0;transform:translateY(5px) scale(.985);clip-path:inset(0 0 100% 0);filter:drop-shadow(0 8px 20px rgba(202,1,105,.14));user-select:none;pointer-events:none}',
    '#tt-loader-spin-wrap.tt-ready #tt-loader-logo{animation:tt-loader-brand-reveal .82s cubic-bezier(.22,.61,.36,1) both}',
    '@keyframes tt-loader-brand-reveal{0%{opacity:0;transform:translateY(5px) scale(.985);clip-path:inset(0 0 100% 0)}18%{opacity:1;transform:translateY(0) scale(1);clip-path:inset(0 0 53% 0)}54%{opacity:1;transform:translateY(0) scale(1);clip-path:inset(0 0 53% 0)}100%{opacity:1;transform:translateY(0) scale(1);clip-path:inset(0)}}',
    '#tt-loader-brand-subtitle{margin-top:clamp(10px,1.4vw,15px);color:#CA0169!important;font-family:"Bodoni Moda","Cormorant Garamond",Didot,"Times New Roman",serif;font-size:clamp(14px,1.45vw,17px);font-weight:500;line-height:1.1;letter-spacing:.055em;text-align:center;opacity:0;transform:translateY(4px);white-space:nowrap}',
    '#tt-loader-spin-wrap.tt-ready #tt-loader-brand-subtitle{animation:tt-loader-copy-in .36s ease .62s both}',
    '@keyframes tt-loader-copy-in{to{opacity:1;transform:translateY(0)}}',
    '.tt-loader-spinner{width:var(--tt-loader-spinner-size);height:var(--tt-loader-spinner-size);display:grid;margin-top:clamp(24px,2.8vw,34px);opacity:0;transform:scale(.92);animation:tt-loader-spinner-shell 3s infinite}',
    '#tt-loader-spin-wrap.tt-ready .tt-loader-spinner{animation:tt-loader-spinner-in .28s ease .78s both,tt-loader-spinner-shell 3s .78s infinite}',
    '.tt-loader-spinner::before,.tt-loader-spinner::after{content:"";grid-area:1/1;border:var(--tt-loader-spinner-border) solid;border-radius:50%;border-color:#CA0169 #CA0169 transparent transparent;mix-blend-mode:multiply;animation:tt-loader-spinner-ring 1s infinite linear;box-sizing:border-box}',
    '.tt-loader-spinner::after{border-color:transparent transparent rgba(202,1,105,.22) rgba(202,1,105,.22);animation-direction:reverse}',
    '@keyframes tt-loader-spinner-in{to{opacity:1;transform:scale(1)}}',
    '@keyframes tt-loader-spinner-shell{100%{transform:rotate(1turn)}}',
    '@keyframes tt-loader-spinner-ring{100%{transform:rotate(1turn)}}',
    '#tt-loader-status{display:flex;flex-direction:column;align-items:center;max-width:min(86vw,440px);margin-top:clamp(15px,2vw,22px);padding:0 12px;box-sizing:border-box}',
    '#tt-loader-status:empty{display:none}',
    '#tt-loader-title{font-family:Montserrat,Arial,sans-serif;font-size:clamp(11px,1.5vw,13px);font-weight:750;line-height:1.35;letter-spacing:.04em;color:#A00055!important;text-align:center;overflow-wrap:anywhere}',
    '#tt-loader-subtitle{margin-top:5px;font-family:Montserrat,Arial,sans-serif;font-size:clamp(10px,1.35vw,12px);font-weight:600;line-height:1.45;color:#A00055!important;text-align:center;opacity:.78;overflow-wrap:anywhere}',
    '@media (min-width:601px) and (max-width:1024px){#tt-loader-spin-wrap{--tt-loader-brand-width:clamp(178px,29vw,220px);--tt-loader-spinner-size:38px;--tt-loader-spinner-border:7px;width:min(100%,310px)}#tt-loader-brand-subtitle{font-size:clamp(12px,1.8vw,15px);margin-top:11px}.tt-loader-spinner{margin-top:25px}}',
    '@media (max-width:600px){#tt-loader{padding:max(16px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left))}#tt-loader-spin-wrap{--tt-loader-brand-width:clamp(120px,43vw,158px);--tt-loader-spinner-size:30px;--tt-loader-spinner-border:5px;width:min(100%,230px);max-width:calc(100vw - 28px)}#tt-loader-brand-subtitle{font-size:clamp(10px,3.2vw,12px);margin-top:8px;letter-spacing:.045em}.tt-loader-spinner{margin-top:20px}#tt-loader-status{margin-top:14px;padding:0 8px}#tt-loader-title{font-size:clamp(10px,3.1vw,12px)}#tt-loader-subtitle{font-size:clamp(9px,2.8vw,11px)}}',
    '@media (max-width:360px){#tt-loader-spin-wrap{--tt-loader-brand-width:clamp(112px,42vw,140px);--tt-loader-spinner-size:27px;--tt-loader-spinner-border:4px}#tt-loader-brand-subtitle{font-size:10px}.tt-loader-spinner{margin-top:17px}}',
    '@media (prefers-reduced-motion:reduce){#tt-loader{transition:opacity .01s linear}#tt-loader-spin-wrap.tt-ready #tt-loader-logo,#tt-loader-spin-wrap.tt-ready #tt-loader-brand-subtitle,#tt-loader-spin-wrap.tt-ready .tt-loader-spinner{animation:none;opacity:1;transform:none;clip-path:none}.tt-loader-spinner::before,.tt-loader-spinner::after{animation-duration:1.6s}}',
    '#tt-store-gate-emergency-dialog{width:min(100%,460px);max-height:calc(100dvh - 32px);overflow:auto;background:#fff;border-radius:20px;padding:clamp(28px,5vw,40px) clamp(20px,5vw,32px);text-align:center;box-shadow:0 18px 60px rgba(35,12,22,.28);box-sizing:border-box}',
    '#tt-store-gate-emergency-actions{display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap}',
    '.tt-store-gate-emergency-action{display:inline-flex;align-items:center;justify-content:center;min-height:46px;min-width:146px;padding:11px 24px;border-radius:999px;font:700 13px/1.2 Montserrat;text-decoration:none;cursor:pointer;touch-action:manipulation;box-sizing:border-box}',
    '@media(max-width:600px){#tt-store-closed-overlay{padding:max(16px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left))!important}#tt-store-gate-emergency-dialog{width:100%;max-width:390px;padding:28px 20px 24px;border-radius:18px}#tt-store-gate-emergency-actions{flex-direction:column}.tt-store-gate-emergency-action{width:min(100%,260px);min-width:0}}'
  ].join('');

  if (!document.getElementById('tt-loader-style')) {
    const style = document.createElement('style');
    style.id = 'tt-loader-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function lockScroll() {
    scrollLockCount += 1;
    if (scrollLockCount > 1) return;

    savedScrollY = window.scrollY || documentElement.scrollTop || 0;
    previousBodyStyle = document.body
      ? {
          position: document.body.style.position,
          top: document.body.style.top,
          left: document.body.style.left,
          right: document.body.style.right,
          width: document.body.style.width,
          overflow: document.body.style.overflow,
          touchAction: document.body.style.touchAction
        }
      : null;
    previousHtmlStyle = {
      overflow: documentElement.style.overflow,
      overscrollBehavior: documentElement.style.overscrollBehavior
    };

    documentElement.classList.add('tt-scroll-locked');
    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';

    if (document.body) {
      document.body.classList.add('tt-scroll-locked');
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + savedScrollY + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
  }

  function unlockScroll() {
    if (scrollLockCount > 0) scrollLockCount -= 1;
    if (scrollLockCount > 0) return;

    documentElement.classList.remove('tt-scroll-locked');
    documentElement.style.overflow = previousHtmlStyle ? previousHtmlStyle.overflow : '';
    documentElement.style.overscrollBehavior = previousHtmlStyle
      ? previousHtmlStyle.overscrollBehavior
      : '';

    if (document.body) {
      document.body.classList.remove('tt-scroll-locked');
      if (previousBodyStyle) {
        document.body.style.position = previousBodyStyle.position;
        document.body.style.top = previousBodyStyle.top;
        document.body.style.left = previousBodyStyle.left;
        document.body.style.right = previousBodyStyle.right;
        document.body.style.width = previousBodyStyle.width;
        document.body.style.overflow = previousBodyStyle.overflow;
        document.body.style.touchAction = previousBodyStyle.touchAction;
      } else {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
      }
    }
    window.scrollTo(0, savedScrollY || 0);
  }

  window.TintinScrollLock = { lock: lockScroll, unlock: unlockScroll };

  function escText(value) {
    const d = document.createElement('div');
    d.textContent = String(value == null ? '' : value);
    return d.innerHTML;
  }

  const initialTitle = postLoginGreeting ? postLoginGreeting.title : '';
  const initialSubtitle =
    postLoginGreeting && postLoginGreeting.subtitle
      ? postLoginGreeting.subtitle
      : '';
  const TITLE_HTML = initialTitle
    ? '<div id="tt-loader-title">' + escText(initialTitle) + '</div>'
    : '';
  const SUBTITLE_HTML = initialSubtitle
    ? '<div id="tt-loader-subtitle">' + escText(initialSubtitle) + '</div>'
    : '';

  const loader = document.createElement('div');
  loader.id = 'tt-loader';
  loader.setAttribute('aria-hidden', 'true');
  loader.setAttribute('role', 'presentation');
  loader.dataset.state = 'show';
  loader.innerHTML =
    '<div id="tt-loader-spin-wrap">' +
    '<img id="tt-loader-logo" src="' +
    LOGO_SRC +
    '" alt="" draggable="false" fetchpriority="high" width="882" height="431">' +
    '<div id="tt-loader-brand-subtitle">accesorios &amp; relojes</div>' +
    '<div class="tt-loader-spinner" aria-hidden="true"></div>' +
    '<div id="tt-loader-status">' +
    TITLE_HTML +
    SUBTITLE_HTML +
    '</div>' +
    '</div>';

  const logo = loader.querySelector('#tt-loader-logo');

  function markLogoReady() {
    logoReady = true;
    const wrap = document.getElementById('tt-loader-spin-wrap');
    if (wrap) wrap.classList.add('tt-ready');
    if (contentReady) tryHideElegant();
  }

  logo.addEventListener('load', markLogoReady, { once: true });
  logo.addEventListener('error', function onLogoError() {
    logo.removeEventListener('error', onLogoError);
    logoReady = true;
    logo.style.display = 'none';
    const wrap = document.getElementById('tt-loader-spin-wrap');
    if (wrap) wrap.classList.add('tt-ready');
    if (contentReady) tryHideElegant();
  });
  if (logo.complete && logo.naturalWidth > 0) markLogoReady();

  function insertLoader() {
    if (inserted || !document.body) return;
    if (!document.getElementById('tt-loader')) {
      inserted = true;
      document.body.insertBefore(loader, document.body.firstChild);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const img = document.getElementById('tt-loader-logo');
          const wrap = document.getElementById('tt-loader-spin-wrap');
          if (img && img.complete && img.naturalWidth > 0) markLogoReady();
          else if (wrap) wrap.classList.add('tt-ready');
        });
      });
    }
  }

  function waitForBody(callback) {
    if (document.body) {
      callback();
      return;
    }
    requestAnimationFrame(() => waitForBody(callback));
  }

  waitForBody(insertLoader);

  function hideNow() {
    if (hidden) return;
    hidden = true;
    loader.dataset.state = 'out';
    loader.style.touchAction = 'auto';
    loader.style.pointerEvents = 'none';
    loader.classList.add('tt-out');

    const generation = ++hideGen;
    function detach() {
      if (generation !== hideGen) return;
      if (hidden) loader.style.display = 'none';
    }
    loader.addEventListener('transitionend', detach, { once: true });
    window.setTimeout(detach, 450);
  }

  function tryHideElegant() {
    if (hidden) return;
    if (storeGateRequired && !gateResolved) return;
    const enough = Date.now() - START >= MIN_SHOW_MS;
    if (!enough || !logoReady) {
      const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - START));
      window.setTimeout(tryHideElegant, Math.max(wait, 140));
      return;
    }
    loader.dataset.state = 'ready';
    hideNow();
  }

  function ready() {
    if (contentReady) return;
    contentReady = true;
    tryHideElegant();
  }

  function show() {
    hideGen += 1;
    hidden = false;
    contentReady = false;
    logoReady = !!(logo && logo.complete && logo.naturalWidth > 0);
    loader.dataset.state = 'show';
    loader.style.display = '';
    loader.style.touchAction = '';
    loader.style.pointerEvents = '';
    loader.classList.remove('tt-out');

    const wrap = document.getElementById('tt-loader-spin-wrap');
    if (wrap) {
      wrap.classList.remove('tt-ready');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => wrap.classList.add('tt-ready'));
      });
    }
  }

  function setText(text, subtitle) {
    const status = document.getElementById('tt-loader-status');
    if (!status) return;

    const value = String(text == null ? '' : text).trim();
    let titleEl = document.getElementById('tt-loader-title');
    if (!value) {
      if (titleEl) titleEl.remove();
    } else {
      if (!titleEl) {
        titleEl = document.createElement('div');
        titleEl.id = 'tt-loader-title';
        status.prepend(titleEl);
      }
      titleEl.textContent = value;
    }

    const subValue = String(subtitle == null ? '' : subtitle).trim();
    let subEl = document.getElementById('tt-loader-subtitle');
    if (!subValue) {
      if (subEl) subEl.remove();
      return;
    }
    if (!subEl) {
      subEl = document.createElement('div');
      subEl.id = 'tt-loader-subtitle';
      status.appendChild(subEl);
    }
    subEl.textContent = subValue;
  }

  function showEmergencyStoreGate() {
    if (!storeGateRequired || gateResolved) return;

    gateEmergencyShown = true;
    waitForBody(() => {
      if (gateResolved) return;
      documentElement.classList.remove(
        'tt-store-gate-pending',
        'tt-store-gate-blocked'
      );
      documentElement.classList.add('tt-store-gate-degraded');

      let notice = document.getElementById('tt-store-gate-network-notice');
      if (!notice) {
        notice = document.createElement('aside');
        notice.id = 'tt-store-gate-network-notice';
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        notice.style.cssText =
          'position:fixed;z-index:2147482988;right:14px;bottom:14px;display:flex;align-items:center;gap:10px;width:min(calc(100vw - 28px),470px);min-height:48px;padding:10px 12px 10px 16px;border:1px solid rgba(173,63,103,.18);border-radius:18px;background:rgba(255,255,255,.96);color:#3a2d32;box-shadow:0 14px 40px rgba(58,20,35,.16);box-sizing:border-box;visibility:visible;pointer-events:auto';
        notice.innerHTML =
          '<span style="min-width:0;flex:1;font:600 12px/1.45 Montserrat,sans-serif">Conexión inestable. Podés explorar la tienda; las compras se habilitan al reconectar.</span>' +
          '<button type="button" aria-label="Reintentar conexión" style="min-width:44px;min-height:44px;padding:8px 12px;border:0;border-radius:999px;background:#ad3f67;color:#fff;font:800 12px/1 Montserrat,sans-serif;cursor:pointer">Reintentar</button>';
        notice
          .querySelector('button')
          ?.addEventListener('click', () => window.location.reload());
        document.body.appendChild(notice);
      }

      if (!window.__TintinEmergencyDegradedGuardBound) {
        window.__TintinEmergencyDegradedGuardBound = true;
        window.addEventListener(
          'click',
          event => {
            if (!documentElement.classList.contains('tt-store-gate-degraded')) {
              return;
            }
            const control = event.target?.closest?.(
              'a[href*="checkout"],.tt-cart-checkout-btn,[data-checkout],[data-action="checkout"]'
            );
            if (!control) return;
            event.preventDefault();
            event.stopImmediatePropagation?.();
            event.stopPropagation?.();
            document
              .getElementById('tt-store-gate-network-notice')
              ?.querySelector('button')
              ?.focus({ preventScroll: true });
          },
          true
        );
      }

      window.dispatchEvent(
        new CustomEvent('tintin:store-gate-state', {
          detail: { state: 'degraded', source: 'startup-timeout' }
        })
      );
    });
  }

  function bootEarlyStoreGateFallback() {
    if (!storeGateRequired || typeof window.fetch !== 'function') return;

    const controller =
      typeof AbortController === 'function' ? new AbortController() : null;
    const timer = window.setTimeout(() => controller?.abort(), 7000);
    const url =
      'https://firestore.googleapis.com/v1/projects/tintin-accesorios/' +
      'databases/(default)/documents/settings/storeGate' +
      '?key=AIzaSyDMD_-656XR3WHJpGikMxKHMMkJV_re5t0';

    window
      .fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit',
        ...(controller ? { signal: controller.signal } : {})
      })
      .then(response => (response.ok ? response.json() : null))
      .then(payload => {
        if (
          payload?.fields?.storeOpen?.booleanValue !== true ||
          gateResolved
        ) {
          return;
        }
        window.dispatchEvent(
          new CustomEvent('tintin:store-gate-state', {
            detail: { state: 'allowed', source: 'public-rest-fallback' }
          })
        );
      })
      .catch(() => {})
      .finally(() => window.clearTimeout(timer));
  }

  function importSibling(fileName, label, onError) {
    let url = 'js/' + fileName;
    try {
      if (SCRIPT_SRC) url = new URL(fileName, SCRIPT_SRC).href;
    } catch {}
    url = versionUrl(url);
    return import(url).catch(error => {
      console.warn('[PageLoader] No se pudo cargar ' + label + ':', error);
      if (typeof onError === 'function') onError(error);
      return null;
    });
  }

  function bootGlobalQuality() {
    if (!window.TintinUIQualityBooted) {
      importSibling('ui-quality.js', 'UI Quality');
    }
  }

  function bootStoreGate() {
    if (!storeGateRequired) return;
    importSibling('store-gate.js', 'Store Gate', showEmergencyStoreGate);
  }

  function bootHeaderMode() {
    if (!window.TintinHeaderModeBooted) {
      importSibling('mobile-header-mode.js', 'Header Mode');
    }
  }

  function bootHeaderDropdownFix() {
    if (!window.TintinHeaderDropdownFixBooted) {
      importSibling('header-dropdown-fix.js', 'Header Dropdown Fix');
    }
  }

  function bootHeaderAccountFix() {
    if (!window.TintinAccountMobileFixBooted) {
      importSibling('header-account-mobile-fix.js', 'Header Account Fix');
    }
  }

  function bootSiteActivity() {
    if (!window.TintinSiteActivityBooted) {
      window.TINTIN_ENABLE_PUBLIC_ACTIVITY = true;
      importSibling('site-activity.js', 'Site Activity');
    }
  }

  function bootHeaderScrollHide() {
    if (!window.TintinHeaderScrollHideBooted) {
      importSibling('header-scroll-hide.js', 'Header Scroll Hide');
    }
  }

  function bootAdminAndProfileFixes() {
    const current = currentPath();
    if (current.endsWith('/admin.html') || current.endsWith('/admin')) {
      importSibling('admin-order-delete-fix.js', 'Admin Order Delete Fix');
      importSibling('admin-welcome-control.js', 'Admin Welcome Control');
      importSibling('admin-mobile-sidebar-fix.js', 'Admin Mobile Sidebar Fix');
      importSibling('admin-store-control.js', 'Admin Store State Sync');
    }
    if (current.endsWith('/perfil.html') || current.endsWith('/perfil')) {
      importSibling('profile-order-stats-fix.js', 'Profile Order Stats Fix');
    }
  }

  function bootScrollReveal() {
    if (!window.TintinGlobalScrollRevealBooted) {
      importSibling('scroll-reveal-global.js', 'Scroll Reveal');
    }
  }

  function bootImagePerformance() {
    if (!window.TintinImagePerformanceBooted) {
      importSibling('image-performance.js', 'Image Performance');
    }
  }

  function bootImagesPhase5Public() {
    if (!window.TintinImagesPhase5Booted) {
      importSibling('images-phase5.js', 'Images Phase 5');
    }
  }

  function bootCollectionsPhase4Public() {
    if (!window.TintinCollectionsPhase4Booted) {
      importSibling('collections-phase4.js', 'Collections Phase 4');
    }
  }

  function bootCartSyncPublic() {
    importSibling('cart-sync.js', 'Cart Sync');
  }

  function bootThemeColorSanitizerPublic() {
    if (!window.TintinThemeColorSanitizerBooted) {
      importSibling('theme-color-sanitizer.js', 'Theme Color Sanitizer');
    }
  }

  function bootPageAuditFixPublic() {
    if (!window.TintinPageAuditFixBooted) {
      importSibling('page-audit-fix.js', 'Page Audit Fix');
    }
  }

  function bootPhase8UiUx() {
    if (!document.getElementById('tt-phase8-ui-ux-css')) {
      const link = document.createElement('link');
      link.id = 'tt-phase8-ui-ux-css';
      link.rel = 'stylesheet';
      link.href = resolveAsset('css/phase8-ui-ux.css');
      document.head.appendChild(link);
    }
    if (!window.TintinUX?.booted) {
      importSibling('phase8-ui-ux.js', 'Phase 8 UI/UX');
    }
  }

  function bootPageRuntime() {
    if (runtimeBooted) return;
    runtimeBooted = true;
    bootGlobalQuality();
    bootHeaderMode();
    bootHeaderDropdownFix();
    bootHeaderAccountFix();
    bootHeaderScrollHide();
    bootAdminAndProfileFixes();
    bootScrollReveal();
    bootImagePerformance();
    bootSiteActivity();
    bootPhase8UiUx();
  }

  function bootPublicRuntime() {
    if (runtimeBooted) return;
    runtimeBooted = true;
    bootHeaderMode();
    bootHeaderDropdownFix();
    bootHeaderAccountFix();
    bootHeaderScrollHide();
    bootAdminAndProfileFixes();
    bootScrollReveal();
    bootImagePerformance();
    bootSiteActivity();
    bootImagesPhase5Public();
    bootCollectionsPhase4Public();
    bootCartSyncPublic();
    bootThemeColorSanitizerPublic();
    bootPageAuditFixPublic();
    bootPhase8UiUx();

    documentElement.classList.remove('tt-initializing', 'tt-parity-guard');
    documentElement.classList.add('tt-ui-ready', 'tt-parity-safe');
  }

  if (storeGateRequired) {
    window.addEventListener(
      'tintin:store-gate-state',
      event => {
        const state = event?.detail?.state || 'unavailable';
        gateResolved = true;

        if (state === 'allowed' || state === 'degraded') {
          if (contentReady) tryHideElegant();
          if (isAdminImagesPage) window.setTimeout(bootPageRuntime, 0);
          else window.setTimeout(bootPublicRuntime, 0);
          return;
        }

        contentReady = true;
        logoReady = true;
        hideNow();
      },
      { passive: true }
    );

    window.setTimeout(() => {
      if (!gateResolved) showEmergencyStoreGate();
    }, STORE_GATE_TIMEOUT_MS);
    bootEarlyStoreGateFallback();
  }

  bootStoreGate();
  if (!storeGateRequired) bootPageRuntime();

  document.addEventListener('tintin:page-ready', ready);
  if (!window.TT_PAGE_LOADER_WAIT) window.addEventListener('load', ready);

  window.setTimeout(() => {
    logoReady = true;
    ready();
    if (storeGateRequired && !gateResolved && !gateEmergencyShown) {
      showEmergencyStoreGate();
    }
    hideNow();
  }, SAFETY_MS);

  window.TintinLoader = {
    ready,
    hide: hideNow,
    show,
    setText,
    lockScroll,
    unlockScroll
  };
  window.ttPageReady = ready;
})();
