'use strict';

/* =============================================================
   TINTIN — Auditoría de Contenido y Apariencia (panel + sitio público)

   Los editores de Contenido (Fase 6) y Apariencia (esquemas de color) ya tienen
   auditorías propias (audit-content-phase6.js, audit-color-scheme.js) que cubren
   el catálogo de tokens, el render seguro y la sanitización de enlaces. Esta
   auditoría fija las invariantes de seguridad y de "cada control produce un
   cambio real" que faltaban blindar de punta a punta:

   - El editor de contenido edita VALORES sobre un conjunto FIJO de páginas y
     selectores en código (no agrega/borra páginas ni inyecta HTML/CSS).
   - El sitio público aplica esos valores por selector real (cambio real) con
     nodos de texto y enlaces saneados.
   - La apariencia solo aplica al público valores que sean un color estricto
     (HEX/rgb/hsl) — enforcement en el punto donde Firestore/caché se vuelve CSS
     en vivo, para que NUNCA se aplique una URL peligrosa ni CSS arbitrario.
   - Vista previa inmediata sin mutar el borrador, guardia de cambios sin
     guardar, overrides por dispositivo y sincronización en tiempo real.
   - Firestore Rules: solo el Super Admin escribe apariencia/esquemas; el
     contenido queda acotado a Super Admin o al permiso dinámico de contenido.

   No abre navegador: comprobaciones estáticas sobre el código publicado.
   ============================================================= */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function read(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  return cache.get(file);
}

const checks = [];
function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const schema        = read('js/content-schema.js');
const siteContent   = read('js/site-content.js');
const adminContent  = read('js/admin-content-phase6.js');
const colorScheme   = read('js/color-scheme.js');
const colorInstant  = read('js/color-scheme-instant.js');
const colorCatalog  = read('js/color-scheme-catalog.js');
const adminApp      = read('js/admin-app.js');
const rules         = read('firestore.rules');

// ===========================================================================
// 1. EDITOR DE CONTENIDO — esquema fijo, valores no HTML
// ===========================================================================
check(
  'El contenido editable es un conjunto FIJO de páginas (sin agregar/borrar)',
  /export const CONTENT_PAGE_IDS = \[/.test(schema) &&
    /'index', 'nosotros', 'catalogo', 'collections'/.test(schema),
  'El editor edita páginas fijas por selector; no debe simular crear/eliminar páginas.'
);
check(
  'Los campos de contenido tienen un tope de longitud',
  /export const CONTENT_MAX_LENGTH = 4000/.test(schema) &&
    /maxLength: options\.maxLength \|\| CONTENT_MAX_LENGTH/.test(schema),
  'Un texto sin tope permitiría cargas abusivas.'
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
    /setAttribute\('href', safe\)/.test(siteContent),
  'Un href editable debe pasar por la lista segura de protocolos.'
);
check(
  'El editor de contenido escribe en la colección protegida site_content',
  /site_content/.test(adminContent),
  'El editor debe usar la colección con reglas, no un almacenamiento libre.'
);

// ===========================================================================
// 2. APARIENCIA — enforcement de color seguro en el apply público (F1)
// ===========================================================================
check(
  'El apply global solo aplica valores que sean un color estricto (HEX/rgb/hsl)',
  /function isSafeColorValue\(value\)/.test(colorScheme) &&
    /out\[token\.cssVar\] = value;/.test(colorScheme) &&
    /value != null && value !== '' && isSafeColorValue\(value\)/.test(colorScheme),
  'color-scheme.js debe validar el valor antes de setProperty (no URLs ni CSS arbitrario).'
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

// ---------------------------------------------------------------------------
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
