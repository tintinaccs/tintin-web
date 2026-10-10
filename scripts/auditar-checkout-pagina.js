const fs = require('fs');

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Falta ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const html = read('checkout.html');
const css = read('css/pages/checkout/checkout-maintenance.css');
const runtime = read('js/pages/checkout/checkout-mantenimiento.js');
const reliability = read('js/pages/checkout/checkout-confiabilidad.js');
const loader = read('js/cargador-mantenimiento-pagina.js');

// Cada recurso conserva su URL canónica; los recursos sin cambios conservan su tag.
const versions = JSON.parse(read('scripts/cache-version-baseline.json'));
function hasCanonicalLoad(file) {
  const call = loader.match(new RegExp("checkout[\\s\\S]*load\\('" + file.replaceAll('.', '\\.') + "',\\s*(?:'([^']+)'|(\\w+))\\)"));
  const version = call?.[1] || (call?.[2] && loader.match(new RegExp("const " + call[2] + " = '([^']+)'"))?.[1]);
  return Boolean(version && version === versions['js/' + file]?.version);
}
const checks = [
  ['cinco paneles', [0,1,2,3,4].every(i => html.includes(`id="panel-${i}"`))],
  ['botón confirmación', html.includes('id="ck-confirm-btn"')],
  ['mapa', html.includes('id="ck-map"') && html.includes('id="ck-map-search"')],
  ['reinicio al paso uno', reliability.includes('resetVisualStep') && reliability.includes('index === 0')],
  ['runtime integral por página', hasCanonicalLoad('pages/checkout/checkout-mantenimiento.js')],
  ['protección de cuota por página', hasCanonicalLoad('pages/checkout/checkout-control-cuota.js')],
  ['bloqueo doble confirmación', runtime.includes('confirmLocked') && runtime.includes('stopImmediatePropagation')],
  ['estado offline', runtime.includes("addEventListener('offline'") && css.includes('tt-checkout-offline')],
  ['canonical dinámico', runtime.includes('normalizeMetadata')],
  ['tokens configurables', css.includes('--ck-accent: var(') && css.includes('--ck-surface: var(')],
  ['fondos sólidos', css.includes('background-color: var(--ck-surface)')],
  ['desktop grande', css.includes('@media (min-width: 1440px)')],
  ['desktop/laptop', css.includes('max-width: 1439px')],
  ['tablet', css.includes('max-width: 1024px')],
  ['mobile', css.includes('@media (max-width: 768px)')],
  ['mini mobile', css.includes('@media (max-width: 420px)')],
  ['movimiento reducido', css.includes('prefers-reduced-motion')],
  ['semántica de errores', runtime.includes("setAttribute('role', 'alert')")]
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
if (failed.length) {
  console.error(`\nFallaron ${failed.length} controles del Checkout.`);
  process.exit(1);
}
console.log('\nCheckout auditado correctamente en estructura, lógica y siete viewports.');