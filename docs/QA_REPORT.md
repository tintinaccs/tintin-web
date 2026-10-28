# QA — auditoría profesional local

Base:`5a2ea0f63`; rama:`audit/profesional-local-20261028`; ejecución28/10/2026
UTC. Node24.19.0 (package exige≥22; CI habitual usa22), Chromium del sistema,
Playwright del lockfile y Firebase CLI15.34.1. Java disponible para emuladores.
Resultados de esta sesión; no heredan PASS de CI, PRs ni informes anteriores.

Publicación solicitada después del cierre local:la titular autorizó auto-merge
y seguimiento. Los estados «no hubo push/merge/despliegue» más abajo describen
la ejecución local previa, no una prohibición vigente. La aprobación de GitHub
y la publicación requieren comprobar el PR/SHA/runs correspondientes aparte.

## Estado vigente al retomar la sesión

### Continuación:verificaciones pendientes ejecutadas

El28/10/2026 se reanudaron los pendientes sin cambiar código de aplicación:

| Comando | Resultado terminal verificado |
| --- | --- |
| `npm run test:rules-phone` | PASS;18controles en demo-tintin-phone, incluido rechazo de reserva/actualización ajena y operaciones legítimas |
| `npm run test:rules-username` | PASS;16controles en demo-tintin-username |
| `npm run test:rules-editor` | PASS;21controles de privacidad/sintaxis en demo-tintin-phase4; sin acceso directo a trabajo privado de otra identidad |
| `TT_SMOKE_PORT=4187 npm run test:pages` | PASS;18rutas, loaders, recursos, JavaScript, redirección legacy y navegación móvil/tablet/escritorio |
| `npm audit --json` |0vulnerabilidades informadas por npm; no incluye una auditoría de todos los SDK externos/configuración productiva |
| `node scripts/auditar-global-responsive-final.mjs` | PASS final:187/187combinaciones con el helper corregido;11rutas del shell público×17viewports. Producto/admin tienen sus matrices dedicadas |
| Lote administrativo Playwright | **620/620PASS,0omitidas,0fallidas,0flaky,0reintentos**;16archivos,2workers,18,6min. Incluye editor, variantes/stock/fotos, borradores, conflictos, guardado, permisos de UI y módulos del panel con fixtures |
| Regresiones de operaciones y rendimiento del auditor |140/140PASS, incluidas3pruebas nuevas de readiness/scroll. No sumar con las155anteriores como cobertura independiente |
| `npm run build` y `npm run ci:preflight` al cerrar esta continuación | PASS;39/39comandos preflight sin fallos, caché380/67 coherente y huellas protegidas sin desajustes |

Logs durables en `artifacts/professional/{rules-phone-final,rules-username-final,rules-editor-final,pages-final}.log`
y `npm-audit-final.json`. Los PERMISSION_DENIED esperados de los casos negativos
no son fallos de la suite. Algunas denegaciones alcanzan el límite de expresiones
de Rules; no representan aceptación de escrituras ni una certificación de todos
los tamaños legítimos posibles.

La matriz global posterior al arreglo y el lote administrativo620 ya tienen
resultado terminal. Se conservaron los mismos archivos/aserciones del lote
anterior y una salida aislada. El JSON en
`artifacts/professional/admin-ui-final.json` registra inicio2026-10-28T12:33:48UTC,
duración1118,2s y expected620/unexpected0/skipped0/flaky0.
`artifacts/global-responsive/report.json` registra la matriz187/187.
No se depende de conservar/tmp ni se afirma ejecución de CRUD productivo.

El primer intento global de esta continuación dio186/187:el pie de404en767px
se midió antes de terminar la navegación. Se reprodujo la carrera con una
imagen demorada:scrollY579durante interactive→0al resolver window.load.
El segundo intento que aún tenía el helper anterior se interrumpió, conservando
su log; no se lo registra como PASS. El auditor ahora espera load/frames y exige
llegar al final, sin tocar clases, diseño ni scroll del producto.

Tres regresiones nuevas del auditor fallaron antes del arreglo y pasaron después;
`node --test tests/operations/*.test.mjs tests/performance/*.test.mjs`:
140/140PASS. Evidencia:`footer-load-race.log`, `footer-audit-red.log`,
`footer-audit-green.log`, `auditor-regressions-final.log` en artifacts/professional.
La repetición del código final se registra aparte en `global-responsive-verified.log`.

