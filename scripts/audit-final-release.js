'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

const pkg = JSON.parse(read('package.json'));
const firebaseRc = JSON.parse(read('.firebaserc'));
const firebaseJson = JSON.parse(read('firebase.json'));
const phase9 = read('js/admin-import-phase9.js');
const quality = read('js/ui-quality.js');
const rules = read('firestore.rules');

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) console.log(`OK — ${label}`);
  else {
    failures += 1;
    console.error(`FAIL — ${label}${detail ? `: ${detail}` : ''}`);
  }
}

check(
  'El proyecto Firebase final es tintin-accesorios',
  firebaseRc?.projects?.default === 'tintin-accesorios',
  'La publicación no debe apuntar a tintin-login ni a otro proyecto'
);

check(
  'El despliegue Spark publica únicamente reglas',
  pkg.scripts?.['deploy:spark']?.includes('--only firestore:rules') &&
    pkg.scripts['deploy:spark'].includes('--project tintin-accesorios') &&
    !pkg.scripts?.['deploy:functions'] &&
    !pkg.scripts?.['deploy:firebase'],
  'No se debe ofrecer un comando de Functions en el plan gratuito'
);

check(
  'Firebase conserva la ruta correcta de reglas',
  firebaseJson?.firestore?.rules === 'firestore.rules' && exists('firestore.rules'),
  'firebase.json debe compilar el mismo archivo publicado'
);

check(
  'Firebase no intenta desplegar Functions por accidente',
  !Object.prototype.hasOwnProperty.call(firebaseJson, 'functions'),
  'Un firebase deploy genérico no debe pedir Blaze ni habilitar Artifact Registry'
);

check(
  'La importación vieja queda oculta',
  phase9.includes("title.includes('importar csv de shopify')") &&
    phase9.includes("title.includes('importar json manual')") &&
    phase9.includes("dataset.phase9LegacyImporter = 'disabled'"),
  'Los flujos sin validación no deben seguir visibles'
);

check(
  'El CSV soporta comillas escapadas y saltos de línea',
  phase9.includes("char === '\"' && next === '\"'") &&
    phase9.includes("char === '\\n' || char === '\\r'") &&
    phase9.includes('if (quoted) throw new Error'),
  'No se puede dividir un CSV de Shopify solamente por líneas y comas'
);

check(
  'Los archivos tienen límites de seguridad',
  phase9.includes('MAX_FILE_BYTES = 5 * 1024 * 1024') &&
    phase9.includes('MAX_IMPORT_ROWS = 1000') &&
    phase9.includes('BATCH_SIZE = 350'),
  'Evita congelar el navegador o superar el límite de Firestore'
);

check(
  'Las colecciones reales validan cada producto',
  phase9.includes("getDocs(collection(db, 'collections'))") &&
    phase9.includes('currentCategorySlugs().has(product.category)') &&
    !phase9.includes("const CAT_MAP ="),
  'No debe volver a una lista fija de categorías'
);

check(
  'La importación no sobrescribe ni repite productos',
  phase9.includes('markDuplicates(records)') &&
    phase9.includes('importFingerprint') &&
    phase9.includes('!record.errors.length && !record.duplicate') &&
    phase9.includes("doc(collection(db, 'products'))"),
  'Solo se crean productos nuevos validados'
);

check(
  'Cada lote importado queda auditado',
  phase9.includes("batch.set(doc(collection(db, 'auditLog'))") &&
    phase9.includes("action: 'importar_productos'") &&
    phase9.includes('await batch.commit()'),
  'Productos y auditoría deben confirmarse en el mismo batch'
);

check(
  'La copia operativa excluye datos de clientas',
  phase9.includes("excludes: ['users', 'orders', 'carts', 'auditLog', 'emailLogs']") &&
    phase9.includes("readCollection('products')") &&
    phase9.includes("readCollection('collections')") &&
    phase9.includes("readCollection('site_content')"),
  'El backup descargable no debe mezclar pedidos o usuarios'
);

check(
  'La Fase 9 arranca en el panel',
  quality.includes('bootAdminImportPhase9') &&
    quality.includes("import(versioned('./admin-import-phase9.js'))"),
  'ui-quality.js debe iniciar el módulo final'
);

check(
  'Las reglas siguen protegiendo productos e importaciones',
  rules.includes('match /products/{productId}') &&
    rules.includes('allow create: if isSuperAdmin() ||') &&
    rules.includes("currentRolePermAllows('productos', 'crear')"),
  'La interfaz no reemplaza las reglas de Firestore'
);

const phaseAudits = [
  'scripts/audit-secure-orders.js',
  'scripts/audit-email-phase3.js',
  'scripts/audit-collections-phase4.js',
  'scripts/audit-images-phase5.js',
  'scripts/audit-content-phase6.js',
  'scripts/audit-cart-phase7.js',
  'scripts/audit-security-phase8.js',
  'scripts/audit-final-release.js',
];
check(
  'Las auditorías de todas las fases están presentes',
  phaseAudits.every(exists),
  'Falta al menos una auditoría del recorrido final'
);

check(
  'Existe un comando final único',
  pkg.scripts?.['audit:final']?.includes('audit:secure-orders') &&
    pkg.scripts['audit:final'].includes('audit:release'),
  'La revisión final debe ejecutarse con npm run audit:final'
);

if (failures) {
  console.error(`\nAuditoría final: ${failures} fallo(s).`);
  process.exit(1);
}

console.log('\nAuditoría final: las nueve fases están integradas correctamente.');
