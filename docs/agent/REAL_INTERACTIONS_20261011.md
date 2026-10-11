# Interacciones reales — 2026-10-11

Codex /root, GPT-6. Base `ac7e394874d2668dd8e0ba505f1a9340cf6bc84c`. El usuario confirmó el fallo en correo normal y autorizó completar checks y merge tras validar. Este informe no renueva sellos históricos de producción.

## Resultado por función

| FUNCIÓN | FUNCIONABA REALMENTE | ERROR DETECTADO | CORRECCIÓN APLICADA | PRUEBA FINAL | ESTADO |
| --- | --- | --- | --- | --- | --- |
| Login, «Continuar» | No en la composición reproducida | HIGH: filtro global de 320 ms cancela el clic interno después del guard asíncrono; no llega al handler/API | Filtrar duplicados sólo en pulsaciones humanas (`isTrusted`); conservar bloqueo de dobles pulsaciones | Regresión falla antes; dos pruebas de eventos pasan después; suite completa verifica HTTP, perfil persistido y navegación | PASS emulado en tres proyectos; publicación pendiente |
| Login móvil pequeño | No: banner intercepta pulsaciones | HIGH: privacidad automática fija tapa el botón en pantallas bajas | Diferir aviso automático durante `/login`; estadísticas siguen desactivadas y preferencias manuales disponibles | Traza previa muestra interceptación; suite toca el botón en 320 × 568 y comprueba persistencia | PASS emulado en tres proyectos |
| Alta canónica del perfil | No cuando dos módulos crean simultáneamente | HIGH: segundo `setDoc` rechaza sobrescribir el contrato de identidad y la reparación conserva un error aunque el perfil ya existe | Ante rechazo, releer documento persistido; sólo continuar si existe. Si sigue ausente, conservar el error | Prueba ejecutable falla antes y pasa después; error de permisos sin documento sigue rechazado | PASS regresión y alta completa emulada |
| Producto / fixture de CI | HTML SEO pasaba aunque hidratación fallaba | MEDIUM: lista sin envoltorio `{id,data}` y colección/categoría ausente | Fixture con contrato real y colección visible; test exige nombre/precio hidratados y compra deshabilitada sin stock | Playwright de producto final PASS | PASS_LOCAL, fixture; no es un defecto confirmado del catálogo publicado |
| Selección de entorno de pruebas | Podía mezclar origen local y producción | MEDIUM: helper de rendimiento ignoraba `PLAYWRIGHT_BASE_URL`, mientras configuración y spec lo aceptaban | Respetar la misma variable cuando no existe `PERF_BASE_URL`; auditor ejecuta defaults, override compartido y prioridad PERF en procesos aislados | Prueba anterior esperaba header local pero navegaba a producción; final verifica header local e hidratación. Auditor antiguo rechazó cadena textual nueva; validación ejecutable comprueba los tres entornos | PASS_LOCAL |
| Código OTP inválido | Rechaza en servicio real emulado | Sin defecto nuevo | Conservar validación; comprobar recuperación y código correcto | Handler original HTTP 400 → error visible → HTTP 200 → Auth real emulado | PASS emulado en tres proyectos |
| Desconexión y reintento | Comprobado en Chromium antes de ampliar | Sin defecto nuevo | Conservar datos y guardas; probar offline/online y envío por Enter | Error visible, botón habilitado, reintento y perfil activo persistido | PASS emulado en tres proyectos |
| Teléfono ocupado / cuenta bloqueada | Servicios rechazan sin activar perfil | Sin defecto nuevo | Conservar permisos y reservas | API y reglas reales emuladas; error visible y documento sin activación | PASS emulado en tres proyectos |
| Producto → carrito → checkout | Avance afectado por el mismo filtro de clics | HIGH: guard de checkout también reemite clic | Corrección del filtro compartido | Producto desde HTTP, cantidad 1 en carrito, checkout muestra ítem y panel siguiente activo | PASS emulado en tres proyectos |
| Cuenta de cliente | No guardaba nombres válidos; botón fuera del panel editable | HIGH: consumidor desestructura `first/last`, pero el helper devuelve `firstName/lastName`; rechaza todo nombre. Tras corregirlo, envía teléfono local incompatible con la reserva E164 y Firestore deniega el guardado. MEDIUM: Guardar oculto en Cuenta y seguridad | Leer campos reales del helper, normalizar el teléfono a E164 y mover el botón a Mis datos; conservar validación y permisos | Regresiones DOM/contrato antes FAIL y después PASS; suite exige guardado en Firestore y recarga | PASS guardado/recarga emulado en tres proyectos |
| Acceso administrativo / roles | Permisos de datos comprobados | Sin defecto nuevo | Conservar reglas y App Check; no simular aprobación de seguridad | Escalación `role:admin` rechazada por Firestore; App Check no emulado mantiene panel privado cerrado y muestra estado recuperable | PASS emulado en tres proyectos; CRUD admin autenticado NO VERIFICADO |
| Navegación rápida producto → checkout | Filtraba una promesa de arranque sin consumidor | MEDIUM: import del controlador cancelado al cambiar de documento deja rechazo sin manejar | Observar la promesa de arranque, conservar log/evento de fallo y rechazo original para consumidores | Regresión Node antes FAIL/después PASS; suite de página completa exige cero excepciones/rechazos reales | PASS regresión y recorrido emulado en tres proyectos |
| Sidebar administrativo | Interacción pasaba; captura fallaba | LOW: escritura absoluta en `/outputs` inexistente | Guardar capturas con `testInfo.outputPath` | 11/11 PASS | PASS_LOCAL de UI aislada |
| Compra final, pagos, correos externos, historial comercial | No comprobados de extremo a extremo en esta sesión | No hay cuentas/credenciales sandbox de proveedores ni sesión admin autorizada disponibles en el entorno | Conservar implementación y pruebas de contratos; no fabricar compras ni entregas | 466 pruebas de dominio y 46 de servidor/seguridad pasan; no sustituyen una compra real sandbox | NO VERIFICADO de extremo a extremo |

