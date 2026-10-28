'use strict';

const { test, expect } = require('@playwright/test');
const { openProductSaveFixture } = require('../ui-ux/helpers/product-save-fixture.cjs');

for (const [width, height] of [[360, 640], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]]) {
  test(`editor conserva scroll y nodos durante actualizaciones locales en ${width}px`, async ({ page }, info) => {
    await openProductSaveFixture(page, width, height, { fullShell: true, photos: true, workflow: true });
    await page.evaluate(() => window.qaProductController.workspace.ready);
    const geometry = await page.evaluate(() => {
      let scroller = document.querySelector('#prod-form-card .adm-card-body');
      while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 100 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
      scroller ||= document.scrollingElement;
      window.qaScrollTarget = scroller;
      window.qaEditorNode = document.getElementById('prod-form-card');
      scroller.scrollTop = 0;
      const rect = scroller.getBoundingClientRect();
      return { max: scroller.scrollHeight - scroller.clientHeight, x: Math.min(innerWidth - 20, Math.max(20, rect.x + rect.width / 2)), y: Math.min(innerHeight - 100, Math.max(100, rect.y + rect.height / 2)) };
    });
    expect(geometry.max, 'el caso debe contener scroll real').toBeGreaterThan(100);
    await page.mouse.move(geometry.x, geometry.y);
    await page.mouse.wheel(0, Math.min(400, geometry.max / 2));
    await expect.poll(() => page.evaluate(() => window.qaScrollTarget.scrollTop)).toBeGreaterThan(0);
    // Esperar al fin del desplazamiento nativo antes de medir un reset indebido.
    await page.waitForTimeout(250);
    const result = await page.evaluate(async () => {
      const target = window.qaScrollTarget, before = target.scrollTop;
      const input = document.getElementById('prod-images-extra');
      const frames = [], tasks = [];
      const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => entry.duration)));
      observer.observe({ type: 'longtask', buffered: false });
      let previous = performance.now();
      for (let i = 0; i < 30; i++) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(requestAnimationFrame);
        const now = performance.now(); frames.push(now - previous); previous = now;
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      observer.disconnect();
      frames.sort((a, b) => a - b);
      return { before, after: target.scrollTop, sameNode: window.qaEditorNode === document.getElementById('prod-form-card'), frameP95Ms: frames[Math.floor(frames.length * 0.95)], maxFrameMs: frames.at(-1), longTasksMs: tasks };
    });
    await info.attach('editor-scroll-lab.json', { body: JSON.stringify({ width, height, ...result }), contentType: 'application/json' });
    console.log('[editor-scroll-lab]', JSON.stringify({ width, height, ...result }));
    expect(result.sameNode).toBe(true);
    expect(Math.abs(result.after - result.before), 'actualizar estado no debe llevar el editor al inicio').toBeLessThanOrEqual(2);
    // Los tiempos son diagnóstico de laboratorio, no INP de campo ni un gate
    // absoluto de FPS en un runner compartido con otras suites.
  });
}
