'use strict';

/* =============================================================
   TINTIN — Auditoría de Usuarios, Roles, Permisos y Acceso por cuenta

   Bloquea las invariantes de seguridad del sistema de cuentas para que no se
   rompan en silencio. La Fase 8 (audit-security-phase8.js) ya cubre el módulo
   admin-users-phase8.js y el render seguro; esta auditoría se centra en:

   - Identidad y techo de roles (roles.js): Super Admin por email de Firebase
     Auth, defaults seguros, sin asignar 'superadmin' desde el panel.
   - Matriz dinámica (role-permissions.js): acotada por el techo (nunca amplía),
     fail-safe ante documento faltante o caché vacío, Super Admin la ignora.
   - CRUD de usuarios en admin-app.js: el Super Admin real no se puede bloquear,
     eliminar ni degradar (guardas duras, no solo ocultar el botón); cada acción
     valida el rol/permiso; las masivas lo excluyen.
   - Firestore Rules: protegen la ficha del Super Admin y la matriz server-side.

   No abre navegador: comprobaciones estáticas sobre el código publicado.
   ============================================================= */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const roles      = read('js/roles.js');
const rolePerms  = read('js/role-permissions.js');
const adminApp   = read('js/admin-app.js');
const phase8     = read('js/admin-users-phase8.js');
const rules      = read('firestore.rules');

