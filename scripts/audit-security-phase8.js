const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const phase = read('js/admin-users-phase8.js');
const quality = read('js/ui-quality.js');
const roles = read('js/roles.js');
const rules = read('firestore.rules');
const pkg = read('package.json');

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
  phase.includes("lower(state.user.email) === SUPER_ADMIN") &&
    roles.includes("export const SUPER_ADMIN = 'tintinaccs@gmail.com'"),
  'No debe depender de un rol editable en Firestore'
);

check(
  'No se puede asignar superadmin desde el panel',
  phase.includes("const ALLOWED_ROLES = ['admin', 'agent', 'viewer', 'client']") &&
    !phase.includes("ALLOWED_ROLES = ['superadmin'"),
  'Super Admin es una identidad protegida, no una opción de rol'
);

check(
  'Usuarios y auditoría se renderizan sin HTML de datos',
  phase.includes('tbody.replaceChildren()') &&
    phase.includes('node.textContent = value') &&
    !phase.includes('tbody.innerHTML') &&
    !phase.includes('insertAdjacentHTML'),
  'Los nombres, emails y motivos no deben interpretarse como código'
);

check(
  'Cambiar usuario y crear auditoría ocurren juntos',
  phase.includes('const batch = writeBatch(db)') &&
    phase.includes("batch.set(doc(collection(db, 'auditLog')), audit)") &&
    phase.includes('await batch.commit()'),
  'La acción sensible no debe quedar sin registro por un fallo posterior'
);

check(
  'Bloquear elimina el poder operativo',
  phase.includes("roleBeforeBlock: canonicalRole(user)") &&
    phase.includes("role: 'client'") &&
    phase.includes('blocked: true'),
  'Una cuenta bloqueada no puede conservar admin o agent'
);

check(
  'La restauración masiva vuelve a Cliente',
  phase.includes('Restauración masiva como Cliente') &&
    phase.includes("blocked: false") &&
    phase.includes("role: 'client'"),
  'No se debe adivinar un rol elevado en una acción masiva'
);

check(
  'La eliminación aclara que solo borra la ficha Firestore',
  phase.includes('La cuenta de Firebase Authentication seguirá existiendo') &&
    phase.includes('Eliminó la ficha de Firestore; Auth no fue eliminada'),
  'Spark no permite borrar Authentication desde el navegador'
);

check(
  'Los usuarios se actualizan en tiempo real',
  phase.includes("onSnapshot(collection(db, 'users')") &&
    phase.includes("query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(300))"),
  'No debe requerir recargar el panel'
);

check(
  'La Fase 8 se inicia solo en admin',
  quality.includes('bootAdminUsersPhase8') &&
    quality.includes("import(versioned('./admin-users-phase8.js'))"),
  'ui-quality.js debe cargar el módulo nuevo'
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
  pkg.includes('"audit:security": "node scripts/audit-security-phase8.js"'),
  'Falta npm run audit:security'
);

if (failures) {
  console.error(`\nAuditoría Fase 8: ${failures} fallo(s).`);
  process.exit(1);
}
console.log('\nAuditoría Fase 8: todo correcto.');
