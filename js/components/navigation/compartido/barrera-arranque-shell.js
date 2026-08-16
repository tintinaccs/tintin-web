const NEXT_LOADER_LABEL_KEY = 'tt_next_loader_label';
const NEXT_LOADER_LABEL_MAX_AGE_MS = 8000;

function waitForLoaderBrand() {
  return new Promise(resolve => {
    const deadline = Date.now() + 1800;
    let settled = false;
    let timer = 0;

    function finish() {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      resolve();
    }

    function inspect() {
      if (settled) return;
      const image = document.getElementById('tt-loader-logo');
      if (!image) {
        if (Date.now() >= deadline) return finish();
        window.requestAnimationFrame(inspect);
        return;
      }
      if (image.complete) return finish();
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
      timer = window.setTimeout(finish, Math.max(0, deadline - Date.now()));
    }

    inspect();
  });
}

function waitForPublicShell() {
  return new Promise(resolve => {
    if (document.body?.classList.contains('tt-public-shell-mounted')) {
      resolve();
      return;
    }

    let settled = false;
    const timer = window.setTimeout(finish, 8500);

    function finish() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      document.removeEventListener('tintin:public-shell-ready', finish);
      document.removeEventListener('tintin:public-shell-error', finish);
      resolve();
    }

    document.addEventListener('tintin:public-shell-ready', finish, { once: true });
    document.addEventListener('tintin:public-shell-error', finish, { once: true });
  });
}

function stashNextLoaderLabel(name) {
  try {
    window.sessionStorage.setItem(
      NEXT_LOADER_LABEL_KEY,
      JSON.stringify({ name, ts: Date.now() })
    );
  } catch {}
}

function bindCleanProductLoaderLabels() {
  if (window.__TintinCleanProductLoaderLabelsBound) return;
  window.__TintinCleanProductLoaderLabelsBound = true;

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
      let name = card?.querySelector(
        '.tt-product-name, .tt-card-name, .tt-look-card-name'
      )?.textContent || '';

      if (!name) {
        const label = anchor.getAttribute('aria-label') || '';
        const match = label.match(/^Ver\s+(.+)$/i);
        name = match ? match[1] : anchor.textContent;
      }

      name = String(name || '').replace(/\s+/g, ' ').trim();
      if (name) stashNextLoaderLabel(name);
    },
    true
  );
}

export function armPublicShellStartupBarrier({ release }) {
  bindCleanProductLoaderLabels();
  Promise.all([waitForPublicShell(), waitForLoaderBrand()]).finally(() => {
    release?.();
  });
}
