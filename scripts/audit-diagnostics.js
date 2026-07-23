const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let failures = 0;

function check(label, condition) {
  if (condition) console.log(`OK — ${label}`);
  else {
    failures += 1;
    console.error(`FAIL — ${label}`);
  }
}

const runtime = read('js/admin-site-diagnostics.js');
const core = read('js/diagnostic-core.js');
const admin = `${read('admin.html')}\n${read('js/admin-app.js')}`;
const css = read('css/admin.css');
const pkg = JSON.parse(read('package.json'));
const firestoreShim = read('js/diagnostic-shims/firestore-shim.js');
const authShim = read('js/diagnostic-shims/auth-shim.js');
const storageShim = read('js/diagnostic-shims/storage-shim.js');
const networkGuard = read('js/diagnostic-shims/network-guard.js');
const builder = read('scripts/build-diagnostic-manifest.js');

const forbiddenWrites = [
  'addDoc', 'setDoc', 'updateDoc', 'deleteDoc', 'writeBatch', 'runTransaction',
  'serverTimestamp', 'localStorage.setItem', 'sessionStorage.setItem'
];
check(
  'El motor de orquestación no importa ni ejecuta escrituras él mismo (las páginas inspeccionadas sí ejecutan scripts, pero solo a través de los shims que bloquean escritura)',
  forbiddenWrites.every(token => !runtime.includes(token)) &&
    !runtime.includes("transaction.objectStore(HISTORY_STORE).delete")
);
check(
  'Las páginas se inspeccionan ejecutando scripts reales, pero el SDK de Firebase queda redirigido a shims de solo lectura',
  runtime.includes("frame.setAttribute('sandbox', 'allow-same-origin allow-scripts')") &&
    runtime.includes("frame-src 'none'") &&
    runtime.includes("object-src 'none'") &&
    runtime.includes('DIAGNOSTIC_SHIM_MAP') &&
    runtime.includes('js/diagnostic-shims/firestore-shim.js') &&
    runtime.includes('js/diagnostic-shims/auth-shim.js') &&
    runtime.includes('js/diagnostic-shims/storage-shim.js') &&
    runtime.includes('js/diagnostic-shims/network-guard.js')
);
check(
  'El shim de Firestore reexporta el SDK real y bloquea únicamente sus funciones de escritura',
  firestoreShim.includes("export * from 'https://www.gstatic.com/firebasejs/") &&
    ['addDoc', 'setDoc', 'updateDoc', 'deleteDoc', 'writeBatch', 'runTransaction']
      .every(name => firestoreShim.includes(`function ${name}`) || firestoreShim.includes(`export function ${name}`)) &&
    firestoreShim.includes('reportBlockedWrite')
);
check(
  'El shim de Auth reexporta el SDK real y bloquea únicamente sus funciones que cambian sesión, credenciales o disparan correos/popups reales',
  authShim.includes("export * from 'https://www.gstatic.com/firebasejs/") &&
    ['signOut', 'updateProfile', 'updatePassword', 'deleteUser', 'signInWithPopup', 'sendSignInLinkToEmail', 'sendPasswordResetEmail']
      .every(name => authShim.includes(name)) &&
    authShim.includes('reportBlockedWrite')
);
check(
  'El shim histórico de Storage es completamente inerte y no importa el SDK eliminado',
  !storageShim.includes("export * from 'https://www.gstatic.com/firebasejs/") &&
    !storageShim.includes('firebase-storage.js') &&
    ['getStorage', 'ref', 'getDownloadURL', 'uploadBytes', 'uploadString', 'uploadBytesResumable', 'deleteObject']
      .every(name => storageShim.includes(`function ${name}`)) &&
    storageShim.includes('reportBlockedWrite') &&
    storageShim.includes('__diagnosticOnly')
);
check(
  'Existe una guardia de red independiente que bloquea llamadas de escritura de Firestore por la forma de la URL, sin depender de una lista de hosts',
  networkGuard.includes('WRITE_PATTERN') &&
    networkGuard.includes('window.fetch') &&
    networkGuard.includes('XMLHttpRequest.prototype.send')
);
check(
  'El historial aislado usa IndexedDB local y no permite resolución manual',
  runtime.includes("const HISTORY_DB = 'tintin-diagnostics-readonly'") &&
    runtime.includes('indexedDB.open') &&
    !runtime.includes('markResolved') &&
    !runtime.includes('resolver-manualmente')
);
check(
  'Los ocho tipos de ejecución están disponibles',
  ['full', 'page', 'module', 'visual', 'functional', 'technical', 'data', 'role']
    .every(mode => admin.includes(`value="${mode}"`))
);
check(
  'La interfaz ofrece gravedad completa, cobertura, filtros, búsqueda e historial',
  ['critical', 'high', 'medium', 'low', 'minimal'].every(level => admin.includes(`value="${level}"`)) &&
    admin.includes('site-diagnostic-search') &&
    admin.includes('site-diagnostic-coverage') &&
    ['route', 'section', 'component', 'device', 'role-filter', 'date'].every(filter =>
      admin.includes(`site-diagnostic-${filter}`)
    ) &&
    admin.includes('data-diagnostic-view="history"')
);
check(
  'Los estados no revisado, no disponible y no reverificado son explícitos',
  ['not-reviewed', 'not-available', 'not-reverified', 'no-longer-detected']
    .every(status => runtime.includes(status) && core.includes(status))
);
check(
  'Cada hallazgo incluye evidencia, reproducción, esperado, real y ubicación',
  ['steps', 'expected', 'actual', 'evidence', 'consequence', 'correctionLocation', 'suggestion']
    .every(field => core.includes(`${field}:`))
);
check(
  'La comparación histórica depende de volver a ejecutar la prueba real',
  core.includes('completed.has(old.testId) ? current.resolved : current.notReverified') &&
    core.includes("confirmation: completed.has(old.testId) ? 'no-longer-detected' : 'not-reverified'") &&
    core.includes('...(previous.notReverified || [])') &&
    core.includes('severityChange')
);
check(
  'Los falsos positivos visuales requieren dos mediciones iguales',
  runtime.includes('const secondKeys = new Set') &&
    runtime.includes('first.filter(item => secondKeys.has(item.key))')
);
check(
  'La inspección responsive incluye siete resoluciones obligatorias',
  runtime.includes('manifest.viewports') &&
    admin.includes('Visual, responsive y accesibilidad')
);
check(
  'El diagnóstico de datos usa consultas limitadas y anonimiza IDs',
  runtime.includes('limit(sampleTargets.has(name) ? 30 : 1)') &&
    runtime.includes('anonymizedDocumentId') &&
    !runtime.includes('getCountFromServer')
);
check(
  'El diagnóstico respeta las colecciones limitadas al documento de la cuenta',
  runtime.includes("const ownDocumentOnly = name === 'checkoutGuards'") &&
    runtime.includes("getDoc(doc(db, 'checkoutGuards', uid))") &&
    runtime.includes('sin enumerar controles de otras cuentas'),
);
check(
  'Los informes no guardan la identidad personal del Super Admin',
  !runtime.includes('userUid:') &&
    !runtime.includes('userEmail:') &&
    !runtime.includes('report.userEmail')
);
check(
  'El módulo declara claramente el modo de solo lectura',
  admin.includes('Modo de solo lectura') &&
    admin.includes('El historial se guarda únicamente en este navegador') &&
    css.includes('.adm-diagnostic-safety')
);
check(
  'Existe un comando dedicado y forma parte de la auditoría final',
  pkg.scripts?.['build:diagnostics'] &&
    pkg.scripts?.['audit:diagnostics'] &&
    pkg.scripts?.['audit:final']?.includes('audit:diagnostics')
);

