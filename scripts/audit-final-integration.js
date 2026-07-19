'use strict';

/* =============================================================
   TINTIN — Auditoría FINAL de integración

   Auditoría transversal que fija las garantías de integración de toda la
   aplicación después de los mantenimientos previos. NO reemplaza a las
   auditorías por dominio (cada una sigue vigente): codifica las invariantes
   de "encaje" que cruzan módulos y que, si se rompieran, no las detectaría
   ninguna auditoría puntual:

   - Fuente ÚNICA de verdad de Firebase y del control de tienda.
   - Integración Super Admin ↔ sitio público a través de documentos Firestore.
   - SEO coherente (robots + sitemap) que no expone páginas privadas.
   - PWA/manifest válido, ruteo de funciones y hosting consistentes.
   - Sin artefactos obsoletos ni plantillas de otra plataforma.
   - Integridad de CI: todo script referenciado existe.

   No abre navegador: comprobaciones estáticas sobre el código publicado.
   ============================================================= */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

// ===========================================================================
// 1. FUENTE ÚNICA DE VERDAD
// ===========================================================================
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => `js/${f}`);
const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const firebaseInitFiles = [...jsFiles, ...htmlFiles].filter(f =>
  /initializeApp\s*\(/.test(read(f)) || /apiKey:\s*["']/.test(read(f))
);
check(
  'Firebase se inicializa en una sola fuente (js/firebase.js)',
  firebaseInitFiles.length === 1 && firebaseInitFiles[0] === 'js/firebase.js',
  `initializeApp/config debe existir solo en js/firebase.js. Encontrado en: ${firebaseInitFiles.join(', ')}`
);
check(
  'El control de tienda tiene un núcleo único (store-gate-core) reutilizado',
  read('js/store-gate.js').includes("from './store-gate-core.js") &&
    read('js/store-gate-core.js').includes("doc(db, 'settings', 'storeGate')") &&
    read('js/page-loader.js').includes('store-gate'),
  'store-gate.js debe apoyarse en store-gate-core.js (una sola lógica) y cargarse vía page-loader.'
);

// ===========================================================================
// 2. INTEGRACIÓN SUPER ADMIN ↔ SITIO PÚBLICO (documentos compartidos)
// ===========================================================================
check(
  'Contacto: el sitio público consume settings/general (whatsapp.js)',
  read('js/whatsapp.js').includes("doc(db, 'settings', 'general')"),
  'El número/mail/redes del footer deben leerse de settings/general, no quedar hardcodeados.'
);
check(
  'Tienda cerrada: el público consume settings/storeGate (store-gate-core.js)',
  read('js/store-gate-core.js').includes("doc(db, 'settings', 'storeGate')"),
  'El bloqueo de tienda debe leer el documento público mínimo settings/storeGate.'
);
check(
  'Apariencia: el público consume colorSchemes + settings/appearance (color-scheme.js)',
  read('js/color-scheme.js').includes('colorSchemes') &&
    read('js/color-scheme.js').includes('APPEARANCE_DOC'),
  'El esquema de color en vivo debe leer colorSchemes y settings/appearance.'
);
check(
  'Contenido: el público consume site_content (site-content.js)',
  read('js/site-content.js').includes('site_content'),
  'El contenido editable debe aplicarse desde la colección site_content.'
);

// ===========================================================================
// 3. SEO — robots + sitemap coherentes, sin exponer páginas privadas
// ===========================================================================
const robots = read('robots.txt');
check(
  'robots.txt bloquea las páginas privadas y apunta al sitemap',
  ['/admin.html', '/admin-images.html', '/login.html', '/checkout.html', '/perfil.html']
    .every(p => robots.includes(`Disallow: ${p}`)) &&
    /Sitemap:\s*https?:\/\//.test(robots),
  'robots.txt debe desindexar admin/login/checkout/perfil y declarar el sitemap.'
);
const sitemap = read('sitemap.xml');
check(
  'sitemap.xml lista las páginas públicas de contenido',
  ['index.html', 'catalogo.html', 'collections.html', 'about.html', 'contact.html',
   'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html',
   'terminos.html', 'privacidad.html'].every(p => sitemap.includes(`/${p}<`)),
  'El sitemap debe incluir todas las páginas públicas de contenido.'
);
check(
  'sitemap.xml NO expone páginas privadas ni no indexables',
  ['admin.html', 'admin-images.html', 'login.html', 'checkout.html', 'perfil.html',
   '404.html', 'nosotros.html'].every(p => !sitemap.includes(`/${p}<`)),
  'El sitemap no debe incluir páginas privadas, de error ni rutas legacy no indexables.'
);

// ===========================================================================
// 4. PWA / MANIFEST / RUTEO / HOSTING
// ===========================================================================
let manifest = null;
try { manifest = JSON.parse(read('manifest.json')); } catch { /* inválido */ }
check(
  'manifest.json es válido y sus íconos existen',
  manifest &&
    manifest.name && manifest.start_url && manifest.scope && manifest.theme_color &&
    Array.isArray(manifest.icons) && manifest.icons.length > 0 &&
    manifest.icons.every(icon => exists(icon.src)),
  'El manifest debe ser JSON válido, con nombre/start_url/scope/theme_color e íconos existentes.'
);
const apiFns = fs.readdirSync(path.join(root, 'functions/api'))
  .filter(f => f.endsWith('.js')).map(f => `/api/${f.replace(/\.js$/, '')}`).sort();
const routesIncluded = (JSON.parse(read('_routes.json')).include || []).slice().sort();
check(
  '_routes.json incluye exactamente las funciones que existen en functions/api',
  JSON.stringify(apiFns) === JSON.stringify(routesIncluded),
  `Desfase entre functions/api y _routes.json.\n  functions: ${apiFns.join(', ')}\n  routes:    ${routesIncluded.join(', ')}`
);
check(
  'firebase.json despliega solo las reglas de Firestore (sin hosting propio)',
  (() => { const fj = JSON.parse(read('firebase.json')); return fj.firestore && fj.firestore.rules === 'firestore.rules' && !fj.hosting; })(),
  'El sitio se sirve por GitHub Pages/Cloudflare; firebase.json solo debe manejar las reglas.'
);

// ===========================================================================
// 5. LIMPIEZA — sin obsoletos, duplicados ni plantillas de otra plataforma
// ===========================================================================
check(
  'No queda el directorio obsoleto de fragmentos (tintin-code-sh)',
  !exists('tintin-code-sh'),
  'El directorio tintin-code-sh (fragmentos Shopify Liquid) debe estar eliminado.'
);
check(
  'No quedan los íconos PNG obsoletos sin referencia',
  !exists('images/Mi cuenta.png') && !exists('images/Busqueda.png') && !exists('images/Carrito.png'),
  'Los PNG de header reemplazados por SVG inline deben estar eliminados.'
);
const liquidLeftovers = [...jsFiles, ...htmlFiles, 'styles.css', 'script.js']
  .filter(f => exists(f) && /\{%[- ]*(liquid|section|schema|render|assign)\b/.test(read(f)));
check(
  'No hay plantillas de otra plataforma (Shopify Liquid) en el sitio',
  liquidLeftovers.length === 0,
  `Restos de plantillas Liquid en: ${liquidLeftovers.join(', ')}`
);

// ===========================================================================
// 6. INTEGRIDAD DE CI — todo script referenciado existe
// ===========================================================================
const pkg = JSON.parse(read('package.json'));
const pkgScripts = Object.values(pkg.scripts).join(' ');
const pkgMissing = [...pkgScripts.matchAll(/node (scripts\/[A-Za-z0-9._-]+\.js)/g)]
  .map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).filter(s => !exists(s));
check(
  'Todos los scripts de auditoría de package.json existen',
  pkgMissing.length === 0,
  `Scripts referenciados que faltan: ${pkgMissing.join(', ')}`
);
const wfDir = path.join(root, '.github/workflows');
const wfText = fs.readdirSync(wfDir).filter(f => /\.ya?ml$/.test(f))
  .map(f => fs.readFileSync(path.join(wfDir, f), 'utf8')).join('\n');
const wfMissing = [...wfText.matchAll(/node (scripts\/[A-Za-z0-9._-]+\.js)/g)]
  .map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).filter(s => !exists(s));
check(
  'Todos los scripts referenciados por los workflows de CI existen',
  wfMissing.length === 0,
  `Scripts de CI que faltan en disco: ${wfMissing.join(', ')}`
);

// ---------------------------------------------------------------------------
const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría final de integración fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría final de integración completada correctamente (${checks.length} comprobaciones).`);
