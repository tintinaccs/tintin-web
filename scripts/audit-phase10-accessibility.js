'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
function check(name, condition, problem) { checks.push({ name, ok: Boolean(condition), problem }); }

const runtime = read('js/quality/phase10-accessibility.js');
const css = read('css/quality/phase10-accessibility.css');
const loader = read('js/quality/phase8-ui-ux.js');
const gate = read('js/core/store-gate/nucleo-control-tienda.js');
const page404 = read('404.html');
const privacy = read('privacidad.html');
const pkg = JSON.parse(read('package.json'));
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));

check('La Fase 10 se inicia desde el runtime compartido', /phase10-accessibility\.js/.test(loader) && /TintinPhase10ImportStarted/.test(loader), 'Debe cargarse una sola vez en todas las páginas que usan page-loader.');
check('Todas las páginas usan la versión de caché de Fase 10', htmlFiles.every(file => !read(file).includes('js/cargador-pagina.js') || read(file).includes('js/cargador-pagina.js?v=tintin-20260801-unified-surfaces-16')), 'No debe quedar una página con el loader anterior.');
check('Existe enlace para saltar al contenido', /ensureSkipLink/.test(runtime) && /Saltar al contenido principal/.test(runtime) && /tt-skip-link/.test(css), 'La navegación por teclado debe poder evitar cabeceras repetidas.');
check(
  'Los controles personalizados funcionan con teclado',
  /getAttribute\('role'\) === 'button'/.test(runtime) &&
    /isKeyboardActivation/.test(runtime) &&
    /key === 'Enter'/.test(runtime) &&
    /(?:key === ' '|event\.code === 'Space'|key === 'Spacebar')/.test(runtime) &&
    /control\.click\(\)/.test(runtime),
  'Un role=button debe responder a Enter y Espacio.'
);
check('Los diálogos atrapan y restauran el foco', /FOCUSABLE_SELECTOR/.test(runtime) && /event\.key !== 'Tab'/.test(runtime) && /returnFocus/.test(runtime) && /focusin/.test(runtime), 'Ningún modal debe dejar que el foco escape o perder el punto de retorno.');
check('Los formularios anuncian errores sin bloquearse', /bindInvalidFeedback/.test(runtime) && /aria-invalid/.test(runtime) && /revisá este dato/.test(runtime), 'El primer campo inválido debe recibir foco y un aviso accesible.');
check('El estado sin conexión es informativo y recuperable', /tt-connectivity-status/.test(runtime) && /window\.addEventListener\('offline'/.test(runtime) && /Reintentar/.test(runtime) && !/aria-modal[^\n]+tt-connectivity/.test(runtime), 'La pérdida temporal de red no debe crear un bloqueo permanente.');
check('WhatsApp e iconos pueden recibir nombre accesible', /Abrir WhatsApp de Tintin/.test(runtime) && /inferControlLabel/.test(runtime), 'Los controles sin texto no deben quedar anónimos para lectores de pantalla.');
check('Foco, contraste, tacto y movimiento tienen estilos inclusivos', /:focus-visible/.test(css) && /44px/.test(css) && /prefers-contrast: more/.test(css) && /forced-colors: active/.test(css) && /prefers-reduced-motion: reduce/.test(css), 'Debe existir una capa visible para teclado, alto contraste y áreas táctiles.');
check('La tienda cerrada conserva diálogo modal e inert', /role="dialog" aria-modal="true"/.test(gate) && /node\.inert = true/.test(gate) && /aria-hidden/.test(gate), 'El overlay de tienda cerrada debe aislar semánticamente el contenido de fondo.');
check('404 y privacidad siguen disponibles', /<h1\b/i.test(page404) && /(?:index\.html|href="\/")/.test(page404) && /<h1\b/i.test(privacy), 'La recuperación de 404 y la información de privacidad deben tener estructura visible.');
check('La auditoría y la prueba de navegador son permanentes', pkg.scripts['audit:phase10'] === 'node scripts/audit-phase10-accessibility.js' && pkg.scripts['test:phase10-a11y'] === 'playwright test tests/ui-ux/phase10-accessibility.spec.js --project=chromium' && pkg.scripts['audit:final'].includes('audit:phase10') && pkg.scripts['test:phase8-ui'] === 'playwright test tests/ui-ux/phase8-ui-ux.spec.js --project=chromium', 'Las Fases 8 y 10 deben conservar auditorías y suites de navegador dedicadas, sin ejecutarse por duplicado.');

const failed = checks.filter(item => !item.ok);
checks.forEach(item => { console.log((item.ok ? 'OK' : 'ERROR') + ' — ' + item.name); if (!item.ok) console.log('  ' + item.problem); });
if (failed.length) { console.error('\nAuditoría Fase 10 fallida: ' + failed.length + ' problema(s).'); process.exit(1); }
console.log('\nAuditoría Fase 10: accesibilidad y experiencia correctas (' + checks.length + ' comprobaciones).');
