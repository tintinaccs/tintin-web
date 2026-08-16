const fs = require('fs');

const html = fs.readFileSync('contact.html', 'utf8');
const runtime = fs.readFileSync('js/pages/institutional/mantenimiento-contacto.js', 'utf8');
const pageFunction = fs.readFileSync('functions/[page].js', 'utf8');
const loader = fs.readFileSync('js/cargador-mantenimiento-pagina.js', 'utf8');
const requiredHtml = [
  'id="contact-form"',
  'id="f-nombre"',
  'id="f-email"',
  'id="f-tel"',
  'id="f-msg"',
  'id="form-success"',
  'tt-contact-info-list',
  'meta property="og:url"',
  'link rel="canonical"'
];
const requiredRuntime = [
  'TintinContactMaintenanceBooted',
  "doc(db, 'settings', 'general')",
  'aria-invalid',
  'navigator.onLine',
  'stopImmediatePropagation',
  'tt-contact-new-message',
  'prefers-reduced-motion',
  '@media(max-width:390px)',
  '@media(max-width:767px)',
  '@media(max-width:1024px)'
];

const missing = [];
for (const token of requiredHtml) if (!html.includes(token)) missing.push(`contact.html: ${token}`);
for (const token of requiredRuntime) if (!runtime.includes(token)) missing.push(`mantenimiento-contacto.js: ${token}`);
if (!runtime.includes('contact(?:\\.html)?')) missing.push('mantenimiento-contacto.js: clean + legacy route recognition');
if (!runtime.includes("new URL('/contact', location.origin)")) missing.push('mantenimiento-contacto.js: clean canonical /contact');
if (!pageFunction.includes('mantenimiento-contacto.js?v=tintin-20260815-contact-clean-1')) missing.push('functions/[page].js: versioned contact runtime injection');
if (!pageFunction.includes('page === \'contact\'')) missing.push('functions/[page].js: contact-only runtime guard');
if (!pageFunction.includes('type="module"')) missing.push('functions/[page].js: Contact runtime must be loaded as ES module');
if (!/contact[\s\S]*load\('pages\/institutional\/mantenimiento-contacto\.js'\)/.test(loader)) missing.push('cargador-mantenimiento-pagina.js: contact maintenance fallback import');
if (/alert\('Por favor completá/.test(runtime)) missing.push('runtime must not use alert validation');
if (missing.length) {
  console.error('Contact audit failed:\n- ' + missing.join('\n- '));
  process.exit(1);
}
console.log('Contact page audit passed with clean-route runtime, clean metadata and versioned edge injection.');
