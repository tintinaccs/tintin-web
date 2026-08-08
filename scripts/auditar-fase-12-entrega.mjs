import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const required = [
  'scripts/auditar-fase-5-rendimiento.js',
  'scripts/auditar-fase-6-seguridad.js',
  'scripts/auditar-fase-7-catalogo.js',
  'scripts/auditar-fase-8-ui-ux.js',
  'tests/import/phase9-import-normalization.test.mjs',
  'scripts/auditar-fase-10-accessibility.js',
  'scripts/auditar-fase-11-seo.js',
  'scripts/auditar-fase-12-entrega.mjs',
  'scripts/generar-csp-cloudflare.js',
  'scripts/produccion-smoke-fase-12.mjs',
  'docs/informe-entrega-fase-12.md',
  '.github/workflows/entrega-final-fase-12.yml'
];
required.forEach(file => check('Existe ' + file, exists(file), 'Falta un entregable permanente de la validación final.'));

const pkg = JSON.parse(read('package.json'));
const finalCommand = String(pkg.scripts?.['audit:final'] || '');
for (const command of ['audit:phase5', 'audit:phase6', 'audit:phase7-catalog', 'audit:phase8-ui', 'test:phase9-import', 'audit:phase10', 'audit:phase11']) {
  check('audit:final incluye ' + command, finalCommand.includes(command), 'La cadena final debe conservar todas las fases previas.');
}
check('Existe prueba crítica de reglas', Boolean(pkg.scripts?.['test:rules-critical']), 'Las reglas deben probarse en emulador.');
check('Existe smoke de todas las páginas', Boolean(pkg.scripts?.['test:pages']), 'Las 18 páginas deben abrirse en el barrido final.');
check('Existe matriz responsive canónica', Boolean(pkg.scripts?.['audit:canonical-viewports']), 'La matriz responsive debe quedar ejecutable.');
check(
  'El build de Pages genera y verifica la CSP por ruta',
  String(pkg.scripts?.['build:pages'] || '').includes('build:csp') && String(pkg.scripts?.['build:pages'] || '').includes('verify:csp'),
  'Cloudflare debe recibir un _headers reproducible antes de publicar.'
);

const workflow = read('.github/workflows/entrega-final-fase-12.yml');
for (const token of [
  'npm run audit:final',
  'npm run test:rules-critical',
  'npm run test:pages',
  'npm run test:phase8-ui',
  'npm run test:phase10-a11y',
  'npm run test:phase11-seo',
  'npm run audit:canonical-viewports',
  'npm audit --omit=dev --audit-level=critical',
  'node scripts/produccion-smoke-fase-12.mjs'
]) {
  check('El workflow final ejecuta ' + token, workflow.includes(token), 'Falta una comprobación obligatoria de Fase 12.');
}
check('El workflow conserva evidencias', workflow.includes('phase12-final-evidence') && workflow.includes('retention-days: 30'), 'Las evidencias deben quedar disponibles para revisión.');
check('El workflow usa Node 22', workflow.includes('node-version: 22'), 'Las herramientas actuales requieren Node 22.');
check(
  'El smoke real corre solo fuera de pull requests',
  /- name: Smoke real de producci[^\r\n]*\r?\n\s+if: github\.event_name != ['"]pull_request['"]\r?\n\s+run: node scripts\/produccion-smoke-fase-12\.mjs/.test(workflow),
  'Un PR todavía no está en producción; el smoke del dominio vivo debe ejecutarse después del merge a main.'
);

const scriptDir = path.join(root, 'scripts');
const temporary = fs.readdirSync(scriptDir).filter(name => /^apply-phase\d|^apply-phase7-phase/i.test(name));
check('No quedan aplicadores temporales', temporary.length === 0, temporary.join(', '));

const ignoredDirs = new Set(['.git', 'node_modules', 'artifacts', 'playwright-report', 'test-results']);
const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.txt', '.rules', '.xml']);
const textFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (textExtensions.has(path.extname(entry.name)) || entry.name === 'firestore.rules') textFiles.push(absolute);
  }
}
walk(root);

const conflicts = [];
const privateKeys = [];
// Exige un bloque PEM completo y una carga útil suficientemente larga. Una
// auditoría que contiene el texto de detección no se confunde con una clave.
const privateKeyBlock = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s*\r?\n(?:[A-Za-z0-9+/=]{20,}\r?\n){2,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
for (const absolute of textFiles) {
  const relative = path.relative(root, absolute).replaceAll('\\', '/');
  const content = fs.readFileSync(absolute, 'utf8');
  if (/^(<<<<<<<|=======|>>>>>>>)(?: |$)/m.test(content)) conflicts.push(relative);
  if (privateKeyBlock.test(content)) privateKeys.push(relative);
}
check('No hay marcadores de conflicto', conflicts.length === 0, conflicts.join(', '));
check('No hay claves privadas versionadas', privateKeys.length === 0, privateKeys.join(', '));

const firebase = JSON.parse(read('firebase.json'));
check('Firebase solo despliega reglas en Spark', Boolean(firebase.firestore?.rules) && !firebase.functions && !firebase.hosting, 'El cierre no debe activar servicios facturables por accidente.');
const rules = read('firestore.rules');
check('Firestore mantiene denegación por defecto', /match \/\{document=\*\*\}[\s\S]*allow read, write: if false/.test(rules), 'Las reglas deben conservar el cierre por defecto.');

const report = read('docs/informe-entrega-fase-12.md');
const normalizedReport = report.replace(/\s+/g, ' ');
for (const section of ['Problemas y causas', 'Cambios realizados', 'Pruebas ejecutadas', 'Controles externos', 'Riesgos residuales']) {
  check('El reporte incluye ' + section, report.includes('## ' + section), 'El informe final debe ser explícito y auditable.');
}
check(
  'El reporte distingue App Check Enforcement',
  /Enforcement.{0,220}(?:no está verificado|no verificado|debe confirmarse|verificar)/i.test(normalizedReport),
  'No se debe afirmar un estado externo sin evidencia de consola.'
);
check('El reporte distingue despliegue de reglas', /reglas.{0,220}(?:no verificad|requiere|consola|despliegue)/i.test(normalizedReport), 'La validación estática no prueba por sí sola el despliegue vivo.');
check('El reporte distingue Apps Script', /Apps Script.{0,220}(?:no verificad|requiere|despliegue)/i.test(normalizedReport), 'El código y el deployment externo son evidencias diferentes.');

let failures = 0;
for (const item of checks) {
  console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.name);
  if (!item.ok) {
    failures += 1;
    if (item.detail) console.log('  ' + item.detail);
  }
}
if (failures) {
  console.error(`\nFase 12: ${failures} comprobación(es) fallida(s).`);
  process.exit(1);
}
console.log(`\nFase 12: cierre estático correcto (${checks.length} comprobaciones).`);
