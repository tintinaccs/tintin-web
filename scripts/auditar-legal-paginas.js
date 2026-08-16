const fs = require('fs');

const pages = ['terminos.html', 'privacidad.html'];
const runtimePath = 'js/pages/institutional/mantenimiento-legal.js';
const errors = [];

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  if (!/<html[^>]+lang="es"/i.test(html)) errors.push(`${page}: falta lang=es`);
  if (!/<meta name="viewport"/i.test(html)) errors.push(`${page}: falta viewport`);
  if (!/<link rel="canonical"/i.test(html)) errors.push(`${page}: falta canonical`);
  if (!/meta property="og:url"/i.test(html)) errors.push(`${page}: falta og:url`);
  if (!/tt-page-hero-title/i.test(html)) errors.push(`${page}: falta H1 visible`);
  if ((html.match(/class="tt-info-block"/g) || []).length < 5) errors.push(`${page}: contenido informativo incompleto`);
  if (!/tt-footer-bottom/i.test(html)) errors.push(`${page}: falta footer`);
}

if (!fs.existsSync(runtimePath)) errors.push('falta js/pages/institutional/mantenimiento-legal.js');
else {
  const runtime = fs.readFileSync(runtimePath, 'utf8');
  [
    "new Set(['terminos', 'privacidad'])",
    "replace(/\\.html$/, '')",
    'tt-legal-nav',
    'aria-labelledby',
    "settings', 'general",
    'prefers-reduced-motion',
    '@media(max-width:767px)',
    '@media(max-width:390px)'
  ].forEach(token => {
    if (!runtime.includes(token)) errors.push(`runtime legal: falta ${token}`);
  });
  if (!runtime.includes('new URL(`/${page}`, location.origin)')) errors.push('runtime legal: canonical debe usar ruta limpia');
}

const loader = fs.readFileSync('js/cargador-mantenimiento-pagina.js', 'utf8');
if (!/terminos\|privacidad[\s\S]*load\('pages\/institutional\/mantenimiento-legal\.js'\)/.test(loader)) {
  errors.push('page-maintenance-loader no importa legal-maintenance en páginas legales');
}

const pageFunction = fs.readFileSync('functions/[page].js', 'utf8');
if (!pageFunction.includes('mantenimiento-legal.js?v=tintin-20260815-legal-clean-1')) errors.push('Pages Function no inyecta runtime legal versionado');
if (!pageFunction.includes("page === 'terminos' || page === 'privacidad'")) errors.push('Pages Function no limita runtime legal a rutas legales');

const workflow = fs.readFileSync('.github/workflows/auditar-tintin.yml', 'utf8');
if (!workflow.includes('node scripts/auditar-legal-paginas.js')) errors.push('workflow no ejecuta auditoría legal');

if (errors.length) {
  console.error('Auditoría de páginas informativas falló:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Auditoría de páginas informativas: OK · rutas limpias y runtime legal versionado.');
