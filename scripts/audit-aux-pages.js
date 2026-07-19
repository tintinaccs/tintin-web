'use strict';

/* =============================================================
   TINTIN — Auditoría de páginas auxiliares y rutas legacy

   Cubre las páginas de sistema que no son de contenido y que hasta ahora no
   tenían auditoría propia:

     - 404.html        → página de error (no indexable, con recuperación).
     - nosotros.html   → ruta antigua / no enlazada: redirige a about.html.

   Fija las invariantes que las mantienen correctas: el 404 no debe indexarse y
   siempre debe ofrecer salida (inicio, catálogo, categorías y WhatsApp); la
   ruta legacy debe seguir siendo un stub mínimo que redirige y consolida su
   canonical en about.html, sin volverse un duplicado del contenido real ni ser
   enlazada por error desde el resto del sitio.

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

const notFound = read('404.html');
const legacy = read('nosotros.html');

// ===========================================================================
// 1. PÁGINA DE ERROR — 404.html
// ===========================================================================
check(
  '[404.html] idioma, viewport, título y descripción',
  /<html[^>]*lang="es"/.test(notFound) &&
    /name="viewport"/.test(notFound) &&
    /<title>[^<]+<\/title>/.test(notFound) &&
    /name="description" content="[^"]{15,}"/.test(notFound),
  'La página de error necesita metadatos básicos legibles.'
);
check(
  '[404.html] es NO indexable (robots noindex)',
  /<meta name="robots" content="noindex">/.test(notFound),
  'Una página de error nunca debe indexarse en buscadores.'
);
check(
  '[404.html] mantiene el tema del sitio (primera pintura + motor en vivo)',
  notFound.includes('js/color-scheme-instant.js') &&
    notFound.includes('js/color-scheme.js'),
  'El 404 debe verse con el mismo esquema de color que el resto del sitio.'
);
check(
  '[404.html] contacto y analítica compartidos',
  notFound.includes('js/whatsapp.js') &&
    notFound.includes('js/analytics.js') &&
    notFound.includes('script.js'),
  'El enlace de WhatsApp debe sincronizarse y la visita debe poder medirse.'
);
check(
  '[404.html] ofrece recuperación: inicio, catálogo y categorías',
  notFound.includes('href="index.html"') &&
    notFound.includes('href="catalogo.html"') &&
    /href="catalogo\.html\?cat=/.test(notFound),
  'Un 404 debe ofrecer siempre salidas claras hacia el sitio.'
);
check(
  '[404.html] incluye ayuda por WhatsApp',
  /href="https:\/\/wa\.me\//.test(notFound),
  'El error debe ofrecer un canal de ayuda directo.'
);
check(
  '[404.html] tiene un encabezado principal y sin manejadores inline',
  /<h1[^>]*class="tt-404-title"/.test(notFound) &&
    !/\son[a-z]+\s*=\s*"/i.test(notFound),
  'Debe haber un H1 y ningún manejador de eventos inline.'
);

// 404: todos los enlaces internos .html deben resolver.
const links404 = [...notFound.matchAll(/href="([^"#?:]+\.html)(?:[?#][^"]*)?"/g)]
  .map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i);
const broken404 = links404.filter(t => !exists(t));
check(
  '[404.html] todos los enlaces internos resuelven',
  broken404.length === 0,
  `Enlaces rotos: ${broken404.join(', ')}`
);

// ===========================================================================
// 2. RUTA LEGACY — nosotros.html (redirige a about.html)
// ===========================================================================
check(
  '[nosotros.html] redirige a about.html (meta refresh)',
  /<meta http-equiv="refresh" content="0; url=about\.html">/.test(legacy),
  'La ruta antigua debe redirigir a la página real de Quiénes somos.'
);
check(
  '[nosotros.html] es no indexable pero sigue el enlace (noindex, follow)',
  /<meta name="robots" content="noindex, follow">/.test(legacy),
  'La ruta duplicada no debe indexarse, pero debe transmitir el enlace a about.html.'
);
check(
  '[nosotros.html] consolida su canonical en about.html',
  legacy.includes('<link rel="canonical" href="https://tintinaccs.github.io/tintin-web/about.html">'),
  'El canonical debe apuntar a la página real, no a la ruta legacy.'
);
check(
  '[nosotros.html] tiene un enlace visible de respaldo hacia about.html',
  /<a href="about\.html">/.test(legacy),
  'Si el refresh no dispara, debe existir un enlace manual a about.html.'
);
check(
  '[nosotros.html] sigue siendo un stub mínimo (no duplica el contenido real)',
  legacy.length < 2000 &&
    !legacy.includes('tt-footer') &&
    !legacy.includes('initSiteContent'),
  'La ruta legacy debe quedar como redirección mínima, no como copia de about.html.'
);
check(
  '[nosotros.html] la página destino about.html existe y no crea bucle de canonical',
  exists('about.html') &&
    read('about.html').includes('<link rel="canonical" href="https://tintinaccs.github.io/tintin-web/about.html">'),
  'El destino debe existir y canonizarse en sí mismo (sin apuntar de vuelta a la ruta legacy).'
);

// La ruta legacy debe permanecer NO enlazada desde el resto del sitio público.
const publicHtml = fs.readdirSync(root).filter(f => f.endsWith('.html') && f !== 'nosotros.html');
const linkingLegacy = publicHtml.filter(f => /href="[^"]*nosotros\.html/.test(read(f)));
check(
  'Ninguna página pública enlaza a la ruta legacy nosotros.html',
  linkingLegacy.length === 0,
  `Estas páginas enlazan a la ruta legacy (deberían apuntar a about.html): ${linkingLegacy.join(', ')}`
);

// ---------------------------------------------------------------------------
const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de páginas auxiliares fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de páginas auxiliares completada correctamente (${checks.length} comprobaciones).`);