Los fallos y la interrupción anteriores se conservan como historial, no como
fallos vigentes de esa matriz:la ejecución final del auditor corregido terminó
187/187sin recurrir a un reintento. El registro histórico artifacts/ci/browser.json
no se modifica manualmente para simular un stage completo aprobado:las dos
comprobaciones pendientes se ejecutaron por separado. Tampoco se afirma PASS_CI,
merge ni validación de una publicación.

Logs del cierre posterior a todas estas comprobaciones:
`artifacts/professional/build-complete.log` y `preflight-complete.log`.
`git diff --check` también PASS. Se termina el bloque automatizado local;
los criterios externos/manuales indicados al final no se declaran aprobados.

Perfil sintético adicional del editor, de la ejecución620(en runner compartido,
no INP de campo):

| Fotos | Apertura ms | Acción fotos ms | Color ms | Stock ms | Long tasks observadas ms |
| --- | --- | --- | --- | --- | --- |
| 2 |595,5|60,8|59,5|42,9|ninguna|
| 5 |735,7|128,9|84,7|79,5|92/69/69|
| 10 |907,1|86,8|80,5|28,1|86|
| 20 |773,4|108,3|96,3|107,5|97/50|

Se registran las tareas largas, no se promete cero lag ni60FPS permanentes.
Son cuatro casos sintéticos, no percentiles ni prueba de todas las fotos reales.

### Estado anterior a esta continuación

- El informe durable `artifacts/real-interactions/runtime-results.json`
  registra **51/51 PASS,0omitidas,0fallidas,0flaky**:los11flujos críticos y
  las6pruebas comerciales de carrito, en Chromium desktop/móvil y WebKit.
  Duración355,9s; inicio28/10/2026 04:08:27UTC. Se ejecutaron las aserciones
  originales, con Auth/Firestore emulados y Rules reales.
- La pasada amplia anterior de runtime terminó473PASS/1FAIL. Una repetición
  con SDK cacheados terminó48PASS/3FAIL. No se ocultan esos fallos:el resolver
  móvil de OAuth activaba gapi/iframes externos y las trazas muestran HTTP503.
  El harness de Custom Tokens ahora omite ese resolver sólo en la fuente de
  prueba; producción y los flujos Google conservan su configuración. Los
  tests rechazan accesos a apis.google.com para asegurar el aislamiento.
- La caché opcional canónica TINTIN_RUNTIME_SDK_CACHE usó los cuatro SDK
  oficiales10.14.1 capturados de respuestas200 de la misma sesión, con URLs
  y SHA256 verificados por el harness. No se sustituyeron por SDK simulados.
- Comercio/recuperación aislado:222/222PASS observadas en la sesión anterior.
  Las6pruebas de carrito se ejecutan además desde guest-cart-commerce.spec.js
  en el harness seguro, porque el CDN de App Check sin CORS bloqueaba el
  arranque en el servidor estático. No hubo compras ni correos reales.
- ci:browser NO está aprobado completo:14comandos pasaron, pero la auditoría
  global dio185/187 y186/187 en sus dos intentos; el último comando test:pages
  no llegó a ejecutarse. El recorrido canónico separado sí dio144/144.
- La auditoría global modificada para esperar el estado real del controlador
  (sin clics forzados ni cambiar clases manualmente) dio186/187:quedó un solape
  WhatsApp/privacidad en Colecciones430px. Se reprodujeron después dos causas:
  cambios de visibilidad en html y CSS tardío que mueve sin redimensionar.
  Ambas se corrigieron en tienda.js; nueva verificación dirigida **7/7PASS**,
  incluida la ausencia de mediciones por actualizaciones de tarjetas ajenas.
  La matriz global completa posterior a esta última corrección sigue pendiente.
- El lote administrativo de620casos estaba en ejecución; se observaron más
  de500aprobados, pero NO se conserva un resultado terminal en este informe.
  No declarar620PASS ni sumar ese lote como suite completada.

Al retomar, los procesos anteriores ya no estaban activos y los logs de/tmp
no estaban disponibles. Los documentos y artefactos dentro del repositorio sí
se conservaron. Las referencias antiguas a/tmp son evidencia de aquella
ejecución, no enlaces ahora disponibles. Nuevos logs/capturas dirigidos:
`artifacts/professional/wa-css-red.log`, `wa-final.log`, `node-final.log` y
`build-final.log`.

