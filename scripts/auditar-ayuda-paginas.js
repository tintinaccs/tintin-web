'use strict';

/* TINTIN — Auditoría de páginas informativas de ayuda. */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

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

const PUBLIC_ORIGIN = 'https://tintinaccesorios.pages.dev';
const PAGES = [
  { file: 'envios.html', id: 'envios', route: '/envios' },
  { file: 'cambios-devoluciones.html', id: 'cambios', route: '/cambios-devoluciones' },
  { file: 'preguntas-frecuentes.html', id: 'faq', route: '/preguntas-frecuentes' }
];
const CLEAN_INFO_LINKS = ['/envios', '/cambios-devoluciones', '/preguntas-frecuentes', '/terminos', '/privacidad'];
const PAGE_FILE_BY_ROUTE = new Map([
  ['/envios', 'envios.html'],
  ['/cambios-devoluciones', 'cambios-devoluciones.html'],
  ['/preguntas-frecuentes', 'preguntas-frecuentes.html'],
  ['/terminos', 'terminos.html'],
  ['/privacidad', 'privacidad.html']
]);

async function run() {
  // Tarea 4: la auditoría consume la misma fachada que Super Admin y el
  // runtime público. No inspeccionamos la ubicación textual de las
  // definiciones: estructura y campos pueden vivir en módulos distintos sin
  // que eso cree una falsa regresión.
  const contentContract = await import(pathToFileURL(path.join(root, 'js/core/store/esquema-contenido.js')).href);

  PAGES.forEach(({ file, id, route }) => {
    const html = read(file);
    const tag = `[${file}]`;
    const pageSchema = contentContract.getPageSchema(id);
    const structurePage = contentContract.getSiteStructurePage(id);

    check(
      `${tag} idioma, viewport, título y descripción`,
      /<html[^>]*lang="es"/.test(html) &&
        /name="viewport"/.test(html) &&
        /<title>[^<]+<\/title>/.test(html) &&
        /name="description" content="[^"]{20,}"/.test(html),
      'Cada página informativa necesita lang, viewport, título y una descripción real.'
    );

    check(
      `${tag} canonical propio hacia la URL final limpia`,
      html.includes(`<link rel="canonical" href="${PUBLIC_ORIGIN}${route}">`),
      'El canonical debe apuntar a la URL final limpia que Cloudflare publica.'
    );

    check(
      `${tag} Open Graph y Twitter completos con imagen existente`,
      /property="og:title"/.test(html) &&
        /property="og:description"/.test(html) &&
        html.includes(`property="og:url" content="${PUBLIC_ORIGIN}${route}"`) &&
        /property="og:type"/.test(html) &&
        /name="twitter:card" content="summary_large_image"/.test(html) &&
        html.includes('og:image" content="https://tintinaccesorios.pages.dev/assets/og-cover.jpg"') &&
        exists('assets/og-cover.jpg'),
      'Las tarjetas sociales deben estar completas y usar la URL final limpia.'
    );

    check(
      `${tag} theme-color, favicon y manifest`,
      /name="theme-color"/.test(html) && /rel="icon"/.test(html) && /rel="manifest"/.test(html),
      'Faltan metadatos de PWA/branding.'
    );

    check(
      `${tag} contenido editable desde el Super Admin`,
      new RegExp(`data-tt-editable="${id}"`).test(html) &&
        /data-tt-section=/.test(html) &&
        html.includes(`initSiteContent('${id}')`) &&
        contentContract.CONTENT_PAGE_IDS.includes(id) &&
        Boolean(pageSchema) &&
        Boolean(structurePage) &&
        structurePage.path === file &&
        structurePage.mode !== contentContract.SITE_STRUCTURE_MODES.protected &&
        contentContract.detectContentPageId(route) === id &&
        contentContract.detectContentPageId(`/${file}`) === id,
      'La página debe declarar su sección editable, inicializar site-content y estar disponible mediante la fachada/estructura canónicas.'
    );

    check(
      `${tag} esquema de color: primera pintura + motor en vivo`,
      html.includes('js/components/color/esquema-color-instantaneo.js') && html.includes('js/components/color/esquema-color.js'),
      'Debe cargar la primera pintura estable y el motor de color en vivo.'
    );

    check(
      `${tag} scripts compartidos`,
      html.includes('js/cargador-pagina.js') &&
        html.includes('js/inicio-navegacion-publica.js') &&
        html.includes('js/components/contact/whatsapp.js') &&
        html.includes('js/analytics/analitica.js') &&
        html.includes('tienda.js'),
      'La fuente HTML debe conservar shell, loader, contacto, analítica y runtime compartido; Pages puede aligerarlos al servir.'
    );

    check(
      `${tag} footer con contacto sincronizable y copyright vigente`,
      /class="tt-footer"/.test(html) &&
        /tt-contact-phone/.test(html) &&
        /tt-contact-email/.test(html) &&
        /tt-contact-addr/.test(html) &&
        html.includes('© 2024-2026 TINTIN ACCESORIOS'),
      'El footer debe traer las clases de contacto sincronizables y copyright vigente.'
    );

    check(
      `${tag} footer usa las cinco rutas informativas limpias`,
      CLEAN_INFO_LINKS.every(cleanRoute => html.includes(`href="${cleanRoute}"`)),
      'Después de build:routes, la navegación informativa debe apuntar a rutas limpias y no a aliases .html.'
    );

    check(
      `${tag} no vuelve a publicar enlaces internos .html normalizables`,
      !/href="(?:\.\/|\/)?(?:envios|cambios-devoluciones|preguntas-frecuentes|terminos|privacidad)\.html(?:[?#][^"]*)?"/i.test(html),
      'Los aliases .html redirigen; no deben permanecer como enlaces navegables después de normalizar rutas.'
    );

    check(
      `${tag} las rutas informativas limpias resuelven a HTML existentes`,
      CLEAN_INFO_LINKS.every(cleanRoute => exists(PAGE_FILE_BY_ROUTE.get(cleanRoute))),
      'Cada destino limpio debe tener su documento HTML fuente correspondiente.'
    );

    check(
      `${tag} sin manejadores de eventos inline`,
      !/\son[a-z]+\s*=\s*"/i.test(html.replace(/data-tt-[a-z-]+="[^"]*"/gi, '')),
      'No debe haber manejadores inline; el comportamiento va en módulos externos.'
    );
  });

  check(
    '[envios.html] las ciudades de envío se leen de settings/shippingRates con estados de carga/vacío/error',
    read('envios.html').includes("onSnapshot(doc(db, 'settings', 'shippingRates')") &&
      read('envios.html').includes('tt-city-price-loading') &&
      read('envios.html').includes('Todavía no cargamos ciudades') &&
      /\(err\) => \{[\s\S]{0,200}renderList\('envios-delivery-cities', \[\]\)/.test(read('envios.html')),
    'Las ciudades y costos deben venir de la configuración real, con carga, vacío y manejo de error.'
  );

  const faqFields = contentContract.getSectionSchema('faq', 'questions')?.fields || [];
  const faqFieldByKey = new Map(faqFields.map(item => [item.key, item]));
  const faqPairsAreMapped = Array.from({ length: 11 }, (_, index) => {
    const question = faqFieldByKey.get(`questions.${index}.q`);
    const answer = faqFieldByKey.get(`questions.${index}.a`);
    return question?.selector === '.tt-faq-q' &&
      answer?.selector === '.tt-faq-a' &&
      question.index === index &&
      answer.index === index;
  }).every(Boolean);

  check(
    '[preguntas-frecuentes.html] cada par pregunta/respuesta es editable por selector',
    read('preguntas-frecuentes.html').includes('tt-faq-q') &&
      read('preguntas-frecuentes.html').includes('tt-faq-a') &&
      faqPairsAreMapped,
    'Las once preguntas y respuestas deben mapear a campos editables reales de la fachada canónica.'
  );

  check(
    'El esquema de contenido reconoce las tres páginas de ayuda',
    PAGES.every(({ file, id, route }) => {
      const pageSchema = contentContract.getPageSchema(id);
      const structurePage = contentContract.getSiteStructurePage(id);
      return contentContract.CONTENT_PAGE_IDS.includes(id) &&
        Boolean(pageSchema) &&
        Boolean(structurePage) &&
        structurePage.path === file &&
        contentContract.detectContentPageId(route) === id &&
        contentContract.detectContentPageId(`/${file}`) === id;
    }),
    'El editor de contenido y el contrato estructural deben cubrir envíos, cambios y preguntas frecuentes con sus rutas limpias y aliases.'
  );

  const failed = checks.filter(item => !item.ok);
  checks.forEach(item => {
    console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
    if (!item.ok) console.log(`  ${item.problem}`);
  });

  if (failed.length) {
    console.error(`\nAuditoría de páginas de ayuda fallida: ${failed.length} problema(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nAuditoría de páginas de ayuda completada correctamente (${checks.length} comprobaciones, rutas limpias y contrato canónico).`);
}

run().catch(error => {
  console.error('\nAuditoría de páginas de ayuda no pudo ejecutarse.');
  console.error(error?.stack || error);
  process.exitCode = 1;
});
