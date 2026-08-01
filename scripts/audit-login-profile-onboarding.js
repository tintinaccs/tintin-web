const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
const moduleSource = fs.readFileSync(path.join(root, 'js/profile-onboarding.mjs'), 'utf8');

const checks = [
  ['el login pasa el rol a las tres validaciones de perfil', (login.match(/await ensureProfileComplete\(user, role\)/g) || []).length === 3],
  ['el guardado usa una transacción', login.includes('await runTransaction(db')],
  ['el nombre del proveedor se confirma antes de editar', login.includes('login-profile-name-confirmation')],
  ['el teléfono se puede solicitar independientemente', login.includes("phoneField.style.display = plan.needsPhone ? '' : 'none'")],
  ['el superadmin se excluye por rol o correo', moduleSource.includes("role).toLowerCase() === 'superadmin'")],
  ['solo se completa un teléfono ausente', moduleSource.includes('if (!currentPhone && phone)')],
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([label, ok]) => console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`));
if (failed.length) process.exit(1);
