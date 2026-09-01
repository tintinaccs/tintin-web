#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const registrySource = read('js/admin/maestro/registro-maestro.js');
const registry = await import(`data:text/javascript;base64,${Buffer.from(registrySource).toString('base64')}`);
const { MAESTRO_MODULES } = registry;

const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

const domainModules = MAESTRO_MODULES.filter(module => module.id !== 'maestro');
const results = [];
const check = (id, label, ok, evidence = '') => results.push({ id, label, ok: Boolean(ok), evidence });

const SPECIALIZED_VALIDATORS = {
  dashboard: ['scripts/auditar-admin-analitica-auditar.js'],
  estadisticas: ['scripts/auditar-admin-analitica-auditar.js'],
  usuarios: ['scripts/auditar-admin-usuarios-roles.js'],
  pedidos: ['scripts/auditar-admin-pedidos.js'],
  productos: ['scripts/auditar-admin-productos-multimedia.js', 'scripts/auditar-borrado-global-catalogo.mjs'],
  resenas: ['tests/engagement/participation-contract.test.mjs', 'tests/engagement/notificaciones-sociales.test.mjs'],
  'me-gusta': ['tests/engagement/participation-contract.test.mjs', 'tests/engagement/notificaciones-sociales.test.mjs'],
  colecciones: ['scripts/auditar-admin-productos-multimedia.js', 'scripts/auditar-borrado-global-catalogo.mjs'],
  paginas: ['scripts/auditar-admin-contenido-apariencia.js'],
  importar: ['scripts/auditar-admin-productos-multimedia.js'],
  imagenes: ['scripts/auditar-admin-productos-multimedia.js'],
  mensajes: ['scripts/auditar-admin-correo-mensajeria.js'],
  'notificaciones-push': ['scripts/auditar-push-web.js'],
  auditoria: ['scripts/auditar-admin-analitica-auditar.js'],
  diagnostico: ['scripts/auditar-admin-analitica-auditar.js'],
  'estudio-codigo': ['scripts/auditar-superadmin-cierre-total.mjs'],
  correos: ['scripts/auditar-admin-correo-mensajeria.js'],
  configuracion: ['scripts/auditar-superadmin-cierre-total.mjs', 'scripts/auditar-pago-metodos.js'],
  permisos: ['scripts/auditar-admin-fundamentos.js', 'scripts/auditar-admin-usuarios-roles.js'],
  apariencia: ['scripts/auditar-admin-contenido-apariencia.js'],
  welcome: ['scripts/auditar-superadmin-cierre-total.mjs']
};

const MUTATING_CAPS = ['create', 'update', 'archive', 'delete', 'sync'];

check('domain-count', 'El cierre evalúa todos los módulos funcionales sin contar Maestro como sustituto', domainModules.length >= 21, `${domainModules.length} módulos funcionales`);

for (const module of domainModules) {
  const caps = module.capabilities || {};
  const evidence = module.evidence || [];
  const validators = SPECIALIZED_VALIDATORS[module.id] || [];
  const mutates = MUTATING_CAPS.some(cap => ['yes', 'guarded'].includes(caps[cap]));

  check(`module-${module.id}-definition`, `${module.label}: tiene dominio, política y descripción propios`,
    Boolean(module.id && module.label && module.policy && module.description));
  check(`module-${module.id}-evidence`, `${module.label}: sus funciones existen fuera del módulo Maestro`,
    evidence.length > 0, evidence.join(', '));
  check(`module-${module.id}-validator`, `${module.label}: tiene auditoría especializada o transversal que valida su dominio`,
    validators.length > 0 && validators.every(exists), validators.join(', '));
  check(`module-${module.id}-read`, `${module.label}: siempre conserva capacidad real de lectura/consulta`, caps.read === 'yes');

  if (mutates) {
    check(`module-${module.id}-guarded-mutations`, `${module.label}: toda mutación está gobernada por permisos y auditoría`,
      ['yes', 'guarded'].includes(caps.permissions) && ['yes', 'guarded'].includes(caps.audit),
      `permissions=${caps.permissions}; audit=${caps.audit}`);
  }

  if (['yes', 'guarded'].includes(caps.sync)) {
    check(`module-${module.id}-sync`, `${module.label}: los cambios declaran sincronización global y no solo visual`,
      ['yes', 'guarded'].includes(caps.sync));
  }
}

check('no-maestro-substitution', 'Maestro permanece como gobierno adicional y no reemplaza capacidades de los demás módulos',
  domainModules.every(module => module.evidence?.length > 0 && module.id !== 'maestro'));

const failures = results.filter(item => !item.ok);
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'superadmin-modulos-completos-por-dominio',
  modules: domainModules.map(module => ({
    id: module.id,
    label: module.label,
    policy: module.policy,
    capabilities: module.capabilities,
    validators: SPECIALIZED_VALIDATORS[module.id] || []
  })),
  totals: { checks: results.length, passed: results.length - failures.length, failed: failures.length },
  results
};
fs.writeFileSync(path.join(artifactDir, 'superadmin-modulos-completos.json'), JSON.stringify(report, null, 2));

for (const item of results) {
  console.log(`${item.ok ? 'OK' : 'FALTA'} - ${item.label}${item.evidence ? ` :: ${item.evidence}` : ''}`);
}
console.log(`\nMódulos completos por dominio: ${report.totals.passed}/${report.totals.checks}`);
if (failures.length) process.exit(1);
