import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function patch(file, before, after, label) {
  const absolute = path.join(root, file);
  let source = fs.readFileSync(absolute, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`No se encontró ${label}.`);
  source = source.replace(before, after);
  fs.writeFileSync(absolute, source);
}

patch(
  'scripts/audit-site-reliability.js',
  "staleVersions.length === 0 && loader.includes(\"const TT_CACHE_VERSION = 'tintin-20260730-appcheck-stable-4'\")",
  "staleVersions.length === 0 && loader.includes(\"const TT_CACHE_VERSION = 'tintin-20260730-phase8-ui-1'\")",
  'el contrato de versión crítica del loader'
);

patch(
  'tests/ui-ux/phase8-ui-ux.spec.js',
  "      actionClass: 'tt-state-action',",
  "      actionClass: 'tt-state-action tt-interactive-control',",
  'la expectativa de mejora interactiva de la acción'
);

fs.rmSync(import.meta.filename);
console.log('Contratos de caché y prueba UI actualizados para Fase 8.');
