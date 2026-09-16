import { SUPER_ADMIN_EMAIL } from './contrato-cuentas-generado.js?v=tintin-20260821-account-contract-1';

export function isSuperAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === String(SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
}

export function isSuperAdmin(user) {
  return isSuperAdminEmail(user?.email);
}
