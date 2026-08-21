/* TINTIN — adaptador de arranque de la navegación pública modular. */
/* Contrato: id="search-panel" role="dialog" · id="cart-drawer" role="dialog" · id="collections-sheet" role="dialog" · id="tt-tablet-menu" role="dialog". */
(function () {
  'use strict';

  if (window.TintinPublicShellBootstrapStarted) return;
  window.TintinPublicShellBootstrapStarted = true;

  // Paridad visual de la navegación: mobile ya usa una superficie blanca
  // opaca. Desktop y tablet deben verse igual, incluida la campana de
  // notificaciones, aunque otra hoja global intente dejar esos controles
  // transparentes o con blur.
  if (!document.getElementById('tt-notification-navigation-solid-style')) {
    const style = document.createElement('style');
    style.id = 'tt-notification-navigation-solid-style';
    style.textContent = `
      @media (min-width: 768px) {
        html body #tt-header-desktop-tablet,
        html body #tt-header-tablet {
          background: #FFFFFF !important;
          background-color: #FFFFFF !important;
          background-image: none !important;
          opacity: 1 !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          mix-blend-mode: normal !important;
        }

        html body #btn-notifications,
        html body #btn-notifications-tablet {
          background: #FFFFFF !important;
          background-color: #FFFFFF !important;
          background-image: none !important;
          border: 1px solid #F1C8D5 !important;
          opacity: 1 !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          mix-blend-mode: normal !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // El hero de Inicio recibe primero el caché local de imágenes y después el
  // snapshot autoritativo de Firestore. El caché puede contener una portada
  // anterior (por ejemplo, el reloj que se veía durante unas décimas antes de
  // la imagen actual). Esta barrera independiente impide que cualquier imagen
  // del caché llegue a pintarse: solo libera el <img> después de la segunda
  // señal de images-phase5, que corresponde a la configuración confirmada.
  const normalizedPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  const isHomePage = normalizedPath === '/' || /\/index(?:\.html)?$/i.test(normalizedPath);
  if (isHomePage && !document.getElementById('tt-authoritative-hero-guard-style')) {
    const heroGuardStyle = document.createElement('style');
    heroGuardStyle.id = 'tt-authoritative-hero-guard-style';
    heroGuardStyle.textContent = 'html.tt-authoritative-hero-pending #tt-hero-img{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(heroGuardStyle);
    document.documentElement.classList.add('tt-authoritative-hero-pending');

    let imageReadySignals = 0;
    const releaseAuthoritativeHero = () => {
      document.documentElement.classList.remove('tt-authoritative-hero-pending');
      document.getElementById('tt-authoritative-hero-guard-style')?.remove();
    };

    window.addEventListener('tintin:images-phase5-ready', () => {
      imageReadySignals += 1;
      if (imageReadySignals < 2) return;
      // gestion-imagenes.js agenda applyHero() en requestAnimationFrame.
      // Dos frames dejan que aplique primero la URL confirmada; la clase
      // tt-hero-pending sigue esperando además a que esa imagen termine de
      // descargar antes de hacerla visible.
      window.requestAnimationFrame(() => window.requestAnimationFrame(releaseAuthoritativeHero));
    });
  }

  const VERSION = 'tintin-20260821-hero-notification-surface-2';
  const scriptUrl = document.currentScript?.src
    || new URL('js/inicio-navegacion-publica.js', window.location.href).href;
  const entryUrl = new URL('./components/navigation/entrada-navegacion-publica.js', scriptUrl);
  const barrierUrl = new URL('./components/navigation/compartido/barrera-arranque-shell.js', scriptUrl);
  entryUrl.searchParams.set('v', VERSION);
  barrierUrl.searchParams.set('v', VERSION);

  let waitHeld = false;
  let barrierArmed = false;
  if (window.TintinLoader?.beginWait) {
    window.TintinLoader.beginWait();
    waitHeld = true;
  }

  const release = () => {
    if (window.__TintinPublicShellStartupWaitHeld) {
      window.__TintinPublicShellStartupWaitHeld = false;
      window.TintinLoader?.endWait?.();
    }
    if (!waitHeld) return;
    waitHeld = false;
    window.TintinLoader?.endWait?.();
  };

  import(barrierUrl.href)
    .then(({ armPublicShellStartupBarrier }) => {
      barrierArmed = true;
      armPublicShellStartupBarrier({ release });
      return import(entryUrl.href);
    })
    .catch(error => {
      window.TintinPublicShellBootstrapStarted = false;
      console.error('[PublicShell] No se pudo iniciar la navegación modular.', error);
      document.dispatchEvent(new CustomEvent('tintin:public-shell-error', { detail: { error } }));
      if (!barrierArmed) release();
    });
})();
