/* =============================================================
   TINTIN — Bootstrap de navegación pública modular
   =============================================================
   Este archivo conserva compatibilidad con todas las páginas públicas.
   La estructura real vive en js/components/navigation/ y se carga como
   módulo ES para que escritorio, tableta, movil y superficies compartidas
   puedan mantenerse por separado.

   Contrato de accesibilidad conservado por los componentes:
   id="search-panel" role="dialog" · id="cart-drawer" role="dialog"
   id="collections-sheet" role="dialog" · id="tt-tablet-menu" role="dialog"
   ============================================================= */
(function () {
  'use strict';

  if (window.TintinPublicShellBootstrapStarted) return;
  window.TintinPublicShellBootstrapStarted = true;

  const MODULE_VERSION = 'tintin-20260816-loader-shell-atomic-1';
  const scriptUrl = document.currentScript?.src || new URL('js/inicio-navegacion-publica.js', window.location.href).href;
  const entryUrl = new URL('./components/navigation/entrada-navegacion-publica.js', scriptUrl);
  entryUrl.searchParams.set('v', MODULE_VERSION);

  /*
   * Barrera temprana del primer render.
   *
   * Antes, TintinLoader.beginWait() se llamaba recién dentro del módulo de
   * navegación, DESPUÉS de que este import() terminara de descargarse y
   * evaluarse. En una carga fría la página podía declarar contentReady en esa
   * ventana y ocultar el loader antes de que el header tuviera oportunidad de
   * registrar su espera. El resultado era un frame visible sin shell seguido
   * por la aparición tardía del header.
   *
   * La espera se arma acá, sincrónicamente, ANTES del import(). Se libera solo
   * cuando el shell anunció ready/error y la marca del loader ya terminó de
   * cargar (o agotó una red de seguridad corta). Así el primer frame revelado
   * siempre pertenece al estado definitivo de la navegación.
   */
  const loader = window.TintinLoader;
  let earlyLoaderWaitHeld = false;
  if (loader?.beginWait) {
    loader.beginWait();
    earlyLoaderWaitHeld = true;
  }

  function waitForLoaderBrand() {
    return new Promise(resolve => {
      const deadline = Date.now() + 1800;
      let finished = false;
      let timeoutId = 0;

      function finish() {
        if (finished) return;
        finished = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        resolve();
      }

      function inspect() {
        if (finished) return;
        const image = document.getElementById('tt-loader-logo');
        if (!image) {
          if (Date.now() >= deadline) {
            finish();
            return;
          }
          window.requestAnimationFrame(inspect);
          return;
        }

        if (image.complete) {
          finish();
          return;
        }

        image.addEventListener('load', finish, { once: true });
        image.addEventListener('error', finish, { once: true });
        timeoutId = window.setTimeout(finish, Math.max(0, deadline - Date.now()));
      }

      inspect();
    });
  }

  function waitForPublicShell() {
    return new Promise(resolve => {
      let settled = false;
      let safetyTimer = 0;

      function cleanup() {
        document.removeEventListener('tintin:public-shell-ready', finish);
        document.removeEventListener('tintin:public-shell-error', finish);
        if (safetyTimer) window.clearTimeout(safetyTimer);
      }

      function finish() {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      }

      document.addEventListener('tintin:public-shell-ready', finish, { once: true });
      document.addEventListener('tintin:public-shell-error', finish, { once: true });
      // No puede existir un bloqueo infinito aunque un error externo impida
      // que el módulo llegue a emitir sus eventos.
      safetyTimer = window.setTimeout(finish, 8500);
    });
  }

  const shellSettled = waitForPublicShell();
  const brandSettled = waitForLoaderBrand();

  Promise.all([shellSettled, brandSettled]).finally(() => {
    if (!earlyLoaderWaitHeld) return;
    earlyLoaderWaitHeld = false;
    window.TintinLoader?.endWait?.();
  });

  /*
   * Compatibilidad con URLs limpias de producto.
   * cargador-pagina.js históricamente guardaba el nombre solo cuando el href
   * terminaba en product.html. Producción usa /product?id=..., así que el
   * loader de destino perdía el nombre y mostraba solo "Producto". Este
   * listener temprano admite ambas rutas y mantiene el mismo contrato de
   * sessionStorage del loader.
   */
  document.addEventListener(
    'click',
    event => {
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor) return;

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      const last = url.pathname.replace(/\/+$/, '').split('/').pop()?.toLowerCase() || '';
      if (last !== 'product' && last !== 'product.html') return;

      const card = anchor.closest('.tt-product-card, .tt-card, .tt-look-card');
      let name = '';
      if (card) {
        name = card.querySelector('.tt-product-name, .tt-card-name, .tt-look-card-name')?.textContent || '';
      }
      if (!name) {
        const label = anchor.getAttribute('aria-label') || '';
        const match = label.match(/^Ver\s+(.+)$/i);
        name = match ? match[1] : anchor.textContent;
      }
      name = String(name || '').replace(/\s+/g, ' ').trim();
      if (!name) return;

      try {
        window.sessionStorage.setItem(
          'tt_next_loader_label',
          JSON.stringify({ name, ts: Date.now() })
        );
      } catch {}
    },
    true
  );

  import(entryUrl.href).catch(error => {
    window.TintinPublicShellBootstrapStarted = false;
    console.error('[PublicShell] No se pudo iniciar la navegación modular.', error);
    document.dispatchEvent(new CustomEvent('tintin:public-shell-error', {
      detail: { error },
    }));
  });
})();