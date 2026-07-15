(function () {
  'use strict';

  if (window.TintinLoader) return;

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

  // Evita que ?from= pueda mandar a una cuenta autorizada fuera de Tintin.
  // Los regresos normales del sitio son rutas relativas como checkout.html.
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
  // El bypass existe solo para desarrollo local. En producción no se puede
  // apagar el control global escribiendo TT_DISABLE_STORE_GATE en la consola.
  const storeGateRequired =
    !isOwnGuardPage &&
    !(isLocalDevelopment && window.TT_DISABLE_STORE_GATE === true);

  documentElement.classList.add('tt-initializing');
  if (storeGateRequired) {
    // Se agrega antes de que exista <body>. Así ninguna página pública puede
    // pintar su contenido antes de comprobar Firebase.
    documentElement.classList.add('tt-store-gate-pending');
  }

  const TT_CACHE_VERSION = 'tintin-20260715-3';
  const MIN_SHOW_MS = 520;
  const STORE_GATE_TIMEOUT_MS = 4500;
  const SAFETY_MS = 5200;
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

  function isHomePage() {
    const current = currentPath();
    return current.endsWith('/index.html') || /\/$/.test(current);
  }

  function isOldLogo(url) {
    return /logo-splash|logo-tintin|tt-splash-line|tt-intro-fallback/i.test(String(url || ''));
  }

  function savedLogo() {
    try {
      const data = JSON.parse(window.localStorage.getItem('tt_images') || '{}');
      const url = data && data.logo_main;
      if (url && !isOldLogo(url)) return url;
    } catch {}
    return '';
  }

  const HOME_LOADER_IMAGE = 'assets-tintin/images/general/logo.png';
  const INNER_LOADER_IMAGE = 'assets-tintin/images/general/logo.png';
  const DEFAULT_LOGO_SRC = resolveAsset(isHomePage() ? HOME_LOADER_IMAGE : INNER_LOADER_IMAGE);
  const LOGO_SRC = savedLogo() || DEFAULT_LOGO_SRC;

  const CSS = [
    'html.tt-scroll-locked,html.tt-scroll-locked body{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}',
    'body.tt-scroll-locked{position:fixed!important;left:0!important;right:0!important;width:100%!important;overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}',
    'html.tt-store-gate-pending,html.tt-store-gate-blocked{background:#FFF6FA!important}',
    'html.tt-store-gate-pending body> *:not(#tt-loader):not(#tt-store-closed-overlay),html.tt-store-gate-blocked body> *:not(#tt-loader):not(#tt-store-closed-overlay){visibility:hidden!important;pointer-events:none!important;user-select:none!important}',
    'html.tt-store-gate-pending body,html.tt-store-gate-blocked body{overflow:hidden!important;overscroll-behavior:none!important}',
    '#tt-store-closed-overlay{visibility:visible!important;pointer-events:auto!important;user-select:auto!important}',
    '#tt-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#FFF6FA;transition:opacity .38s ease,visibility .38s ease;overflow:hidden;overscroll-behavior:none;touch-action:none}',
    '#tt-loader.tt-out{opacity:0;visibility:hidden;pointer-events:none}',
    '#tt-loader-spin-wrap{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '#tt-loader-logo{position:relative;z-index:1;width:clamp(180px,15vw,230px);max-width:72vw;height:auto;object-fit:contain;display:block;opacity:0;transform:scale(.96);filter:drop-shadow(0 8px 22px rgba(212,106,138,.18));user-select:none;pointer-events:none}',
    '#tt-loader-spin-wrap.tt-ready #tt-loader-logo{animation:tt-logo-in .5s cubic-bezier(.22,.61,.36,1) both,tt-logo-breathe 2.6s ease-in-out .5s infinite}',
    '@keyframes tt-logo-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}',
    '@keyframes tt-logo-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}',
    '@media (max-width:600px){#tt-loader-logo{width:clamp(110px,30vw,150px)}}',
    '@media (min-width:601px) and (max-width:1120px){#tt-loader-logo{width:clamp(145px,20vw,190px)}}',
    '@media (prefers-reduced-motion:reduce){#tt-loader{transition:opacity .01s linear}#tt-loader-spin-wrap.tt-ready #tt-loader-logo{animation:none;opacity:1;transform:none}}',
    '.tt-loader-dots{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:20px;opacity:0}',
    '#tt-loader-spin-wrap.tt-ready .tt-loader-dots{opacity:1;transition:opacity .3s ease .15s}',
    '.tt-loader-dots span{width:9px;height:9px;border-radius:50%;background:var(--pink-dark,#D46A8A);opacity:.35;animation:tt-loader-dot-bounce 1.1s ease-in-out infinite}',
    '.tt-loader-dots span:nth-child(2){animation-delay:.15s}',
    '.tt-loader-dots span:nth-child(3){animation-delay:.3s}',
    '@keyframes tt-loader-dot-bounce{0%,80%,100%{transform:scale(.72);opacity:.35}40%{transform:scale(1.15);opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.tt-loader-dots span{animation:none;opacity:.75}}',
    '#tt-store-gate-emergency-dialog{width:min(100%,460px);max-height:calc(100dvh - 32px);overflow:auto;background:#fff;border-radius:20px;padding:clamp(28px,5vw,40px) clamp(20px,5vw,32px);text-align:center;box-shadow:0 18px 60px rgba(35,12,22,.28);box-sizing:border-box}',
    '#tt-store-gate-emergency-actions{display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap}',
    '.tt-store-gate-emergency-action{display:inline-flex;align-items:center;justify-content:center;min-height:46px;min-width:146px;padding:11px 24px;border-radius:999px;font:700 13px/1.2 Poppins,Arial,sans-serif;text-decoration:none;cursor:pointer;touch-action:manipulation;box-sizing:border-box}',
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

  const DOTS_HTML =
    '<div class="tt-loader-dots"><span></span><span></span><span></span></div>';
  const loader = document.createElement('div');
  loader.id = 'tt-loader';
  loader.setAttribute('aria-hidden', 'true');
  loader.setAttribute('role', 'presentation');
  loader.dataset.state = 'show';
  loader.innerHTML =
    '<div id="tt-loader-spin-wrap"><img id="tt-loader-logo" src="' +
    LOGO_SRC +
    '" alt="" draggable="false" fetchpriority="high" width="220" height="220">' +
    (isHomePage() ? '' : DOTS_HTML) +
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
    if (logo.src !== DEFAULT_LOGO_SRC) {
      logo.src = DEFAULT_LOGO_SRC;
    } else {
      logo.removeEventListener('error', onLogoError);
      logoReady = true;
      logo.style.display = 'none';
      const wrap = document.getElementById('tt-loader-spin-wrap');
      if (wrap) wrap.classList.add('tt-ready');
      if (contentReady) tryHideElegant();
    }
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
          if (img && img.complete) markLogoReady();
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
    // Cada página decide sola cuándo su propio contenido está listo
    // (estructura pintada, carrito cargado, etc.) sin saber nada del
    // resultado de store-gate.js — esa señal puede llegar bastante antes
    // de que la consulta real a Firestore termine. Si se dejara ocultar el
    // loader en ese momento, quedaría una pantalla en blanco (todo el body
    // sigue tapado por tt-store-gate-pending) hasta que el aviso de tienda
    // cerrada recién apareciera un rato después — o nunca, si algo fallaba
    // antes. El listener de 'tintin:store-gate-state' más abajo vuelve a
    // llamar a esta función en cuanto el gate resuelve.
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
    logoReady = !!(logo && logo.complete);
    loader.dataset.state = 'show';
    loader.style.display = '';
    loader.style.touchAction = '';
    loader.style.pointerEvents = '';
    loader.classList.remove('tt-out');
  }

  function setText() {}

  function buildEmergencyLoginUrl() {
    const current =
      (window.location.pathname.split('/').pop() || 'index.html') +
      window.location.search +
      window.location.hash;
    const pathname = window.location.pathname || '/';
    const appDirectory = pathname.endsWith('/')
      ? pathname
      : pathname.slice(0, pathname.lastIndexOf('/') + 1);
    const loginUrl = new URL(`${appDirectory}login.html`, window.location.origin);
    loginUrl.searchParams.set('from', current);
    return loginUrl.href;
  }

  function goToEmergencyLogin(event) {
    event?.preventDefault();
    event?.stopImmediatePropagation?.();
    event?.stopPropagation?.();
    window.location.assign(buildEmergencyLoginUrl());
  }

  function lockEmergencySiblings() {
    if (!document.body) return;
    Array.from(document.body.children).forEach(node => {
      if (node.id === 'tt-loader' || node.id === 'tt-store-closed-overlay') return;
      if (node.dataset.ttEmergencyInert !== '1') {
        node.dataset.ttEmergencyInert = '1';
        node.dataset.ttEmergencyPrevInert = node.inert ? '1' : '0';
        node.dataset.ttEmergencyHadAria = node.hasAttribute('aria-hidden') ? '1' : '0';
        node.dataset.ttEmergencyPrevAria = node.getAttribute('aria-hidden') || '';
      }
      if (!node.inert) node.inert = true;
      if (node.getAttribute('aria-hidden') !== 'true') {
        node.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function showEmergencyStoreGate() {
    if (!storeGateRequired || gateResolved) return;

    gateEmergencyShown = true;
    waitForBody(() => {
      if (gateResolved) return;
      documentElement.classList.remove('tt-store-gate-pending');
      documentElement.classList.add('tt-store-gate-blocked');
      lockEmergencySiblings();

      let overlay = document.getElementById('tt-store-closed-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tt-store-closed-overlay';
        overlay.style.cssText =
          'position:fixed;inset:0;z-index:2147482990;background:rgba(30,10,18,.62);backdrop-filter:blur(7px);display:grid;place-items:center;padding:clamp(16px,3vw,32px);box-sizing:border-box;overflow:auto;pointer-events:auto;touch-action:manipulation';
        document.body.appendChild(overlay);
      }
      overlay.inert = false;
      overlay.removeAttribute('inert');
      overlay.removeAttribute('aria-hidden');
      overlay.innerHTML =
        '<div id="tt-store-gate-emergency-dialog" role="dialog" aria-modal="true" aria-labelledby="tt-store-gate-title">' +
        '<div style="font-size:40px;margin-bottom:14px" aria-hidden="true">⚠️</div>' +
        '<div id="tt-store-gate-title" style="font-weight:800;font-size:clamp(19px,3.2vw,22px);color:#8b2642;margin-bottom:12px">No pudimos comprobar el estado de la tienda</div>' +
        '<p style="font-size:14px;color:#555;line-height:1.65;margin:0 auto 26px;max-width:360px">Por seguridad, el sitio permanece bloqueado. Podés reintentar o iniciar sesión como parte del equipo.</p>' +
        '<div id="tt-store-gate-emergency-actions">' +
        '<button type="button" id="tt-store-gate-emergency-retry" class="tt-store-gate-emergency-action" style="border:0;background:#8b2642;color:#fff">Reintentar</button>' +
        '<a id="tt-store-gate-emergency-login" class="tt-store-gate-emergency-action" href="' +
        buildEmergencyLoginUrl() +
        '" target="_self" style="background:#fff;color:#8b2642!important;border:1.5px solid #d9a9b8">Iniciar sesión</a>' +
        '</div></div>';
      overlay
        .querySelector('#tt-store-gate-emergency-retry')
        ?.addEventListener('click', () => window.location.reload());
      overlay
        .querySelector('#tt-store-gate-emergency-login')
        ?.addEventListener('click', goToEmergencyLogin, { capture: true });

      // Este aviso de emergencia ya es la respuesta final para esta carga.
      // Se retira el loader inmediatamente: no debe quedar tapando el aviso
      // mientras se espera que una página bloqueada anuncie contenido listo.
      gateResolved = true;
      contentReady = true;
      logoReady = true;
      hideNow();
    });
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

  function bootPageRuntime() {
    if (runtimeBooted) return;
    runtimeBooted = true;
    bootGlobalQuality();
    bootHeaderMode();
    bootHeaderDropdownFix();
    bootHeaderScrollHide();
    bootAdminAndProfileFixes();
    bootScrollReveal();
  }

  function bootPublicRuntime() {
    if (runtimeBooted) return;
    runtimeBooted = true;

    // Las páginas públicas ya cargan sus módulos funcionales desde el HTML
    // (productos, colecciones, imágenes, carrito y contenido). Volver a
    // iniciar acá el paquete global de "quality" duplicaba esos renderers y
    // agregaba varios MutationObserver sobre todo el documento. En cuentas
    // autorizadas —incluido Super Admin— esa cascada podía monopolizar el
    // hilo principal y dejar el navegador detenido sobre el loader.
    bootHeaderMode();
    bootHeaderDropdownFix();
    bootHeaderScrollHide();
    bootAdminAndProfileFixes();

    documentElement.classList.remove('tt-initializing', 'tt-parity-guard');
    documentElement.classList.add('tt-ui-ready', 'tt-parity-safe');
  }

  if (storeGateRequired) {
    window.addEventListener(
      'tintin:store-gate-state',
      event => {
        const state = event?.detail?.state || 'unavailable';
        gateResolved = true;

        if (state === 'allowed') {
          // Destapar primero la página. El runtime público liviano arranca en
          // una tarea posterior y no puede retener el loader mientras carga.
          if (contentReady) tryHideElegant();
          // admin-images sí necesita los módulos de administración de Fase 5;
          // el resto de las páginas protegidas usa el runtime público liviano.
          if (isAdminImagesPage) window.setTimeout(bootPageRuntime, 0);
          else window.setTimeout(bootPublicRuntime, 0);
          return;
        }

        // "closed" y "unavailable" ya tienen un overlay final creado por
        // store-gate.js. El loader se quita sin esperar page-ready/load.
        contentReady = true;
        logoReady = true;
        hideNow();
      },
      { passive: true }
    );
    window.setTimeout(() => {
      if (!gateResolved) showEmergencyStoreGate();
    }, STORE_GATE_TIMEOUT_MS);
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
