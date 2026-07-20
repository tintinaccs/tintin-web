'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const cache = new Map();

function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(file => file.endsWith('.js')).map(file => `js/${file}`);
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const firebaseInitFiles = [...jsFiles, ...htmlFiles].filter(file =>
  /initializeApp\s*\(/.test(read(file)) || /apiKey:\s*["']/.test(read(file))
);
check(
  'Firebase se inicializa únicamente en js/firebase.js',
  firebaseInitFiles.length === 1 && firebaseInitFiles[0] === 'js/firebase.js',
  `Inicializadores encontrados: ${firebaseInitFiles.join(', ')}`
);
check(
  'El control de tienda reutiliza store-gate-core',
  read('js/store-gate.js').includes("from './store-gate-core.js") &&
    read('js/store-gate-core.js').includes("doc(db, 'settings', 'storeGate')") &&
    read('js/page-loader.js').includes('store-gate'),
  'El gate público debe tener una sola implementación.'
);
check(
  'Configuración general pública tiene una sola suscripción compartida',
  read('js/public-settings-store.js').includes("onSnapshot(doc(db, 'settings', 'general')") &&
    read('js/whatsapp.js').includes('onPublicSettings') &&
    read('js/checkout-payment-methods.js').includes('onPublicSettings'),
  'WhatsApp y pagos deben compartir public-settings-store.'
);
check(
  'Tienda cerrada consume settings/storeGate',
  read('js/store-gate-core.js').includes("doc(db, 'settings', 'storeGate')"),
  'La apertura de tienda debe usar el documento público mínimo.'
);
check(
  'Apariencia consume colorSchemes y settings/appearance',
  read('js/color-scheme.js').includes('colorSchemes') && read('js/color-scheme.js').includes('APPEARANCE_DOC'),
  'La apariencia debe seguir conectada al Super Admin.'
);
check(
  'Contenido consume site_content',
  read('js/site-content.js').includes('site_content'),
  'El contenido editable debe conservar Firestore como fuente.'
);

const robots = read('robots.txt');
check(
  'robots bloquea páginas privadas y declara sitemap',
  ['/admin.html', '/admin-images.html', '/login.html', '/checkout.html', '/perfil.html']
    .every(page => robots.includes(`Disallow: ${page}`)) && /Sitemap:\s*https?:\/\//.test(robots),
  'robots.txt no protege todas las rutas privadas.'
);
const sitemap = read('sitemap.xml');
check(
  'sitemap incluye las páginas públicas',
  ['index.html', 'catalogo.html', 'collections.html', 'about.html', 'contact.html',
   'envios.html', 'cambios-devoluciones.html', 'preguntas-frecuentes.html',
   'terminos.html', 'privacidad.html'].every(page => sitemap.includes(`/${page}<`)),
  'Faltan páginas públicas en sitemap.xml.'
);
check(
  'sitemap no expone páginas privadas',
  ['admin.html', 'admin-images.html', 'login.html', 'checkout.html', 'perfil.html',
   '404.html', 'nosotros.html'].every(page => !sitemap.includes(`/${page}<`)),
  'El sitemap contiene rutas que no deben indexarse.'
);

let manifest = null;
try {
  manifest = JSON.parse(read('manifest.json'));
} catch {}
check(
  'manifest es válido y sus iconos existen',
  manifest && manifest.name && manifest.start_url && manifest.scope && manifest.theme_color &&
    Array.isArray(manifest.icons) && manifest.icons.length > 0 && manifest.icons.every(icon => exists(icon.src)),
  'manifest.json o sus recursos son inválidos.'
);
const apiFunctions = fs.readdirSync(path.join(root, 'functions/api'))
  .filter(file => file.endsWith('.js')).map(file => `/api/${file.replace(/\.js$/, '')}`).sort();
const routes = (JSON.parse(read('_routes.json')).include || []).slice().sort();
check(
  '_routes incluye exactamente las funciones existentes',
  JSON.stringify(apiFunctions) === JSON.stringify(routes),
  `Funciones: ${apiFunctions.join(', ')} | Rutas: ${routes.join(', ')}`
);
check(
  'firebase.json solo despliega reglas',
  (() => {
    const config = JSON.parse(read('firebase.json'));
    return config.firestore && config.firestore.rules === 'firestore.rules' && !config.hosting;
  })(),
  'El hosting no debe administrarse desde firebase.json.'
);

check('No queda tintin-code-sh', !exists('tintin-code-sh'), 'Quedan fragmentos obsoletos.');
check(
  'No quedan PNG obsoletos del header',
  !exists('images/Mi cuenta.png') && !exists('images/Busqueda.png') && !exists('images/Carrito.png'),
  'Quedan imágenes reemplazadas por SVG.'
);
const liquid = [...jsFiles, ...htmlFiles, 'styles.css', 'script.js']
  .filter(file => exists(file) && /\{%[- ]*(liquid|section|schema|render|assign)\b/.test(read(file)));
check('No quedan plantillas Liquid', liquid.length === 0, `Archivos: ${liquid.join(', ')}`);

const packageScripts = Object.values(JSON.parse(read('package.json')).scripts).join(' ');
const packageMissing = [...packageScripts.matchAll(/node (scripts\/[A-Za-z0-9._-]+\.js)/g)]
  .map(match => match[1]).filter((value, index, values) => values.indexOf(value) === index).filter(file => !exists(file));
check('Todos los scripts de package.json existen', packageMissing.length === 0, packageMissing.join(', '));
const workflowDirectory = path.join(root, '.github/workflows');
const workflowText = fs.readdirSync(workflowDirectory).filter(file => /\.ya?ml$/.test(file))
  .map(file => fs.readFileSync(path.join(workflowDirectory, file), 'utf8')).join('\n');
const workflowMissing = [...workflowText.matchAll(/node (scripts\/[A-Za-z0-9._-]+\.js)/g)]
  .map(match => match[1]).filter((value, index, values) => values.indexOf(value) === index).filter(file => !exists(file));
check('Todos los scripts de CI existen', workflowMissing.length === 0, workflowMissing.join(', '));

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});
if (failed.length) {
  console.error(`\nAuditoría final fallida: ${failed.length} problema(s).`);
  process.exit(1);
}
console.log(`\nAuditoría final completada (${checks.length} comprobaciones).`);
