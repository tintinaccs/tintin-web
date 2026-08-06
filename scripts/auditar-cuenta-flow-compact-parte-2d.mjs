import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'account-flow-part2d');
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = requestPath.replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(4175, '127.0.0.1', resolve));

function staticHtml(fileName) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/\s*>/gi, '')
    .replace(/<head>/i, '<head><base href="http://127.0.0.1:4175/">');
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const failures = [];

try {
  await page.setContent(staticHtml('login.html'), { waitUntil: 'load' });
  await page.addStyleTag({ content: `
    html,body{visibility:visible!important;opacity:1!important}
    #tt-loader,#tt-privacy-consent{display:none!important}
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  ` });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  await page.waitForTimeout(100);

  const metrics = await page.evaluate(() => {
    const side = document.querySelector('.login-form-side');
    const logo = document.querySelector('.login-mobile-logo');
    const box = document.querySelector('.login-box');
    const back = document.querySelector('.login-back');
    const rect = element => {
      const r = element.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };
    return {
      viewportHeight: innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
      side: rect(side), logo: rect(logo), box: rect(box), back: rect(back),
      justifyContent: getComputedStyle(side).justifyContent
    };
  });

  if (metrics.logo.top < -1 || metrics.box.top < -1) {
    failures.push({ message: 'El contenido inicial de Login queda por encima del viewport corto.', metrics });
  }
  if (metrics.scrollHeight < metrics.back.bottom - 1) {
    failures.push({ message: 'El enlace final de Login queda fuera del área desplazable.', metrics });
  }
  if (metrics.scrollHeight <= metrics.viewportHeight && metrics.back.bottom > metrics.viewportHeight + 1) {
    failures.push({ message: 'Login no habilita desplazamiento aunque el contenido supera la pantalla.', metrics });
  }

  fs.writeFileSync(path.join(outDir, 'compact-report.json'), JSON.stringify({ metrics, failures }, null, 2));
  await page.screenshot({ path: path.join(outDir, 'b320-login-short.png'), fullPage: true });
} finally {
  await context.close();
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`PARTE 2D COMPACTA: ${failures.length} problema(s) detectado(s).`);
  failures.forEach(item => console.error(`- ${item.message}`));
  process.exit(1);
}
console.log('PARTE 2D COMPACTA: CORRECTA · Login 320×568 conserva todo el contenido accesible mediante scroll.');
