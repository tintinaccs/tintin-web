import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'institutional-help-legal-part2e');
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = requestPath === '/' ? 'preguntas-frecuentes.html' : requestPath.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, {
    'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4177, '127.0.0.1', resolve));

function staticHtml() {
  return fs.readFileSync(path.join(root, 'preguntas-frecuentes.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/\s*>/gi, '')
    .replace(/<head>/i, '<head><base href="http://127.0.0.1:4177/">');
}

const viewports = [
  { name: 'b320', width: 320, height: 568 },
  { name: 'm360', width: 360, height: 800 },
  { name: 'm390', width: 390, height: 844 },
  { name: 'm430', width: 430, height: 932 },
  { name: 't768', width: 768, height: 1024 },
  { name: 't1024', width: 1024, height: 768 },
  { name: 'd1280', width: 1280, height: 900 },
  { name: 'd1440', width: 1440, height: 960 },
];

const browser = await chromium.launch({ headless: true });
const failures = [];
const report = [];

function fail(viewport, interaction, message, data = null) {
  failures.push({ page: 'faq', viewport, interaction, message, data });
}

async function dispatchKey(locator, key) {
  await locator.evaluate((element, pressedKey) => {
    element.focus();
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: pressedKey,
      bubbles: true,
      cancelable: true,
    }));
  }, key);
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', error => fail(viewport.name, 'runtime', `Error JS: ${error.message}`));

    // Se conserva el HTML y CSS reales, pero se excluyen módulos de Firebase,
    // shell y analítica: no participan en el acordeón y pueden reemplazar partes
    // del DOM durante una auditoría larga. Luego se ejecuta el script.js real.
    await page.setContent(staticHtml(), { waitUntil: 'load' });
    await page.addStyleTag({ content: `
      #tt-loader,#tt-privacy-consent,.tt-store-closed-overlay,.tt-header,.tt-mobile-nav{display:none!important}
      html,body,.section,.tt-info-block,.tt-faq-item,.tt-faq-q,.tt-faq-a{
        visibility:visible!important;
        opacity:1!important;
        transform:none!important;
        filter:none!important;
      }
      *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
    ` });
    await page.addScriptTag({ path: path.join(root, 'script.js') });
    await page.evaluate(() => {
      document.documentElement.classList.add('tt-parity-safe');
      document.body.classList.remove('tt-loading', 'tt-page-loading', 'is-loading', 'scroll-lock');
      document.querySelectorAll('[inert]').forEach(element => element.removeAttribute('inert'));
      initFaqAccordion();
    });
    await page.waitForSelector('.tt-faq-q[role="button"]', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(60);

    const count = await page.locator('.tt-faq-item').count();
    if (count < 8) fail(viewport.name, 'initial', 'Se cargaron menos preguntas de las esperadas.', { count });

    const firstQuestion = page.locator('.tt-faq-q').first();
    await dispatchKey(firstQuestion, 'Enter');
    await page.waitForTimeout(30);
    const keyboardState = await page.locator('.tt-faq-item').first().evaluate(item => {
      const answer = item.querySelector('.tt-faq-a');
      const rect = answer.getBoundingClientRect();
      return {
        open: item.classList.contains('tt-faq-open'),
        answerHeight: Math.round(rect.height), left: Math.round(rect.left),
        right: Math.round(rect.right), viewport: innerWidth,
      };
    });
    if (!keyboardState.open || keyboardState.answerHeight < 1) {
      fail(viewport.name, 'keyboard-enter', 'Enter no abre la primera respuesta.', keyboardState);
    }
    if (keyboardState.left < -2 || keyboardState.right > viewport.width + 2) {
      fail(viewport.name, 'keyboard-enter', 'La respuesta abierta sale del viewport.', keyboardState);
    }

    if (count > 1) {
      const secondQuestion = page.locator('.tt-faq-q').nth(1);
      await dispatchKey(secondQuestion, ' ');
      await page.waitForTimeout(30);
      const keyboardSpace = await page.locator('.tt-faq-item').evaluateAll(items => items.slice(0, 2).map(item => {
        const answer = item.querySelector('.tt-faq-a');
        const rect = answer.getBoundingClientRect();
        return { open: item.classList.contains('tt-faq-open'), answerHeight: Math.round(rect.height) };
      }));
      if (keyboardSpace[0]?.open || !keyboardSpace[1]?.open || keyboardSpace[1]?.answerHeight < 1) {
        fail(viewport.name, 'keyboard-space', 'Espacio no cambia correctamente la pregunta abierta.', keyboardSpace);
      }
    }

    for (let index = 0; index < count; index += 1) {
      const question = page.locator('.tt-faq-q').nth(index);
      await question.evaluate(element => element.click());
      await page.waitForTimeout(20);
      const state = await page.locator('.tt-faq-item').nth(index).evaluate(item => {
        const question = item.querySelector('.tt-faq-q');
        const answer = item.querySelector('.tt-faq-a');
        const qr = question.getBoundingClientRect();
        const ar = answer.getBoundingClientRect();
        return {
          open: item.classList.contains('tt-faq-open'),
          question: { left: Math.round(qr.left), right: Math.round(qr.right), height: Math.round(qr.height) },
          answer: {
            left: Math.round(ar.left), right: Math.round(ar.right), height: Math.round(ar.height),
            scrollWidth: answer.scrollWidth, clientWidth: answer.clientWidth,
          },
        };
      });
      if (!state.open || state.answer.height < 1) {
        fail(viewport.name, `click-${index + 1}`, 'El clic no abre la respuesta.', state);
      }
      if (
        state.question.left < -2 || state.question.right > viewport.width + 2
        || state.answer.left < -2 || state.answer.right > viewport.width + 2
        || state.answer.scrollWidth > state.answer.clientWidth + 3
      ) {
        fail(viewport.name, `click-${index + 1}`, 'Pregunta o respuesta abierta queda recortada.', state);
      }
    }

    const openCount = await page.locator('.tt-faq-item.tt-faq-open').count();
    if (openCount !== 1) fail(viewport.name, 'final', 'El acordeón debe conservar una sola respuesta abierta.', { openCount });

    report.push({ viewport, questionCount: count, openCount });
    if (['b320', 'm390', 't768', 'd1280'].includes(viewport.name)) {
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-faq-interaction.png`), fullPage: true });
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

fs.writeFileSync(
  path.join(outDir, 'faq-interaction-report.json'),
  JSON.stringify({ report, failures }, null, 2),
);

if (failures.length) {
  console.error(`FAQ PARTE 2E: ${failures.length} problema(s) de interacción detectado(s).`);
  failures.forEach(item => console.error(`- [${item.viewport}/${item.interaction}] ${item.message}`));
  process.exit(1);
}
console.log(`FAQ PARTE 2E: CORRECTA · ${viewports.length} viewports · clic, Enter y Espacio abren respuestas sin recortes.`);
