const fs = require('fs');

const pages = ['terminos.html', 'privacidad.html'];
const runtimePath = 'js/legal-maintenance.js';
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

if (!fs.existsSync(runtimePath)) errors.push('falta js/legal-maintenance.js');
else {
  const runtime = fs.readFileSync(runtimePath, 'utf8');
  [
    "terminos.html",
    "privacidad.html",
    "tt-legal-nav",
    "aria-labelledby",
    "settings', 'general",
    'prefers-reduced-motion',
    '@media(max-width:767px)',
    '@media(max-width:390px)',
  ].forEach(token => {
    if (!runtime.includes(token)) errors.push(`runtime legal: falta ${token}`);
  });
}

const store = fs.readFileSync('js/collections-store.js', 'utf8');
if (!store.includes("./legal-maintenance.js")) errors.push('collections-store no importa legal-maintenance');

const workflow = fs.readFileSync('.github/workflows/tintin-audit.yml', 'utf8');
if (!workflow.includes('node scripts/audit-legal-pages.js')) errors.push('workflow no ejecuta auditoría legal');

if (errors.length) {
  console.error('Auditoría de páginas informativas falló:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Auditoría de páginas informativas: OK');
