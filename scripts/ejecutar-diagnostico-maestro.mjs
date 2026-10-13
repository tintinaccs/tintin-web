#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, match => match.slice(1))), '..');
const requestedSuite = process.argv[2] || '';
const artifactsRoot = path.resolve(root, process.env.MASTER_ARTIFACTS_DIR || 'artifacts/master');
const productionOrigin = String(process.env.TINTIN_PUBLIC_ORIGIN || 'https://tintinaccesorios.pages.dev').replace(/\/$/, '');

const suites = {
  static: {
    title: 'Integridad, build y diagnóstico estructural',
    checks: [
      ['build-pages', 'Construir artefacto exacto de Pages', 'npm run build:pages'],
      ['verify-diagnostics', 'Verificar manifiesto diagnóstico reproducible', 'npm run verify:diagnostics'],
      ['audit-final', 'Auditoría final acumulada del repositorio', 'npm run audit:final'],
      ['audit-deep', 'Barrido profundo adicional', 'npm run audit:deep'],
      ['audit-names', 'Convenciones y coherencia de nombres', 'npm run audit:names']
    ]
  },
  commerce: {
    title: 'Comercio, pedidos, carrito, datos y cuentas',
    checks: [
      ['secure-orders', 'Contrato seguro de pedidos y pagos soportados', 'npm run audit:secure-orders'],
      ['checkout-delivery', 'Checkout y persistencia de entrega', 'npm run audit:checkout-delivery'],
      ['cart-audit', 'Lógica de carrito', 'npm run audit:cart'],
      ['cart-persistence', 'Persistencia de carrito', 'npm run test:cart-persistence'],
      ['store-gate', 'Control de disponibilidad de tienda', 'npm run audit:store-gate'],
      ['storegate-deadlock', 'Protección contra bloqueo del store gate', 'npm run audit:storegate-deadlock'],
      ['critical-healing', 'Recuperación de flujos críticos e inventario', 'npm run audit:critical-healing'],
      ['products-media', 'Productos, variantes y multimedia del Admin', 'npm run audit:products-media'],
      ['admin-orders', 'Pedidos del Admin y ciclo operativo', 'npm run audit:admin-orders'],
      ['users-roles', 'Usuarios, roles y autorización administrativa', 'npm run audit:users-roles'],
      ['login-profile', 'Acceso, perfil e incorporación', 'npm run audit:login-profile'],
      ['public-contract', 'Contrato operativo público', 'npm run audit:public-operational-contract']
    ]
  },
  'public-ui': {
    title: 'Cliente: UI, navegación, responsive, accesibilidad y SEO',
    checks: [
      ['navigation-header', 'Header y navegación responsive en Chromium', 'npm run test:navigation-header'],
      ['phase8-ui', 'Flujos UI/UX públicos en Chromium', 'npm run test:phase8-ui'],
      ['phase10-a11y', 'Accesibilidad pública en Chromium', 'npm run test:phase10-a11y'],
      ['phase11-seo', 'SEO dinámico en Chromium', 'npm run test:phase11-seo'],
      ['canonical-viewports', 'Matriz canónica de viewports', 'npm run audit:canonical-viewports'],
      ['responsive-geometry', 'Geometría responsive global', 'npm run audit:global-responsive-geometry'],
      ['responsive-navigation', 'Navegación responsive adicional', 'npm run audit:responsive-navigation'],
      ['navigation-search', 'Navegación y búsqueda', 'npm run audit:navigation-search']
    ]
  },
  'admin-ui': {
    title: 'Super Admin: visual, módulos, sincronización y operación',
    checks: [
      ['admin-foundation', 'Fundamentos del panel administrativo', 'npm run audit:admin-foundation'],
      ['admin-sync', 'Sincronización Admin ↔ público', 'npm run audit:admin-sync'],
      ['content-appearance', 'Contenido y apariencia administrable', 'npm run audit:content-appearance'],
      ['appearance-unified', 'Apariencia unificada del Admin', 'npm run audit:appearance-unified'],
      ['email-messaging', 'Correo y mensajería administrativa', 'npm run audit:email-messaging'],
      ['analytics', 'Analítica administrativa', 'npm run audit:analytics-audit'],
      ['visual-builder-ui', 'Editor visual seguro en Chromium', 'npm run test:visual-builder-ui'],
      ['visual-builder-runtime', 'Runtime del editor visual en Chromium', 'npx playwright test tests/visual-builder/visual-studio-v2-runtime.spec.js --project=chromium'],
      ['admin-visual-all-sections', 'Todas las secciones Admin/Super Admin en 15 viewports', 'node scripts/auditar-admin-visual-parte-2f-v3.mjs'],
      ['global-fit', 'Ajuste global de páginas y panel', 'node scripts/auditar-global-fit-parte-2f.mjs']
    ]
  },
  performance: {
    title: 'Performance, fluidez, carga y caché',
    checks: [
      ['performance-static', 'Auditoría de rendimiento en tiempo real', 'npm run audit:performance'],
      ['performance-regressions', 'Regresiones de rendimiento', 'npm run audit:performance-regressions'],
      ['page-loading', 'Carga inicial y loader global', 'npm run audit:page-loading'],
      ['phase5-performance', 'Optimización de Fase 5', 'npm run audit:phase5'],
      ['cache-versioning', 'Versionado e integridad de caché', 'npm run audit:cache-versioning'],
      ['performance-browser', 'Performance pública y acceso Admin en Chromium', 'npm run test:performance']
    ]
  },
  security: {
    title: 'Seguridad, CSP, App Check, aislamiento y dependencias',
    checks: [
      ['security-main', 'Auditoría de seguridad general', 'npm run audit:security'],
      ['security-phase6', 'Invariantes de seguridad Fase 6', 'npm run audit:phase6'],
      ['csp-regressions', 'Regresiones CSP, Cloudinary y Firebase Auth', 'node --test tests/security/csp-cloudinary-upload.test.mjs'],
      ['verify-csp', 'CSP generada y reproducible', 'npm run verify:csp'],
      ['app-check', 'Bootstrap y protección de App Check', 'npm run audit:app-check-bootstrap'],
      ['login-isolation', 'Aislamiento de acceso y sesión', 'npm run audit:login-isolation'],
      ['npm-production-audit', 'Dependencias de producción sin vulnerabilidades moderadas o superiores', 'npm audit --omit=dev --audit-level=moderate']
    ]
  },
  rules: {
    title: 'Firestore Rules y consistencia de identidad',
    checks: [
      ['rules-critical', 'Matriz crítica de reglas Firestore en emulador', 'npm run test:rules-critical'],
      ['rules-phone', 'Un teléfono, una cuenta', 'npm run test:rules-phone']
    ]
  },
  production: {
    title: 'Producción real, headers, rutas, sitemap y disponibilidad',
    checks: [
      ['production-health', `Salud real de producción (${productionOrigin})`, 'npm run monitor:production'],
      ['production-smoke', `Smoke integral de producción (${productionOrigin})`, 'node scripts/produccion-smoke-fase-12.mjs']
    ]
  }
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function durationLabel(ms) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function tail(text, lines = 80) {
  return String(text || '').split(/\r?\n/).slice(-lines).join('\n');
}

function runSuite(name) {
  const definition = suites[name];
  if (!definition) {
    console.error(`Suite desconocida: ${name}`);
    console.error(`Suites disponibles: ${Object.keys(suites).join(', ')}`);
    process.exit(2);
  }

  const suiteDir = path.join(artifactsRoot, name);
  fs.rmSync(suiteDir, { recursive: true, force: true });
  ensureDir(suiteDir);

  const startedAt = nowIso();
  const results = [];
  console.log(`\n=== DIAGNÓSTICO MAESTRO · ${definition.title} ===\n`);

  for (const [id, label, command] of definition.checks) {
    const started = Date.now();
    console.log(`▶ ${label}`);
    console.log(`  $ ${command}`);

    const execution = spawnSync(command, {
      cwd: root,
      env: process.env,
      shell: true,
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024
    });

    const finished = Date.now();
    const status = execution.status ?? (execution.error ? 1 : 0);
    const stdout = execution.stdout || '';
    const stderr = execution.stderr || '';
    const combined = [
      `# ${label}`,
      `# command: ${command}`,
      `# started: ${new Date(started).toISOString()}`,
      `# duration_ms: ${finished - started}`,
      `# exit_code: ${status}`,
      '',
      stdout,
      stderr
    ].join('\n');

    fs.writeFileSync(path.join(suiteDir, `${id}.log`), combined, 'utf8');
    results.push({
      id,
      label,
      command,
      status: status === 0 ? 'PASS' : 'FAIL',
      exitCode: status,
      durationMs: finished - started,
      log: `${id}.log`,
      signal: execution.signal || null,
      error: execution.error ? String(execution.error.message || execution.error) : null
    });

    if (status === 0) {
      console.log(`✓ ${label} · ${durationLabel(finished - started)}\n`);
    } else {
      console.error(`✗ ${label} · exit ${status} · ${durationLabel(finished - started)}`);
      const failureTail = tail(`${stdout}\n${stderr}`);
      if (failureTail.trim()) console.error(`${failureTail}\n`);
    }
  }

  const failed = results.filter(item => item.status === 'FAIL');
  const completedAt = nowIso();
  const payload = {
    schemaVersion: 1,
    suite: name,
    title: definition.title,
    status: failed.length ? 'FAIL' : 'PASS',
    commit: process.env.GITHUB_SHA || null,
    ref: process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || null,
    runId: process.env.GITHUB_RUN_ID || null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    productionOrigin: name === 'production' ? productionOrigin : null,
    startedAt,
    completedAt,
    checks: results
  };

  fs.writeFileSync(path.join(suiteDir, 'result.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(suiteDir, 'SUMMARY.md'), renderSuiteMarkdown(payload), 'utf8');

  console.log(`=== ${definition.title}: ${payload.status} · ${results.length - failed.length}/${results.length} checks correctos ===`);
  process.exit(failed.length ? 1 : 0);
}

function renderSuiteMarkdown(payload) {
  const rows = payload.checks.map(item =>
    `| ${item.status === 'PASS' ? 'PASS' : 'FAIL'} | ${item.label.replace(/\|/g, '\\|')} | ${item.exitCode} | ${durationLabel(item.durationMs)} | \`${item.log}\` |`
  ).join('\n');
  return `# ${payload.title}\n\nEstado: **${payload.status}**\n\n| Estado | Verificación | Código | Duración | Evidencia |\n|---|---|---:|---:|---|\n${rows}\n`;
}

function walk(dir, collector = []) {
  if (!fs.existsSync(dir)) return collector;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, collector);
    else if (entry.name === 'result.json') collector.push(full);
  }
  return collector;
}

function renderMasterSummary(results, expectedSuites, includeProduction) {
  const bySuite = new Map(results.map(item => [item.suite, item]));
  const ordered = expectedSuites.map(name => {
    if (name === 'production' && !includeProduction) {
      return { suite: name, title: suites[name].title, status: 'SKIPPED', checks: [] };
    }
    return bySuite.get(name) || { suite: name, title: suites[name]?.title || name, status: 'NOT_VERIFIED', checks: [] };
  });

  const failedChecks = ordered.flatMap(item => (item.checks || []).filter(check => check.status === 'FAIL').map(check => ({ suite: item.suite, title: item.title, ...check })));
  const missingSuites = ordered.filter(item => item.status === 'NOT_VERIFIED');
  const failedSuites = ordered.filter(item => item.status === 'FAIL');
  const passSuites = ordered.filter(item => item.status === 'PASS');
  const skippedSuites = ordered.filter(item => item.status === 'SKIPPED');
  const globalStatus = failedSuites.length || missingSuites.length ? 'FAIL' : 'PASS';

  const areaRows = ordered.map(item => {
    const pass = (item.checks || []).filter(check => check.status === 'PASS').length;
    const fail = (item.checks || []).filter(check => check.status === 'FAIL').length;
    return `| ${item.title} | **${item.status}** | ${pass} | ${fail} |`;
  }).join('\n');

  const findingLines = failedChecks.length
    ? failedChecks.map(item => `- **${item.title}** — ${item.label} (exit ${item.exitCode}). Evidencia: \`${item.suite}/${item.log}\`.`).join('\n')
    : '- No hubo verificaciones automáticas fallidas.';

  const missingLines = missingSuites.length
    ? missingSuites.map(item => `- **NO VERIFICADO:** ${item.title}. El job no produjo un resultado utilizable; revisar instalación, runner o logs del workflow.`).join('\n')
    : '- Ninguna suite automática quedó sin verificar.';

  const markdown = `# Diagnóstico Maestro Tintin\n\nEstado global automático: **${globalStatus}**\n\nCommit: \`${process.env.GITHUB_SHA || 'desconocido'}\`  \nRun: \`${process.env.GITHUB_RUN_ID || 'desconocido'}\`  \nProducción: \`${productionOrigin}\`\n\n## Cobertura\n\n| Área | Estado | PASS | FAIL |\n|---|---|---:|---:|\n${areaRows}\n\n## Hallazgos automáticos\n\n${findingLines}\n\n## No verificado\n\n${missingLines}\n\n## Exclusión deliberada\n\n- **Compra real end-to-end:** fuera de la automatización por decisión del propietario. El workflow sí valida contratos, checkout, pedidos, carrito, reglas, seguridad y manejo técnico relacionado, pero no ejecuta una transacción monetaria real.\n- **Operaciones destructivas sobre datos reales:** el diagnóstico no crea, modifica ni elimina pedidos, usuarios, stock o configuración de producción para “probar” el sistema.\n\n## Criterio de cierre automático\n\nPara que este workflow quede verde, todas las suites habilitadas deben producir resultado y todos sus checks bloqueantes deben pasar. Un job ausente se clasifica como **NOT_VERIFIED**, nunca como correcto.\n`;

  return {
    markdown,
    payload: {
      schemaVersion: 1,
      status: globalStatus,
      commit: process.env.GITHUB_SHA || null,
      runId: process.env.GITHUB_RUN_ID || null,
      productionOrigin,
      includeProduction,
      counts: {
        suitesPass: passSuites.length,
        suitesFail: failedSuites.length,
        suitesSkipped: skippedSuites.length,
        suitesNotVerified: missingSuites.length,
        checksFail: failedChecks.length
      },
      suites: ordered,
      generatedAt: nowIso(),
      exclusions: [
        'Compra real end-to-end a cargo del propietario.',
        'No se ejecutan escrituras destructivas sobre datos reales de producción.'
      ]
    }
  };
}

function aggregateSummary() {
  const collectedRoot = path.resolve(root, process.env.MASTER_COLLECTED_DIR || 'artifacts/collected');
  const outputDir = path.resolve(root, process.env.MASTER_SUMMARY_DIR || 'artifacts/master-summary');
  ensureDir(outputDir);

  const includeProduction = String(process.env.MASTER_INCLUDE_PRODUCTION || 'true').toLowerCase() !== 'false';
  const expectedSuites = ['static', 'commerce', 'public-ui', 'admin-ui', 'performance', 'security', 'rules', 'production'];
  const resultFiles = walk(collectedRoot);
  const parsed = [];

  for (const file of resultFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data?.suite && expectedSuites.includes(data.suite)) parsed.push(data);
    } catch (error) {
      console.error(`No se pudo leer ${file}: ${error.message}`);
    }
  }

  const { markdown, payload } = renderMasterSummary(parsed, expectedSuites, includeProduction);
  fs.writeFileSync(path.join(outputDir, 'RESUMEN-MAESTRO.md'), markdown, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'diagnostico-maestro.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(markdown);
  process.exit(payload.status === 'PASS' ? 0 : 1);
}

if (requestedSuite === 'summary') aggregateSummary();
else runSuite(requestedSuite);
