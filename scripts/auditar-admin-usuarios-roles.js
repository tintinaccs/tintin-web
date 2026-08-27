'use strict';

/* =============================================================
   TINTIN — Auditoría de Usuarios, Roles, Permisos y autoridad única

   Verifica que:
   - identidad/roles continúen protegidos;
   - admin-app.js sea la única autoridad runtime de Usuarios;
   - la ruta Fase 8 sea solo compatibilidad y la ficha sea read-only;
   - Firestore Rules mantengan el límite server-side.
   ============================================================= */

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [];
function check(name, condition, problem) { checks.push({ name, ok: Boolean(condition), problem }); }

const roles = read('js/core/auth/roles.js');
const rolePerms = read('js/core/auth/permisos-roles.js');
const adminApp = read('js/admin/admin-app.js');
const compat = read('js/admin/users/gestion-usuarios-admin.js');
const ficha = read('js/admin/users/ficha-usuario-admin.js');
const rules = read('firestore.rules');
const accountContract = JSON.parse(read('config/account-contract.json'));
const accountStatusFunction = read('functions/api/admin-delete-user.js');

// 1. Identidad y techo de roles
check(
  'El Super Admin se identifica por el correo oficial de Firebase Auth',
  /export const SUPER_ADMIN = SUPER_ADMIN_EMAIL/.test(roles) &&
    accountContract.superAdminEmail === 'tintinaccs@gmail.com' &&
    /if \(authenticatedEmail === SUPER_ADMIN\) return 'superadmin'/.test(roles),
  'La identidad de Super Admin no debe depender de un campo editable en Firestore.'
);
check(
  'Un rol inválido o documento faltante caen a client',
  /if \(!snap\.exists\(\)\) return 'client'/.test(roles) &&
    /ASSIGNABLE_ROLES\.includes\(role\) \? role : 'client'/.test(roles),
  'Sin ficha o con rol desconocido nunca debe haber permisos elevados.'
);
check(
  'superadmin nunca es asignable desde el panel',
  /if \(!ASSIGNABLE_ROLES\.includes\(role\)\) throw new Error/.test(roles) &&
    !accountContract.assignableRoles.includes('superadmin'),
  'superadmin es identidad protegida, no rol asignable.'
);

// 2. Matriz dinámica acotada
check(
  'Solo admin/agent/viewer son columnas editables',
  /export const EDITABLE_ROLES = EDITABLE_PERMISSION_ROLES/.test(rolePerms) &&
    JSON.stringify(accountContract.editablePermissionRoles) === JSON.stringify(['admin', 'agent', 'viewer']),
  'Super Admin y Cliente no son columnas editables.'
);
check(
  'Los defaults nunca amplían el techo fijo',
  /out\[role\]\[modKey\]\[actKey\] = editable \? !!\(PERMISSIONS\[role\]\?\.\[act\.defaultFrom\]\) : false/.test(rolePerms),
  'La matriz dinámica solo puede acotar permisos existentes.'
);
check(
  'Una matriz ausente o inválida usa defaults fail-safe',
  /catch \(e\)[\s\S]{0,160}_cache = defaults/.test(rolePerms) &&
    /if \(!_cache\)[\s\S]{0,220}return !!\(PERMISSIONS\[role\]\?\.\[act\.defaultFrom\]\)/.test(rolePerms),
  'La ausencia del documento no debe abrir permisos ni bloquear al Super Admin.'
);
check(
  'Super Admin ignora una matriz defectuosa',
  /function roleCanDo\(moduleKey, actionKey\)/.test(adminApp) &&
    /return currentRole === 'superadmin' \|\| canDo\(currentRole, moduleKey, actionKey\)/.test(adminApp),
  'roleCanDo debe aceptar superadmin antes de consultar la matriz.'
);

