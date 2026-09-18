'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

const pkg = JSON.parse(read('package.json'));
const firebaseRc = JSON.parse(read('.firebaserc'));
const firebaseJson = JSON.parse(read('firebase.json'));
const phase9 = read('js/admin/importacion-admin.js');
const importCore = read('js/core/store/shopify-import-core.mjs');
const importJob = read('functions/api/admin-import-job.js');
const adminHtml = read('admin.html');
const normalization = read('js/core/store/normalizacion-importacion.mjs');
const normalizationTests = read('tests/import/phase9-import-normalization.test.mjs');
const quality = read('js/quality/calidad-interfaz.js');
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
  phase9.includes("title.includes('importar csv')") &&
    phase9.includes("title.includes('importar json manual')") &&
    phase9.includes("dataset.phase9LegacyImporter = 'disabled'"),
  'Los flujos sin validación no deben seguir visibles'
);

check(
  'El CSV detecta coma, punto y coma o tabulador y conserva campos citados',
  phase9.includes('parseDelimitedRowsStream') &&
    importCore.includes('groupShopifyRows') &&
    normalization.includes("const candidates = [',', ';', '\\t']") &&
    normalization.includes("char === '\"' && next === '\"'") &&
    normalization.includes("char === '\\n' || char === '\\r'") &&
    normalizationTests.includes('detecta coma, punto y coma o tabulador'),
  'El importador debe aceptar exportaciones CSV regionales sin romper comillas o saltos de línea'
);

check(
  'Los precios localizados se normalizan sin confundir miles y decimales',
  phase9.includes('parseLocalizedNumber') &&
    normalization.includes('export function parseLocalizedNumber') &&
    normalizationTests.includes("parseLocalizedNumber('100.000'), 100000") &&
    normalizationTests.includes("parseLocalizedNumber('1.234,56'), 1234.56") &&
    normalizationTests.includes("parseLocalizedNumber('1,234.56'), 1234.56"),
  'Los precios paraguayos e internacionales deben producir el mismo número estable'
);

check(
  'El stock vacío queda ilimitado y los valores inválidos se rechazan',
  phase9.includes('parseOptionalStock') &&
    phase9.includes("record.product.stock == null ? 'Sin límite'") &&
    normalization.includes('export function parseOptionalStock') &&
    normalizationTests.includes("parseOptionalStock('Sin límite'), null") &&
    normalizationTests.includes("Number.isNaN(parseOptionalStock('-1'))"),
  'Un stock vacío no debe convertirse silenciosamente en agotado'
);

check(
  'Las copias operativas validan formato, proyecto y versión antes de importar',
  phase9.includes('validateOperationalBackupEnvelope(parsed') &&
    normalization.includes("value.format !== format") &&
    normalization.includes("value.projectId !== projectId") &&
    normalization.includes("value.schemaVersion !== schemaVersion") &&
    normalizationTests.includes('valida proyecto, formato y versión'),
  'No se debe importar una copia de otro proyecto o esquema incompatible'
);

check(
  'El preview no ejecuta migración ni escrituras de productos',
  importJob.includes("catalogMigration: 'not-executed'") &&
    importJob.includes('dryRun: true') &&
    !phase9.includes("collection(db, 'products')"),
  'La migración real de catálogo debe quedar fuera de esta fase y requerir autorización explícita.'
);

check(
  'Los archivos grandes usan streaming y checkpoint',
  phase9.includes('MAX_FILE_BYTES = 250 * 1024 * 1024') &&
    phase9.includes('parseDelimitedRowsStream') &&
    !phase9.includes('MAX_IMPORT_ROWS') &&
    importJob.includes('lastCheckpoint'),
  'Evita congelar el navegador y permite preparar trabajos grandes sin una cota arbitraria de filas.'
);

check(
  'Las colecciones reales validan cada producto',
  phase9.includes("readCollection('collections', 5000)") &&
    importCore.includes('resolveShopifyCollection') &&
    importCore.includes('ambiguous') &&
    !phase9.includes("const CAT_MAP ="),
  'No debe volver a una lista fija ni asignar colecciones ambiguas en silencio'
);

check(
  'La importación no sobrescribe ni repite productos',
  importCore.includes('buildImportFingerprint') &&
    importCore.includes('stableProductDocumentId') &&
    phase9.includes("strategy: 'SKIP'") &&
    importJob.includes('currentDocument: { exists: false }') &&
    !phase9.includes("collection(db, 'products')"),
  'La identidad y estrategia deben ser deterministas; no se escribe el catálogo en el preview'
);

check(
  'Cada preview queda auditado server-side',
  importJob.includes("import_job_created") &&
    importJob.includes('importJobs/${jobId}') &&
    phase9.includes('JOB_ENDPOINT'),
  'El job y su evento de auditoría deben persistirse juntos sin presentar migración ejecutada'
);

check(
  'La copia operativa excluye datos de clientas',
  phase9.includes("excludes: ['users', 'orders', 'carts', 'auditLog', 'emailLogs']") &&
    phase9.includes("readCollection('products')") &&
    /readCollection\('collections'/.test(phase9) &&
    /readCollection\('site_content'/.test(phase9),
  'El backup descargable no debe mezclar pedidos o usuarios'
);

check(
  'La superficie canónica de importación arranca en el panel',
  adminHtml.includes('js/admin/importacion-admin.js?v=tintin-20260918-shopify-phase2-safe-1') &&
    phase9.includes('shopify-import-canonical-card'),
  'admin.html debe montar el único módulo de importación validado'
);

check(
  'Las reglas siguen protegiendo productos e importaciones',
  rules.includes('match /products/{productId}') &&
    rules.includes('allow create: if isSuperAdmin() ||') &&
    rules.includes("currentRolePermAllows('productos', 'crear')"),
  'La interfaz no reemplaza las reglas de Firestore'
);

const phaseAudits = [
  'scripts/auditar-seguro-pedidos.js',
  'scripts/auditar-correo-fase-3.js',
  'scripts/auditar-colecciones-fase-4.js',
  'scripts/auditar-imagenes-fase-5.js',
  'scripts/auditar-contenido-fase-6.js',
  'scripts/auditar-carrito-fase-7.js',
  'scripts/auditar-seguridad-fase-8.js',
  'scripts/auditar-final-entrega.js',
];
check(
  'Las auditorías de todas las fases están presentes',
  phaseAudits.every(exists),
  'Falta al menos una auditoría del recorrido final'
);

check(
  'Existe un comando final único',
  pkg.scripts?.['audit:final']?.includes('audit:secure-orders') &&
    pkg.scripts['audit:final'].includes('test:phase9-import') &&
    pkg.scripts['audit:final'].includes('audit:release') &&
    pkg.scripts?.['test:phase9-import'] === 'node --test tests/import/phase9-import-normalization.test.mjs',
  'La revisión final debe ejecutar las pruebas de importación dentro de npm run audit:final'
);

if (failures) {
  console.error(`\nAuditoría final: ${failures} fallo(s).`);
  process.exit(1);
}

console.log('\nAuditoría final: las nueve fases están integradas correctamente.');
