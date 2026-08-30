(function () {
  'use strict';

  // Cada entrada de una página comienza arriba. El navegador puede restaurar
  // el scroll anterior incluso en una navegación normal o desde bfcache;
  // forzarlo aquí (en head, antes de pintar contenido) evita que cualquier
  // ruta aparezca a mitad de página.
  try { history.scrollRestoration = 'manual'; } catch {}
  function resetEntryScroll() {
    var root = document.documentElement;
    var body = document.body;
    var previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.scrollTop = 0;
    if (body) body.scrollTop = 0;
    requestAnimationFrame(function () {
      window.scrollTo(0, 0);
      root.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      root.style.scrollBehavior = previous;
    });
  }
  resetEntryScroll();
  document.addEventListener('DOMContentLoaded', resetEntryScroll, { once: true });
  window.addEventListener('load', resetEntryScroll, { once: true, passive: true });
  window.addEventListener('pageshow', resetEntryScroll, { passive: true });

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

  // Preconecta (DNS + TLS) con los orígenes que están en el camino crítico
  // de CUALQUIER página antes de que el HTML los descubra por sí solo:
  // Cloudinary (hero, editorial, productos, colecciones), el SDK de
  // Firestore (gstatic) y el propio backend de Firestore — los dos últimos
  // se piden apenas carga firebase.js, mucho antes que cualquier imagen.
  [
    { id: 'tt-cloudinary-preconnect', href: 'https://res.cloudinary.com' },
    { id: 'tt-gstatic-preconnect', href: 'https://www.gstatic.com' },
    { id: 'tt-firestore-preconnect', href: 'https://firestore.googleapis.com' },
  ].forEach(function (origin) {
    if (!document.head || document.getElementById(origin.id)) return;
    const preconnect = document.createElement('link');
    preconnect.id = origin.id;
    preconnect.rel = 'preconnect';
    preconnect.href = origin.href;
    preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);

    const dnsPrefetch = document.createElement('link');
    dnsPrefetch.rel = 'dns-prefetch';
    dnsPrefetch.href = origin.href;
    document.head.appendChild(dnsPrefetch);
  });

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

  const TT_CACHE_VERSION = 'tintin-20260825-scroll-reveal-2';
  // 120ms (fijado en #396 para matar esperas artificiales) resultó por
  // debajo del umbral de percepción humana: en conexiones rápidas el logo y
  // el texto de sección ("Página Principal", "Catálogo", "Producto") no
  // llegan a registrarse visualmente. 400ms es el estándar habitual de
  // splash/loading screens (suficiente para que se perciba la marca, sin
  // reintroducir la espera artificial de 900ms que hubo antes de #396).
  const MIN_SHOW_MS = 400;
  // Se reportó (con evidencia real, recurrente, no puntual) el aviso de
  // emergencia "No pudimos comprobar el estado de la tienda" en un equipo
  // donde el propio loader ya llevaba ~6s arriba antes de que este tope se
  // cumpliera — cargar cargador-pagina.js → control-tienda.js → Firebase Auth/
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
  // Cuenta tareas asíncronas que deben terminar antes de ocultar el loader,
  // además de contentReady/gate. La usa entrada-navegacion-publica.js para
  // que el header/nav real (que se monta en el DOM de forma asíncrona) esté
  // insertado antes de revelar la página — si no, el contenido se corre
  // visiblemente apenas termina de montarse (layout shift real, medido en
  // producción tras acortar MIN_SHOW_MS). No agrega demora artificial: solo
  // bloquea mientras esa tarea puntual sigue en curso.
  let pendingWaits = 0;
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

  const NEXT_LOADER_LABEL_KEY = 'tt_next_loader_label';
  const NEXT_LOADER_LABEL_MAX_AGE_MS = 8000;

  function stashNextLoaderLabel(name) {
    try {
      window.sessionStorage.setItem(
        NEXT_LOADER_LABEL_KEY,
        JSON.stringify({ name: name, ts: Date.now() })
      );
    } catch {}
  }

  function consumeNextLoaderLabel() {
    try {
      const raw = window.sessionStorage.getItem(NEXT_LOADER_LABEL_KEY);
      if (!raw) return '';
      window.sessionStorage.removeItem(NEXT_LOADER_LABEL_KEY);
      const data = JSON.parse(raw);
      if (!data || typeof data.name !== 'string' || !data.name.trim()) return '';
      if (
        typeof data.ts !== 'number' ||
        Date.now() - data.ts > NEXT_LOADER_LABEL_MAX_AGE_MS
      ) {
        return '';
      }
      return data.name.trim();
    } catch {
      return '';
    }
  }

  // Cualquier tarjeta o link que lleve a la ficha /product (o al alias
  // product.html) guarda el nombre antes de navegar, porque el id no es legible
  // y el loader de la página siguiente no tiene los datos del catálogo.
  document.addEventListener(
    'click',
    function (event) {
      const anchor = event.target && event.target.closest && event.target.closest('a[href]');
      if (!anchor) return;
      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      const productPath = url.pathname.replace(/\/+$/, '').split('/').pop() || '';
      if (!/^product(?:\.html)?$/i.test(productPath)) return;
      const card = anchor.closest('.tt-product-card, .tt-card, .tt-look-card');
      let name = '';
      if (card) {
        const nameEl = card.querySelector(
          '.tt-product-name, .tt-card-name, .tt-look-card-name'
        );
        if (nameEl) name = nameEl.textContent;
      }
      if (!name) {
        const label = anchor.getAttribute('aria-label') || '';
        const match = label.match(/^Ver\s+(.+)$/i);
        name = match ? match[1] : anchor.textContent;
      }
      name = String(name || '').trim();
      if (name) stashNextLoaderLabel(name);
    },
    true
  );

  const CATALOG_CATEGORY_LABELS = {
    relojes: 'Relojes',
    bolsos: 'Bolsos',
    collares: 'Collares',
    aros: 'Aros',
    pulseras: 'Pulseras',
    anillos: 'Anillos',
    tobilleras: 'Tobilleras',
    brazaletes: 'Brazaletes',
    earcuff: 'Ear Cuffs',
    armcuff: 'Arm Cuffs',
    gafas: 'Gafas',
    joyeros: 'Joyeros'
  };

  const CATALOG_CATEGORY_ALIASES = {
    bags: 'bolsos', bag: 'bolsos', bolso: 'bolsos',
    reloj: 'relojes', watch: 'relojes', watches: 'relojes',
    arete: 'aros', aretes: 'aros', earring: 'aros', earrings: 'aros',
    collar: 'collares', necklace: 'collares', cadena: 'collares', cadenas: 'collares',
    pulsera: 'pulseras', bracelet: 'pulseras',
    anillo: 'anillos', ring: 'anillos',
    tobillera: 'tobilleras', ankle: 'tobilleras',
    brazalete: 'brazaletes',
    'ear cuff': 'earcuff', earcuffs: 'earcuff',
    'arm cuff': 'armcuff', armcuffs: 'armcuff',
    lente: 'gafas', lentes: 'gafas', sunglasses: 'gafas',
    joyero: 'joyeros', 'jewelry box': 'joyeros'
  };

  const PAGE_BRAND_LABELS = {
    index: 'Página Principal',
    '': 'Página Principal',
    contact: 'Contacto',
    login: 'Iniciar Sesión',
    about: 'Quiénes Somos',
    nosotros: 'Quiénes Somos',
    perfil: 'Mi Perfil',
    collections: 'Colecciones',
    checkout: 'Finalizar Compra',
    envios: 'Envíos',
    'cambios-devoluciones': 'Cambios y Devoluciones',
    'preguntas-frecuentes': 'Preguntas Frecuentes',
    terminos: 'Términos y Condiciones',
    privacidad: 'Privacidad',
    admin: 'Panel Admin',
    'admin-images': 'Gestión de Imágenes',
    404: 'Página no Encontrada'
  };

  function currentPageFile() {
    // Cloudflare Pages sirve URLs limpias (/contact, /about, sin
    // ".html"), pero en local o con enlaces directos puede llegar con la
    // extensión igual — hay que aceptar ambas formas por igual.
    const last = currentPath().split('/').pop() || '';
    return last.replace(/\.html$/, '');
  }

  function computeBrandLabel() {
    const file = currentPageFile() || 'index';

    if (file === 'catalogo') {
      let cat = '';
      try {
        cat = (new URLSearchParams(window.location.search).get('cat') || '')
          .toLowerCase()
          .trim();
      } catch {}
      cat = CATALOG_CATEGORY_ALIASES[cat] || cat;
      if (!cat || cat === 'todos') return 'Catálogo Principal';
      return CATALOG_CATEGORY_LABELS[cat]
        ? 'Catálogo - ' + CATALOG_CATEGORY_LABELS[cat]
        : 'Catálogo Principal';
    }

    if (file === 'product') {
      const stashed = consumeNextLoaderLabel();
      return stashed ? 'Producto - ' + stashed : 'Producto';
    }

    return PAGE_BRAND_LABELS[file] || 'accesorios & relojes';
  }

  const BRAND_LABEL = computeBrandLabel();
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
    '#tt-loader-logo{position:relative;z-index:1;display:block;width:var(--tt-loader-brand-width);max-width:100%;height:auto;object-fit:contain;opacity:1;transform:none;clip-path:none;filter:drop-shadow(0 8px 20px rgba(202,1,105,.14));user-select:none;pointer-events:none}',
    '#tt-loader-wordmark{position:relative;z-index:1;margin-top:clamp(6px,1vw,10px);font-family:Montserrat;font-weight:800;font-size:clamp(19px,2.5vw,27px);line-height:1;letter-spacing:.01em;color:#CA0169!important;white-space:nowrap;opacity:0;transform:scale(1.09)}',
    '#tt-loader-spin-wrap.tt-ready #tt-loader-wordmark{animation:tt-logo-fade-scale-in .6s cubic-bezier(.22,.61,.36,1) both}',
    '#tt-loader-wordmark .tt-loader-wordmark-i{position:relative;display:inline-block;color:#CA0169!important}',
    '#tt-loader-wordmark .tt-loader-wordmark-i::before,#tt-loader-wordmark .tt-loader-wordmark-i::after{content:"";position:absolute;top:-.24em;width:.15em;height:.24em;background:#CA0169;border-radius:.15em .15em 0 0}',
    '#tt-loader-wordmark .tt-loader-wordmark-i::before{left:50%;transform:rotate(-45deg);transform-origin:0 100%}',
    '#tt-loader-wordmark .tt-loader-wordmark-i::after{right:50%;transform:rotate(45deg);transform-origin:100% 100%}',
    '#tt-loader-brand-subtitle{margin-top:clamp(6px,1vw,9px);max-width:100%;padding:0 6px;box-sizing:border-box;color:#CA0169!important;font-family:Montserrat;font-size:clamp(12px,1.3vw,14px);font-weight:500;line-height:1.25;letter-spacing:.055em;text-align:center;opacity:0;transform:scale(1.09);white-space:normal}',
    '#tt-loader-spin-wrap.tt-ready #tt-loader-brand-subtitle{animation:tt-logo-fade-scale-in .6s cubic-bezier(.22,.61,.36,1) both}',
    '.tt-loader-spinner{width:var(--tt-loader-spinner-size);height:var(--tt-loader-spinner-size);display:grid;margin-top:clamp(24px,2.8vw,34px);opacity:0;transform:scale(1.09);animation:tt-loader-spinner-shell 3s infinite}',
    '#tt-loader-spin-wrap.tt-ready .tt-loader-spinner{animation:tt-logo-fade-scale-in .6s cubic-bezier(.22,.61,.36,1) both,tt-loader-spinner-shell 3s infinite}',
    '.tt-loader-spinner::before,.tt-loader-spinner::after{content:"";grid-area:1/1;border:var(--tt-loader-spinner-border) solid;border-radius:50%;border-color:#CA0169 #CA0169 transparent transparent;mix-blend-mode:multiply;animation:tt-loader-spinner-ring 1s infinite linear;box-sizing:border-box}',
    '.tt-loader-spinner::after{border-color:transparent transparent rgba(202,1,105,.22) rgba(202,1,105,.22);animation-direction:reverse}',
    '@keyframes tt-loader-spinner-shell{100%{transform:rotate(1turn)}}',
    '@keyframes tt-loader-spinner-ring{100%{transform:rotate(1turn)}}',
    '#tt-loader-status{display:flex;flex-direction:column;align-items:center;max-width:min(86vw,440px);margin-top:clamp(15px,2vw,22px);padding:0 12px;box-sizing:border-box}',
    '#tt-loader-status:empty{display:none}',
    '#tt-loader-title{font-family:Montserrat;font-size:clamp(11px,1.5vw,13px);font-weight:750;line-height:1.35;letter-spacing:.04em;color:#A00055!important;text-align:center;overflow-wrap:anywhere}',
    '#tt-loader-subtitle{margin-top:5px;font-family:Montserrat;font-size:clamp(10px,1.35vw,12px);font-weight:600;line-height:1.45;color:#A00055!important;text-align:center;opacity:.78;overflow-wrap:anywhere}',
    '@media (min-width:601px) and (max-width:1024px){#tt-loader-spin-wrap{--tt-loader-brand-width:clamp(178px,29vw,220px);--tt-loader-spinner-size:38px;--tt-loader-spinner-border:7px;width:min(100%,310px)}#tt-loader-brand-subtitle{font-size:clamp(12px,1.8vw,15px);margin-top:11px}.tt-loader-spinner{margin-top:25px}}',
    '@media (max-width:600px){#tt-loader{padding:max(16px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left))}#tt-loader-spin-wrap{--tt-loader-brand-width:clamp(120px,43vw,158px);--tt-loader-spinner-size:30px;--tt-loader-spinner-border:5px;width:min(100%,230px);max-width:calc(100vw - 28px)}#tt-loader-brand-subtitle{font-size:clamp(10px,3.2vw,12px);margin-top:8px;letter-spacing:.045em}.tt-loader-spinner{margin-top:20px}#tt-loader-status{margin-top:14px;padding:0 8px}#tt-loader-title{font-size:clamp(10px,3.1vw,12px)}#tt-loader-subtitle{font-size:clamp(9px,2.8vw,11px)}}',
    '@media (max-width:360px){#tt-loader-spin-wrap{--tt-loader-brand-width:clamp(112px,42vw,140px);--tt-loader-spinner-size:27px;--tt-loader-spinner-border:4px}#tt-loader-brand-subtitle{font-size:10px}.tt-loader-spinner{margin-top:17px}}',
    // css/quality/calidad-interfaz.css aplica *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important}
    // bajo reduced-motion — sin !important acá, ese reset gana y el anillo se ve congelado
    // (una vuelta imperceptible y listo) en vez de seguir señalando "todavía estoy cargando".
    // Un spinner de progreso es estado del sistema, no una animación decorativa: se lo excluye
    // a propósito del apagado general de movimiento.
    '@media (prefers-reduced-motion:reduce){#tt-loader{transition:opacity .01s linear}#tt-loader-spin-wrap.tt-ready #tt-loader-wordmark,#tt-loader-spin-wrap.tt-ready #tt-loader-brand-subtitle,#tt-loader-spin-wrap.tt-ready .tt-loader-spinner{animation:none;opacity:1;transform:none;clip-path:none}.tt-loader-spinner::before,.tt-loader-spinner::after{animation-duration:1.6s!important;animation-iteration-count:infinite!important}}',
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
    '<div id="tt-loader-wordmark" aria-hidden="true">T<span class="tt-loader-wordmark-i">I</span>NT<span class="tt-loader-wordmark-i">I</span>N</div>' +
    '<div id="tt-loader-brand-subtitle">' +
    escText(BRAND_LABEL) +
    '</div>' +
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
    if (pendingWaits > 0) return;
    const enough = Date.now() - START >= MIN_SHOW_MS;
    if (!enough) {
      const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - START));
      window.setTimeout(tryHideElegant, Math.max(wait, 32));
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
          '<span style="min-width:0;flex:1;font:600 12px/1.45 Montserrat">Conexión inestable. Podés explorar la tienda; las compras se habilitan al reconectar.</span>' +
          '<button type="button" aria-label="Reintentar conexión" style="min-width:44px;min-height:44px;padding:8px 12px;border:0;border-radius:999px;background:#ad3f67;color:#fff;font:800 12px/1 Montserrat;cursor:pointer">Reintentar</button>';
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
    const url = '/api/public-catalog?resource=storeGate';

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
        // Acepta el contrato del endpoint protegido y conserva el formato
        // Firestore anterior para despliegues que todavía lo entreguen.
        const storeOpen = payload?.data?.storeOpen === true ||
          payload?.fields?.storeOpen?.booleanValue === true;
        if (
          payload?.ok !== true && payload?.fields?.storeOpen?.booleanValue !== true ||
          payload?.resource && payload.resource !== 'storeGate' ||
          storeOpen !== true ||
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
      importSibling('quality/calidad-interfaz.js', 'UI Quality');
    }
  }

  function bootStoreGate() {
    if (!storeGateRequired) return;
    importSibling('core/store-gate/control-tienda.js', 'Store Gate', showEmergencyStoreGate);
  }

  function bootHeaderMode() {
    if (!window.TintinHeaderModeBooted) {
      importSibling('components/navigation/compartido/visibilidad-navegacion-por-dispositivo.js', 'Header Mode');
    }
  }

  function bootHeaderDropdownFix() {
    if (window.TintinSurfaceController) return;
    if (!window.TintinHeaderDropdownFixBooted) {
      importSibling('components/navigation/compartido/compatibilidad-menus-desplegables.js', 'Header Dropdown Fix');
    }
  }

  function bootHeaderAccountFix() {
    if (window.TintinSurfaceController) return;
    if (!window.TintinAccountMobileFixBooted) {
      importSibling('components/navigation/compartido/compatibilidad-cuenta-movil.js', 'Header Account Fix');
    }
  }

  function bootSiteActivity() {
    if (!window.TintinSiteActivityBooted) {
      window.TINTIN_ENABLE_PUBLIC_ACTIVITY = true;
      importSibling('analytics/actividad-sitio.js', 'Site Activity');
    }
  }

  function bootHeaderScrollHide() {
    if (!window.TintinHeaderScrollHideBooted) {
      importSibling('components/navigation/compartido/ocultar-encabezado-al-desplazar.js', 'Header Scroll Hide');
    }
  }

  function bootAdminAndProfileFixes() {
    const current = currentPath();
    if (current.endsWith('/admin.html') || current.endsWith('/admin')) {
      importSibling('admin/orders/eliminacion-pedidos-admin.js', 'Admin Order Delete Fix');
      importSibling('admin/content/control-bienvenida-admin.js', 'Admin Welcome Control');
      importSibling('admin/ajuste-barra-lateral-movil-admin.js', 'Admin Mobile Sidebar Fix');
      importSibling('admin/settings/control-tienda-admin.js', 'Admin Store State Sync');
    }
    if (current.endsWith('/perfil.html') || current.endsWith('/perfil')) {
      importSibling('pages/profile/correccion-estadisticas-pedidos-perfil.js', 'Profile Order Stats Fix');
    }
  }

  function bootScrollReveal() {
    if (!window.TintinGlobalScrollRevealBooted) {
      importSibling('quality/revelado-desplazamiento-global.js?tt-reveal=20260825-2', 'Scroll Reveal');
    }
  }

  function bootImagePerformance() {
    if (!window.TintinImagePerformanceBooted) {
      importSibling('components/images/rendimiento-imagenes.js', 'Image Performance');
    }
  }

  function bootImagesPhase5Public() {
    if (!window.TintinImagesPhase5Booted) {
      importSibling('components/images/gestion-imagenes.js', 'Images Phase 5');
    }
  }

  function bootCollectionsPhase4Public() {
    if (!window.TintinCollectionsPhase4Booted) {
      importSibling('pages/collections/presentacion-colecciones.js', 'Collections Phase 4');
    }
  }

  function bootCartSyncPublic() {
    importSibling('components/cart/sincronizacion-carrito.js', 'Cart Sync');
  }

  function bootFavoritesPublic() {
    importSibling('components/favorites/sincronizacion-favoritos.js', 'Favorites');
  }

  function bootThemeColorSanitizerPublic() {
    if (!window.TintinThemeColorSanitizerBooted) {
      importSibling('components/color/normalizador-color-tema.js', 'Theme Color Sanitizer');
    }
  }

  function bootPageAuditFixPublic() {
    if (!window.TintinPageAuditFixBooted) {
      importSibling('quality/correccion-auditoria-pagina.js', 'Page Audit Fix');
    }
  }

  function bootPhase8UiUx() {
    if (!document.getElementById('tt-phase8-ui-ux-css')) {
      const link = document.createElement('link');
      link.id = 'tt-phase8-ui-ux-css';
      link.rel = 'stylesheet';
      link.href = resolveAsset('css/quality/experiencia-interfaz.css');
      document.head.appendChild(link);
    }
    if (!window.TintinUX?.booted) {
      importSibling('quality/experiencia-interfaz.js', 'Phase 8 UI/UX');
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

    documentElement.classList.remove('tt-initializing', 'tt-parity-guard');
    documentElement.classList.add('tt-ui-ready', 'tt-parity-safe');
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
    bootFavoritesPublic();
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
    // Si el store gate nunca emitió ningún estado (ni "allowed", ni
    // "degraded", ni bloqueado), bootPublicRuntime()/bootPageRuntime()
    // jamás corrieron: sin esto, tt-initializing quedaba pegado para
    // siempre y body.tt-home-premium seguía con visibility:hidden bajo
    // un loader ya oculto (ver css/pages/home/ajuste-inicio.css).
    if (isAdminImagesPage) bootPageRuntime();
    else bootPublicRuntime();
  }, SAFETY_MS);

  function beginWait() {
    pendingWaits += 1;
  }
  function endWait() {
    pendingWaits = Math.max(0, pendingWaits - 1);
    if (pendingWaits === 0 && contentReady) tryHideElegant();
  }

  window.TintinLoader = {
    ready,
    hide: hideNow,
    show,
    setText,
    lockScroll,
    unlockScroll,
    beginWait,
    endWait
  };
  window.ttPageReady = ready;
})();
