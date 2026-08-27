import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const contract = JSON.parse(read('config/account-contract.json'));
const roles = read('js/core/auth/roles.js');
const cloudflare = read('cloudflare/seguridad-cloudinary.js');
const rules = read('firestore.rules');
const otp = read('functions/api/email-otp-send.js');
const deletion = read('functions/api/admin-delete-user.js');
const lifecycle = read('cloudflare/user-lifecycle-domain.js');
const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });

check('El contrato declara exactamente los cinco roles persistidos', JSON.stringify(contract.roles) === JSON.stringify(['superadmin','admin','agent','viewer','client']));
check('Super Admin no es asignable', !contract.assignableRoles.includes('superadmin') && contract.assignableRoles.includes('viewer'));
check('El navegador consume el contrato generado', roles.includes("from './contrato-cuentas-generado.js"));
check('Cloudflare consume el mismo contrato generado', cloudflare.includes("from './contrato-cuentas-generado.js"));
check('Rules acepta la allowlist moderna completa', rules.includes("['client', 'admin', 'agent', 'viewer']"));
check('customerId queda inmutable y ligado al UID', rules.includes("'customerId'") && rules.includes("data.customerId == 'CUS_' + userId"));
check('La auditoría continúa append-only', /match \/auditLog\/\{logId\}[\s\S]{0,260}allow update, delete: if false/.test(rules));
check('PIN ya no excluye cuentas Google', !otp.includes('google_account_exists') && !otp.includes("providers.includes('google.com')"));
check(
  'Eliminar cuenta conserva tombstone',
  deletion.includes('applyUserLifecycle') &&
    lifecycle.includes("profileStatus: fsString('deleted')") &&
    lifecycle.includes("deleted: fsBoolean(true)") &&
    lifecycle.includes("setFirebaseUserDisabled(env, uid, action === 'softDelete')") &&
    !deletion.includes('deleteFirebaseUser') &&
    !lifecycle.includes('deleteFirebaseUser')
);

for (const item of checks) console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
if (checks.some(item => !item.ok)) process.exit(1);
console.log(`Contrato de cuentas verificado (${checks.length} controles).`);