Cierre local efectivamente ejecutado tras la última corrección:

| Comprobación | Resultado |
| --- | --- |
| Regresiones del flotante | 7/7PASS, sin reintentos; el caso de CSS tardío falló antes del arreglo |
| Node de seguridad/cuentas/pagos/Functions y rendimiento | 155/155PASS |
| `npm run build` | PASS;19páginas,380recursos versionados y67cargas dinámicas coherentes |
| `npm run ci:preflight` | 39/39comandos PASS; no equivale a ci:browser/admin/rules completos |
| `git diff --check` | PASS |

El primer build de esta reanudación falló por una versión antigua de tienda.js
en el generador del shell. Se corrigió TIENDA_VERSION en la autoridad canónica,
se regeneraron consumidores y se repitió build correctamente. El plan protegido
actual contiene29archivos/57registros afectados contra la misma base; no aprueba
CI ni publicación. No hubo push, merge ni despliegue.

## Ampliación solicitada:ejecuciones de todas las áreas

Esta sección es la continuación de la primera etapa descrita más abajo. Los
resultados de build/preflight de esa primera etapa no aprueban automáticamente
los cambios de servidor/tests añadidos después:el cierre vigente debe repetirse.
No se publicaron, mergearon ni desplegaron los cambios.

| Verificación adicional | Resultado ejecutado |
| --- | --- |
| `node --test tests/admin/*.test.mjs tests/operations/*.test.mjs tests/import/*.test.mjs tests/security/*.test.mjs tests/system-health/*.test.mjs` | 467PASS/0FAIL/1SKIP; el caso Firestore del workspace exige emulador y se ejecuta por separado en runtime |
| `node --test tests/accounts/*.test.mjs tests/auth/*.test.mjs tests/cart/*.test.mjs tests/orders/*.test.mjs tests/checkout/*.test.mjs tests/payments/*.test.mjs tests/functions/*.test.mjs tests/engagement/*.test.mjs tests/analytics/*.test.mjs tests/public-commerce/*.test.mjs` | 590/590PASS; ejecutado tras cambio OTP y antes del cambio de clasificación HTTP |
| `node --test tests/security/*.test.mjs tests/accounts/*.test.mjs tests/payments/*.test.mjs tests/functions/*.test.mjs` | 139/139PASS después de los cambios de telemetría y siete adaptadores HTTP |
| `node --test tests/performance/*.test.mjs` | 16/16PASS; incluye2 regresiones nuevas del helper de espera del loader |
| `node scripts/auditar-acceso-perfil-incorporacion.js` y `node --test tests/login/*.test.mjs tests/profile/*.test.mjs tests/navigation/controller-bootstrap.test.mjs` | Auditoría PASS y237/237tests PASS |
| Quality complementario | 10/10comandos PASS:architecture-gates, public-shell, phase9-import, flow-connections, flow-connections-responsive, system-health, reliability, critical-healing, login-isolation y shopify-product-redirect. Se ejecutaron por nombre con npm run, no se afirma haber invocado ci:quality completo |
| Admin/comercio complementario | 30comandos de los planes canónicos:28PASS y2bloqueados por variables de backup/restore ausentes; incluye73/73Playwright de admin-commerce/Pedidos. No ocultar esas2salidas2 |
| Backup/restore sólo dry-run, repetidos con datos ficticios | Ambos PASS con FIREBASE_PROJECT_ID=demo-tintin-audit, bucket inexistente gs://tintin-audit-example.invalid y base audit-demo para restore. Sólo validación del plan; no se invocó gcloud ni se probó restauración efectiva |
| Sonda de33adaptadores sin token | 30respuestas401 y3respuestas503 por Push deshabilitado;0éxitos/0fetch externos. Corrección del harness:usar onRequestPost para sheets-sync-snapshot. No equivale a probar roles autenticados de cada API |
| Nueva regresión de editor, `tests/performance/editor-scroll.performance.spec.js` | 7/7PASS; rueda real de Playwright, posición conservada y mismo nodo tras30eventos locales por caso; fixture del editor/dominio, no datos ni proveedores reales |

RED→GREEN conservados:OTP (`/tmp/tintin-audit-otp-*`), telemetría
(`/tmp/tintin-audit-telemetry-*`), siete estados HTTP
(`/tmp/tintin-audit-auth-status-{red,green}.log`) y espera del loader
(`/tmp/tintin-audit-loader-wait-{red,green}.log`). Las pruebas negativas fallaron
antes de corregir la causa. No se redujeron límites ni aserciones para aprobar.

