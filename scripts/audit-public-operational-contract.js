const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const authNav = read('js/auth-nav.js');
const roles = read('js/roles.js');
const shell = read('js/public-shell.js');
const styles = read('styles.css');
const packageJson = JSON.parse(read('package.json'));

for (const role of ['superadmin', 'admin', 'agent', 'viewer']) {
  check(new RegExp(`${role}:[\\s\\S]*?viewDashboard:\\s*true`).test(roles), `Falta cobertura del rol interno ${role}`);
}
check(/client:[\s\S]*?viewDashboard:\s*false/.test(roles), 'El rol cliente puede revelar estados operativos');
check(authNav.includes("classList.toggle('tt-staff-session',staff)"), 'La sesion interna no controla la visibilidad');
check(styles.includes('[data-tt-operational-status]'), 'Falta el selector operativo compartido');
check(styles.includes('html.tt-staff-session'), 'Falta la excepcion visual para el equipo');
check(/\[data-tt-operational-status\][\s\S]*?display:\s*none\s*!important/.test(styles), 'El estado operativo no arranca oculto');
check(/html\.tt-staff-session[\s\S]*?display:\s*flex\s*!important/.test(styles), 'El equipo no puede revelar el estado operativo');

const operationalSources = {
  'collections.html': 'data-tt-operational-status="collections"',
  'js/cart-sync.js': "dataset.ttOperationalStatus = 'cart'",
  'js/catalog-maintenance.js': "dataset.ttOperationalStatus = 'catalog'",
  'js/collections-maintenance.js': "dataset.ttOperationalStatus = 'collections'",
  'js/product-maintenance.js': "dataset.ttOperationalStatus = 'product'",
  'js/checkout-reliability.js': "dataset.ttOperationalStatus = 'checkout'",
  'js/profile-maintenance.js': "dataset.ttOperationalStatus = 'profile'"
};
for (const [file, marker] of Object.entries(operationalSources)) {
  check(read(file).includes(marker), `${file} no declara su estado operativo`);
}

check(shell.includes("tienda?.setAttribute('aria-current', 'page')"), 'Desktop no anuncia Tienda activa');
check(shell.includes("mobileTienda?.setAttribute('aria-current', 'page')"), 'Tablet no anuncia Tienda activa');
check(shell.includes("if (active) control.setAttribute('aria-current', 'page')"), 'La tabbar no anuncia la ruta activa');
check(packageJson.scripts['audit:public-operational-visibility'], 'Falta la auditoria visual dedicada');

if (failures.length) {
  console.error(failures.map(message => `FALTA - ${message}`).join('\n'));
  process.exit(1);
}

console.log('Contrato de visibilidad operativa y navegacion activa: correcto.');
