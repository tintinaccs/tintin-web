const fs = require('fs');

const html = fs.readFileSync('about.html', 'utf8');
const css = fs.readFileSync('css/pages/institutional/about-maintenance.css', 'utf8');
const js = fs.readFileSync('js/pages/institutional/mantenimiento-nosotros.js', 'utf8');
const canonicalGuard = fs.readFileSync('js/pages/institutional/about-canonical-clean-v1.js', 'utf8');
const pageFunction = fs.readFileSync('functions/[page].js', 'utf8');
const loader = fs.readFileSync('js/cargador-mantenimiento-pagina.js', 'utf8');

const checks = [
  ['about page exists', html.includes('<section class="section tt-about-section"')],
  ['single h1 exists', (html.match(/<h1\b/g) || []).length === 1],
  ['about image has useful alt', /alt="Tintin Accesorios y Relojes"/.test(html)],
  ['about runtime is loaded by page', /about[\s\S]*load\('pages\/institutional\/mantenimiento-nosotros\.js'\)/.test(loader)],
  ['runtime recognizes clean and legacy about route', js.includes('about(?:\\.html)?')],
  ['clean canonical guard is injected by Pages Function', pageFunction.includes('about-canonical-clean-v1.js') && pageFunction.includes("page === 'about'")],
  ['clean canonical guard pins canonical and OG to /about', canonicalGuard.includes("new URL('/about', window.location.origin)") && canonicalGuard.includes('link[rel="canonical"]') && canonicalGuard.includes('meta[property="og:url"]')],
  ['clean canonical guard resists later metadata rewrites', canonicalGuard.includes('MutationObserver') && canonicalGuard.includes("attributeFilter: ['href', 'content']") && canonicalGuard.includes("addEventListener('pageshow'")],
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
console.log('\nAbout page audit passed with clean canonical guard and responsive maintenance.');
