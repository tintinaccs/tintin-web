'use strict';

/**
 * Recuperación ante red intermitente / offline: aunque una consulta tarde o
 * falle, la página nunca debe quedar en blanco ni con el loader girando para
 * siempre. Debe llegar a un estado seguro (contenido, aviso de tienda o mensaje
 * de recuperación) antes del timeout de emergencia.
 */
const { test, expect } = require('@playwright/test');
const { url, BUDGETS } = require('./_helpers');

test('[offline] con red cortada el loader igual se resuelve (no gira infinito)', async ({ page, context }) => {
  // Cargar primero online para tener el shell, luego cortar la red.
  await page.goto(url('index.html'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});

  // Aun offline, el loader debe retirarse por el timeout de emergencia.
  await page.waitForFunction(() => {
    const l = document.getElementById('tt-loader');
    return !l || getComputedStyle(l).display === 'none' || l.classList.contains('tt-out');
  }, { timeout: BUDGETS.loaderMaxMs + 2000 }).catch(() => {});

  const state = await page.evaluate(() => {
    const l = document.getElementById('tt-loader');
    const loaderGone = !l || getComputedStyle(l).display === 'none' || l.classList.contains('tt-out');
    const overlay = document.getElementById('tt-store-closed-overlay') ||
      document.getElementById('tt-store-gate-emergency-dialog');
    const hasBodyText = (document.body.innerText || '').trim().length > 0;
    return { loaderGone, hasRecovery: !!overlay, hasBodyText };
  });

  // No debe quedar pantalla en blanco ni loader infinito: o se ve contenido, o
  // hay un aviso/diálogo de recuperación.
  expect(state.loaderGone || state.hasRecovery,
    'el loader debe cerrarse o mostrar un estado de recuperación').toBeTruthy();
  expect(state.hasBodyText || state.hasRecovery,
    'no debe quedar una pantalla en blanco').toBeTruthy();

  await context.setOffline(false);
});
