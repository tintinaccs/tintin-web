import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const publicSite = JSON.parse(fs.readFileSync(path.resolve('config/public-site.json'), 'utf8'));
const origin = String(process.env.TINTIN_PUBLIC_ORIGIN || publicSite.origin || '').replace(/\/$/, '');
const pages = ['/login', '/perfil'];
const timeoutMs = Number(process.env.TINTIN_AUTH_BROWSER_TIMEOUT_MS || 30000);
const results = [];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const relative of pages) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const problems = [];
    page.on('console', message => {
      const text = message.text();
      if (/content security policy|app.?check|recaptcha/i.test(text)) problems.push(`${message.type()}: ${text}`);
    });
    page.on('pageerror', error => {
      const text = String(error?.message || error);
      if (/content security policy|app.?check|recaptcha/i.test(text)) problems.push(text);
    });
    const started = Date.now();
    try {
      const response = await page.goto(origin + relative, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForTimeout(8000);
      const snapshot = await page.evaluate(() => ({
        title: document.title,
        appCheck: window.TintinAppCheckStatus || 'missing',
        bodyBytes: document.body?.innerText?.length || 0
      }));
      // GitHub-hosted runners share egress IPs. After enough scheduled probes,
      // reCAPTCHA Enterprise can throttle that automation client for a day
      // (`appCheck/throttled`) even though the public page and its App Check
      // configuration are healthy. Keep this CI-only rate limit from turning
      // the production monitor red; real CSP failures and other App Check
      // errors remain blocking below.
      const appCheckThrottled = problems.some(problem => /appCheck\/throttled|requests throttled/i.test(problem));
      if (!response?.ok()) throw new Error(`${relative} respondió ${response?.status() || 'sin respuesta'}`);
      if (snapshot.appCheck !== 'enabled' && !appCheckThrottled) throw new Error(`${relative} reportó App Check ${snapshot.appCheck}.`);
      if (snapshot.bodyBytes < 20) throw new Error(`${relative} no pintó contenido visible.`);
      const blockingProblems = problems.filter(problem => !/appCheck\/throttled|requests throttled/i.test(problem));
      if (blockingProblems.length) throw new Error(`${relative} registró errores de CSP/App Check: ${blockingProblems.join(' | ')}`);
      results.push({ relative, ok: true, ms: Date.now() - started, appCheckWarning: appCheckThrottled ? 'throttled-by-recaptcha-ci' : null, ...snapshot });
    } catch (error) {
      results.push({ relative, ok: false, ms: Date.now() - started, error: String(error?.message || error), problems });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

fs.mkdirSync(path.resolve('artifacts'), { recursive: true });
fs.writeFileSync(path.resolve('artifacts/auth-browser-smoke.json'), JSON.stringify({ checkedAt: new Date().toISOString(), origin, ok: results.every(result => result.ok), results }, null, 2));
for (const result of results) console.log(`${result.ok ? 'OK' : 'ERROR'} — ${result.relative} — ${result.error || `${result.appCheck}${result.appCheckWarning ? ` (${result.appCheckWarning})` : ''} — ${result.ms} ms`}`);
if (results.some(result => !result.ok)) process.exit(1);
const throttled = results.some(result => result.appCheckWarning === 'throttled-by-recaptcha-ci');
console.log(throttled
  ? 'Login y perfil verificados en navegador real sin errores CSP; App Check quedó limitado por reCAPTCHA del runner de CI.'
  : 'Login y perfil verificados en navegador real con App Check activo y sin errores CSP.');
