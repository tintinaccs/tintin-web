'use strict';

/* =============================================================
   TINTIN — Auditoría de páginas informativas de ayuda

   Cubre las páginas de servicio/ayuda que hasta ahora no tenían auditoría
   propia (las legales terminos/privacidad ya la tienen en audit-legal-pages.js):

     - envios.html
     - cambios-devoluciones.html
     - preguntas-frecuentes.html

   Fija las invariantes que las mantienen correctas de punta a punta:
   metadatos y canonical, Open Graph/Twitter con imagen existente, contenido
   editable desde el Super Admin (data-tt-editable + site-content + esquema),
   scripts compartidos (esquema de color en vivo, sincronización de contacto),
   footer con contacto sincronizado y copyright vigente, enlaces internos que
   resuelven, y ausencia de manejadores inline inseguros.

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

const PAGES = [
  { file: 'envios.html', id: 'envios' },
  { file: 'cambios-devoluciones.html', id: 'cambios' },
  { file: 'preguntas-frecuentes.html', id: 'faq' }
];

const schema = read('js/content-schema.js');

// ---------------------------------------------------------------------------
// Comprobaciones por página
// ---------------------------------------------------------------------------
PAGES.forEach(({ file, id }) => {
  const html = read(file);
  const tag = `[${file}]`;

  check(
    `${tag} idioma, viewport, título y descripción`,
    /<html[^>]*lang="es"/.test(html) &&
      /name="viewport"/.test(html) &&
      /<title>[^<]+<\/title>/.test(html) &&
      /name="description" content="[^"]{20,}"/.test(html),
    'Cada página informativa necesita lang, viewport, título y una descripción real.'
  );

  check(
    `${tag} canonical propio hacia el dominio canónico`,
    html.includes(`<link rel="canonical" href="https://tintinaccs.github.io/tintin-web/${file}">`),
    'El canonical debe apuntar a la propia URL en el dominio canónico publicado.'
  );

  check(
    `${tag} Open Graph y Twitter completos con imagen existente`,
    /property="og:title"/.test(html) &&
      /property="og:description"/.test(html) &&
      /property="og:url"/.test(html) &&
      /property="og:type"/.test(html) &&
      /name="twitter:card" content="summary_large_image"/.test(html) &&
      html.includes('og:image" content="https://tintinaccs.github.io/tintin-web/assets/og-cover.jpg"') &&
      exists('assets/og-cover.jpg'),
    'Las tarjetas sociales deben estar completas y la imagen debe existir en el repo.'
  );

  check(
    `${tag} theme-color, favicon y manifest`,
    /name="theme-color"/.test(html) &&
      /rel="icon"/.test(html) &&
      /rel="manifest"/.test(html),
    'Faltan metadatos de PWA/branding (theme-color, favicon o manifest).'
  );

  check(
    `${tag} contenido editable desde el Super Admin (selector + init + esquema)`,
    new RegExp(`data-tt-editable="${id}"`).test(html) &&
      /data-tt-section=/.test(html) &&
      html.includes(`initSiteContent('${id}')`) &&
      new RegExp(`'${file}': '${id}'`).test(schema),
    'La página debe declarar su sección editable, inicializar site-content y estar en el esquema de contenido.'
  );

  check(
    `${tag} esquema de color: primera pintura + motor en vivo`,
    html.includes('js/color-scheme-instant.js') &&
      html.includes('js/color-scheme.js'),
    'Debe cargar la primera pintura estable y el motor de color en vivo para reflejar Apariencia.'
  );

  check(
    `${tag} scripts compartidos (shell, loader, contacto, analítica)`,
    html.includes('js/page-loader.js') &&
      html.includes('js/public-shell.js') &&
      html.includes('js/whatsapp.js') &&
      html.includes('js/analytics.js') &&
      html.includes('script.js'),
    'La página debe compartir el shell público, loader, sincronización de contacto y analítica.'
  );

  check(
    `${tag} footer con contacto sincronizable y copyright vigente`,
    /class="tt-footer"/.test(html) &&
      /tt-contact-phone/.test(html) &&
      /tt-contact-email/.test(html) &&
      /tt-contact-addr/.test(html) &&
      html.includes('© 2024-2026 TINTIN ACCESORIOS'),
    'El footer debe traer las clases de contacto que whatsapp.js sincroniza y el copyright vigente.'
  );

  check(
    `${tag} el footer enlaza a las páginas hermanas de información`,
    html.includes('href="envios.html"') &&
      html.includes('href="cambios-devoluciones.html"') &&
      html.includes('href="preguntas-frecuentes.html"') &&
      html.includes('href="terminos.html"') &&
      html.includes('href="privacidad.html"'),
    'La navegación de información debe enlazar de forma coherente entre las páginas de servicio.'
  );

  check(
    `${tag} sin manejadores de eventos inline (onclick=...)`,
    !/\son[a-z]+\s*=\s*"/i.test(html.replace(/data-tt-[a-z-]+="[^"]*"/gi, '')),
    'No debe haber manejadores inline; el comportamiento va en módulos externos.'
  );

  // Enlaces internos: cada href a un .html local debe resolver a un archivo real.
  const localLinks = [...html.matchAll(/href="([^"#?:]+\.html)(?:[?#][^"]*)?"/g)]
    .map(m => m[1])
    .filter((v, i, a) => a.indexOf(v) === i);
  const broken = localLinks.filter(target => !exists(target));
  check(
    `${tag} todos los enlaces internos .html resuelven`,
    broken.length === 0,
    `Enlaces rotos: ${broken.join(', ')}`
  );
});

// ---------------------------------------------------------------------------
// Comprobaciones específicas
// ---------------------------------------------------------------------------
check(
  '[envios.html] las ciudades de envío se leen de settings/general con estados de carga/vacío/error',
  read('envios.html').includes("onSnapshot(doc(db, 'settings', 'general')") &&
    read('envios.html').includes('tt-city-price-loading') &&
    read('envios.html').includes('Todavía no cargamos ciudades') &&
    /\(err\) => \{[\s\S]{0,200}renderList\('envios-delivery-cities', \[\]\)/.test(read('envios.html')),
  'Las ciudades y costos deben venir de la configuración real, con carga, vacío y manejo de error.'
);

check(
  '[preguntas-frecuentes.html] cada par pregunta/respuesta es editable por selector',
  read('preguntas-frecuentes.html').includes('tt-faq-q') &&
    read('preguntas-frecuentes.html').includes('tt-faq-a') &&
    schema.includes("faqField('questions.0.q'"),
  'Las preguntas frecuentes deben mapear a los campos editables del esquema de contenido.'
);

check(
  'El esquema de contenido reconoce las tres páginas de ayuda',
  /'envios', 'faq', 'cambios'/.test(schema) &&
    schema.includes("'envios.html': 'envios'") &&
    schema.includes("'preguntas-frecuentes.html': 'faq'") &&
    schema.includes("'cambios-devoluciones.html': 'cambios'"),
  'El editor de contenido debe cubrir envíos, cambios y preguntas frecuentes.'
);

// ---------------------------------------------------------------------------
const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de páginas de ayuda fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de páginas de ayuda completada correctamente (${checks.length} comprobaciones).`);