// ===========================================================================
// 1. IDENTIDAD Y TECHO DE ROLES (roles.js)
// ===========================================================================
check(
  'El Super Admin se identifica por el correo oficial de Firebase Auth',
  /export const SUPER_ADMIN = 'tintinaccs@gmail\.com'/.test(roles) &&
    /if \(authenticatedEmail === SUPER_ADMIN\) return 'superadmin'/.test(roles),
  'La identidad de Super Admin no debe depender de un campo editable en Firestore.'
);
check(
  'Un rol inválido o un documento faltante caen a "client" (default seguro)',
  /if \(!snap\.exists\(\)\) return 'client'/.test(roles) &&
    /\['admin', 'agent', 'viewer', 'client'\]\.includes\(role\) \? role : 'client'/.test(roles),
  'Sin ficha o con un rol desconocido, el usuario nunca debe quedar con permisos.'
);
check(
  'setUserRole nunca permite asignar "superadmin"',
  /const allowed = \['admin', 'agent', 'viewer', 'client'\]/.test(roles) &&
    /if \(!allowed\.includes\(role\)\) throw new Error/.test(roles),
  '"superadmin" es una identidad protegida, no un rol asignable.'
);
check(
  'El Super Admin tiene todos los permisos del techo fijo',
  /superadmin:\s*\{[\s\S]{0,900}manageUsers:\s*true[\s\S]{0,900}viewDashboard:\s*true/.test(roles),
  'La matriz fija de superadmin debe conceder todo.'
);

// ===========================================================================
// 2. MATRIZ DINÁMICA (role-permissions.js) — acotada y fail-safe
// ===========================================================================
check(
  'Solo admin/agent/viewer son columnas editables (no superadmin ni client)',
  /export const EDITABLE_ROLES = \['admin', 'agent', 'viewer'\]/.test(rolePerms),
  'Super Admin siempre tiene todo y Cliente no es un rol de panel; no se editan acá.'
);
check(
  'Los defaults de la matriz derivan del techo fijo (nunca amplían)',
  /out\[role\]\[modKey\]\[actKey\] = editable \? !!\(PERMISSIONS\[role\]\?\.\[act\.defaultFrom\]\) : false/.test(rolePerms),
  'La pantalla solo puede ACOTAR lo que roles.js ya permite, jamás abrir más.'
);
check(
  'Si falta el documento o falla la lectura, se usan los defaults (fail-safe)',
  /catch \(e\)[\s\S]{0,160}_cache = defaults/.test(rolePerms),
  'Una matriz ausente o ilegible equivale a "todo como siempre", nunca a bloquear todo.'
);
check(
  'canDo, sin caché, cae al techo fijo de roles.js (nunca abre de más)',
  /if \(!_cache\)[\s\S]{0,220}return !!\(PERMISSIONS\[role\]\?\.\[act\.defaultFrom\]\)/.test(rolePerms),
  'El fallback de permisos debe ser el mínimo seguro, no un "true".'
);
check(
  'canDo niega acciones no implementadas o de roles no editables',
  /if \(!act \|\| act\.implemented === false\) return false/.test(rolePerms) &&
    /if \(act\.rolesEditable && !act\.rolesEditable\.includes\(role\)\) return false/.test(rolePerms),
  'Un rol sin columna editable nunca gana un permiso por la matriz.'
);
check(
  'Guardar la matriz reemplaza el documento completo (merge:false)',
  /merge: false/.test(rolePerms) &&
    /updatedBy: actorEmail/.test(rolePerms),
  'El documento se guarda completo para no dejar permisos huérfanos, con autor.'
);
check(
  'Una matriz defectuosa NUNCA bloquea al Super Admin real',
  /function roleCanDo\(moduleKey, actionKey\)/.test(adminApp) &&
    /return currentRole === 'superadmin' \|\| canDo\(currentRole, moduleKey, actionKey\)/.test(adminApp),
  'roleCanDo debe devolver true para superadmin antes de consultar la matriz.'
);

// ===========================================================================
// 3. CRUD DE USUARIOS (admin-app.js) — protecciones del Super Admin
// ===========================================================================
check(
  'Bloquear valida (con guarda dura) que no sea el Super Admin',
  /window\.blockUser = async \(uid, email\) => \{\s*\n\s*if \(email === SUPER_ADMIN\) \{ toast\('No se puede bloquear al Super Admin'\); return; \}/.test(adminApp),
  'El Super Admin no debe poder bloquearse ni siquiera llamando la función directo.'
);
check(
  'Eliminar usuario protege la ficha del Super Admin y valida el permiso',
  /_target\.email === SUPER_ADMIN\) \{ toast\('El perfil del Super Admin no se puede eliminar'\)/.test(adminApp) &&
    /window\.deleteUser[\s\S]{0,700}if \(!can\(currentRole, 'deleteUsers'\)\)/.test(adminApp),
  'deleteUser no debe borrar al Super Admin ni correr sin permiso (ocultar el botón no basta).'
);
check(
  'Cambiar rol bloquea al Super Admin, valida permiso y limita a roles reales',
  /if \(email === SUPER_ADMIN\) \{\s*\n\s*toast\('El rol del Super Admin está protegido/.test(adminApp) &&
    /if \(!can\(currentRole, 'assignRoles'\)\) \{ toast\('No tenés permiso para cambiar roles'\)/.test(adminApp) &&
    /if \(!\['admin', 'agent', 'viewer', 'client'\]\.includes\(role\)\)/.test(adminApp),
  'updateUserRole no debe degradar al Super Admin ni escribir un rol inválido/"superadmin".'
);
check(
  'Las acciones masivas de usuarios excluyen al Super Admin (guarda dura)',
  (adminApp.match(/u\.email !== SUPER_ADMIN/g) || []).length >= 3,
  'Cambio de rol, bloqueo y restauración masivos deben filtrar al Super Admin.'
);
check(
  'Bloquear degrada el rol a client y guarda el rol previo para restaurar',
  /roleBeforeBlock: prevRole,\s*\n\s*role: 'client'/.test(adminApp),
  'Una cuenta bloqueada no debe conservar admin/agent; se guarda roleBeforeBlock.'
);
check(
  'Cada acción de usuario queda registrada en Auditoría',
  /logAudit\('cambiar_rol'/.test(adminApp) &&
    /logAudit\('bloquear_usuario'/.test(adminApp) &&
    /logAudit\('restaurar_usuario'/.test(adminApp) &&
    /logAudit\('eliminar_usuario'/.test(adminApp),
  'El cambio de rol, bloqueo, restauración y eliminación deben dejar rastro.'
);
check(
  'La tabla de usuarios escapa nombre, email y avatar (anti-XSS)',
  /escapeHtmlAdmin\(u\.name/.test(adminApp) &&
    /escapeHtmlAdmin\(u\.email/.test(adminApp) &&
    /sanitizeImageUrl\(u\.photoURL/.test(adminApp),
  'Los datos de la clienta no deben interpretarse como código.'
);

// ===========================================================================
// 4. MÓDULO FASE 8 (admin-users-phase8.js) — protecciones paralelas
// ===========================================================================
check(
  'El módulo Fase 8 protege al Super Admin en bloquear/eliminar/masivas',
  /const isSuperRecord = record => lower\(record\?\.email\) === SUPER_ADMIN/.test(phase8) &&
    /async function blockOne\(user\) \{\s*\n\s*if \(isSuperRecord\(user\)\) return/.test(phase8) &&
    /async function deleteOne\(user\) \{\s*\n\s*if \(isSuperRecord\(user\)\) return/.test(phase8) &&
    /state\.users\.filter\(user => state\.selected\.has\(user\.uid\) && !isSuperRecord\(user\)\)/.test(phase8),
  'El módulo Fase 8 también debe blindar al Super Admin en cada acción.'
);
check(
  'El módulo Fase 8 solo maneja roles reales (sin superadmin)',
  /const ALLOWED_ROLES = \['admin', 'agent', 'viewer', 'client'\]/.test(phase8),
  'No debe existir "superadmin" como opción de rol asignable.'
);

// ===========================================================================
// 5. FIRESTORE RULES — protección server-side
// ===========================================================================
check(
  'Las reglas impiden eliminar la ficha del Super Admin',
  /allow delete: if isSuperAdmin\(\) &&\s*\n\s*!isSuperAdminAccount\(resource\.data\)/.test(rules),
  'Ni el propio Super Admin debe poder borrar su ficha desde el cliente.'
);
check(
  'Las reglas impiden escribir role:"superadmin" salvo la cuenta oficial',
  /request\.resource\.data\.role != 'superadmin' \|\|\s*\n\s*request\.auth\.token\.email == "tintinaccs@gmail\.com"/.test(rules),
  'Nadie debe poder elevar a "superadmin" a otra cuenta desde el panel.'
);
check(
  'Solo el Super Admin puede escribir la matriz de permisos',
  /match \/rolePermissions\/\{docId\}[\s\S]{0,500}allow write: if isSuperAdmin\(\)/.test(rules),
  'Un Admin no debe poder editar rolePermissions/main.'
);
check(
  'La ficha de un usuario solo la lee su dueño o el Super Admin',
  /match \/users\/\{userId\}[\s\S]{0,120}allow read: if isSignedIn\(\) &&[\s\S]{0,80}request\.auth\.uid == userId \|\| isSuperAdmin\(\)/.test(rules),
  'Una cuenta no debe leer la ficha de otra.'
);
check(
  'El registro de auditoría es de solo lectura para el Super Admin',
  /match \/auditLog\/\{logId\}[\s\S]{0,120}allow read: if isSuperAdmin\(\)/.test(rules),
  'Los registros de auditoría no deben quedar expuestos a otros roles.'
);

// ===========================================================================
// 6. ACCESO / APLICACIÓN INMEDIATA DE PERMISOS
// ===========================================================================
check(
  'Los permisos dinámicos se cargan ANTES de armar la UI del panel',
  /await loadRolePermissions\(\);[\s\S]{0,220}setupPermissions\(role\)/.test(adminApp),
  'canDo debe tener datos reales desde el primer render, sin requerir recarga.'
);
check(
  'El acceso al panel se decide por rol real (client/sin rol fuera)',
  /if \(role === 'client' \|\| !role\) \{\s*\n\s*window\.location\.href = 'perfil\.html'/.test(adminApp),
  'Un cliente autenticado nunca debe entrar al panel.'
);

// ---------------------------------------------------------------------------
const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de usuarios/roles/permisos fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de usuarios/roles/permisos completada correctamente (${checks.length} comprobaciones).`);