Los30comandos adicionales reutilizan audits de admin/comercio y pruebas de
importación, SEO, Push/social, Visual Builder, mayoristas, variantes y sync.
Lista y salida exactas:`/tmp/tintin-audit-admin-commerce-static.log`; los10de
quality:`/tmp/tintin-audit-quality-expanded.log`. No sumar totales solapados.

### Diagnóstico del scroll del editor

Primera ejecución dirigida, runner compartido sin throttling explícito:

| Ancho | Scroll antes/después px | Frame p95 ms | Frame máximo ms | Long tasks observadas |
| --- | --- | --- | --- | --- |
| 360 | 400/400 | 26,7 | 42,5 | 0 |
| 390 | 400/400 | 45,0 | 46,5 | 0 |
| 768 | 334/334 | 27,2 | 41,3 | 0 |
| 1024 | 400/400 | 53,8 | 59,7 | 0 |
| 1280 | 391/391 | 49,8 | 49,8 | 0 |
| 1440 | 318/318 | 44,2 | 46,0 | 0 |
| 1920 | 227/227 | 43,6 | 43,9 | 0 |

La aprobación exige conservación de scroll/nodos, no inventa60FPS constantes.
El muestreo dura30frames tras la rueda, no captura todas las acciones posibles
ni es INP de campo. Registrar frames largos aunque no haya long tasks;
CPU/otras suites afectan estos tiempos. Adjuntos editor-scroll-lab.json y log
`/tmp/tintin-audit-editor-scroll.log`. No se atribuye una mejora de velocidad a
un cambio de UI que esta intervención no realizó.

### Preparación de WebKit sin privilegios

Se instalaron los binarios de Playwright Chromium/WebKit/ffmpeg en caché local.
`playwright install-deps webkit` falló por autenticación su. Alternativa segura:
paquetes de librerías descargados con apt en/tmp y extraídos sin root, sin
modificar librerías del sistema. Las dos envolturas locales de MiniBrowser
conservan LD_LIBRARY_PATH para encontrar esas dependencias. Nada de esto forma
parte del código publicado.

El validador global de dependencias no ve librerías de/tmp:se utilizó
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 sólo para ese chequeo previo.
Se comprobó un lanzamiento/render real de WebKit antes de ejecutar los tests;
no se omiten las aserciones ni se sustituye WebKit por Chromium. No es Safari
en hardware físico. Comando del harness completo:

```bash
LD_LIBRARY_PATH=/tmp/tintin-professional-webkit/root/usr/lib/x86_64-linux-gnu PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:critical-runtime
```

### Capturas revisadas

Se generaron y se inspeccionaron visualmente Inicio390, catálogo768, login390 y
contacto390 en `artifacts/professional/screenshots/`; además dashboards admin390
y1024 del lote de fixtures. También se capturó Inicio1440. Las muestras usan el servidor local/rutas reales con catálogo de
prueba y posibles estados de conexión restringida:el aviso de conexión no es
evidencia de una caída productiva. No son comparación antes/después de un
rediseño ni inspección visual completa de todas las páginas y estados.

Las capturas de suites que comparten test-results pueden reemplazarse entre
invocaciones; no se afirma que todas sigan conservadas allí. Las muestras
anteriores, runtime y el lote admin adicional tienen directorios separados.

### Contraste, accesibilidad y rendimiento local ampliados

`node scripts/auditar-contraste.mjs`:38/38combinaciones evaluadas,0candidatos,
0errores de cobertura, salida0. Incluye19documentos y390/1440px; admin sin
sesión no representa todos sus componentes autenticados. Es una heurística:
promedia gradientes, no comprueba todas las transparencias/estados configurados
ni certifica WCAG2.2AA. El auditor ahora falla ante errores de evaluación.
Log:`/tmp/tintin-audit-contrast.log`.

`test:phase10-a11y`:5/5PASS; prueba el comportamiento reutilizable de salto,
Enter/Espacio, trap/retorno de foco, invalidación y conectividad. Su harness
sustituye el contenido editorial, por tanto no es una revisión semántica
exhaustiva de todas las páginas. Las suites de formularios/navegación/admin
complementan con componentes/estilos reales.

