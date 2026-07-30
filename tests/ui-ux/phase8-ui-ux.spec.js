import { test, expect } from '@playwright/test';

test.describe('Fase 8 — UI/UX global', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.TT_DISABLE_STORE_GATE = true;
    });
  });

  test('carga una sola capa global y expone estados accesibles', async ({ page }) => {
    const errors = [];
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/about.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.TintinUX?.booted === true);

    await expect(page.locator('html')).toHaveClass(/tt-phase8-ux-ready/);
    await expect(page.locator('#tt-phase8-ui-ux-css')).toHaveCount(1);

    const result = await page.evaluate(() => {
      const host = document.createElement('section');
      host.id = 'phase8-test-state';
      document.body.appendChild(host);
      window.TintinUX.renderState(host, {
        state: 'error',
        title: 'No pudimos cargar',
        message: 'Probá nuevamente.',
        actionLabel: 'Reintentar',
        onAction: () => {}
      });

      const button = document.createElement('button');
      button.id = 'phase8-test-button';
      button.textContent = 'Guardar';
      document.body.appendChild(button);
      window.TintinUX.enhance(document);
      window.TintinUX.setBusy(button, true, { label: 'Guardando…', timeout: 5000 });

      return {
        state: host.dataset.ttState,
        role: host.getAttribute('role'),
        live: host.getAttribute('aria-live'),
        actionClass: host.querySelector('button')?.className,
        busy: button.getAttribute('aria-busy'),
        busyData: button.dataset.ttBusy,
        disabled: button.disabled,
        interactive: button.dataset.ttInteractive,
      };
    });

    expect(result).toEqual({
      state: 'error',
      role: 'alert',
      live: 'assertive',
      actionClass: 'tt-state-action',
      busy: 'true',
      busyData: '1',
      disabled: true,
      interactive: '1',
    });

    await page.evaluate(() => window.TintinUX.setBusy(document.getElementById('phase8-test-button'), false));
    await expect(page.locator('#phase8-test-button')).not.toHaveAttribute('aria-busy');
    await expect(page.locator('#phase8-test-button')).toBeEnabled();

    await page.locator('#phase8-test-button').dispatchEvent('pointerdown');
    await expect(page.locator('#phase8-test-button')).toHaveClass(/tt-is-pressed/);
    await page.locator('#phase8-test-button').dispatchEvent('pointerup');
    await expect(page.locator('#phase8-test-button')).not.toHaveClass(/tt-is-pressed/);

    expect(errors).toEqual([]);
  });

  test('respeta movimiento reducido sin perder estados', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/contact.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.TintinUX?.booted === true);

    const values = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const button = document.createElement('button');
      button.textContent = 'Acción';
      document.body.appendChild(button);
      window.TintinUX.enhance(document);
      button.classList.add('tt-is-pressed');
      return {
        fast: root.getPropertyValue('--tt-motion-fast').trim(),
        transform: getComputedStyle(button).transform,
      };
    });

    expect(values.fast).toBe('1ms');
    expect(values.transform).toBe('none');
  });
});
