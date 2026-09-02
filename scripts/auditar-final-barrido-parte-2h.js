'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checks = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const expectedPages = [
  '404.html',
  'about.html',
  'admin-images.html',
  'admin.html',
  'cambios-devoluciones.html',
  'catalogo.html',
  'checkout.html',
  'collections.html',
  'contact.html',
  'envios.html',
  'index.html',
  'login.html',
  'nosotros.html',
  'perfil.html',
  'preguntas-frecuentes.html',
  'privacidad.html',
  'product.html',
  'terminos.html'
].sort();

const actualPages = fs.readdirSync(root)
  .filter(file => file.endsWith('.html'))
  .sort();

check(
  'Las 18 rutas del producto permanecen presentes',
  JSON.stringify(actualPages) === JSON.stringify(expectedPages),
  `Esperadas: ${expectedPages.join(', ')} | Encontradas: ${actualPages.join(', ')}`
);

const smoke = read('scripts/smoke-todas-paginas.mjs');
check(
  'El smoke test recorre las 18 rutas',
  expectedPages.every(page => smoke.includes(`/${page}`)),
  'El recorrido de navegador no incluye todas las páginas raíz.'
);

const responsive = read('scripts/auditar-global-responsive-final.mjs');
const officialViewports = [
  [360, 800], [390, 844], [430, 932], [768, 1024],
  [1024, 768], [1280, 900], [1440, 1000]
];
const boundaryWidths = [320, 480, 481, 767, 769, 1023, 1025, 1920];
check(
  'La geometría conserva las 7 pantallas oficiales',
  officialViewports.every(([width, height]) => responsive.includes(`[${width}, ${height}]`)),
  'Falta al menos una pantalla oficial en la auditoría responsive global.'
);
check(
  'La geometría conserva los límites responsive críticos',
  boundaryWidths.every(width => responsive.includes(`[${width},`)),
  'Falta al menos un ancho límite en la auditoría responsive global.'
);

const expectedRoles = ['guest', 'client', 'viewer', 'agent', 'admin', 'superadmin'];
let diagnostics = null;
try {
  diagnostics = JSON.parse(read('diagnostic-manifest.json'));
} catch {}
check(
  'El diagnóstico final representa las 18 páginas',
  diagnostics?.platform?.pages === 18 &&
    expectedPages.every(page => diagnostics.pages?.some(item => item.path === page)),
  'El manifiesto de diagnóstico no coincide con las 18 páginas actuales.'
);
check(
  'El diagnóstico final conserva los 6 roles',
  JSON.stringify(diagnostics?.roles || []) === JSON.stringify(expectedRoles),
  `Roles esperados: ${expectedRoles.join(', ')}`
);

const pkg = JSON.parse(read('package.json'));
const finalAudit = String(pkg.scripts?.['audit:final'] || '');
const centralWorkflowPath = '.github/workflows/auditar-tintin.yml';
const visualWorkflowPath = '.github/workflows/auditoria-visual.yml';
const centralWorkflow = exists(centralWorkflowPath) ? read(centralWorkflowPath) : '';
const visualWorkflow = exists(visualWorkflowPath) ? read(visualWorkflowPath) : '';

// Las antiguas Partes 2A–2G ya no tienen un workflow por separado. Su cobertura
// se conserva como contratos dentro del único gate de PR y del barrido visual
// consolidado. Esto evita siete runners duplicados sin bajar la protección.
const partContracts = [
  {
    part: '2A',
    area: 'responsive global',
    packageScripts: ['audit:global-responsive-geometry', 'audit:canonical-viewports'],
    finalNeedles: [],
    ciNeedles: ['npm run audit:canonical-viewports', 'npm run audit:global-responsive-geometry'],
    visualNeedles: ['npm run audit:canonical-viewports', 'npm run audit:global-responsive-geometry']
  },
  {
    part: '2B',
    area: 'inicio y navegación',
    packageScripts: ['test:navigation-header', 'test:pages', 'audit:public-shell'],
    finalNeedles: ['npm run audit:public-shell'],
    ciNeedles: ['npm run test:navigation-header', 'npm run test:pages'],
    visualNeedles: ['npm run test:pages']
  },
  {
    part: '2C',
    area: 'catálogo, colecciones y producto',
    packageScripts: ['audit:collections', 'audit:cart', 'audit:products-media', 'test:pages'],
    finalNeedles: ['npm run audit:collections', 'npm run audit:cart', 'npm run audit:products-media'],
    ciNeedles: ['npm run test:pages'],
    visualNeedles: ['npm run test:pages']
  },
  {
    part: '2D',
    area: 'checkout, login y perfil',
    packageScripts: ['audit:secure-orders', 'audit:checkout-delivery', 'audit:login-profile', 'test:phase8-ui'],
    finalNeedles: ['npm run audit:secure-orders', 'npm run audit:checkout-delivery', 'npm run audit:login-profile'],
    ciNeedles: ['npm run test:phase8-ui'],
    visualNeedles: []
  },
  {
    part: '2E',
    area: 'institucionales, ayuda y legales',
    packageScripts: ['audit:help-pages', 'audit:aux-pages', 'audit:phase10', 'test:phase10-a11y'],
    finalNeedles: ['npm run audit:help-pages', 'npm run audit:aux-pages', 'npm run audit:phase10'],
    ciNeedles: ['npm run test:phase10-a11y'],
    visualNeedles: []
  },
  {
    part: '2F',
    area: 'Admin y Super Admin',
    packageScripts: ['audit:admin-foundation', 'audit:users-roles', 'audit:appearance-unified'],
    finalNeedles: ['npm run audit:admin-foundation', 'npm run audit:users-roles', 'npm run audit:appearance-unified'],
    ciNeedles: ['node scripts/auditar-superadmin-maestro.mjs', 'node scripts/auditar-superadmin-maestro-responsive.mjs'],
    visualNeedles: ['node scripts/auditar-superadmin-maestro-responsive.mjs']
  },
  {
    part: '2G',
    area: 'sistema y estados especiales',
    packageScripts: ['audit:reliability', 'audit:storegate-deadlock', 'audit:app-check-bootstrap', 'test:phase8-ui'],
    finalNeedles: ['npm run audit:reliability', 'npm run audit:storegate-deadlock', 'npm run audit:app-check-bootstrap'],
    ciNeedles: ['npm run test:phase8-ui'],
    visualNeedles: []
  }
];

