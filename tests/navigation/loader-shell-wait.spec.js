'use strict';

const { test, expect } = require('@playwright/test');

// Cubre el contrato atómico del primer render: el loader no debe revelar la
// página hasta que la navegación real y la marca visual estén listas. Las
// pruebas de regresión retrasan explícitamente recursos del camino crítico
// para cubrir la ventana que antes quedaba fuera del test normal.

test('TintinLoader.beginWait() retiene el ocultamiento hasta endWait()', async ({ page }) => {
  await page.goto('/about.html', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    // Espera a que el loader real quede disponible.
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

  await page.route('**/js/components/navigation/entrada-navegacion-publica.js*', async route => {
    await new Promise(resolve => setTimeout(resolve, 900));
    await route.continue();
  });

  await page.route('**/api/visual-studio-global-public*', async route => {
    await new Promise(resolve => setTimeout(resolve, 650));
    await route.continue();
  });

  await page.goto('/catalogo.html', { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(500);
  const duringDelay = await page.evaluate(() => {
    const loader = document.getElementById('tt-loader');
    return {
      loaderVisible: Boolean(loader)
        && getComputedStyle(loader).display !== 'none'
        && !loader.classList.contains('tt-out'),
      shellMounted: document.body.classList.contains('tt-public-shell-mounted'),
    };
  });

  expect(duringDelay.loaderVisible, 'el loader debe seguir cubriendo la página mientras el módulo todavía no llegó').toBe(true);
  expect(duringDelay.shellMounted, 'el retraso artificial debe mantener el shell aún sin montar en este punto').toBe(false);

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

  await page.route('**/assets-tintin/images/general/tintin-loader-brand.svg*', async route => {
    await new Promise(resolve => setTimeout(resolve, 900));
    await route.continue();
  });

  await page.goto('/about.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const halfway = await page.evaluate(() => {
    const loader = document.getElementById('tt-loader');
    const logo = document.getElementById('tt-loader-logo');
    return {
      loaderVisible: Boolean(loader)
        && getComputedStyle(loader).display !== 'none'
        && !loader.classList.contains('tt-out'),
      logoComplete: Boolean(logo?.complete),
    };
  });

  expect(halfway.logoComplete, 'el recurso está retrasado a propósito para probar la barrera de marca').toBe(false);
  expect(halfway.loaderVisible, 'el loader debe permanecer mientras el logo todavía está pendiente').toBe(true);

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