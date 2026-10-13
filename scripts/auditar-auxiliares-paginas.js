'use strict';

/* TINTIN — Auditoría de 404 y ruta legacy nosotros. */
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

const notFound = read('404.html');
const legacy = read('nosotros.html');

function hasHref(html, cleanRoute, legacyFile) {
  return html.includes(`href="${cleanRoute}"`) || html.includes(`href="${legacyFile}"`);
}

function localTargetExists(raw) {
  const value = String(raw || '').split(/[?#]/)[0];
  if (!value || /^(?:https?:|mailto:|tel:|#|\/\/)/i.test(value)) return true;
  if (value === '/') return exists('index.html');
  const clean = value.replace(/^\//, '');
  if (exists(clean)) return true;
  if (!path.extname(clean) && exists(`${clean}.html`)) return true;
  return false;
}

check(
  '[404.html] idioma, viewport, título y descripción',
  /<html[^>]*lang="es"/.test(notFound) && /name="viewport"/.test(notFound) &&
    /<title>[^<]+<\/title>/.test(notFound) && /name="description" content="[^"]{15,}"/.test(notFound),
  'La página de error necesita metadatos básicos legibles.'
);
check(
  '[404.html] es NO indexable',
  /<meta\s+name="robots"\s+content="[^"]*\bnoindex\b[^"]*">/i.test(notFound),
  'Una página de error nunca debe indexarse.'
);
check(
  '[404.html] mantiene el tema del sitio',
  notFound.includes('js/components/color/esquema-color-instantaneo.js') && notFound.includes('js/components/color/esquema-color.js'),
  'El 404 debe verse con el mismo esquema de color.'
);
check(
  '[404.html] contacto y analítica compartidos',
  notFound.includes('js/components/contact/whatsapp.js') && notFound.includes('js/analytics/analitica.js') && notFound.includes('tienda.js'),
  'El enlace de WhatsApp debe sincronizarse y la visita debe poder medirse.'
);
check(
  '[404.html] ofrece recuperación hacia inicio, catálogo y categorías',
  hasHref(notFound, '/', 'index.html') &&
    hasHref(notFound, '/catalogo', 'catalogo.html') &&
    /href="(?:\/catalogo|catalogo\.html)\?cat=/.test(notFound),
  'El 404 debe funcionar tanto en fuente como después de build:routes y ofrecer salidas claras.'
);
check(
  '[404.html] incluye ayuda por WhatsApp',
  /href="https:\/\/wa\.me\//.test(notFound),
  'El error debe ofrecer un canal de ayuda directo.'
);
check(
  '[404.html] tiene H1 y no usa manejadores inline',
  /<h1[^>]*class="tt-404-title"/.test(notFound) && !/\son[a-z]+\s*=\s*"/i.test(notFound),
  'Debe haber un H1 y ningún manejador de eventos inline.'
);

const internal404 = [...notFound.matchAll(/href="([^"#]+)"/g)]
  .map(match => match[1])
  .filter(value => !/^(?:https?:|mailto:|tel:|#|\/\/)/i.test(value));
const broken404 = internal404.filter(value => !localTargetExists(value));
check(
  '[404.html] todos los destinos internos resuelven, incluida la forma limpia',
  broken404.length === 0,
  `Enlaces rotos: ${broken404.join(', ')}`
);

check(
  '[nosotros.html] redirige directamente a /about',
  /<meta http-equiv="refresh" content="0; url=\/about">/.test(legacy),
  'La ruta antigua debe saltar directamente a la URL limpia final.'
);
check(
  '[nosotros.html] es noindex, follow',
  /<meta name="robots" content="noindex, follow">/.test(legacy),
  'La ruta duplicada no debe indexarse.'
);
check(
  '[nosotros.html] canonicaliza a /about',
  legacy.includes('<link rel="canonical" href="https://tintinaccesorios.pages.dev/about">'),
  'El canonical debe apuntar a la URL limpia real.'
);
check(
  '[nosotros.html] tiene respaldo visible hacia /about',
  /<a href="\/about">/.test(legacy),
  'Si el refresh no dispara debe existir un enlace manual limpio.'
);
check(
  '[nosotros.html] sigue siendo un stub mínimo',
  legacy.length < 2000 && !legacy.includes('tt-footer') && !legacy.includes('initSiteContent'),
  'La ruta legacy no debe duplicar el contenido de About.'
);
check(
  '[nosotros.html] destino About existe y canonicaliza a sí mismo',
  exists('about.html') && read('about.html').includes('<link rel="canonical" href="https://tintinaccesorios.pages.dev/about">'),
  'El destino debe existir y usar canonical limpio.'
);

const publicHtml = fs.readdirSync(root).filter(file => file.endsWith('.html') && file !== 'nosotros.html');
const linkingLegacy = publicHtml.filter(file => /href="[^"]*nosotros\.html/.test(read(file)));
check(
  'Ninguna página pública enlaza nosotros.html',
  linkingLegacy.length === 0,
  `Páginas con enlace legacy: ${linkingLegacy.join(', ')}`
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});
if (failed.length) {
  console.error(`\nAuditoría de páginas auxiliares fallida: ${failed.length} problema(s).`);
  process.exit(1);
}
console.log(`\nAuditoría de páginas auxiliares completada correctamente (${checks.length} comprobaciones, rutas limpias).`);