check(
  'El CI consolidado y la auditoría visual existen',
  exists(centralWorkflowPath) && exists(visualWorkflowPath),
  'Falta el gate central de PR o la auditoría visual consolidada.'
);

for (const contract of partContracts) {
  const commandsExist = contract.packageScripts.every(name => typeof pkg.scripts?.[name] === 'string');
  const finalConnected = contract.finalNeedles.every(needle => finalAudit.includes(needle));
  const ciConnected = contract.ciNeedles.every(needle => centralWorkflow.includes(needle));
  const visualConnected = contract.visualNeedles.every(needle => visualWorkflow.includes(needle));

  check(
    `Parte ${contract.part}: cobertura ${contract.area} preservada`,
    commandsExist && finalConnected && ciConnected && visualConnected,
    `La Parte ${contract.part} perdió un comando o su conexión al CI/visual consolidado.`
  );
}

const imageProblems = [];
for (const page of expectedPages) {
  const html = read(page);
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const hasSource = /(?:^|\s)src\s*=\s*["'][^"']+["']/i.test(tag);
    const dynamic = /\bdata-dynamic-src\s*=\s*["']true["']/i.test(tag);
    if (!hasSource && !dynamic) imageProblems.push(`${page}: imagen sin origen`);
    if (dynamic && !/\bid\s*=\s*["'][^"']+["']/i.test(tag)) {
      imageProblems.push(`${page}: imagen dinámica sin id`);
    }
    if (dynamic && !/\balt\s*=\s*["'][^"']+["']/i.test(tag)) {
      imageProblems.push(`${page}: imagen dinámica sin texto alternativo`);
    }
  }
}
check(
  'Las imágenes sin origen estático declaran su carga dinámica',
  imageProblems.length === 0,
  imageProblems.join(' | ')
);

check(
  'El manifiesto final no contiene referencias locales faltantes',
  Array.isArray(diagnostics?.missingReferences) && diagnostics.missingReferences.length === 0,
  `Referencias faltantes: ${JSON.stringify(diagnostics?.missingReferences || [])}`
);

check(
  'La Parte 2H está conectada a la auditoría final',
  pkg.scripts?.['audit:part2h'] === 'node scripts/auditar-final-barrido-parte-2h.js' &&
    finalAudit.includes('npm run audit:part2h'),
  'Falta audit:part2h o no forma parte de audit:final.'
);

check(
  'La protección continua de la Parte 2H está activa en el CI único',
  centralWorkflow.includes('pull_request:') &&
    centralWorkflow.includes('push:') &&
    centralWorkflow.includes('npm run build:pages') &&
    centralWorkflow.includes('node scripts/auditar-integraciones-canonicas.mjs') &&
    centralWorkflow.includes('npm run audit:final') &&
    centralWorkflow.includes('npm run test:phase10-a11y') &&
    centralWorkflow.includes('npm run test:phase11-seo') &&
    centralWorkflow.includes('npm run test:performance') &&
    centralWorkflow.includes('npm run audit:global-responsive-geometry'),
  'El gate central dejó de ejecutar alguna protección estática o de navegador obligatoria.'
);

check(
  'La protección visual programada sigue activa sin duplicar el gate de PR',
  visualWorkflow.includes('schedule:') &&
    visualWorkflow.includes('workflow_dispatch:') &&
    !/(^|\n)\s*pull_request\s*:/.test(visualWorkflow) &&
    visualWorkflow.includes('npm run audit:canonical-viewports') &&
    visualWorkflow.includes('npm run audit:global-responsive-geometry') &&
    visualWorkflow.includes('npm run test:pages'),
  'La auditoría visual consolidada debe ser programada/manual y conservar viewports, geometría y smoke.'
);

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
}

if (failed.length) {
  console.error(`\nBarrido final 2H fallido: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nBarrido final 2H completado (${checks.length} comprobaciones).`);