// 3. Una sola autoridad de Usuarios
check(
  'admin-app.js mantiene el único listener de users',
  (adminApp.match(/onSnapshot\(query\(collection\(db, ['"]users['"],?\)?/g) || []).length === 1 &&
    !compat.includes('onSnapshot(') && !ficha.includes('onSnapshot('),
  'La colección users no debe escucharse desde dos módulos del mismo panel.'
);
check(
  'La compatibilidad Fase 8 no contiene CRUD paralelo',
  compat.includes('única autoridad activa de Usuarios es js/admin/admin-app.js') &&
    compat.includes("import('./ficha-usuario-admin.js") &&
    !compat.includes('writeBatch(') && !compat.includes('updateDoc(') &&
    !compat.includes('setDoc(') && !compat.includes('deleteDoc('),
  'La ruta histórica solo debe delegar la ficha de lectura.'
);
check(
  'La ficha detallada es read-only y bajo demanda',
  ficha.includes("getDoc(doc(db, 'users', uid))") &&
    ficha.includes("where('userId', '==', uid)") &&
    ficha.includes("where('targetId', '==', uid)") &&
    !ficha.includes('onSnapshot(') && !ficha.includes('writeBatch(') &&
    !ficha.includes('updateDoc(') && !ficha.includes('setDoc('),
  'La ficha no puede convertirse en una segunda fuente de estado o acciones.'
);

// 4. CRUD canónico y protecciones
check(
  'Bloquear protege al Super Admin',
  /window\.blockUser = async \(uid, email\) => \{\s*\n\s*if \(email === SUPER_ADMIN\)/.test(adminApp),
  'La protección debe existir en la acción, no solo en el botón.'
);
check(
  'Eliminar protege al Super Admin y valida permiso',
  /_target\.email === SUPER_ADMIN/.test(adminApp) &&
    /window\.deleteUser[\s\S]{0,800}if \(!can\(currentRole, 'deleteUsers'\)\)/.test(adminApp),
  'deleteUser no puede borrar la cuenta oficial ni correr sin permiso.'
);
check(
  'Cambiar rol protege Super Admin y limita roles',
  /if \(email === SUPER_ADMIN\)[\s\S]{0,260}return;/.test(adminApp) &&
    /if \(!can\(currentRole, 'assignRoles'\)\)/.test(adminApp) &&
    /if \(!ASSIGNABLE_ROLES\.includes\(role\)\)/.test(adminApp),
  'No debe poder degradarse Super Admin ni escribirse un rol desconocido.'
);
check(
  'Acciones masivas excluyen al Super Admin',
  (adminApp.match(/u\.email !== SUPER_ADMIN/g) || []).length >= 3,
  'Rol, bloqueo y restauración masiva deben excluir la cuenta oficial.'
);
check(
  'Bloqueo y restauración preservan roleBeforeBlock',
  /roleBeforeBlock: prevRole,\s*\n\s*role: 'client'/.test(adminApp) &&
    /ASSIGNABLE_ROLES\.includes\(u\?\.roleBeforeBlock\)\s*\?\s*u\.roleBeforeBlock\s*:\s*'client'/.test(adminApp),
  'Una cuenta bloqueada pierde privilegios y al restaurarse recupera un rol anterior válido.'
);
check(
  'Las acciones sensibles dejan auditoría',
  /logAudit\('cambiar_rol'/.test(adminApp) &&
    /logAudit\('bloquear_usuario'/.test(adminApp) &&
    /logAudit\('restaurar_usuario'/.test(adminApp) &&
    /auditLog\/\$\{id\}/.test(accountStatusFunction),
  'Rol, bloqueo, restauración y soft-delete deben quedar trazados.'
);
check(
  'La tabla escapa nombre, email y avatar',
  /escapeHtmlAdmin\(u\.name/.test(adminApp) &&
    /escapeHtmlAdmin\(u\.email/.test(adminApp) &&
    /sanitizeImageUrl\(u\.photoURL/.test(adminApp),
  'Los datos de clienta no deben interpretarse como HTML ejecutable.'
);

// 5. Firestore Rules
check(
  'Las reglas impiden borrar físicamente users',
  /match \/users\/\{userId\}[\s\S]{0,1800}allow delete: if false/.test(rules),
  'Las identidades históricas deben conservarse.'
);
check(
  'Las reglas impiden asignar superadmin y protegen la cuenta oficial',
  rules.includes("request.resource.data.role in ['client', 'admin', 'agent', 'viewer']") &&
    rules.includes('!isSuperAdminAccount(resource.data)'),
  'Solo se admiten roles asignables y la cuenta oficial no puede degradarse.'
);
check(
  'Solo Super Admin escribe rolePermissions',
  /match \/rolePermissions\/\{docId\}[\s\S]{0,500}allow write: if isSuperAdmin\(\)/.test(rules),
  'Un Admin común no debe editar la matriz de permisos.'
);
check(
  'Cada ficha users solo la lee su dueño o Super Admin',
  /match \/users\/\{userId\}[\s\S]{0,160}allow read: if isSignedIn\(\) &&[\s\S]{0,100}request\.auth\.uid == userId \|\| isSuperAdmin\(\)/.test(rules),
  'Una cuenta no puede leer la ficha privada de otra.'
);
check(
  'auditLog es de solo lectura para Super Admin',
  /match \/auditLog\/\{logId\}[\s\S]{0,160}allow read: if isSuperAdmin\(\)/.test(rules),
  'Los registros de auditoría no deben exponerse a otros roles.'
);

// 6. Inicialización
check(
  'Los permisos dinámicos se cargan antes de armar la UI',
  /await loadRolePermissions\(\);[\s\S]{0,220}setupPermissions\(role\)/.test(adminApp),
  'canDo debe estar inicializado desde el primer render.'
);
check(
  'client o rol ausente no entra al panel',
  /if \(role === 'client' \|\| !role\) \{\s*\n\s*window\.location\.href = 'perfil\.html'/.test(adminApp),
  'Una clienta autenticada nunca debe entrar al panel.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});
if (failed.length) {
  console.error(`\nAuditoría de usuarios/roles/permisos fallida: ${failed.length} problema(s).`);
  process.exit(1);
}
console.log(`\nAuditoría de usuarios/roles/permisos completada (${checks.length} comprobaciones).`);
