'use strict';

const { test, expect } = require('@playwright/test');

// Cubre el fix de CLS: el loader de página (js/cargador-pagina.js) no debe
// ocultarse mientras haya una tarea async pendiente registrada con
// TintinLoader.beginWait()/endWait() — lo usa entrada-navegacion-publica.js
// para esperar a que el header/nav real esté insertado en el DOM antes de
// revelar el contenido, evitando el salto visual que se midió en producción
// al acortar MIN_SHOW_MS.

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

test('el shell público nunca queda montado después de que el loader se oculta', async ({ page }) => {
  // Verificación de integración: en una carga real, en ningún frame el
  // loader debe estar oculto mientras el shell (header/nav) todavía no se
  // montó — sería exactamente el salto visual que causó el bug de CLS.
  await page.goto('/catalogo.html', { waitUntil: 'domcontentloaded' });

  const violation = await page.evaluate(async () => {
    let found = null;
    const t0 = performance.now();
    const check = () => {
      const loader = document.getElementById('tt-loader');
      const loaderGone = !loader || getComputedStyle(loader).display === 'none' || loader.classList.contains('tt-out');
      const shellMounted = document.body.classList.contains('tt-public-shell-mounted');
      if (loaderGone && !shellMounted && found === null) found = performance.now() - t0;
    };
    await new Promise(resolve => {
      const raf = () => {
        check();
        if (performance.now() - t0 < 4000) requestAnimationFrame(raf);
        else resolve();
      };
      requestAnimationFrame(raf);
    });
    return found;
  });

  expect(violation, 'el loader se ocultó antes de que el shell público estuviera montado').toBeNull();
});
