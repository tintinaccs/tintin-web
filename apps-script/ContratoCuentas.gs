// GENERADO desde config/account-contract.json. No editar a mano.
// Copiar este archivo al proyecto oficial TINTIN INVENTARIO 2026 junto con los
// demás .gs. La autorización efectiva sigue ocurriendo en Firebase/Firestore.
const TINTIN_ACCOUNT_CONTRACT_ = Object.freeze({
  schemaVersion: 1,
  superAdminEmail: 'tintinaccs@gmail.com',
  roles: Object.freeze(['superadmin', 'admin', 'agent', 'viewer', 'client']),
  assignableRoles: Object.freeze(['admin', 'agent', 'viewer', 'client']),
  editablePermissionRoles: Object.freeze(['admin', 'agent', 'viewer']),
  staffRoles: Object.freeze(['superadmin', 'admin', 'agent', 'viewer']),
  anonymousRole: 'guest',
  profileStatuses: Object.freeze(['legacy', 'incomplete', 'active', 'deleted']),
  customerIdPrefix: 'CUS_',
  identityVersion: 1
});

function tintinRoleIsKnown_(role) {
  return TINTIN_ACCOUNT_CONTRACT_.roles.indexOf(String(role || '').trim().toLowerCase()) !== -1;
}

function tintinRoleIsAssignable_(role) {
  return TINTIN_ACCOUNT_CONTRACT_.assignableRoles.indexOf(String(role || '').trim().toLowerCase()) !== -1;
}

function tintinIsOfficialSuperAdmin_(record) {
  return String(record && record.email || '').trim().toLowerCase() === TINTIN_ACCOUNT_CONTRACT_.superAdminEmail;
}
