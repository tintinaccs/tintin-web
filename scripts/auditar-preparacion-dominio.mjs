import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('config/public-site.json'));
const target = config.cutover || {};
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    console.log(`OK — ${name}`);
    return;
  }
  failures.push(`${name}: ${detail}`);
  console.error(`ERROR — ${name}: ${detail}`);
}

const activeOrigin = String(config.origin || '').replace(/\/$/, '');
const targetOrigin = String(target.origin || '').replace(/\/$/, '');
let activeUrl;
let targetUrl;
try { activeUrl = new URL(activeOrigin); } catch {}
try { targetUrl = new URL(targetOrigin); } catch {}

check('Origen activo HTTPS válido', activeUrl?.protocol === 'https:', 'config.public-site.origin debe ser HTTPS.');
check('Destino de cutover HTTPS válido', targetUrl?.protocol === 'https:', 'config.public-site.cutover.origin debe ser HTTPS.');
check('Auth activo usa el host público activo', config.firebaseAuthDomain === activeUrl?.hostname, 'firebaseAuthDomain debe coincidir con el dominio que sirve la tienda.');
check('Auth de cutover usa el host público definitivo', target.firebaseAuthDomain === targetUrl?.hostname, 'cutover.firebaseAuthDomain debe coincidir con el dominio definitivo.');
check('Redirect OAuth de cutover es exacto', target.oauthRedirectUri === `${targetOrigin}/__/auth/handler`, 'Debe ser https://<dominio>/__/auth/handler.');
check('App Check incluye dominio definitivo', Array.isArray(target.appCheckDomains) && target.appCheckDomains.includes(targetUrl?.hostname), 'La lista de dominios a autorizar en reCAPTCHA Enterprise debe incluir el host definitivo.');

const routes = JSON.parse(read('_routes.json'));
check('Proxy Auth está ruteado por Pages Functions', routes.include?.includes('/__/auth/*'), '_routes.json debe incluir /__/auth/*.');
check('Proxy Auth existe', fs.existsSync(path.join(root, 'functions/__/auth/[[path]].js')), 'Falta el proxy transparente hacia firebaseapp.com.');
const authProxy = read('functions/__/auth/[[path]].js');
check('Proxy Auth es transparente, no 302 interno', authProxy.includes("redirect: 'manual'") && authProxy.includes('FIREBASE_AUTH_ORIGIN') && authProxy.includes("responseHeaders.set('location'"), 'El proxy debe reenviar helpers y reescribir solo redirects del origen Firebase.');

const firebase = read('js/core/firebase/firebase.js');
check('Firebase usa authDomain configurable por build', /authDomain\s*:\s*["'][^"']+["']/.test(firebase) && read('scripts/sincronizar-origen-publico.js').includes("relative === 'js/core/firebase/firebase.js'"), 'El build debe sustituir authDomain desde config/public-site.json.');
check('App Check usa reCAPTCHA Enterprise', firebase.includes('ReCaptchaEnterpriseProvider') && firebase.includes('initializeAppCheck') && firebase.includes('FIREBASE_APP_CHECK_SITE_KEY'), 'La web debe conservar el proveedor Enterprise y su site key.');
check('App Check expone estado comprobable', firebase.includes('window.TintinAppCheckStatus') && firebase.includes("'enabled'"), 'El smoke test del dominio definitivo necesita poder verificar App Check en navegador real.');

const cspGenerator = read('scripts/generar-csp-cloudflare.js');
check('CSP usa origen público central', cspGenerator.includes('config/public-site.json') && cspGenerator.includes('${publicOrigin}'), 'frame-src y hashes deben regenerarse a partir del dominio activo.');
check('SEO usa origen público central', read('scripts/auditar-fase-11-seo.js').includes("config/public-site.json"), 'La auditoría SEO no debe fijar pages.dev por separado.');
check('Monitor usa origen público central', read('scripts/auditar-produccion-salud.mjs').includes("config/public-site.json"), 'El monitor debe cambiar de origen al mismo tiempo que la configuración pública.');

if (failures.length) {
  console.error(`\nPreparación de dominio incompleta: ${failures.length} problema(s).`);
  process.exit(1);
}

console.log('\nPreparación de código para cutover: correcta.');
console.log('Pendientes externos antes de activar el dominio: custom domain/SSL en Cloudflare, redirect OAuth autorizado, dominio autorizado en Firebase Authentication y dominios de reCAPTCHA Enterprise/App Check.');
