'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function check(name, condition, problem) {
  checks.push({ name, ok: Boolean(condition), problem });
}

const runtime = read('js/phase8-ui-ux.js');
const styles = read('css/phase8-ui-ux.css');
const loader = read('js/page-loader.js');
const packageJson = JSON.parse(read('package.json'));
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));

check(
  'El runtime de Fase 8 se carga una sola vez desde page-loader',
  /function bootPhase8UiUx/.test(loader) &&
    /importSibling\('phase8-ui-ux\.js'/.test(loader) &&
    /window\.TintinUX\?\.booted/.test(loader) &&
    (loader.match(/bootPhase8UiUx\(\);/g) || []).length === 2,
  'Público y páginas con guard propio deben compartir una sola instancia, sin reactivar ui-quality completo.'
);

check(
  'La hoja de estilos de UI/UX se inyecta de forma versionada',
  /tt-phase8-ui-ux-css/.test(loader) &&
    /resolveAsset\('css\/phase8-ui-ux\.css'\)/.test(loader) &&
    /tintin-20260730-phase8-ui-1/.test(loader),
  'El navegador debe recibir la nueva capa aunque tenga caché inmutable.'
);

check(
  'Todas las páginas HTML usan la nueva versión de page-loader',
  htmlFiles.every(file => {
    const html = read(file);
    return !html.includes('js/page-loader.js') || html.includes('js/page-loader.js?v=tintin-20260731-phase10-a11y-1');
  }),
  'No debe quedar una página cargando el runtime anterior.'
);

check(
  'Los controles reciben feedback visible para mouse, tacto y teclado',
  /pointerdown/.test(runtime) &&
    /pointerup/.test(runtime) &&
    /keydown/.test(runtime) &&
    /keyup/.test(runtime) &&
    /tt-is-pressed/.test(runtime) &&
    /:active:not\(:disabled\)/.test(styles),
  'El feedback no puede depender únicamente de hover.'
);

check(
  'Las operaciones asíncronas exponen estado ocupado y se recuperan',
  /export function setButtonBusy/.test(runtime) &&
    /aria-busy/.test(runtime) &&
    /data-tt-busy/.test(runtime) &&
    /BUSY_TIMEOUT_MS/.test(runtime) &&
    /La operación está tardando más de lo esperado/.test(runtime) &&
    /tintin:async-settled/.test(runtime),
  'Un botón ocupado debe informar, impedir duplicados y liberarse incluso ante una espera excesiva.'
);

check(
  'Los formularios inválidos nunca quedan bloqueados',
  /form\.checkValidity\(\)/.test(runtime) &&
    /document\.addEventListener\('invalid'/.test(runtime) &&
    /releaseFormButtons/.test(runtime),
  'La validación nativa debe restaurar cualquier submit marcado como ocupado.'
);

check(
  'Existe una API segura para carga, error, vacío, éxito e información',
  /export function renderState/.test(runtime) &&
    /\['loading', 'error', 'empty', 'success', 'info'\]/.test(runtime) &&
    /container\.replaceChildren\(\)/.test(runtime) &&
    /textContent = title/.test(runtime) &&
    !/container\.innerHTML/.test(runtime),
  'Los estados deben crearse con DOM seguro y una estructura consistente.'
);

check(
  'Errores y estados normales usan roles y live regions apropiados',
  /state === 'error' \? 'alert' : 'status'/.test(runtime) &&
    /state === 'error' \? 'assertive' : 'polite'/.test(runtime) &&
    /tt-ux-live-region/.test(runtime),
  'El feedback visual también debe anunciarse a lectores de pantalla.'
);

check(
  'Los estados dinámicos existentes se mejoran sin reemplazar su contenido',
  /MutationObserver/.test(runtime) &&
    /STATE_SELECTOR/.test(runtime) &&
    /classList\.add\('tt-state-surface'/.test(runtime) &&
    /querySelectorAll\('button,a'\)/.test(runtime),
  'La capa debe ser progresiva y compatible con estados ya renderizados por cada módulo.'
);

check(
  'Los estados visuales siguen la identidad de Tintin',
  /--color-brand-primary/.test(styles) &&
    /--tt-page-bg/.test(styles) &&
    /--color-brand-primary-hover/.test(styles) &&
    /tt-state-error/.test(styles) &&
    /tt-state-empty/.test(styles) &&
    /tt-state-success/.test(styles),
  'Carga, error y vacío deben compartir tipografía, radios, sombras y color de marca.'
);

check(
  'Las animaciones usan duraciones y curva comunes',
  /--tt-motion-fast/.test(styles) &&
    /--tt-motion-normal/.test(styles) &&
    /--tt-motion-ease/.test(styles) &&
    /cubic-bezier/.test(styles),
  'Las transiciones no deben variar arbitrariamente entre componentes.'
);

check(
  'Movimiento reducido elimina desplazamientos y shimmer',
  /@media \(prefers-reduced-motion: reduce\)/.test(styles) &&
    /transform: none !important/.test(styles) &&
    /tt-skeleton::after[\s\S]*display: none !important/.test(styles),
  'La preferencia de movimiento reducido debe conservar información sin animación decorativa.'
);

check(
  'Las imágenes fallidas muestran una explicación accesible',
  /tt-img-error-label/.test(runtime) &&
    /No pudimos cargar la imagen de/.test(runtime) &&
    /role', 'status'/.test(runtime) &&
    /\.tt-img-error-label/.test(styles),
  'Una imagen rota no debe quedar como un bloque opaco sin explicación.'
);

check(
  'La Fase 8 tiene auditoría estática y prueba de navegador dedicadas',
  packageJson.scripts['audit:phase8-ui'] === 'node scripts/audit-phase8-ui-ux.js' &&
    packageJson.scripts['test:phase8-ui'] === 'playwright test tests/ui-ux --project=chromium' &&
    packageJson.scripts['audit:final'].includes('audit:phase8-ui'),
  'La capa UI/UX debe quedar protegida contra regresiones.'
);

const failed = checks.filter(item => !item.ok);
checks.forEach(item => {
  console.log(`${item.ok ? 'OK' : 'ERROR'} — ${item.name}`);
  if (!item.ok) console.log(`  ${item.problem}`);
});

if (failed.length) {
  console.error(`\nAuditoría Fase 8 fallida: ${failed.length} problema(s).`);
  process.exit(1);
}

console.log(`\nAuditoría Fase 8: UI/UX correcta (${checks.length} comprobaciones).`);
