const fs = require('fs');

const html = fs.readFileSync('contact.html', 'utf8');
const runtime = fs.readFileSync('js/contact-maintenance.js', 'utf8');
const store = fs.readFileSync('js/collections-store.js', 'utf8');
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
for (const token of requiredRuntime) if (!runtime.includes(token)) missing.push(`contact-maintenance.js: ${token}`);
if (!store.includes("import './contact-maintenance.js")) missing.push('collections-store.js: contact maintenance import');
if (/alert\('Por favor completá/.test(runtime)) missing.push('runtime must not use alert validation');
if (missing.length) {
  console.error('Contact audit failed:\n- ' + missing.join('\n- '));
  process.exit(1);
}
console.log('Contact page audit passed for 1600, 1440, 1280, 1024, 768, 390 and 320 px contracts.');