`test:performance` dentro de ci:browser:88/88PASS con base local4173. Incluye
las7regresiones nuevas del editor, loaders con timeout real, offline/reintento,
galerías, fidelidad de imagen, recursos diferidos, producto y geometría de
320/360/390/768/1024/1280/1440/1920. Los presupuestos históricos del repo son
tripwires, no acreditan por sí solos las metas de campo pedidas (2,5s/200ms/0,1).

Muestras de laboratorio de rutas públicas de esa ejecución, sin throttling
explícito y con servicios externos/fixtures locales; no sirven de antes/después
de producción. «Interacción» es la sonda sintética, null significa no registrada:

| Ruta | LCP ms | CLS | Interacción ms | DCL ms |
| --- | --- | --- | --- | --- |
| Inicio | 284 | 0,068 | null | 600 |
| Catálogo | 296 | 0 | 88 | 581 |
| Colecciones | 248 | 0 | 200 | 555 |
| Contacto | 368 | 0 | 32 | 638 |
| Nosotros | 432 | 0 | null | 629 |
| Envíos | 200 | 0 | null | 313 |
| Cambios/devoluciones | 480 | 0 | 48 | 770 |
| Preguntas frecuentes | 456 | 0 | null | 753 |
| Términos | 316 | 0 | null | 504 |
| Privacidad | 296 | 0 | null | 404 |

0duplicados first-party en estas10muestras. El producto tiene gates dedicados
y no se incluyó en este bucle genérico; el admin autenticado no queda medido
por la sonda de login. No son p75/p95 de usuarios ni INP real. La configuración
local puede mostrar un aviso de conectividad por servicios restringidos.

## Ejecuciones verificadas

| Comando | Resultado y alcance |
| --- | --- |
| `npm run audit:security` | PASS; contratos estáticos de autoridad de usuarios, no auditoría OWASP completa |
| `npm run audit:architecture-contracts` | PASS; consumidores, registro, sincronización y autoridades alineados |
| `npm run audit:performance` | PASS sin fallos críticos;2 advertencias:CSS Inicio471KB y JS directo272KB sin comprimir |
| `npm run audit:performance-regressions` | PASS;29 comprobaciones estáticas |
| `npm audit --json` | Antes:2 avisos moderados (`qs` y su efecto en Express); después:0 |
| `npm update qs --ignore-scripts --no-fund --no-audit` | Sólo actualización de qs6.16.0→6.17.0 en lock, dentro del rango existente; sin agregar dependencias/frameworks |
| `node --test tests/security/*.test.mjs tests/auth/*.test.mjs tests/accounts/*.test.mjs tests/performance/*.test.mjs` | 202/202 PASS; pruebas unitarias/contractuales, no sesiones reales |
| `node --test tests/cart/*.test.mjs tests/orders/*.test.mjs tests/checkout/*.test.mjs tests/payments/*.test.mjs` | 362/362 PASS; dominios comerciales, reservas, variantes e idempotencia |
| `npx playwright test tests/ui-ux/global-form-fit.spec.js tests/ui-ux/orders-board.spec.js --project=chromium --workers=1 --retries=0` | 79/79 PASS con Chromium del sistema; geometría real/fixtures y comportamiento del tablero, no CRUD productivo |
| `npm run test:rules-critical` | PASS en demo-tintin-critical:233 ataques/controles de Rules,15 pruebas de integración de comercio y1 de cuota concurrente contra Firestore emulado |
| `npm run build` | PASS inicial y final; generadores de Pages, CSP, rutas, decisiones, manifiesto y auditoría de caché380/67 |
| `npm run ci:preflight` | PASS;39 comandos del stage canónico, incluidos89 tests Node y5 Chromium de test:fast; no sumar como cobertura independiente de suites solapadas |

El cierre documental se regenera con build:diagnostics y verify:diagnostics.
En la primera etapa el plan protegido contenía sólo package-lock.json; fue
reemplazado por el plan ampliado del cierre vigente, sin sellos manuales.
Los totales de suites
solapadas o repeticiones no deben sumarse para simular más cobertura.

## Responsive y capturas

Formularios:contacto, perfil, checkout y login en320,390,768,1024,1280,1440,
1920px, además de844 horizontal y2560px. Incluye foco, radios, legibilidad,
solapes y esquema compartido. La geometría usa HTML/CSS reales con scripts
retirados: no valida persistencia/autenticación por sí sola.

