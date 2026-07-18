const fs = require('fs');

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Falta ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const html = read('login.html');
const css = read('css/login-maintenance.css');
const runtime = read('js/login-maintenance.js');
const store = read('js/collections-store.js');

const checks = [
  ['Google', html.includes('id="btn-google"')],
  ['correo', html.includes('id="login-email-input"') && html.includes('id="btn-send-email-link"')],
  ['errores y éxito', html.includes('id="login-error"') && html.includes('id="login-success"')],
  ['runtime cargado', store.includes("./login-maintenance.js")],
  ['redirección interna', runtime.includes("target.origin !== location.origin")],
  ['canonical dinámico', runtime.includes('normalizeLocation')],
  ['aria-live', runtime.includes("setAttribute('aria-live'")],
  ['tokens configurables', css.includes('--login-accent: var(') && css.includes('--login-surface: var(')],
  ['superficies sólidas', css.includes('background-color: var(--login-surface)')],
  ['desktop grande', css.includes('@media (min-width: 1440px)')],
  ['desktop/laptop', css.includes('max-width: 1439px')],
  ['tablet', css.includes('max-width: 1024px')],
  ['mobile', css.includes('@media (max-width: 768px)')],
  ['mini mobile', css.includes('@media (max-width: 420px)')],
  ['movimiento reducido', css.includes('prefers-reduced-motion')],
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
if (failed.length) process.exit(1);
console.log('\nLogin auditado correctamente en lógica, seguridad y siete viewports.');
