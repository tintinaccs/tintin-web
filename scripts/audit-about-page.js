const fs = require('fs');

const html = fs.readFileSync('about.html', 'utf8');
const css = fs.readFileSync('css/about-maintenance.css', 'utf8');
const js = fs.readFileSync('js/about-maintenance.js', 'utf8');
const loader = fs.readFileSync('js/page-maintenance-loader.js', 'utf8');

const checks = [
  ['about page exists', html.includes('<section class="section tt-about-section"')],
  ['single h1 exists', (html.match(/<h1\b/g) || []).length === 1],
  ['about image has useful alt', /alt="Tintin Accesorios y Relojes"/.test(html)],
  ['about runtime is loaded by page', /about[\s\S]*load\('about-maintenance\.js'\)/.test(loader)],
  ['canonical is normalized dynamically', js.includes('link[rel="canonical"]') && js.includes("new URL('about.html'")],
  ['social metadata is normalized', js.includes('meta[property="og:url"]') && js.includes('meta[name="twitter:image"]')],
  ['time-sensitive shipping claim is normalized', js.includes('Los horarios, costos y disponibilidad se confirman')],
  ['image error state exists', js.includes("classList.add('is-error')") && css.includes('.is-error::after')],
  ['values receive list semantics', js.includes("setAttribute('role', 'list')") && js.includes("setAttribute('role', 'listitem')")],
  ['footer year is dynamic', js.includes('new Date().getFullYear()')],
  ['large desktop layout covered', css.includes('max-width: 1100px')],
  ['tablet layout covered', css.includes('@media (max-width: 768px)')],
  ['mini mobile layout covered', css.includes('@media (max-width: 420px)')],
  ['reduced motion covered', css.includes('prefers-reduced-motion: reduce')],
  ['focus visibility covered', css.includes(':focus-visible')],
  ['solid image surface covered', css.includes('background: var(--about-soft) !important')]
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} about-page audit check(s) failed.`);
  process.exit(1);
}
console.log('\nAbout page audit passed for desktop, laptop, tablet, mobile and mini mobile.');
