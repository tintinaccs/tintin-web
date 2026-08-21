import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'config/account-contract.json'), 'utf8'));
const quote = value => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const list = values => `[${values.map(quote).join(', ')}]`;

function jsSource() {
  return `// GENERADO desde config/account-contract.json. No editar a mano.\nexport const ACCOUNT_CONTRACT = Object.freeze({\n  schemaVersion: ${contract.schemaVersion},\n  superAdminEmail: ${quote(contract.superAdminEmail)},\n  roles: Object.freeze(${list(contract.roles)}),\n  assignableRoles: Object.freeze(${list(contract.assignableRoles)}),\n  editablePermissionRoles: Object.freeze(${list(contract.editablePermissionRoles)}),\n  staffRoles: Object.freeze(${list(contract.staffRoles)}),\n  anonymousRole: ${quote(contract.anonymousRole)},\n  profileStatuses: Object.freeze(${list(contract.profileStatuses)}),\n  customerIdPrefix: ${quote(contract.customerIdPrefix)},\n  identityVersion: ${contract.identityVersion},\n});\n\nexport const SUPER_ADMIN_EMAIL = ACCOUNT_CONTRACT.superAdminEmail;\nexport const ACCOUNT_ROLES = ACCOUNT_CONTRACT.roles;\nexport const ASSIGNABLE_ROLES = ACCOUNT_CONTRACT.assignableRoles;\nexport const EDITABLE_PERMISSION_ROLES = ACCOUNT_CONTRACT.editablePermissionRoles;\nexport const STAFF_ROLES = ACCOUNT_CONTRACT.staffRoles;\nexport const PROFILE_STATUSES = ACCOUNT_CONTRACT.profileStatuses;\n\nexport function customerIdForUid(uid) {\n  const normalized = String(uid || '').trim();\n  if (!/^[A-Za-z0-9_-]{6,128}$/.test(normalized)) throw new Error('UID inválido para customerId');\n  return \`${contract.customerIdPrefix}\${normalized}\`;\n}\n`;
}

function cloudflareSource() {
  return jsSource().split('\nexport const ACCOUNT_ROLES')[0] +
    '\nexport const ASSIGNABLE_ROLES = ACCOUNT_CONTRACT.assignableRoles;\n';
}

function appsScriptSource() {
  return `// GENERADO desde config/account-contract.json. No editar a mano.\n// Copiar este archivo al proyecto oficial TINTIN INVENTARIO 2026 junto con los\n// demás .gs. La autorización efectiva sigue ocurriendo en Firebase/Firestore.\nconst TINTIN_ACCOUNT_CONTRACT_ = Object.freeze({\n  schemaVersion: ${contract.schemaVersion},\n  superAdminEmail: ${quote(contract.superAdminEmail)},\n  roles: Object.freeze(${list(contract.roles)}),\n  assignableRoles: Object.freeze(${list(contract.assignableRoles)}),\n  editablePermissionRoles: Object.freeze(${list(contract.editablePermissionRoles)}),\n  staffRoles: Object.freeze(${list(contract.staffRoles)}),\n  anonymousRole: ${quote(contract.anonymousRole)},\n  profileStatuses: Object.freeze(${list(contract.profileStatuses)}),\n  customerIdPrefix: ${quote(contract.customerIdPrefix)},\n  identityVersion: ${contract.identityVersion}\n});\n\nfunction tintinRoleIsKnown_(role) {\n  return TINTIN_ACCOUNT_CONTRACT_.roles.indexOf(String(role || '').trim().toLowerCase()) !== -1;\n}\n\nfunction tintinRoleIsAssignable_(role) {\n  return TINTIN_ACCOUNT_CONTRACT_.assignableRoles.indexOf(String(role || '').trim().toLowerCase()) !== -1;\n}\n\nfunction tintinIsOfficialSuperAdmin_(record) {\n  return String(record && record.email || '').trim().toLowerCase() === TINTIN_ACCOUNT_CONTRACT_.superAdminEmail;\n}\n`;
}

const targets = [
  ['js/core/auth/contrato-cuentas-generado.js', jsSource()],
  ['cloudflare/contrato-cuentas-generado.js', cloudflareSource()],
  ['apps-script/ContratoCuentas.gs', appsScriptSource()],
];
const check = process.argv.includes('--check');
let stale = false;
for (const [relative, expected] of targets) {
  const target = path.join(root, relative);
  if (check) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (current !== expected) { console.error(`DESACTUALIZADO — ${relative}`); stale = true; }
  } else {
    fs.writeFileSync(target, expected, 'utf8');
    console.log(`GENERADO — ${relative}`);
  }
}
if (stale) process.exit(1);
if (check) console.log('Contrato de cuentas sincronizado en navegador, Cloudflare y Apps Script.');
