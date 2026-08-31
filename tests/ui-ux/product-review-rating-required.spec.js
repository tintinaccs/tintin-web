import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const helperSource = `${fs.readFileSync('js/pages/product/validacion-puntuacion-resena.js', 'utf8').replace(/^export\s+/gm, '')}\nwindow.__ratingGuard = { isValidReviewRating, syncReviewPublishState, reportMissingReviewRating };`;

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-small', width: 320, height: 720 },
];

for (const viewport of viewports) {
  test(`reseña exige puntuación antes de publicar - ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.setContent(`
      <form id="tt-review-editor">
        <div class="tt-rating-input" role="radiogroup">
          <button type="button" data-review-rating="1" tabindex="0">★</button>
          <button type="button" data-review-rating="2" tabindex="-1">★</button>
          <button type="button" data-review-rating="3" tabindex="-1">★</button>
          <button type="button" data-review-rating="4" tabindex="-1">★</button>
          <button type="button" data-review-rating="5" tabindex="-1">★</button>
        </div>
        <span data-rating-status aria-live="polite"></span>
        <textarea name="comment">Me encantó</textarea>
        <button type="submit" data-review-submit>Publicar opinión</button>
        <div role="alert" data-review-error></div>
      </form>`);
    await page.addScriptTag({ content: helperSource });

    await page.evaluate(() => window.__ratingGuard.syncReviewPublishState(document.querySelector('#tt-review-editor'), 0));
    const submit = page.locator('[data-review-submit]');
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute('aria-disabled', 'true');

    const submitCount = await page.evaluate(() => {
      let count = 0;
      const form = document.querySelector('#tt-review-editor');
      form.addEventListener('submit', event => { event.preventDefault(); count += 1; });
      form.querySelector('[data-review-submit]').click();
      return count;
    });
    expect(submitCount).toBe(0);

    await page.evaluate(() => window.__ratingGuard.reportMissingReviewRating(document.querySelector('#tt-review-editor')));
    await expect(page.locator('[data-review-error]')).toContainText('Elegí de 1 a 5 estrellas');
    await expect(page.locator('[data-review-rating="1"]')).toBeFocused();

    await page.evaluate(() => window.__ratingGuard.syncReviewPublishState(document.querySelector('#tt-review-editor'), 4));
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveAttribute('aria-disabled', 'false');

    await page.evaluate(() => window.__ratingGuard.syncReviewPublishState(document.querySelector('#tt-review-editor'), 0));
    await expect(submit).toBeDisabled();
  });
}
