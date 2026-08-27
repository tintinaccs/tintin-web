const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const admin = read('js/admin/admin-app.js');
const compat = read('js/admin/users/gestion-usuarios-admin.js');
const ficha = read('js/admin/users/ficha-usuario-admin.js');
const quality = read('js/quality/calidad-interfaz.js');
const roles = read('js/core/auth/roles.js');
const rules = read('firestore.rules');
const pkg = read('package.json');
const deleteUserEndpoint = read('functions/api/admin-delete-user.js');
const lifecycle = read('cloudflare/user-lifecycle-domain.js');
const accountContract = JSON.parse(read('config/account-contract.json'));

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) console.log(`OK — ${label}`);
  else {
    failures += 1;
    console.error(`FAIL — ${label}${detail ? `: ${detail}` : ''}`);
  }
}

check(
  'El Super Admin se reconoce por el correo oficial',
  roles.includes('export const SUPER_ADMIN = SUPER_ADMIN_EMAIL') &&
    accountContract.superAdminEmail === 'tintinaccs@gmail.com' &&
    admin.includes("currentUser.email !== SUPER_ADMIN"),
  'La identidad protegida no debe depender de un rol editable en Firestore'
);

check(
  'No se puede asignar superadmin desde el panel',
  admin.includes('ASSIGNABLE_ROLES.includes(role)') &&
    !accountContract.assignableRoles.includes('superadmin'),
  'Super Admin es una identidad protegida, no una opción asignable'
);

check(
  'admin-app.js es la única autoridad en tiempo real de users',
  (admin.match(/onSnapshot\(query\(collection\(db, ['"]users['"],?\)?/g) || []).length === 1 &&
    !compat.includes("onSnapshot(") &&
    !ficha.includes("onSnapshot("),
  'No debe existir un segundo listener de la colección users en el módulo Fase 8 o en la ficha'
);

check(
  'La ruta histórica Fase 8 ya no mantiene CRUD ni estado paralelo',
  compat.includes('única autoridad activa de Usuarios es js/admin/admin-app.js') &&
    compat.includes("import('./ficha-usuario-admin.js") &&
    !compat.includes('writeBatch(') &&
    !compat.includes('updateDoc(') &&
    !compat.includes('setDoc(') &&
    !compat.includes('deleteDoc('),
  'gestion-usuarios-admin.js solo debe actuar como puente de compatibilidad'
);

check(
  'La ficha detallada es de solo lectura y carga bajo demanda',
  ficha.includes("getDoc(doc(db, 'users', uid))") &&
    ficha.includes("where('userId', '==', uid)") &&
    ficha.includes("where('targetId', '==', uid)") &&
    !ficha.includes('writeBatch(') &&
    !ficha.includes('updateDoc(') &&
    !ficha.includes('setDoc(') &&
    !ficha.includes('deleteDoc(') &&
    !ficha.includes('onSnapshot('),
  'Ver ficha no debe crear otra autoridad de datos ni escribir cuentas'
);

check(
  'La tabla principal sanea datos de clientas antes de renderizar',
  admin.includes('escapeHtmlAdmin(u.name') &&
    admin.includes('escapeHtmlAdmin(u.email') &&
    admin.includes('sanitizeImageUrl(u.photoURL'),
  'Nombre, email y avatar no deben convertirse en código ejecutable'
);

check(
  'Bloquear elimina el poder operativo y conserva el rol anterior',
  admin.includes('roleBeforeBlock: prevRole') &&
    admin.includes("role: 'client'") &&
    admin.includes('blocked: true'),
  'Una cuenta bloqueada no puede conservar admin o agent'
);

check(
  'Restaurar recupera roleBeforeBlock válido',
  admin.includes("ASSIGNABLE_ROLES.includes(u.roleBeforeBlock) ? u.roleBeforeBlock : 'client'") &&
    admin.includes('blocked: false'),
  'Debe recuperar el rol anterior válido y usar client solo como respaldo'
);

check(
  'Cambios sensibles de usuario mantienen registro de auditoría',
  admin.includes("logAudit('cambiar_rol'") &&
    admin.includes("logAudit('bloquear_usuario'") &&
    admin.includes("logAudit('restaurar_usuario'") &&
    deleteUserEndpoint.includes('applyUserLifecycle') &&
    lifecycle.includes('auditLog/${eventId}'),
  'Rol, bloqueo, restauración y eliminación deben seguir dejando rastro'
);

check(
  'La eliminación revoca acceso y conserva identidad histórica auditada',
  admin.includes("fetch('/api/admin-delete-user'") &&
    deleteUserEndpoint.includes('applyUserLifecycle') &&
    lifecycle.includes("profileStatus: fsString('deleted')") &&
    lifecycle.includes("setFirebaseUserDisabled(env, uid, action === 'softDelete')") &&
    lifecycle.includes('auditLog/${eventId}') &&
    lifecycle.includes('phoneReservations/') &&
    !deleteUserEndpoint.includes('deleteFirebaseUser') &&
    !lifecycle.includes('deleteFirebaseUser'),
  'La cuenta debe quedar como tombstone y no borrarse físicamente'
);

check(
  'UI Quality conserva compatibilidad sin reactivar una segunda autoridad',
  quality.includes('bootAdminUsersPhase8') &&
    quality.includes("import(versioned('../admin/users/gestion-usuarios-admin.js'))") &&
    compat.includes('TintinAdminUsersPhase8Booted'),
  'La ruta antigua puede seguir cargándose, pero debe ser un puente inerte de CRUD'
);

check(
  'Las reglas protegen usuarios y carrito por UID',
  rules.includes('match /users/{userId}') &&
    rules.includes('request.auth.uid == userId') &&
    rules.includes('match /cart/{itemId}') &&
    rules.includes('!isBlockedUser()'),
  'Una cuenta no debe modificar otra ni operar bloqueada'
);

check(
  'La auditoría es de solo lectura para Super Admin',
  rules.includes('match /auditLog/{logId}') &&
    rules.includes('allow read: if isSuperAdmin()'),
  'Los registros no deben quedar visibles para clientes'
);

check(
  'Existe el comando de auditoría dedicado',
  pkg.includes('"audit:security": "node scripts/auditar-seguridad-fase-8.js"'),
  'Falta npm run audit:security'
);

if (failures) {
  console.error(`\nAuditoría Fase 8: ${failures} fallo(s).`);
  process.exit(1);
}
console.log('\nAuditoría Fase 8: autoridad única de Usuarios verificada.');