childProcess.execFileSync(process.execPath, ['scripts/build-diagnostic-manifest.js'], {
  cwd: root,
  stdio: 'pipe'
});
const firstManifest = read('diagnostic-manifest.json');
childProcess.execFileSync(process.execPath, ['scripts/build-diagnostic-manifest.js'], {
  cwd: root,
  stdio: 'pipe'
});
const secondManifest = read('diagnostic-manifest.json');
const manifest = JSON.parse(secondManifest);
const rootPages = fs.readdirSync(root)
  .filter(file => file.endsWith('.html'))
  .sort();
check('El manifiesto es reproducible', firstManifest === secondManifest);
check(
  'El inventario incluye todas las páginas HTML visibles y ocultas del repositorio',
  rootPages.every(file => manifest.pages.some(page => page.path === file)) &&
    manifest.pages.length === rootPages.length
);
check(
  'El inventario no se incluye a sí mismo en su huella',
  !manifest.files.some(file => file.path === 'diagnostic-manifest.json')
);
check(
  'El inventario registra páginas, módulos, archivos, componentes, roles y resoluciones',
  manifest.pages.length > 0 &&
    manifest.modules.length > 0 &&
    manifest.files.length > 0 &&
    manifest.pages.every(page =>
      Array.isArray(page.buttons) &&
      Array.isArray(page.forms) &&
      Array.isArray(page.modals) &&
      Array.isArray(page.sections)
    ) &&
    manifest.roles.length >= 6 &&
    manifest.viewports.length === 7 &&
    manifest.routePatterns.length > 0 &&
    manifest.files.some(file => file.path === 'apps-script/Phase3Security.gs') &&
    manifest.files.some(file => file.path === '.github/workflows/deploy-pages.yml')
);
check(
  'El inventario excluye capturas y reportes temporales de las pruebas',
  builder.includes("new Set(['.git', 'artifacts', 'node_modules', 'public'])") &&
    builder.includes("new Set(['firebase-debug.log', 'firestore-debug.log', 'ui-debug.log'])")
);

if (failures) {
  console.error(`\nAuditoría de Diagnóstico: ${failures} fallo(s).`);
  process.exit(1);
}
console.log('\nAuditoría de Diagnóstico: módulo de solo lectura correctamente integrado.');