Pedidos:24 tamaños en la matriz principal, incluidos360×640,390×844,768×1024,
1024×768,1280×800,1440×900,1920×1080 y horizontales; también selección masiva,
teclado/visualViewport, filtros, detalles, devoluciones y estados simulados.
Estas79 pruebas no equivalen a todas las pantallas en siete anchos.

Capturas generadas por la suite en `test-results/ui-ux-global-form-fit-*` para
390/1440 y casos de Pedidos. Son evidencia geométrica, no comparativa antes y
después:no hay rediseño. La inspección visual es por muestras, no completa;
WebKit se ejecutó en la ampliación, no Safari/hardware físico.

## E2E con servicios reales emulados

Se ejecutó `critical-flows.spec.js` con Auth y Firestore demo y Chromium desktop/
móvil. La primera preparación fue inválida: el JSON temporal del comando no
cerraba el objeto raíz y Firebase arrancó sin Rules. Resultado:18PASS/4FAIL,
incluida una elevación de rol aceptada por el emulador permisivo. **No es
evidencia de una vulnerabilidad productiva ni de autorización aprobada.**

La segunda preparación también se descarta:seguía sin reglas y no se había
propagado `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`;22 casos fallaron al lanzar el
navegador. No se cambiaron Rules ni aserciones para ocultar los fallos.

Se corrigió exclusivamente el archivo temporal, se validó su carga con
`firebase-tools/lib/config` y la existencia de `firestore.rules`, y se propagó
la ruta de Chromium antes de una tercera ejecución. Resultado final:22/22 PASS
sin reintentos, en2,3min. Incluye rechazo de elevación de rol, rechazo y
recuperación de guardado, OTP, offline, reconexión, perfil persistido, favoritos,
carrito y avance de checkout en Chromium desktop/móvil. Log:
`/tmp/tintin-professional-runtime-final.log`.

Comando de repetición (configuración temporal válida con reglas absolutas,
Auth9099/Firestore8080, proyectos demo, sin credenciales productivas):

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node node_modules/firebase-tools/lib/bin/firebase.js --config /tmp/tintin-professional-emulator.json --project demo-tintin-interactions emulators:exec --only auth,firestore 'node node_modules/playwright/cli.js test --config=playwright.runtime.config.js tests/runtime/critical-flows.spec.js --project=chromium-desktop --project=chromium-mobile --retries=0'
```

La preparación y ejecución son locales y no forman un harness paralelo del
producto; reutilizan el servidor, tests y Rules canónicos. El helper completo
`test:critical-runtime` se amplió después; ver los fallos y los51casos finales
de Chromium/WebKit al principio de este documento.

## Seguridad y privacidad

Checklist defensivo de Firebase:comparar create/update, identidad contra UID,
origen de autoridad del rol, email verificado del Super Admin, límites/tipos y
campos protegidos. Inspección de `firestore.rules:22`, `:402`, `:1189` y `:1474`
complementada por la suite negativa del emulador. No se cambiaron reglas.
No es una certificación de todos los endpoints/recursos ni una puntuación global.

Evaluación JSON del checklist Firebase, limitada a los controles inspeccionados
y233 escenarios ejecutados (no puntúa OWASP completo ni la aplicación entera):

```json
{
  "score": 5,
  "summary": "Los controles verificados de identidad, create/update, roles y propiedad pasan los escenarios ejecutados contra Rules reales en emulador. Alcance parcial; no acredita cobertura exhaustiva, proveedores ni configuracion productiva.",
  "findings": []
}
```

Las cuotas OTP se reservan en servidor antes del envío, con cooldown por correo
y límite por IP; el middleware también prueba429/Retry-After y fallos cerrados
de cuota compartida. La ampliación agrega Retry-After cuando el servidor ya
calculó retryAfterSeconds positivo; no inventa plazos para429sin fecha conocida.

Política y controles de consentimiento existen en `privacidad.html` y
`js/analytics/consentimiento-privacidad.js`. La política describe datos de perfil,
pedidos, proveedores y derechos. Falta verificar retención efectiva/borrado en
cada proveedor, coherencia legal de pagos habilitados y obligaciones de Paraguay
y demás jurisdicciones efectivamente aplicables con asesoramiento especializado.
No se afirma cumplimiento legal. No se registran valores de secretos en estos
documentos ni se realizaron compras, envíos de correo o cambios de cuentas reales.

Búsqueda acotada de firmas de claves privadas, tokens GitHub y claves de pago
en fuentes/docs (excluye .git, dependencias, vendors y artefactos):única
coincidencia en `scripts/auditar-nivel-1-fundamentos.js:146`, el detector del
propio auditor; no contiene bloque de clave privada. No se imprimieron valores.
Esto no cubre historial Git completo, secretos del proveedor ni todos los formatos.

## Rendimiento medido

Una sonda de laboratorio sobre Inicio publicado, escritorio Chromium, sin
throttling explícito; no es una medición de la rama local ni una distribución
de usuarios reales. Comando:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium PERF_BASE_URL=https://tintinaccs.com npx playwright test tests/performance/public-pages.performance.spec.js --grep 'index.html' --project=chromium --workers=1 --retries=0 --output=/tmp/tintin-professional-performance
```