## Por qué los checks anteriores no detectaban el fallo

Se inspeccionaron las 52 specs Playwright existentes, configuración compartida y workflows. Inventario individual en [evidencia](evidence/real-interactions-20261011/playwright-inventory.json). 20 specs extraen fragmentos del runtime, 37 usan `page.route`, nueve contienen esperas temporales y una tiene un skip condicionado al entorno preview. Estas cifras describen aislamiento, no convierten todos esos tests en incorrectos. 31 aparecen explícitamente en workflows; las otras 21 no se consideran ejecutadas por deducción: algunas pueden llegar mediante scripts npm, y deben cotejarse con logs concretos.

`profile-availability-recovery.spec.js` extrae el formulario del login y reemplaza dependencias. `google-loader-recovery.spec.js` prueba un segmento de acceso. Verifican casos útiles, pero omiten el filtro global y la capa de privacidad que coexistían en la página completa. La ficha local de rendimiento volvía después de verificar HTML SEO, antes de comprobar hidratación. El CI base `38100080999` estaba verde con esa cobertura; verde no demuestra la composición ausente.

Se conservan los tests útiles y se agrega `test:critical-runtime` a `audit:login-profile`, invocado por `audit:final` en Repository audit. Configuración independiente con un worker, cero retries y tres motores/proyectos. No usa `force`, esperas artificiales ni salta casos. Espera DOM y luego resultados visibles/HTTP/persistencia; la descarga de recursos auxiliares no determina que un flujo haya terminado.

## Entornos y límites

Producción pública y base de Git coinciden al comenzar: fingerprint `d3b6fb83b493ec592c94cf6d532d63b12707b3ee359e4428b28fa8579201a8f7`, Pages asociado al commit base y CI base success. Se consultaron manifiesto y pantalla de login sin enviar correo real. El candidato debe completar CI/preview y, tras merge, cotejar de nuevo el manifiesto publicado.

El host de pruebas sirve HTML, CSS y módulos completos del repositorio, SDK Firebase oficial 10.14.1 (bytes sin modificar descargados una vez por el host de prueba y servidos al mismo URL de módulo; caché local opcional de bytes registrados en trazas oficiales con versión, URL y SHA-256 verificados), Auth Emulator y Firestore Emulator con las reglas originales. Envío/verificación OTP y disponibilidad de teléfono usan handlers de producción; sólo se inyectan adaptadores de servicios de prueba. La entrega de correo es un buzón local y el custom token sin firma es exclusivo del Auth Emulator. App Check no tiene emulador: su indisponibilidad real debe cerrar el admin; no se atribuye PASS a reCAPTCHA, Google OAuth ni CRUD privado. La API de catálogo local lee documentos reales del emulador con el contrato público; no valida despliegue edge. Historial comercial y notificaciones auxiliares no están implementados en ese host y responden 404, no éxitos ficticios.

Toda conexión accidental a Firestore/Auth/APIs de producción se aborta y hace fallar la suite. Reset y seeds se limitan al proyecto `demo-tintin-interactions`. No se envían compras, pagos ni correos externos. Resend, Apps Script, PayPal, Cloudinary autenticado y dispositivos físicos requieren sus entornos y accesos correspondientes.

