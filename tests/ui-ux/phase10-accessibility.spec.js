'use strict';

const { test, expect } = require('@playwright/test');

async function openAccessiblePage(page) {
  await page.addInitScript(() => { window.TT_DISABLE_STORE_GATE = true; });
  await page.goto('/about.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.TintinAccessibility?.booted === true);
  await page.waitForFunction(() => document.documentElement.classList.contains('tt-phase10-a11y-ready'));

  // Aislamos la capa global de accesibilidad del contenido editorial, banners y
  // diálogos propios de la página. Esos componentes tienen sus auditorías
  // dedicadas; aquí se comprueba el contrato reutilizable de la Fase 10.
  await page.evaluate(() => {
    document.head.innerHTML = '<meta charset="utf-8"><style>body{margin:0;padding:24px}main,section,button,input,a,[role="button"]{display:block;margin:8px}</style>';
    document.body.innerHTML = '<main id="contenido-principal" tabindex="-1"><h1>Prueba de accesibilidad</h1></main>';
    window.TintinAccessibility.enhance(document);
    window.TintinAccessibility.scanDialogs();
  });
  await page.waitForFunction(() => Boolean(document.getElementById('tt-skip-link')));
}

test('el enlace de salto aparece con teclado y enfoca el contenido', async ({ page }) => {
  await openAccessiblePage(page);
  await page.keyboard.press('Tab');
  const skip = page.locator('#tt-skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('main,[role="main"]').first()).toBeFocused();
});

test('controles role button responden a Enter y Espacio', async ({ page }) => {
  await openAccessiblePage(page);
  await page.evaluate(() => {
    [
      ['tt-test-role-button-enter', 'Acción Enter'],
      ['tt-test-role-button-space', 'Acción Espacio']
    ].forEach(([id, label]) => {
      const control = document.createElement('div');
      control.id = id;
      control.setAttribute('role', 'button');
      control.textContent = label;
      control.dataset.clicks = '0';
      control.addEventListener('click', () => {
        control.dataset.clicks = String(Number(control.dataset.clicks) + 1);
      });
      document.body.appendChild(control);
      window.TintinAccessibility.enhance(control);
    });
  });

  const enterControl = page.locator('#tt-test-role-button-enter');
  const spaceControl = page.locator('#tt-test-role-button-space');

  await expect(enterControl).toHaveAttribute('tabindex', '0');
  await expect(spaceControl).toHaveAttribute('tabindex', '0');

  await enterControl.press('Enter');
  await expect(enterControl).toHaveAttribute('data-clicks', '1');

  await spaceControl.press('Space');
  await expect(spaceControl).toHaveAttribute('data-clicks', '1');
});

test('el diálogo atrapa el foco y lo devuelve al cerrar', async ({ page }) => {
  await openAccessiblePage(page);
  await page.evaluate(() => {
    const trigger = document.createElement('button');
    trigger.id = 'tt-test-trigger';
    trigger.textContent = 'Abrir prueba';
    document.body.appendChild(trigger);
    trigger.focus();
    const dialog = document.createElement('section');
    dialog.id = 'tt-test-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = '<h2>Diálogo accesible</h2><button id="tt-first">Primero</button><button id="tt-last">Último</button>';
    document.body.appendChild(dialog);
    window.TintinAccessibility.enhance(dialog);
    window.TintinAccessibility.scanDialogs();
  });
  await expect(page.locator('#tt-first')).toBeFocused();
  await page.locator('#tt-last').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#tt-first')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#tt-last')).toBeFocused();
  await page.evaluate(() => {
    document.getElementById('tt-test-dialog').remove();
    window.TintinAccessibility.scanDialogs();
  });
  await expect(page.locator('#tt-test-trigger')).toBeFocused();
});

test('un campo inválido recibe foco y aria-invalid', async ({ page }) => {
  await openAccessiblePage(page);
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.innerHTML = '<label for="tt-required">Dato requerido</label><input id="tt-required" required><button type="submit">Enviar</button>';
    form.addEventListener('submit', event => event.preventDefault());
    document.body.appendChild(form);
    form.requestSubmit();
  });
  const field = page.locator('#tt-required');
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
});

test('la pérdida de conexión informa sin abrir un modal', async ({ page }) => {
  await openAccessiblePage(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  });
  const status = page.locator('#tt-connectivity-status');
  await expect(status).toBeVisible();
  await expect(status).toContainText('sin conexión');
  await expect(status).not.toHaveAttribute('aria-modal', 'true');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
  });
  await expect(status).toBeHidden();
});
