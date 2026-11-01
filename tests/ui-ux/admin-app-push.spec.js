// App móvil, Fase 17 · Notificaciones push: las tarjetas push-card y push-master-card
// (movidas a la sección por notificaciones-push-maestro.js) ya se adaptan en ≤768 con
// las reglas existentes (tablas como tarjetas con etiqueta, campos de 16px). Esta spec
// fija ese comportamiento. Filas ficticias; no se registra ni envía ninguna notificación.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

for (const width of [320, 390, 540, 768, 820, 1024, 1440]) {
  test(`push ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true });
    await page.evaluate(() => {
      const s = document.getElementById('section-notificaciones-push');
      for (const id of ['push-card', 'push-master-card']) { const c = document.getElementById(id); s.appendChild(c); c.style.display = ''; }
      document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n === s));
      document.getElementById('push-master-devices').innerHTML = '<tr><td><strong>iPhone de prueba con nombre largo</strong><br><small>ios · abc123…</small></td><td>admin@tintin.test</td><td>2026-11-01 10:00</td><td><span class="adm-badge">Activo</span></td><td><button type="button" class="adm-btn adm-btn-danger adm-btn-sm" data-push-revoke="d1">Revocar</button></td></tr>';
      document.getElementById('push-master-events').innerHTML = '<tr><td><strong>order.created</strong><br><small>evt-000-ficticio</small></td><td><span class="adm-badge">failed</span></td><td>0 / 1</td><td style="overflow-wrap:anywhere">messaging/registration-token-not-registered</td><td>2026-11-01<br><button type="button" class="adm-btn adm-btn-sm" data-push-retry="e1">Reintentar aviso</button></td></tr>';
    });
    // La capa espacio-modulos-admin procesa las filas en el siguiente cuadro.
    if (width <= 768) await page.waitForFunction(() => document.querySelector('#push-master-devices td[data-label]'));
    const m = await page.evaluate(() => {
      const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
      const h = n => n.getBoundingClientRect().height;
      const s = document.getElementById('section-notificaciones-push');
      const all = [...s.querySelectorAll('*')].filter(vis);
      return {
        app: document.documentElement.classList.contains('adm-app'),
        overflow: document.documentElement.scrollWidth > innerWidth,
        wide: all.filter(n => n.getBoundingClientRect().right > innerWidth + 1).map(n => n.tagName + '.' + n.className),
        small: [...s.querySelectorAll('button,a,select,input:not([type=checkbox]),textarea')].filter(vis).filter(n => h(n) < 44).map(n => n.id || n.className),
        checks: [...s.querySelectorAll('input[type=checkbox]')].filter(n => vis(n) || vis(n.closest('label') || n)).filter(n => !n.closest('label') || h(n.closest('label')) < 44).map(n => n.id),
        fonts: [...s.querySelectorAll('input:not([type=checkbox]),select,textarea')].filter(vis).filter(n => parseFloat(getComputedStyle(n).fontSize) < 16).map(n => n.id),
        thead: [...s.querySelectorAll('#push-master-card thead')].map(t => t.getBoundingClientRect().height),
        label: getComputedStyle(document.querySelector('#push-master-devices td'), '::before').content,
      };
    });
    expect(m.overflow).toBe(false);
    expect(m.wide).toEqual([]);
    if (width <= 768) {
      expect(m.app).toBe(true);
      expect(m.small).toEqual([]);
      expect(m.checks).toEqual([]);
      expect(m.fonts).toEqual([]);
      // Encabezado oculto a la vista pero disponible para lectores de pantalla (patrón de la capa).
      expect(m.thead.length).toBe(2);
      expect(m.thead.every(h => h <= 1)).toBe(true);
      expect(m.label).toContain('Dispositivo');
    } else {
      expect(m.app).toBe(false);
    }
  });
}
