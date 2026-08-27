'use strict';

/* =============================================================
   TINTIN — Auditoría de Contenido y Apariencia (panel + sitio público)

   La estructura de páginas/secciones proviene del contrato canónico; el
   catálogo de campos conserva defaults y sanitizadores seguros. Esta auditoría
   verifica la interfaz pública de esa arquitectura y las invariantes de
   seguridad de Contenido + Apariencia de punta a punta.
   ============================================================= */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

async function main() {
  const schemaModule = await import(pathToFileURL(path.join(root, 'js/core/store/esquema-contenido.js')).href);
  const checks = [];
  function check(name, condition, problem) {
    checks.push({ name, ok: Boolean(condition), problem });
  }

  const siteContent   = read('js/core/store/contenido-sitio.js');
  const adminContent  = read('js/admin/content/gestion-contenido-admin.js');
  const colorScheme   = read('js/components/color/esquema-color.js');
  const colorInstant  = read('js/components/color/esquema-color-instantaneo.js');
  const colorCatalog  = read('js/components/color/esquema-color-catalogo.js');
  const adminApp      = read('js/admin/admin-app.js');
  const rules         = read('firestore.rules');

  // ===========================================================================
  // 1. EDITOR DE CONTENIDO — registro canónico, valores no HTML
  // ===========================================================================
  const requiredPages = ['index', 'nosotros', 'catalogo', 'collections', 'contact', 'envios', 'faq', 'cambios'];
  const protectedPages = ['checkout', 'login', 'perfil'];
  check(
    'El CMS usa el registro canónico y no incorpora flujos protegidos',
    requiredPages.every(page => schemaModule.CONTENT_PAGE_IDS.includes(page) && schemaModule.getPageSchema(page)) &&
      protectedPages.every(page => !schemaModule.CONTENT_PAGE_IDS.includes(page) && schemaModule.getPageSchema(page) === null),
    'Solo páginas registradas por el contrato pueden ser editables; Checkout/Login/Perfil deben seguir protegidos.'
  );

  const fieldsRespectLimit = schemaModule.CONTENT_PAGE_IDS.every(pageId => {
    const page = schemaModule.getPageSchema(pageId);
    if (!page) return true;
    return Object.values(page.sections || {}).every(section =>
      (section.fields || []).every(field => Number.isFinite(field.maxLength) && field.maxLength > 0 && field.maxLength <= schemaModule.CONTENT_MAX_LENGTH)
    );
  });
  check(
    'Los campos de contenido tienen un tope efectivo de longitud',
    schemaModule.CONTENT_MAX_LENGTH === 4000 &&
      schemaModule.sanitizeContentText('x'.repeat(5000)).length === 4000 &&
      schemaModule.sanitizeContentText(`a\u0000b`) === 'ab' &&
      fieldsRespectLimit,
    'El límite global debe seguir en 4000, aplicarse realmente y ningún campo puede superarlo.'
  );

  check(
    'El sitio público aplica el contenido por selector real (cambio real)',
    /root\.querySelectorAll\(item\.selector\)/.test(siteContent) &&
      /onSnapshot\(/.test(siteContent),
    'Cada campo debe escribir en su selector en vivo; si no, sería un control decorativo.'
  );
  check(
    'El contenido público se pinta con nodos de texto, nunca con HTML de Firestore',
    /document\.createTextNode\(line\)/.test(siteContent) &&
      /element\.replaceChildren\(/.test(siteContent) &&
      !/\.innerHTML\s*=/.test(siteContent),
    'Un valor de Firestore nunca debe interpretarse como HTML.'
  );
  check(
    'Los enlaces editables se sanean antes de asignar el href',
    /const safe = sanitizeContentHref\(value/.test(siteContent) &&
      /setAttribute\('href', safe\)/.test(siteContent) &&
      schemaModule.sanitizeContentHref('javascript:alert(1)', '/catalogo') === '/catalogo',
    'Un href editable debe pasar por el sanitizador exportado antes de llegar al DOM.'
  );
  check(
    'El editor de contenido escribe en la colección protegida site_content',
    /site_content/.test(adminContent),
    'El editor debe usar la colección con reglas, no un almacenamiento libre.'
  );

  // ===========================================================================
  // 2. APARIENCIA — enforcement de color seguro en el apply público
  // ===========================================================================
  check(
    'El apply global solo aplica valores que sean un color estricto (HEX/rgb/hsl)',
    /function isSafeColorValue\(value\)/.test(colorScheme) &&
      /out\[token\.cssVar\] = value;/.test(colorScheme) &&
      /value != null && value !== '' && isSafeColorValue\(value\)/.test(colorScheme),
    'esquema-color.js debe validar el valor antes de setProperty (no URLs ni CSS arbitrario).'
  );
  check(
    'El validador de color rechaza url(), CSS arbitrario y valores largos',
    /if \(!v \|\| v\.length > 64\) return false/.test(colorScheme) &&
      /\^#\(\[0-9a-f\]\{3\}/.test(colorScheme) &&
      /\^rgba\?\\\(/.test(colorScheme),
    'El allowlist debe anclar el formato (^...$) para no dejar pasar url(...) ni ";".'
  );
  check(
    'La primera pintura (caché) también valida el color antes de aplicarlo',
    /function isSafeColorValue\(value\)/.test(colorInstant) &&
      /hasOwnProperty\.call\(map, key\) && isSafeColorValue\(map\[key\]\)/.test(colorInstant),
    'Una caché vieja o manipulada no debe poder inyectar un valor peligroso al pintar.'
  );
  check(
    'Los colores se aplican como custom properties (valor puro), no como CSS libre',
    /root\.style\.setProperty\(key, value\)/.test(colorScheme),
    'Se escribe una variable --color-*; nunca se inyecta una regla o bloque CSS.'
  );
  check(
    'La importación de esquemas valida cada color y descarta los inválidos',
    /function isValidColorLocal\(v\)/.test(adminApp) &&
      /isValidColorLocal\(value\)\) \{/.test(adminApp),
    'Importar un esquema no debe meter valores no-color en Firestore.'
  );

  // ===========================================================================
  // 3. APARIENCIA — tokens conectados, preview, unsaved, dispositivo, realtime
  // ===========================================================================
  check(
    'Cada token del catálogo tiene una variable CSS real (consumidor)',
    /cssVar:/.test(colorCatalog) &&
      /export const GLOBAL_TOKENS/.test(colorCatalog),
    'Un token sin cssVar sería una opción decorativa sin efecto.'
  );
  check(
    'La vista previa es inmediata y no muta el borrador guardado',
    /aparTransientColor = \{ scope: aparScope, key: tok\.key, value: v, deviceKey \}/.test(adminApp) &&
      /onPreview\(v\)/.test(adminApp),
    'El preview debe mostrarse sin escribir el cambio hasta confirmar.'
  );
  check(
    'Apariencia tiene guardia de cambios sin guardar',
    /function aparHasPending/.test(adminApp) &&
      /aparRegisterUnsavedGuard/.test(adminApp),
    'Salir con cambios sin guardar debe avisar.'
  );
  check(
    'La apariencia soporta overrides por dispositivo (breakpoints)',
    /DEVICE_BREAKPOINTS/.test(colorScheme) &&
      /deviceOverrideEnabled/.test(colorScheme) &&
      /deviceOverrides/.test(colorScheme),
    'La configuración por dispositivo debe aplicarse según el breakpoint real.'
  );
  check(
    'El esquema global se sincroniza en tiempo real (onSnapshot)',
    (colorScheme.match(/onSnapshot\(/g) || []).length >= 2 &&
      /doc\(db, 'colorSchemes', schemeId/.test(colorScheme) &&
      /APPEARANCE_DOC/.test(colorScheme),
    'Un cambio de esquema debe reflejarse sin recargar.'
  );
  check(
    'Ante un error de lectura del esquema se conserva lo último aplicado',
    /No se pudo cargar el esquema activo; se mantiene el último aplicado\/cacheado/.test(colorScheme) &&
      /markColorSchemeReady\('scheme-read-error'\)/.test(colorScheme),
    'Un fallo de carga no debe dejar la página sin colores ni bloqueada.'
  );
  check(
    'Guardar apariencia escribe en la colección de esquemas',
    /setDoc\(doc\(db, 'colorSchemes', schemeId\)/.test(adminApp),
    'El guardado debe persistir en colorSchemes, la fuente que lee el público.'
  );

  // ===========================================================================
  // 4. FIRESTORE RULES — escritura protegida
  // ===========================================================================
  check(
    'Solo el Super Admin escribe settings/appearance',
    /match \/settings\/appearance \{[\s\S]{0,80}allow write: if isSuperAdmin\(\)/.test(rules),
    'La apariencia global no debe poder cambiarla otro rol.'
  );
  check(
    'Solo el Super Admin crea/edita/borra esquemas de color',
    /match \/colorSchemes\/\{schemeId\}[\s\S]{0,140}allow create, update, delete: if isSuperAdmin\(\)/.test(rules),
    'Los esquemas de color son exclusivos del Super Admin.'
  );
  check(
    'El contenido del sitio está acotado por rol/permiso (no libre)',
    /match \/site_content\/\{pageId\}[\s\S]{0,220}isSuperAdmin\(\) \|\|[\s\S]{0,220}currentRolePermAllows\('contenido', 'editarTextos'\)/.test(rules),
    'Editar contenido debe requerir Super Admin o el permiso dinámico de contenido.'
  );

  const failed = checks.filter(item => !item.ok);
  checks.forEach(item => {
    console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
    if (!item.ok) console.log(`  ${item.problem}`);
  });

  if (failed.length) {
    console.error(`\nAuditoría de contenido/apariencia fallida: ${failed.length} problema(s).`);
    process.exit(1);
  }

  console.log(`\nAuditoría de contenido/apariencia completada correctamente (${checks.length} comprobaciones).`);
}

main().catch(error => {
  console.error('ERROR — No se pudo cargar la fachada canónica de contenido.', error);
  process.exit(1);
});
