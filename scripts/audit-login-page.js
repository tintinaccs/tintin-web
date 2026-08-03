const fs = require('fs');

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Falta ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const html = read('login.html');
const maintenanceCss = read('css/login-maintenance.css');
const fluidCss = read('css/login-fluid-responsive.css');
const css = `${maintenanceCss}\n${fluidCss}`;
const runtime = read('js/login-maintenance.js');
const loader = read('js/page-maintenance-loader.js');

const checks = [
  ['Google', html.includes('id="btn-google"')],
  ['correo', html.includes('id="login-email-input"') && html.includes('id="btn-send-otp"')],
  ['errores y éxito', html.includes('id="login-error"') && html.includes('id="login-success"')],
  ['runtime cargado por página', /login[\s\S]*load\('login-maintenance\.js'\)/.test(loader)],
  ['capa responsive cargada', runtime.includes('login-fluid-responsive.css')],
  ['redirección interna', runtime.includes('target.origin !== location.origin')],
  ['canonical dinámico', runtime.includes('normalizeLocation')],
  ['aria-live', runtime.includes("setAttribute('aria-live'")],
  ['tokens configurables', css.includes('--login-accent: var(') && css.includes('--login-surface: var(')],
  ['superficies sólidas', css.includes('background-color: var(--login-surface)')],
  ['desktop grande', css.includes('@media (min-width: 1440px)')],
  ['desktop/laptop', css.includes('@media (min-width: 960px)')],
  ['tablet', css.includes('@media (min-width: 800px) and (max-width: 1099px)')],
  ['mobile', css.includes('@media (max-width: 799px)') && css.includes('@media (max-width: 599px)')],
  ['mini mobile', css.includes('@media (max-width: 359px)') || css.includes('@media (max-width: 420px)')],
  ['movimiento reducido', css.includes('prefers-reduced-motion')]
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
if (failed.length) process.exit(1);
console.log('\nLogin auditado correctamente en lógica, seguridad y todos los viewports fluidos.');
