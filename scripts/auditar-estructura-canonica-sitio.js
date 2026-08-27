'use strict';

/* =============================================================
   TINTIN — Auditoría de consumidores de estructura canónica

   La estructura ya NO vive en el esquema histórico de campos. La cadena debe
   ser siempre:

     contrato-estructura-sitio.js
                 ↓
          esquema-contenido.js (fachada)
        ↙        ↓          ↘
   Superadmin  runtime    Cloudflare

   definiciones-contenido.js solo aporta campos/defaults/sanitización.
   ============================================================= */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const contract = read('js/core/store/contrato-estructura-sitio.js');
const gateway = read('js/core/store/esquema-contenido.js');
const definitions = read('js/core/store/definiciones-contenido.js');
const adminContent = read('js/admin/content/gestion-contenido-admin.js');
const visualAdmin = read('js/admin/appearance/editor-visual-admin.js');
const visualRuntime = read('js/core/store/editor-visual-runtime.js');
const visualCore = read('cloudflare/visual-builder-core.js');
const publicContent = read('js/core/store/contenido-sitio.js');
const packageJson = read('package.json');

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

check(
  'Existe una autoridad estructural explícita y versionada',
  contract.includes('SITE_STRUCTURE_VERSION') &&
    contract.includes('SITE_STRUCTURE_CONTRACT') &&
    contract.includes('SITE_PUBLIC_PAGE_IDS'),
  'La lista de páginas/secciones no debe volver a repartirse entre consumidores.'
);

check(
  'La fachada canónica combina estructura y campos por responsabilidad',
  gateway.includes("from './contrato-estructura-sitio.js'") &&
    gateway.includes("from './definiciones-contenido.js'") &&
    gateway.includes('structural.root') &&
    gateway.includes('content?.fields || []'),
  'esquema-contenido.js debe proyectar roots del contrato y campos de definiciones-contenido.'
);

check(
  'Las definiciones antiguas no son la autoridad estructural pública',
  !adminContent.includes('definiciones-contenido.js') &&
    !visualAdmin.includes('definiciones-contenido.js') &&
    !visualRuntime.includes('definiciones-contenido.js') &&
    !visualCore.includes('definiciones-contenido.js') &&
    !publicContent.includes('definiciones-contenido.js'),
  'Solo la fachada canónica puede importar definiciones-contenido.js.'
);

for (const [label, source] of [
  ['Superadmin Contenido', adminContent],
  ['Visual Builder Admin', visualAdmin],
  ['runtime público', visualRuntime],
  ['backend Cloudflare', visualCore],
  ['contenido público', publicContent],
]) {
  check(
    `${label} consume la fachada canónica`,
    source.includes('esquema-contenido.js'),
    `${label} no debe mantener/importar una estructura paralela.`
  );
}

check(
  'La fachada excluye páginas protegidas del CMS libre',
  gateway.includes('SITE_STRUCTURE_MODES.protected') &&
    gateway.includes('return null'),
  'Checkout/Login/Perfil no deben convertirse en páginas visuales de libre composición.'
);

check(
  'El editor vigente no puede atravesar una barrera estructural fija',
  gateway.includes('firstBarrier') &&
    gateway.includes('page.sections.slice(0, limit)') &&
    gateway.includes('section.movable && section.visualEditable'),
  'Hasta tener orden por zonas, solo se proyecta el prefijo seguro anterior a una barrera fija.'
);

check(
  'Catálogo usa el root físico actual y conserva trazabilidad del legado',
  contract.includes("section('header', 'Encabezado del catálogo', '.cat-hero'") &&
    contract.includes("legacyContentRoots: ['.catalog-header, .tt-page-hero']"),
  'La conexión antigua debe quedar trazada hasta retirar su último consumidor.'
);

check(
  'Envíos, FAQ y Cambios usan la section física como root estructural',
  contract.includes("section('details', 'Información de envíos', '.tt-page-hero + .section'") &&
    contract.includes("section('questions', 'Preguntas y respuestas', '.tt-page-hero + .section'") &&
    contract.includes("section('policy', 'Política', '.tt-page-hero + .section'"),
  'No se debe reordenar un .container interno como si fuera una sección completa.'
);

check(
  'No reaparecen IDs retirados como estructura activa',
  !gateway.includes("sections: { collections_header") &&
    !gateway.includes("sections: { products_header") &&
    !contract.includes("section('collections_header'") &&
    !contract.includes("section('products_header'"),
  'Los IDs retirados solo pueden existir en el registro de migración de la Tarea 2.'
);

check(
  'CI ejecuta la auditoría de estructura en la auditoría final',
  packageJson.includes('"audit:site-structure"') &&
    packageJson.includes('npm run audit:site-structure'),
  'Un cambio estructural sin validar no debe poder cerrar la entrega.'
);

check(
  'La definición de campos conserva sanitización de texto/enlaces',
  definitions.includes('sanitizeContentText') &&
    definitions.includes('sanitizeContentHref') &&
    definitions.includes('javascript|data|vbscript|file') &&
    definitions.includes('CONTENT_MAX_LENGTH'),
  'Separar estructura y campos no debe debilitar el saneamiento existente.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría de consumidores canónicos fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría canónica completada (${checks.length} comprobaciones).`);