Chrome Desktop (binario Chromium disponible), Chromium Mobile Pixel 7 y WebKit Mobile iPhone 13 son pruebas emuladas. Los dos proyectos móviles también prueban login en 320 × 568; los demás casos usan sus dimensiones nativas. No se presenta esto como prueba en todos los teléfonos físicos. WebKit local utiliza librerías del sistema extraídas en un directorio temporal porque el usuario del entorno no dispone de instalación root; corre el motor real. CI instala sólo el navegador faltante y sus librerías si es necesario, sin reinstalar node_modules ni Chromium.

El reporte HTML se genera fuera del árbol fuente en un directorio temporal y se conserva como ZIP en artifacts para no mezclar CSS del visor de terceros con el código de la tienda en auditorías de tipografía. Se conserva el auditor sin excepciones nuevas.

## Evidencia y reproducción

- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node --test tests/login/*.test.mjs tests/profile/*.test.mjs tests/navigation/controller-bootstrap.test.mjs`: 162/162 PASS. Regresiones de ubicación de Guardar, contrato de nombres, teléfono E164 y rechazo del bootstrap fallan antes y pasan después.
- Dominio accounts/auth/login/checkout/payments/cart/orders: 466/466 PASS. Servidor/seguridad/mantenimiento: 46/46 PASS.
- Regresiones browser anteriores: 81 casos de interacción PASS y cinco capturas fallaron por ruta absoluta; después de corregirla sidebar 11/11 PASS. No se atribuye PASS a la ejecución que falló.
- Producto con origen local y proxy del entorno: 1/1 PASS con hidratación y stock final comprobados.
- CI `38109567474` del candidato `67f7c7f`: 14 casos PASS (primeros siete en Chromium Desktop y Mobile), 10 FAIL. Las trazas identifican WebKit bloqueando el puerto 4190 reservado y la prueba de cuenta esperando un banner que el aviso de red oculta. Se cambia el host a 4174 y se comprueba directamente la edición de cuenta. Esta revisión encuentra además el botón Guardar en un panel distinto y lo corrige. La corrida fallida se conserva como evidencia; no se presenta como PASS.
- CI `38110771584` de `dedc45b`: 16 PASS y 8 FAIL. Cuenta rechaza nombre válido por contrato incorrecto del consumidor. En WebKit las operaciones y resultados de login/checkout/permiso llegaron, pero el SDK emitió errores Fetch de control de acceso al cerrar canales del emulador durante navegación; no se ignoran. El diagnóstico nativo de WebKit ocurrió al cancelar canales del emulador durante navegación y no emitió ErrorEvent ni unhandledrejection de JavaScript (traza de calibración conservada). Se registra sólo ese caso exacto: tipo nativo, origen 127.0.0.1:8080, SDK 10.14.1, proyecto demo, canales Listen/Write y evento beforeunload/pagehide en el último segundo. Fuera de ese caso, pageerror falla. ErrorEvent y unhandledrejection siempre fallan aunque el mensaje se parezca a una cancelación. Se conservan transporte y origen originales del SDK; no se desactiva seguridad ni se alteran respuestas del emulador. Tres pruebas de calibración inyectan excepciones y promesas no capturadas y exigen que el monitor las detecte. La suite contiene 24 flujos completos más esas tres calibraciones.
- `npm run test:critical-runtime`: **27/27 PASS, cero retries** (24 flujos completos + tres calibraciones), corrida final local en `artifacts/real-interactions/runtime-complete-final.log`. Chrome Desktop, Chromium Mobile Pixel 7 y WebKit Mobile iPhone 13: nueve casos cada uno. Se conserva el SDK oficial registrado por CI, comprobando URL/versión/SHA-256 antes de usar su caché por indisponibilidad de CDN en el executor. Auth y Firestore usan sus emuladores reales y reglas originales. Capturas de login y perfil después de recargar, JSON, HTML comprimido y trazas previas en `artifacts/real-interactions/`. No se atribuye PASS a corridas anteriores que fallaron.
- CI `38112619141` de `6e1def9`: 27/27 runtime PASS; auditor posterior de Fase 5 falló por exigir una cadena textual antigua. Se reemplaza por ejecución del helper: origen canónico por defecto, override Playwright y prioridad PERF. No se cambia ningún presupuesto ni requisito de rendimiento.
- Build Pages, cache (316 archivos/64 cargas), arquitectura y protección local PASS. Plan exacto: 38 archivos protegidos, 34 registros. Estado del SHA final en [checks del PR #1095](https://github.com/tintinaccs/tintin-web/pull/1095/checks); el mantenimiento requiere revisión manual del propietario sobre el SHA exacto, según `MANTENIMIENTO_FLUJOS.md`.

## Inventario por spec existente

| Spec | CI explícito | Rutas simuladas | Runtime extraído | Esperas | Skip condicionado |
| --- | --- | ---: | --- | ---: | --- |
| tests/cart/color-choice-browser.spec.js | no | 2 | sí | 0 | no |
| tests/cart/quantity-browser.spec.js | sí | 1 | sí | 0 | no |
| tests/catalog/master-presentation.spec.js | no | 3 | no | 0 | no |
| tests/checkout/coupon-recovery.spec.js | sí | 2 | sí | 0 | no |
| tests/checkout/invoice-ui.spec.js | no | 1 | sí | 0 | no |
| tests/checkout/login-required-browser.spec.js | sí | 1 | sí | 0 | no |
| tests/checkout/navigation-responsive.spec.js | sí | 8 | sí | 0 | no |
| tests/checkout/saved-identity.spec.js | no | 1 | sí | 0 | no |
| tests/checkout/shipping-page-runtime.spec.js | no | 4 | no | 0 | no |
| tests/login/google-loader-recovery.spec.js | sí | 2 | sí | 0 | no |
| tests/login/location-map-browser.spec.js | no | 2 | sí | 0 | no |
| tests/login/profile-availability-recovery.spec.js | sí | 4 | sí | 0 | no |
| tests/login/saved-address-map-browser.spec.js | no | 2 | sí | 0 | no |
| tests/navigation/collection-menu-parity.spec.js | sí | 2 | no | 0 | no |
| tests/navigation/header-responsive.spec.js | sí | 2 | no | 0 | no |
| tests/navigation/live-activity-notices.spec.js | sí | 0 | no | 0 | no |
| tests/navigation/loader-shell-wait.spec.js | sí | 5 | no | 0 | sí |
| tests/navigation/master-home.spec.js | no | 0 | no | 0 | no |
| tests/navigation/mobile-halo-checkout-labels.spec.js | no | 1 | sí | 0 | no |
| tests/navigation/mobile-navigation-front.spec.js | no | 2 | no | 0 | no |
| tests/navigation/public-initial-layout.spec.js | sí | 2 | no | 1 | no |
| tests/navigation/whatsapp-fixed.spec.js | no | 1 | sí | 0 | no |
| tests/operations/central-loader-ui.spec.js | sí | 2 | no | 0 | no |
| tests/operations/loader-palette.spec.js | sí | 2 | no | 1 | no |
| tests/performance/admin.performance.spec.js | sí | 0 | no | 1 | no |
| tests/performance/offline-recovery.spec.js | sí | 0 | no | 0 | no |
| tests/performance/product.performance.spec.js | sí | 0 | no | 0 | no |
| tests/performance/public-pages.performance.spec.js | sí | 0 | no | 0 | no |
| tests/performance/realtime-sync.spec.js | sí | 0 | no | 1 | no |
| tests/performance/responsive-performance.spec.js | sí | 0 | no | 0 | no |
| tests/profile/account-wholesale-sync.spec.js | sí | 3 | sí | 0 | no |
| tests/profile/initial-profile-render.spec.js | sí | 2 | no | 0 | no |
| tests/profile/wholesale-session-recovery.spec.js | sí | 1 | sí | 0 | no |
| tests/seo/phase11-seo.spec.js | sí | 0 | no | 0 | no |
| tests/ui-ux/admin-commerce-shopify.spec.js | no | 12 | no | 0 | no |
| tests/ui-ux/admin-sidebar-interaction.spec.js | sí | 2 | no | 0 | no |
| tests/ui-ux/admin-white-icons.spec.js | sí | 4 | no | 0 | no |
| tests/ui-ux/import-identity-review.spec.js | sí | 3 | no | 0 | no |
| tests/ui-ux/inventory-reservation-review.spec.js | sí | 1 | sí | 0 | no |
| tests/ui-ux/phase10-accessibility.spec.js | sí | 0 | no | 0 | no |
| tests/ui-ux/phase8-ui-ux.spec.js | sí | 2 | no | 0 | no |
| tests/ui-ux/product-card-colors.spec.js | no | 3 | sí | 0 | no |
| tests/ui-ux/product-color-gallery.spec.js | no | 15 | sí | 0 | no |
| tests/ui-ux/product-first-paint.spec.js | no | 1 | no | 0 | no |
| tests/ui-ux/product-review-rating-required.spec.js | no | 0 | no | 0 | no |
| tests/ui-ux/product-small-controls.spec.js | sí | 4 | no | 0 | no |
| tests/ui-ux/public-spacing-product.spec.js | sí | 4 | no | 0 | no |
| tests/ui-ux/whatsapp-feedback-responsive.spec.js | no | 4 | sí | 0 | no |
| tests/visual-builder/apariencia-preview-abajo.spec.js | no | 0 | no | 0 | no |
| tests/visual-builder/visual-builder-runtime.spec.js | no | 0 | no | 1 | no |
| tests/visual-builder/visual-builder-ui.spec.js | no | 0 | sí | 2 | no |
| tests/visual-builder/visual-studio-v2-runtime.spec.js | no | 0 | no | 2 | no |