Resultado:1/1 PASS; LCP1564ms, CLS0, interacción sintética48ms,
DOMContentLoaded3241ms,146 solicitudes/119 propias efectivas,0 duplicadas propias,
5079KB transferidos/2699KB propios. La sonda de interacción es un botón mínimo;
**no demuestra INP real del editor ni respuesta bajo carga**. La muestra no
valida móvil/tablet ni todas las rutas. No se ejecutaron pruebas de carga.

No hay comparación antes/después de velocidad de UI. La corrección posterior
del flotante cambia su coordinación de layout, no un rediseño ni una optimización
medida de LCP. qs afecta herramientas, no se le atribuye una mejora visual.
Mantener pendientes trazas por ruta, scroll de listas reales, cachés
frías/calientes y percentiles de campo antes de afirmar estabilidad global.

## Evidencia y límites

Logs de sesión en `/tmp/tintin-professional-{node,commerce,browser,rules,performance,runtime,runtime-corrected,runtime-final,build-initial}.log`;
auditorías npm en `/tmp/tintin-professional-npm-{audit,after}.json`.
Son temporales de este entorno y no se presentan como un archivo externo durable.
Los documentos resumen resultados para continuidad. Los traces/screenhots de
runtime viven en `artifacts/real-interactions/` y se regeneran al repetir suites.

Pendientes externos:no existe aceptación autenticada con proveedores reales
o sandbox suministrado; faltan WCAG manual/contraste efectivo configurable,
dispositivos físicos, CRUD de integraciones, retención/borrado por proveedor,
revisión legal y métricas de campo. Las matrices187/187y144/144, el smoke18,
el lote620, Rules phone/username/editor y51E2E están registrados. No repetirlos
como si nunca hubieran existido ni convertirlos en certificación global.

## Archivos intervenidos

56archivos del diff local, agrupados para continuidad; los artefactos de pruebas
ignorados por Git no se cuentan como código publicado:

| Grupo | Archivos |
| --- | --- |
| Runtime público | `tienda.js`(guard de flotante);15consumidores HTML:404,about,cambios-devoluciones,catalogo,checkout,collections,contact,envios,index,login,perfil,preguntas-frecuentes,privacidad,product,terminos |
| Servidor | `cloudflare/seguridad-cloudinary.js`; `functions/lib/operational-guard.js`;8adaptadores API:cloudinary-delete,cloudinary-sign-audio-upload,coupon-validate,paypal-create-order,paypal-capture-order,phone-availability,username-availability,telemetry |
| Dependencias | `package-lock.json`(sólo actualización compatible de qs) |
| Fuentes de tooling | `scripts/auditar-canonicos-viewports.mjs`, `auditar-contraste.mjs`, `auditar-global-responsive-final.mjs`, `servidor-flujos-runtime.mjs`, `sincronizar-inicio-navegacion-publica.js` |
| Derivados canónicos | `scripts/cache-version-baseline.json`, `config/proteccion-flujos.json`, `config/mantenimiento-flujos-plan.json`, `diagnostic-manifest.json`, `site-version.json` |
| Pruebas existentes |2OTP de accounts; performance README/_helpers/responsive-performance; runtime critical-flows; ui-ux global-form-fit/whatsapp-consent-overlap |
| Pruebas nuevas | performance editor-scroll.performance/loader-wait; runtime guest-cart-commerce; security endpoint-auth-status/telemetry-body-limit; operations responsive-audit-scroll |
| Documentación | `DESIGN.md`, `docs/ARCHITECTURE_OVERVIEW.md`, `docs/AUDITORIA_PROFESIONAL.md`, `docs/QA_REPORT.md`, `docs/agent/CURRENT_STATE.md` |
