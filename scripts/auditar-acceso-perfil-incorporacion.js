const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
const moduleSource = fs.readFileSync(path.join(root, 'js/pages/profile/configuracion-inicial-perfil.mjs'), 'utf8');

const checks = [
  ['el alta se valida solo al crear y los reingresos continúan directo',
    (login.match(/firstLogin: profile\.isNew === true/g) || []).length === 2 &&
    (login.match(/firstLogin: false/g) || []).length === 1 &&
    login.includes('if (!firstLogin) return;')],
  ['el guardado usa una transacción', login.includes('await runTransaction(db')],
  ['el nombre del proveedor se confirma antes de editar', login.includes('login-profile-name-confirmation')],
  ['el teléfono se puede solicitar independientemente', login.includes("phoneField.style.display = plan.needsPhone ? '' : 'none'")],
  ['el superadmin se excluye por rol o correo', moduleSource.includes("role).toLowerCase() === 'superadmin'")],
  ['solo se completa un teléfono ausente', moduleSource.includes('if (!currentPhone && clean(submittedPhone))')],
  ['el nombre y el apellido se validan por separado', moduleSource.includes('export function isValidNamePart')],
  ['los nombres genéricos no se guardan como reales', moduleSource.includes('PLACEHOLDER_NAMES')],
  ['la ubicación exige coordenadas, no solo texto', moduleSource.includes('export function hasUsableAddress')],
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([label, ok]) => console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`));
if (failed.length) process.exit(1);
