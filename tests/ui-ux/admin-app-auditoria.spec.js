// App móvil, Fase 18 · Auditoría: registro en tarjetas, selección y barra masiva usables
// en ≤768; tablet/escritorio sin cambios. Filas ficticias; no se exporta ni lee Firestore.
const { test, expect } = require('@playwright/test');
const { load } = require('./helpers/admin-panel-fixture.cjs');

const row = (id, who, detail) => `<tr><td class="col-select"><input type="checkbox" class="audit-row-check" data-id="${id}"></td><td style="white-space:nowrap;font-size:12px">01/11/2026 10:00</td><td style="font-size:12px">${who}</td><td style="font-size:12px">Cambio de estado de pedido<span class="adm-badge" style="margin-left:6px">Masivo (12)</span></td><td style="font-size:12px;color:var(--adm-muted)"><strong>Pedido #TT-000123</strong> — ${detail}</td></tr>`;

for (const width of [320, 390, 540, 768, 820, 1024, 1440]) {
  test(`auditoría ${width}px`, async ({ page }) => {
    await load(page, width, 'admin.html', { mobile: true, sidebar: true });
    await page.evaluate(html => {
      const s = document.getElementById('section-auditoria');
      document.querySelectorAll('.adm-section').forEach(n => n.classList.toggle('active', n === s));
      document.getElementById('audit-tbody').innerHTML = html;
      document.getElementById('audit-bulk-toolbar').classList.add('show');
    }, row('a1', 'administradora.con.correo.muy.largo@tintin.test', 'pendiente → enviado · Historial: precio 120000 → 99000 · stock 4 → 3') + row('a2', 'modder@tintin.test', 'stock ilimitado → 10'));
    if (width <= 768) await page.waitForFunction(() => document.querySelector('#audit-tbody td[data-label]'));
    const m = await page.evaluate(() => {
      const vis = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
      const r = n => n.getBoundingClientRect();
      const s = document.getElementById('section-auditoria');
      const hit = cb => { const l = cb.closest('label'); const b = r(l || cb); return Math.round(Math.min(b.width, b.height)); };
      return {
        app: document.documentElement.classList.contains('adm-app'),
        overflow: document.documentElement.scrollWidth > innerWidth,
        wide: [...s.querySelectorAll('*')].filter(vis).filter(n => r(n).right > innerWidth + 1).map(n => n.tagName + '.' + n.className),
        small: [...s.querySelectorAll('button')].filter(vis).filter(n => r(n).height < 44).map(n => n.textContent.trim()),
        checkIds: [...s.querySelectorAll("input[type=checkbox]")].map(n => (n.id || n.className) + ":" + Math.round(Math.min(r(n.closest("label")||n).width, r(n.closest("label")||n).height))),
        checks: [...s.querySelectorAll('input[type=checkbox]')].filter(n => vis(n) || (n.closest('label') && vis(n.closest('label')))).map(hit),
        label: getComputedStyle(document.querySelector('#audit-tbody td:nth-child(3)'), '::before').content,
      };
    });
    expect(m.overflow).toBe(false);
    expect(m.wide).toEqual([]);
    if (width <= 768) {
      expect(m.app).toBe(true);
      expect(m.small).toEqual([]);
      expect(m.checks.length).toBeGreaterThan(0);
      expect(m.checks.every(v => v >= 44), JSON.stringify(m.checkIds)).toBe(true);
      expect(m.label).toContain('Quién');
    } else {
      expect(m.app).toBe(false);
    }
  });
}
