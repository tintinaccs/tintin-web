// GENERADO desde config/account-contract.json. No editar a mano.
export const ACCOUNT_CONTRACT = Object.freeze({
  schemaVersion: 1,
  superAdminEmail: 'tintinaccs@gmail.com',
  roles: Object.freeze(['superadmin', 'admin', 'agent', 'viewer', 'client']),
  assignableRoles: Object.freeze(['admin', 'agent', 'viewer', 'client']),
  editablePermissionRoles: Object.freeze(['admin', 'agent', 'viewer']),
  staffRoles: Object.freeze(['superadmin', 'admin', 'agent', 'viewer']),
  anonymousRole: 'guest',
  profileStatuses: Object.freeze(['legacy', 'incomplete', 'active', 'deleted']),
  customerIdPrefix: 'CUS_',
  identityVersion: 1,
});

export const SUPER_ADMIN_EMAIL = ACCOUNT_CONTRACT.superAdminEmail;
export const ASSIGNABLE_ROLES = ACCOUNT_CONTRACT.assignableRoles;
