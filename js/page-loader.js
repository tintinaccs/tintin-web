(function () {
  'use strict';

  // El sitio real vive en tintinaccesorios.pages.dev — el único dominio
  // donde el ingreso con Google por redirección (sin ventanas emergentes)
  // puede funcionar en cualquier navegador, porque ahí la página y el
  // authDomain de Firebase son el MISMO origen (ver js/firebase.js). Si
  // alguien entra por el dominio viejo de GitHub Pages, se lo lleva a la
  // misma página en pages.dev conservando ruta, parámetros y hash; sin
  // esto, quien navegue por github.io queda atrapado en un bucle de login
  // (Google acepta, pero la sesión queda guardada en el otro dominio y el
  // navegador no permite leerla desde acá).
  if (window.location.hostname === 'tintinaccs.github.io') {
    try {
      const strippedPath = window.location.pathname.replace(/^\/tintin-web\/?/, '/');
      window.location.replace(
        'https://tintinaccesorios.pages.dev' + strippedPath +
        window.location.search + window.location.hash
      );
      return;
    } catch {}
  }

  if (window.TintinLoader) return;

  // Preconecta con Cloudinary (DNS + TLS) antes de que se descubra la
  // primera imagen real — recorta el primer byte de cualquier foto servida
  // desde ahí (hero, editorial, Nosotros, logo, productos, colecciones) en
  // TODAS las páginas, sin depender de que cada HTML lo declare por separado.
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

  const TT_CACHE_VERSION = 'tintin-20260722-order-delete-2';
  const MIN_SHOW_MS = 520;
  // Se reportó (con evidencia real, recurrente, no puntual) el aviso de
  // emergencia "No pudimos comprobar el estado de la tienda" en un equipo
  // donde el propio loader ya llevaba ~6s arriba antes de que este tope se
  // cumpliera — cargar page-loader.js → store-gate.js → Firebase Auth/
  // Firestore (todos módulos ES encadenados, algunos desde el CDN de
  // Google) puede tardar más que 4.5-5.2s en una red o equipo lentos. Se
  // duplica el margen sin tocar el comportamiento "fail closed": si de
  // verdad no se puede comprobar el estado, se sigue bloqueando igual, solo
  // que se le da más tiempo real a la conexión antes de decidir eso.
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

  // Cloudflare Pages sirve URLs limpias (/catalogo, no /catalogo.html) —
  // el nombre de archivo real solo aparece completo en desarrollo local.
  // Sacar el ".html" acá, una sola vez, es lo que le permite a todo lo que
  // sigue (isHomePage, PAGE_TITLES) funcionar igual con los dos formatos.
  function currentFile() {
    const file = currentPath().split('/').pop() || '';
    return file.replace(/\.html$/, '');
  }

  function isHomePage() {
    if (/\/$/.test(currentPath())) return true;
    const file = currentFile();
    return file === '' || file === 'index';
  }

  // Título fijo por página, en mayúsculas, mostrado entre el logo y los
  // puntitos de carga en TODAS las páginas menos el inicio (que no lleva
  // ninguno). Es estático a propósito (no depende de datos de Firestore ni
  // de parámetros como ?cat=): cualquier búsqueda async agregaría justo la
  // demora que este cambio busca evitar.
  const PAGE_TITLES = {
    catalogo: 'CATÁLOGO',
    collections: 'COLECCIONES',
    product: 'PRODUCTO',
    about: 'NOSOTROS',
    nosotros: 'NOSOTROS',
    contact: 'CONTACTO',
    checkout: 'FINALIZAR COMPRA',
    perfil: 'MI PERFIL',
    login: 'INGRESAR',
    admin: 'PANEL DE ADMINISTRACIÓN',
    'admin-images': 'BIBLIOTECA DE IMÁGENES',
    envios: 'ENVÍOS',
    'cambios-devoluciones': 'CAMBIOS Y DEVOLUCIONES',
    'preguntas-frecuentes': 'PREGUNTAS FRECUENTES',
    terminos: 'TÉRMINOS Y CONDICIONES',
    privacidad: 'PRIVACIDAD',
    '404': 'PÁGINA NO ENCONTRADA'
  };

  function defaultPageTitle() {
    if (isHomePage()) return '';
    return PAGE_TITLES[currentFile()] || '';
  }

  // login.html no puede mantener su propio saludo ("Hola de nuevo, .../
  // genérico para cuentas nuevas") visible después de saltar a index.html —
  // la navegación tira abajo ese loader entero. Lo deja guardado acá mismo
  // (ver stashPostLoginGreeting en login.html) para que este, el loader de
  // la página de destino, lo recoja y lo siga mostrando un instante — la
  // única razón por la que el inicio (que normalmente no lleva título)
  // llega a mostrar uno acá.
  const POST_LOGIN_GREETING_KEY = 'tt_post_login_greeting';
  const POST_LOGIN_GREETING_MAX_AGE_MS = 8000;

  function consumePostLoginGreeting() {
    try {
      const raw = window.sessionStorage.getItem(POST_LOGIN_GREETING_KEY);
      if (!raw) return null;
      window.sessionStorage.removeItem(POST_LOGIN_GREETING_KEY);
      const data = JSON.parse(raw);
      if (!data || typeof data.title !== 'string' || !data.title.trim()) return null;
      if (typeof data.ts !== 'number' || Date.now() - data.ts > POST_LOGIN_GREETING_MAX_AGE_MS) return null;
      return data;
    } catch {
      return null;
    }
  }

  const postLoginGreeting = consumePostLoginGreeting();

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
    // Sin transición: el cambio de logo de carga a contenido final tiene que
    // ser directo, de un punto a otro, nunca un cross-fade visible del fondo
    // claro del loader mezclándose con el contenido de abajo (aunque ese
    // contenido ya esté 100% listo y correcto, la mezcla en sí se percibe
    // como "otro paso" antes de llegar al resultado final).
    '#tt-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#FFF6FA;transition:opacity .01s linear,visibility .01s linear;overflow:hidden;overscroll-behavior:none;touch-action:none}',
    '#tt-loader.tt-out{opacity:0;visibility:hidden;pointer-events:none}',
    '#tt-loader-spin-wrap{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '#tt-loader-logo{position:relative;z-index:1;width:clamp(180px,15vw,230px);max-width:72vw;height:auto;object-fit:contain;display:block;opacity:0;transform:scale(.96);filter:drop-shadow(0 8px 22px rgba(212,106,138,.18));user-select:none;pointer-events:none}',
    '#tt-loader-spin-wrap.tt-ready #tt-loader-logo{animation:tt-logo-in .5s cubic-bezier(.22,.61,.36,1) both,tt-logo-heartbeat 1.8s ease-in-out .5s infinite}',
    '@keyframes tt-logo-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}',
    // Doble pulso (lub-dub) como un latido real, seguido de una pausa —
    // no una respiración lenta y pareja. Debe notarse a simple vista.
    '@keyframes tt-logo-heartbeat{0%,100%{transform:scale(1)}14%{transform:scale(1.14)}28%{transform:scale(1.03)}42%{transform:scale(1.14)}58%{transform:scale(1)}}',
    '@media (max-width:600px){#tt-loader-logo{width:clamp(110px,30vw,150px)}}',
    '@media (min-width:601px) and (max-width:1120px){#tt-loader-logo{width:clamp(145px,20vw,190px)}}',
    '@media (prefers-reduced-motion:reduce){#tt-loader{transition:opacity .01s linear}#tt-loader-spin-wrap.tt-ready #tt-loader-logo{animation:none;opacity:1;transform:none}}',
    // color con !important: styles.css aplica "color:var(--tt-text)!important"
    // a cualquier div (entre otras etiquetas) para el texto normal del sitio.
    // Sin este !important esa regla le gana a esta por especificidad igual +
    // orden de carga, y el título/subtítulo del loader terminan en gris
    // oscuro en vez del rosa de marca que se ve acá.
    '#tt-loader-title{margin-top:16px;font-family:Montserrat;font-size:clamp(12px,2.6vw,15px);font-weight:800;letter-spacing:.1em;color:var(--pink-dark,#AD3F67)!important;text-align:center;opacity:0;max-width:86vw;padding:0 12px;box-sizing:border-box;word-break:break-word}',
    '#tt-loader-spin-wrap.tt-ready #tt-loader-title{opacity:1;transition:opacity .3s ease .1s}',
    '#tt-loader-subtitle{margin-top:6px;font-family:Montserrat;font-size:clamp(11px,2.2vw,13px);font-weight:600;color:#9e7a89!important;text-align:center;opacity:0;max-width:86vw;padding:0 12px;box-sizing:border-box}',
    '#tt-loader-spin-wrap.tt-ready #tt-loader-subtitle{opacity:1;transition:opacity .3s ease .15s}',
    '@media (max-width:600px){#tt-loader-title{font-size:clamp(11px,3.4vw,13px);letter-spacing:.06em;margin-top:14px}#tt-loader-subtitle{font-size:clamp(10px,2.8vw,12px)}}',
    '@media (prefers-reduced-motion:reduce){#tt-loader-title,#tt-loader-subtitle{transition:none}}',
    '.tt-loader-dots{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:20px;opacity:0}',
    '#tt-loader-spin-wrap.tt-ready .tt-loader-dots{opacity:1;transition:opacity .3s ease .15s}',
    '.tt-loader-dots span{width:9px;height:9px;border-radius:50%;background:var(--pink-dark,#AD3F67);opacity:.35;animation:tt-loader-dot-bounce 1.1s ease-in-out infinite}',
    '.tt-loader-dots span:nth-child(2){animation-delay:.15s}',
    '.tt-loader-dots span:nth-child(3){animation-delay:.3s}',
    '@keyframes tt-loader-dot-bounce{0%,80%,100%{transform:scale(.72);opacity:.35}40%{transform:scale(1.15);opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.tt-loader-dots span{animation:none;opacity:.75}}',
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

  const DOTS_HTML =
    '<div class="tt-loader-dots"><span></span><span></span><span></span></div>';
  function escText(value) {
    const d = document.createElement('div');
    d.textContent = String(value == null ? '' : value);
    return d.innerHTML;
  }
  const initialTitle = postLoginGreeting ? postLoginGreeting.title : defaultPageTitle();
  const initialSubtitle = postLoginGreeting && postLoginGreeting.subtitle ? postLoginGreeting.subtitle : '';
  const showLoaderExtras = !isHomePage() || !!postLoginGreeting;
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
    '<div id="tt-loader-spin-wrap"><img id="tt-loader-logo" src="' +
    LOGO_SRC +
    '" alt="" draggable="false" fetchpriority="high" width="220" height="220">' +
    (showLoaderExtras ? TITLE_HTML + SUBTITLE_HTML + DOTS_HTML : '') +
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

  // Reemplaza el título fijo de la página (si lo hay) por un mensaje de
  // estado puntual — lo usa login.html mientras procesa el ingreso
  // ("Hola de nuevo, correo@ejemplo.com!" + "Aguardá un momento…"). Pasar
  // '' como título lo saca; el subtítulo es opcional y se sigue el mismo
  // criterio. No fuerza mayúsculas por CSS — lo que se ve depende de cómo
  // venga el texto (los títulos fijos de página ya vienen en mayúscula).
  function setText(text, subtitle) {
    const value = String(text == null ? '' : text).trim();
    let titleEl = document.getElementById('tt-loader-title');
    if (!value) {
      if (titleEl) titleEl.remove();
    } else {
      if (!titleEl) {
        const wrap = document.getElementById('tt-loader-spin-wrap');
        if (wrap) {
          titleEl = document.createElement('div');
          titleEl.id = 'tt-loader-title';
          const dots = wrap.querySelector('.tt-loader-dots');
          if (dots) wrap.insertBefore(titleEl, dots);
          else wrap.appendChild(titleEl);
        }
      }
      if (titleEl) titleEl.textContent = value;
    }

    const subValue = String(subtitle == null ? '' : subtitle).trim();
    let subEl = document.getElementById('tt-loader-subtitle');
    if (!subValue) {
      if (subEl) subEl.remove();
      return;
    }
    if (!subEl) {
      const wrap = document.getElementById('tt-loader-spin-wrap');
      if (!wrap) return;
      subEl = document.createElement('div');
      subEl.id = 'tt-loader-subtitle';
      const dots = wrap.querySelector('.tt-loader-dots');
      if (dots) wrap.insertBefore(subEl, dots);
      else wrap.appendChild(subEl);
    }
    subEl.textContent = subValue;
  }

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

  function bootHeaderAccountFix() {
    if (!window.TintinAccountMobileFixBooted) {
      importSibling('header-account-mobile-fix.js', 'Header Account Fix');
    }
  }

  function bootSiteActivity() {
    if (!window.TintinSiteActivityBooted) {
      // Reactivado tras el incidente de cuota: ahora las escrituras de
      // presencia/tráfico están limitadas por reglas (freno de 20s por
      // visitante) y protegidas por Firebase App Check, así que ya no
      // hace falta mantener el interruptor apagado por defecto.
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

  // Estos 5 módulos solo se cargaban a través de ui-quality.js (bootGlobalQuality),
  // que bootPublicRuntime dejó de llamar para evitar observadores duplicados
  // (ver #86). Pero ninguno de los 5 tiene otra forma de cargarse en páginas
  // públicas — sin esto, ni las imágenes de settings/images, ni las colecciones
  // de Fase 4, ni el carrito multi-pestaña, ni el esquema de colores de
  // Apariencia se aplican nunca fuera de admin-images.html. Se importan acá
  // directamente (mismo patrón que el resto de este archivo) para no volver a
  // traer el paquete pesado de ui-quality.js que causó el freeze original.
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
  }

  function bootPublicRuntime() {
    if (runtimeBooted) return;
    runtimeBooted = true;

    // Volver a traer el paquete completo de ui-quality.js acá (css(), forms(),
    // refresh() con su timer, bootMobileHeader duplicando bootHeaderMode, etc.)
    // agregaba varios MutationObserver sobre todo el documento y eso fue lo que
    // congelaba el navegador (#86) — por eso las funciones de abajo importan
    // cada módulo por separado, igual que hace este archivo con el resto.
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
