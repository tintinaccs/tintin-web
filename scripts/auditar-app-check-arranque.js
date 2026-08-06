'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const moduleFiles = fs.readdirSync(path.join(root, 'js'))
  .filter(file => file.endsWith('.js'))
  .map(file => `js/${file}`);

const loader = read('js/cargador-pagina.js');
const firebase = read('js/core/firebase/firebase.js');
const storeGate = read('js/core/store-gate/nucleo-control-tienda.js');
const storeGateRuntime = read('js/core/store-gate/control-tienda.js');
const activity = read('js/analytics/actividad-sitio.js');
const analytics = read('js/analytics/analitica.js');
const images = read('js/components/images/imagenes.js');
const publicSettings = read('js/core/store/configuracion-publica.js');
const products = read('js/core/store/estado-productos.js');
const collections = read('js/pages/collections/estado-colecciones.js');
const siteContent = read('js/core/store/contenido-sitio.js');
const index = read('index.html');
const allRuntime = [...htmlFiles, ...moduleFiles].map(read).join('\n');

const checks = [
  [
    'GitHub Pages redirige al origen público antes de inicializar la aplicación',
    loader.indexOf("window.location.hostname === 'tintinaccs.github.io'") <
      loader.indexOf('if (window.TintinLoader) return') &&
      loader.includes("'https://tintinaccesorios.pages.dev'") &&
      loader.includes('window.location.replace(')
  ],
  [
    'El origen público nunca se trata como host técnico',
    !loader.includes('technicalCloudflareHost') &&
      !loader.includes('window.TintinAbortAppBootstrap') &&
      !firebase.includes('TECHNICAL_CLOUDFLARE_HOST') &&
      !firebase.includes('APP_BOOT_ABORTED')
  ],
  [
    'App Check Enterprise obtiene un primer token antes del refresco automático',
    firebase.includes("6LdhrGAtAAAAAIPJJ2nTT9300Vor--Wlq0PRCP9m") &&
      firebase.includes('ReCaptchaEnterpriseProvider') &&
      firebase.includes('new ReCaptchaEnterpriseProvider(FIREBASE_APP_CHECK_SITE_KEY)') &&
      !firebase.includes('ReCaptchaV3Provider') &&
      firebase.includes('isTokenAutoRefreshEnabled: false') &&
      firebase.includes('getAppCheckToken(appCheck, false)') &&
      firebase.includes('setTokenAutoRefreshEnabled(appCheck, true)')
  ],
  [
    'El estado público solo marca App Check activo después del token',
    firebase.indexOf("window.TintinAppCheckStatus = 'enabled'") >
      firebase.indexOf('getAppCheckToken(appCheck, false)')
  ],
  [
    'El control de tienda espera la certificación del origen',
    storeGate.includes('if (!await appCheckReady)') &&
      storeGate.indexOf('if (!await appCheckReady)') < storeGate.indexOf("let primaryStatus = 'missing'") &&
      storeGateRuntime.includes('const appCheckAvailable = await appCheckReady') &&
      storeGateRuntime.indexOf('const appCheckAvailable = await appCheckReady') <
        storeGateRuntime.indexOf('onSnapshot(')
  ],
  [
    'Una falla transitoria usa un solo modo consulta, nunca otra ventana modal',
    storeGateRuntime.includes("publishState('degraded')") &&
      loader.includes("state === 'allowed' || state === 'degraded'") &&
      storeGate.includes("classList.add('tt-store-gate-degraded')") &&
      storeGate.includes('tt-store-gate-network-notice') &&
      loader.includes('__TintinEmergencyDegradedGuardBound')
  ],
  [
    'El modo consulta bloquea únicamente el paso crítico de compra',
    storeGate.includes('a[href*="checkout"]') &&
      storeGate.includes('.tt-cart-checkout-btn') &&
      storeGate.includes('__TintinStoreGateDegradedGuardBound')
  ],
  [
    'La presencia no escribe sin App Check',
    activity.includes('const appCheckAvailable = await appCheckReady') &&
      (
        activity.includes('window.TINTIN_ENABLE_PUBLIC_ACTIVITY === true &&\n  appCheckAvailable') ||
        activity.includes('window.TINTIN_ENABLE_PUBLIC_ACTIVITY !== true || !appCheckAvailable')
      )
  ],
  [
    'La presencia corta los reintentos ante rechazos permanentes',
    activity.includes('PERMANENT_WRITE_ERROR_CODES') &&
      activity.includes('stopAfterPermanentWriteError') &&
      activity.includes("stopAfterPermanentWriteError(error, 'actualizar la presencia')") &&
      activity.includes('analyticsWritable = false') &&
      activity.includes('stopActivity();') &&
      activity.includes('permanentWriteErrorCode')
  ],
  [
    'Los lectores públicos no encadenan errores si App Check falla',
    analytics.includes('if (!await appCheckReady)') &&
      images.includes('if (!await appCheckReady)') &&
      publicSettings.includes('appCheckReady.then(ready =>') &&
      products.includes('if (!await appCheckReady)') &&
      collections.includes('if (!await appCheckReady)') &&
      siteContent.includes('appCheckReady.then(ready =>')
  ],
  [
    'Todos los consumidores usan una sola versión de Firebase',
    !allRuntime.includes('firebase.js?v=tintin-20260716-cloudinary-fix-1') &&
      allRuntime.includes('firebase.js?v=tintin-20260730-appcheck-stable-4')
  ],
  [
    'Todas las páginas fuerzan el loader corregido',
    htmlFiles.every(file =>
      read(file).includes('cargador-pagina.js?v=tintin-20260801-unified-surfaces-16')
    )
  ],
  [
    'La portada no precarga dos veces la hoja principal',
    !/<link[^>]+rel=["']preload["'][^>]+href=["']styles\.css/i.test(index)
  ]
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FALTA'} — ${label}`);
  if (!ok) failures += 1;
}

if (failures) {
  console.error(`\nAuditoría de arranque App Check: ${failures} fallo(s).`);
  process.exit(1);
}

console.log('\nAuditoría de arranque App Check completada correctamente.');
