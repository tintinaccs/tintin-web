'use strict';

const { test, expect } = require('@playwright/test');

// Cubre el contrato atómico del primer render: el loader no debe revelar la
// página hasta que la navegación real y la marca visual estén listas. Las
// pruebas de regresión bloquean explícitamente recursos del camino crítico
// hasta que el propio test decide liberarlos; así no dependen de cuánto tardó
// DOMContentLoaded en el runner de CI.

test('TintinLoader.beginWait() retiene el ocultamiento hasta endWait()', async ({ page }) => {
  await page.goto('/about.html', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    for (let i = 0; i < 50 && !window.TintinLoader; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    if (!window.TintinLoader) return { error: 'TintinLoader nunca se definió' };

    window.TintinLoader.show();
    window.TintinLoader.beginWait();
    window.TintinLoader.ready();

    const loaderEl = () => document.getElementById('tt-loader');
    const isHidden = () => {
      const node = loaderEl();
      return !node || getComputedStyle(node).display === 'none' || node.classList.contains('tt-out');
    };

    await new Promise(resolve => setTimeout(resolve, 500));
    const stillVisibleWithPendingWait = !isHidden();

    window.TintinLoader.endWait();
    await new Promise(resolve => setTimeout(resolve, 500));
    const hiddenAfterEndWait = isHidden();

    return { stillVisibleWithPendingWait, hiddenAfterEndWait };
  });

  expect(result.error, result.error).toBeUndefined();
  expect(result.stillVisibleWithPendingWait, 'el loader no debe ocultarse mientras hay un beginWait() pendiente').toBe(true);
  expect(result.hiddenAfterEndWait, 'el loader debe ocultarse una vez que endWait() libera la espera').toBe(true);
});

async function installFirstFrameProbe(page) {
  await page.addInitScript(() => {
    window.TT_DISABLE_STORE_GATE = true;
    window.__ttFirstFrameProbe = {
      loaderSeen: false,
      violation: false,
      samples: 0,
    };

    const sample = () => {
      const state = window.__ttFirstFrameProbe;
      const loader = document.getElementById('tt-loader');
      if (loader) state.loaderSeen = true;

      if (state.loaderSeen) {
        const loaderGone = !loader
          || getComputedStyle(loader).display === 'none'
          || loader.classList.contains('tt-out');
        const shellMounted = Boolean(document.body?.classList.contains('tt-public-shell-mounted'));
        if (loaderGone && !shellMounted) state.violation = true;
        state.samples += 1;
      }

      requestAnimationFrame(sample);
    };

    requestAnimationFrame(sample);
  });
}

test('una importación lenta del shell nunca deja un frame visible sin header', async ({ page }) => {
  await installFirstFrameProbe(page);

  let releaseEntry;
  const entryGate = new Promise(resolve => { releaseEntry = resolve; });
  let markEntryRequested;
  const entryRequested = new Promise(resolve => { markEntryRequested = resolve; });

  await page.route('**/js/components/navigation/entrada-navegacion-publica.js*', async route => {
    markEntryRequested();
    await entryGate;
    await route.continue();
  });

  let releaseConfig;
  const configGate = new Promise(resolve => { releaseConfig = resolve; });
  await page.route('**/api/visual-studio-global-public*', async route => {
    await configGate;
    await route.continue();
  });

  const navigation = page.goto('/catalogo.html', { waitUntil: 'domcontentloaded' });
  await entryRequested;
  await page.waitForSelector('#tt-loader', { state: 'attached', timeout: 5000 });

  const whileEntryBlocked = await page.evaluate(() => {
    const loader = document.getElementById('tt-loader');
    return {
      loaderVisible: Boolean(loader)
        && getComputedStyle(loader).display !== 'none'
        && !loader.classList.contains('tt-out'),
      shellMounted: document.body.classList.contains('tt-public-shell-mounted'),
    };
  });

  expect(whileEntryBlocked.loaderVisible, 'el loader debe cubrir la página mientras el módulo de navegación sigue bloqueado').toBe(true);
  expect(whileEntryBlocked.shellMounted, 'el shell no puede estar montado antes de que llegue su módulo').toBe(false);

  releaseEntry();
  releaseConfig();
  await navigation;

  await page.waitForFunction(() => document.body.classList.contains('tt-public-shell-mounted'), null, { timeout: 9000 });
  await page.waitForFunction(() => {
    const loader = document.getElementById('tt-loader');
    return !loader || getComputedStyle(loader).display === 'none' || loader.classList.contains('tt-out');
  }, null, { timeout: 9000 });

  const probe = await page.evaluate(() => window.__ttFirstFrameProbe);
  expect(probe.loaderSeen).toBe(true);
  expect(probe.samples).toBeGreaterThan(0);
  expect(probe.violation, 'no puede existir ningún frame posterior a la aparición del loader donde este ya se haya ido y el header todavía no esté montado').toBe(false);
});

test('el loader no se retira antes de que el logo inicial termine de cargar', async ({ page }) => {
  await page.addInitScript(() => {
    window.TT_DISABLE_STORE_GATE = true;
  });

  let releaseLogo;
  const logoGate = new Promise(resolve => { releaseLogo = resolve; });
  let markLogoRequested;
  const logoRequested = new Promise(resolve => { markLogoRequested = resolve; });

  await page.route('**/assets-tintin/images/general/tintin-loader-brand.svg*', async route => {
    markLogoRequested();
    await logoGate;
    await route.continue();
  });

  const navigation = page.goto('/about.html', { waitUntil: 'domcontentloaded' });
  await logoRequested;
  await page.waitForSelector('#tt-loader-logo', { state: 'attached', timeout: 5000 });

  const whileLogoBlocked = await page.evaluate(() => {
    const loader = document.getElementById('tt-loader');
    const logo = document.getElementById('tt-loader-logo');
    return {
      loaderVisible: Boolean(loader)
        && getComputedStyle(loader).display !== 'none'
        && !loader.classList.contains('tt-out'),
      logoComplete: Boolean(logo?.complete),
    };
  });

  expect(whileLogoBlocked.logoComplete, 'el logo debe seguir incompleto mientras su respuesta está bloqueada').toBe(false);
  expect(whileLogoBlocked.loaderVisible, 'el loader debe permanecer mientras el logo todavía está pendiente').toBe(true);

  releaseLogo();
  await navigation;

  await page.waitForFunction(() => document.getElementById('tt-loader-logo')?.complete === true, null, { timeout: 5000 });
  await page.waitForFunction(() => {
    const loader = document.getElementById('tt-loader');
    return !loader || getComputedStyle(loader).display === 'none' || loader.classList.contains('tt-out');
  }, null, { timeout: 9000 });
});

test('un enlace limpio /product conserva el nombre para el loader siguiente', async ({ page }) => {
  await page.addInitScript(() => {
    window.TT_DISABLE_STORE_GATE = true;
  });
  await page.goto('/catalogo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__TintinCleanProductLoaderLabelsBound === true,
    null,
    { timeout: 5000 }
  );

  const stored = await page.evaluate(() => {
    sessionStorage.removeItem('tt_next_loader_label');

    const anchor = document.createElement('a');
    anchor.href = '/product?id=producto-prueba';
    anchor.textContent = 'Reloj Aurora';
    anchor.addEventListener('click', event => event.preventDefault());
    document.body.appendChild(anchor);
    anchor.click();

    const raw = sessionStorage.getItem('tt_next_loader_label');
    anchor.remove();
    return raw ? JSON.parse(raw) : null;
  });

  expect(stored?.name).toBe('Reloj Aurora');
  expect(typeof stored?.ts).toBe('number');
});
