import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { classifyAuthBrowserDiagnostic } from './lib/auth-browser-diagnostics.mjs';
import { readProductionOrigins } from './lib/origen-produccion.mjs';
import { inspectFirebaseAuthHelpers } from './lib/auth-helper-health.mjs';

const { origin } = readProductionOrigins();
const publicSite = JSON.parse(fs.readFileSync(path.resolve('config/public-site.json'), 'utf8'));
const expectedAuthDomain = new URL(origin).hostname === publicSite.technicalFirebaseAuthDomain
  ? publicSite.technicalFirebaseAuthDomain : publicSite.firebaseAuthDomain;
const pages = ['/login', '/perfil'];
const timeoutMs = Number(process.env.TINTIN_AUTH_BROWSER_TIMEOUT_MS || 30000);
const results = [];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
try {
  for (const relative of pages) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const problems = [];
    let firebaseModuleUrl = '';
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/js/core/firebase/firebase.js' && url.origin === origin) firebaseModuleUrl = url.href;
    });
    page.on('console', message => {
      const text = message.text();
      if (/content security policy|app.?check|recaptcha/i.test(text)) problems.push({ source: 'console', level: message.type(), text });
    });
    page.on('pageerror', error => {
      const text = String(error?.message || error);
      problems.push({ source: 'pageerror', text });
    });
    const started = Date.now();
    try {
      const response = await page.goto(origin + relative, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForTimeout(8000);
      if (!firebaseModuleUrl) throw new Error(`${relative} no cargó la configuración Firebase de este artefacto.`);
      const snapshot = await page.evaluate(async moduleUrl => ({
        title: document.title,
        appCheck: window.TintinAppCheckStatus || 'missing',
        bodyBytes: document.body?.innerText?.length || 0,
        authDomain: (await import(moduleUrl)).getFirebaseAuthDomain()
      }), firebaseModuleUrl);
      // GitHub-hosted runners share egress IPs. After enough scheduled probes,
      // reCAPTCHA Enterprise can throttle that automation client for a day
      // (`appCheck/throttled`) even though the public page and its App Check
      // configuration are healthy. Keep this CI-only rate limit from turning
      // the production monitor red; real CSP failures and other App Check
      // errors remain blocking below.
      const diagnostics = problems.map(problem => ({ ...problem, classification: classifyAuthBrowserDiagnostic(problem) }));
      const warnings = diagnostics.filter(problem => problem.classification !== 'blocking');
      const appCheckThrottled = diagnostics.some(problem => problem.classification === 'recaptcha-throttled');
      if (!response?.ok()) throw new Error(`${relative} respondió ${response?.status() || 'sin respuesta'}`);
      if (snapshot.appCheck !== 'enabled' && !appCheckThrottled) throw new Error(`${relative} reportó App Check ${snapshot.appCheck}.`);
      if (snapshot.bodyBytes < 20) throw new Error(`${relative} no pintó contenido visible.`);
      const blockingProblems = diagnostics.filter(problem => problem.classification === 'blocking');
      if (blockingProblems.length) throw new Error(`${relative} registró errores de JavaScript/CSP/App Check: ${blockingProblems.map(problem => problem.text).join(' | ')}`);
      const authHelpers = await inspectFirebaseAuthHelpers({ authDomain: snapshot.authDomain, expectedAuthDomain, timeoutMs });
      results.push({ relative, ok: true, ms: Date.now() - started, warnings, authHelpers, appCheckWarning: appCheckThrottled ? 'throttled-by-recaptcha-ci' : null, ...snapshot });
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
for (const result of results) {
  console.log(`${result.ok ? 'OK' : 'ERROR'} — ${result.relative} — ${result.error || `${result.appCheck}${result.appCheckWarning ? ` (${result.appCheckWarning})` : ''} — ${result.ms} ms`}`);
  for (const warning of result.warnings || []) console.log(`DIAGNÓSTICO — ${result.relative} — ${warning.classification}: ${warning.text}`);
}
if (results.some(result => !result.ok)) process.exit(1);
const throttled = results.some(result => result.appCheckWarning === 'throttled-by-recaptcha-ci');
console.log(throttled
  ? 'Login y perfil visibles sin errores bloqueantes; App Check limitado por reCAPTCHA del runner, desafío real NO VERIFICADO.'
  : 'Login y perfil visibles con estado App Check habilitado y sin errores bloqueantes; no equivale a OAuth ni compra completos.');
