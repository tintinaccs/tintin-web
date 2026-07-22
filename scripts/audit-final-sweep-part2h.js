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

const smoke = read('scripts/smoke-all-pages.mjs');
check(
  'El smoke test recorre las 18 rutas',
  expectedPages.every(page => smoke.includes(`/${page}`)),
  'El recorrido de navegador no incluye todas las páginas raíz.'
);

const responsive = read('scripts/audit-global-responsive-final.mjs');
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

const partContracts = [
  {
    part: '2A',
    workflow: '.github/workflows/global-responsive-audit.yml',
    scripts: ['scripts/audit-global-responsive-final.mjs'],
    workflowNeedles: ['npm run audit:global-responsive-geometry']
  },
  {
    part: '2B',
    workflow: '.github/workflows/home-part2b-audit.yml',
    scripts: ['scripts/audit-home-visual-part2b-v3.mjs'],
    workflowNeedles: ['scripts/audit-home-visual-part2b-v3.mjs']
  },
  {
    part: '2C',
    workflow: '.github/workflows/commerce-part2c-audit.yml',
    scripts: ['scripts/audit-commerce-visual-part2c.mjs'],
    workflowNeedles: ['scripts/audit-commerce-visual-part2c.mjs']
  },
  {
    part: '2D',
    workflow: '.github/workflows/account-flow-part2d-audit.yml',
    scripts: [
      'scripts/audit-account-flow-visual-part2d.mjs',
      'scripts/enforce-account-flow-part2d.mjs',
      'scripts/audit-account-flow-compact-part2d.mjs'
    ],
    workflowNeedles: [
      'scripts/audit-account-flow-visual-part2d.mjs',
      'scripts/enforce-account-flow-part2d.mjs',
      'scripts/audit-account-flow-compact-part2d.mjs'
    ]
  },
  {
    part: '2E',
    workflow: '.github/workflows/institutional-help-legal-part2e-audit.yml',
    scripts: [
      'scripts/audit-institutional-help-legal-part2e-v2.mjs',
      'scripts/enforce-institutional-help-legal-part2e.mjs',
      'scripts/audit-faq-interaction-part2e.mjs'
    ],
    workflowNeedles: [
      'scripts/audit-institutional-help-legal-part2e-v2.mjs',
      'scripts/enforce-institutional-help-legal-part2e.mjs',
      'scripts/audit-faq-interaction-part2e.mjs'
    ]
  },
  {
    part: '2F',
    workflow: '.github/workflows/admin-part2f-audit.yml',
    scripts: [
      'scripts/audit-admin-visual-part2f-v3.mjs',
      'scripts/audit-global-fit-part2f.mjs'
    ],
    workflowNeedles: [
      'scripts/audit-admin-visual-part2f-v3.mjs',
      'scripts/audit-global-fit-part2f.mjs'
    ]
  },
  {
    part: '2G',
    workflow: '.github/workflows/system-special-part2g-audit.yml',
    scripts: [
      'scripts/audit-system-special-states-part2g-v2.mjs',
      'scripts/enforce-system-special-part2g.mjs'
    ],
    workflowNeedles: [
      'scripts/audit-system-special-states-part2g-v2.mjs',
      'scripts/enforce-system-special-part2g.mjs'
    ]
  }
];

for (const contract of partContracts) {
  const workflowExists = exists(contract.workflow);
  const workflow = workflowExists ? read(contract.workflow) : '';
  check(
    `Parte ${contract.part}: auditorías y workflow presentes`,
    workflowExists && contract.scripts.every(exists),
    `Falta el workflow o un script obligatorio de la Parte ${contract.part}.`
  );
  check(
    `Parte ${contract.part}: workflow conectado a sus auditorías`,
    workflow.includes('pull_request:') &&
      workflow.includes('- main') &&
      contract.workflowNeedles.every(needle => workflow.includes(needle)),
    `El workflow de la Parte ${contract.part} perdió su disparador o una auditoría.`
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

const pkg = JSON.parse(read('package.json'));
check(
  'La Parte 2H está conectada a la auditoría final',
  pkg.scripts?.['audit:part2h'] === 'node scripts/audit-final-sweep-part2h.js' &&
    pkg.scripts?.['audit:final']?.includes('npm run audit:part2h'),
  'Falta audit:part2h o no forma parte de audit:final.'
);

const part2hWorkflow = '.github/workflows/final-sweep-part2h-audit.yml';
const part2hWorkflowText = exists(part2hWorkflow) ? read(part2hWorkflow) : '';
check(
  'La protección continua de la Parte 2H está activa',
  part2hWorkflowText.includes('pull_request:') &&
    part2hWorkflowText.includes('push:') &&
    part2hWorkflowText.includes('npm run build:pages') &&
    part2hWorkflowText.includes('npm run audit:deep') &&
    part2hWorkflowText.includes('npm run audit:final') &&
    part2hWorkflowText.includes('audit-firestore-read-budget.js'),
  'El workflow 2H no ejecuta toda la protección estática final.'
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
