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
export const ACCOUNT_ROLES = ACCOUNT_CONTRACT.roles;
export const ASSIGNABLE_ROLES = ACCOUNT_CONTRACT.assignableRoles;
export const EDITABLE_PERMISSION_ROLES = ACCOUNT_CONTRACT.editablePermissionRoles;
export const STAFF_ROLES = ACCOUNT_CONTRACT.staffRoles;
export const PROFILE_STATUSES = ACCOUNT_CONTRACT.profileStatuses;

export function customerIdForUid(uid) {
  const normalized = String(uid || '').trim();
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(normalized)) throw new Error('UID inválido para customerId');
  return `CUS_${normalized}`;
}
