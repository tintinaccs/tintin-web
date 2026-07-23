const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failures = 0;
let warnings = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`OK — ${label}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ''}`);
}

function warn(label, condition, detail = '') {
  if (condition) {
    console.log(`OK — ${label}`);
    return;
  }

  warnings += 1;
  console.warn(`WARN — ${label}${detail ? `: ${detail}` : ''}`);
}

const requiredFiles = [
  'README.md',
  'SECURITY.md',
  '.env.example',
  '.gitignore',
  'docs/ARCHITECTURE.md',
  'docs/CHANGE_IMPACT_CHECKLIST.md',
  'docs/BACKUP_RECOVERY.md',
  'firestore.rules',
  'firebase.json',
  '.github/workflows/deploy-pages.yml',
  '.github/workflows/final-sweep-part2h-audit.yml'
];

for (const file of requiredFiles) {
  check(`Existe ${file}`, exists(file));
}

const gitignore = read('.gitignore');
check(
  'package.json no está excluido del control de versiones',
  !/^package\.json\s*$/m.test(gitignore)
);
check(
  'package-lock.json no está excluido del control de versiones',
  !/^package-lock\.json\s*$/m.test(gitignore)
);
check(
  'Los archivos .env privados están excluidos',
  /^\.env\s*$/m.test(gitignore) && /^\.env\.\*\s*$/m.test(gitignore)
);
check(
  '.env.example permanece versionable',
  /^!\.env\.example\s*$/m.test(gitignore)
);
check(
  'Cuentas de servicio y claves privadas están excluidas',
  /service-account/i.test(gitignore) && /\*\.pem/.test(gitignore) && /\*\.key/.test(gitignore)
);

const readme = read('README.md');
const impact = read('docs/CHANGE_IMPACT_CHECKLIST.md');
const architecture = read('docs/ARCHITECTURE.md');
const security = read('SECURITY.md');
const backup = read('docs/BACKUP_RECOVERY.md');

for (const viewport of [
  '1920 × 1080',
  '1440 × 900',
  '1280 × 720',
  '1024 × 768',
  '768 × 1024',
  '390 × 844',
  '320 × 568'
]) {
  check(`La matriz contempla ${viewport}`, impact.includes(viewport));
}

for (const role of ['Invitado', 'Cliente', 'Viewer', 'Agente', 'Admin', 'Super Admin']) {
  check(`La matriz contempla el rol ${role}`, impact.includes(role));
}

check(
  'La arquitectura declara al navegador como entorno no confiable',
  architecture.includes('El navegador se considera un entorno no confiable')
);
check(
  'La definición de terminado exige auditorías verdes',
  readme.includes('el Pull Request y el despliegue quedan verdes')
);
check(
  'Existe procedimiento de rotación de credenciales',
  security.includes('revocarse o rotarse') && backup.includes('Revocar o rotar inmediatamente')
);
check(
  'Existe procedimiento de recuperación para datos masivos',
  backup.includes('Recuperación de cambios masivos')
);

const rules = read('firestore.rules');
check(
  'Firestore mantiene denegación por defecto',
  /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/.test(rules)
);
check(
  'El Super Admin oficial está protegido en reglas',
  rules.includes('request.auth.token.email == "tintinaccs@gmail.com"')
);
check(
  'Las cuentas bloqueadas se consideran en permisos',
  rules.includes('function isBlockedUser()') && rules.includes('!isBlockedUser()')
);

const firebase = read('js/firebase.js');
check(
  'Firebase importa App Check',
  firebase.includes('initializeAppCheck') && firebase.includes('ReCaptchaV3Provider')
);
check(
  'El estado de App Check nunca se presenta como activo sin configuración',
  firebase.includes("window.TintinAppCheckStatus = 'enabled'") &&
    firebase.includes("window.TintinAppCheckStatus = 'configuration-required'")
);
warn(
  'App Check tiene una clave pública configurada',
  !/const FIREBASE_APP_CHECK_SITE_KEY\s*=\s*['"]\s*['"]/.test(firebase),
  'Requiere clave pública y enforcement desde Firebase Console; no se puede inventar desde el repositorio'
);

const sourceRoots = ['js', 'functions', '.github/workflows'];
const textExtensions = new Set(['.js', '.mjs', '.cjs', '.html', '.json', '.yml', '.yaml', '.rules']);
const forbiddenPatterns = [
  { label: 'clave privada PEM', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { label: 'secreto Stripe en vivo', regex: /sk_live_[A-Za-z0-9]{12,}/ },
  { label: 'token GitHub clásico', regex: /ghp_[A-Za-z0-9]{20,}/ },
  { label: 'token GitHub fino', regex: /github_pat_[A-Za-z0-9_]{20,}/ },
  { label: 'cuenta de servicio Firebase', regex: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/ }
];

const findings = [];
function walk(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return;

  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(absolutePath)) {
      walk(path.join(relativePath, entry));
    }
    return;
  }

  if (!textExtensions.has(path.extname(relativePath).toLowerCase())) return;
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(content)) findings.push(`${relativePath}: ${pattern.label}`);
  }
}

for (const sourceRoot of sourceRoots) walk(sourceRoot);
check(
  'No se detectan secretos privados conocidos en código desplegable',
  findings.length === 0,
  findings.join('; ')
);

const deployWorkflow = read('.github/workflows/deploy-pages.yml');
check(
  'El despliegue publica únicamente después de regenerar diagnósticos',
  deployWorkflow.includes('npm run build:pages') && deployWorkflow.indexOf('npm run build:pages') < deployWorkflow.indexOf('actions/upload-pages-artifact')
);
check(
  'Los despliegues no se pisan entre sí',
  deployWorkflow.includes('cancel-in-progress: false') && deployWorkflow.includes('group: "pages"')
);

if (failures > 0) {
  console.error(`\nNivel 1: ${failures} fallo(s), ${warnings} advertencia(s).`);
  process.exit(1);
}

console.log(`\nNivel 1: base correcta con ${warnings} advertencia(s) externa(s) documentada(s).`);
