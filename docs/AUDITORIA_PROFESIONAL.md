# Auditoría profesional — intervención local por fases

Base `5a2ea0f63` (incluye #1262/#1263), rama `audit/profesional-local-20261028`.
Fecha de ejecución:28/10/2026 UTC. Agente:Codex. Durante la auditoría inicial
no se autorizaban push/merge/publicación. Después del cierre local, la titular
solicitó explícitamente auto-merge y seguimiento. La publicación se acredita
por PR/SHA/checks, no por los resultados locales de este informe. Continúa
prohibida cualquier operación comercial real o bypass de protecciones.

## Inventario de pantallas

19 documentos HTML:18 superficies/aliases de aplicación y un documento de
verificación de Search Console. El inventario no equivale a 19 E2E aprobados.

| Superficie | Documentos/consumidores | Funciones existentes |
| --- | --- | --- |
| Inicio | `index.html` | Hero, colecciones, más vendidos, reseñas, Instagram |
| Catálogo | `catalogo.html` | Filtros, búsqueda, tarjetas, colores, stock y precios |
| Colecciones | `collections.html` | Categorías, disponibilidad y navegación al catálogo |
| Producto | `product.html`, `functions/product.js`, `functions/products/` | Metadata de servidor, variantes, fotos, precio, cantidades, reseñas y relacionados |
| Compra | `checkout.html` | Datos, ubicación/envío/retiro, resumen, pago habilitado y confirmación |
| Cuenta | `login.html`, `perfil.html` | Google/OTP por email, onboarding, sesión, direcciones, favoritos e historial |
| Institucional | `about.html`, `contact.html` | Historia, formulario/contacto y canales oficiales |
| Ayuda/legal | `envios.html`, `preguntas-frecuentes.html`, `cambios-devoluciones.html`, `terminos.html`, `privacidad.html` | Información, políticas e índice de secciones |
| Auxiliares | `404.html`, `nosotros.html` | Error navegable y alias histórico de Nosotros |
| Administración | `admin.html`, `admin-images.html` | Panel por rol, CRUD/editor, medios y operación |
| Verificación | `googlef396be0b943aa3d1.html` | Documento de proveedor; no pantalla de negocio |

23 secciones administrativas identificadas en `admin.html`:dashboard,
estadisticas, usuarios, pedidos, ventas-locales, clientes-compraron,
espejos-sheets, mayoristas, productos, resenas, me-gusta, colecciones, paginas,
importar, mensajes, notificaciones-push, auditoria, diagnostico, flujo-conexiones,
correos, configuracion, permisos y apariencia. Su presencia no certifica cada CRUD.

## Arquitectura, componentes y datos

HTML/CSS y JavaScript modular nativo, con entrada clásica `tienda.js`; no es una
SPA React/Vue/Next. Pages Functions/Cloudflare implementan servidor y rutas
limpias/dinámicas. `_routes.json`, CSP, shell y manifiestos son generados.
Fuentes:README, AGENTS, `docs/arquitectura-tecnica.md`, contratos de calidad,
versiones canónicas y autoridades existentes. No crear autoridades paralelas.

58 adaptadores en `functions/api/`:catálogo y contenido público, Visual Builder,
Auth OTP y disponibilidad de identidad, avatar, engagement y notificaciones,
pedidos/cupones, PayPal, Cloudinary, mayoristas, comercio local, importación,
sincronización Sheets, geolocalización, telemetría y salud/diagnóstico.
Los endpoints delegan lógica en `cloudflare/`; revisar autorización por operación,
no inferir que todos son públicos por estar en `/api/`.

Firebase Authentication identifica; Firestore y Rules gobiernan datos. Contrato
de roles en `config/account-contract.json`; reglas exigen email verificado para
Super Admin y usan UID/roles protegidos. No hay autenticación tradicional de
contraseña que deba reconstruirse: login actual usa Google y OTP de correo.
Carrito utiliza almacenamiento local y sincronización; sesión usa Firebase y
handoff en sessionStorage; preferencias, consentimiento y cachés tienen módulos
propios. Borradores/editor conservan sus contratos de UID, CAS y recuperación.

Integraciones:Firebase, Cloudflare, Cloudinary, Resend, Apps Script/Sheets,
PayPal, reCAPTCHA Enterprise/App Check, geolocalización, Instagram y Push/FCM.
Su código presente no certifica credenciales/proveedores productivos.
Las funciones de IA visibles corresponden a herramientas locales de medios
(ONNX), no se identificó un servicio de generación por tokens que justifique
agregar planes o cuotas de IA.

Componentes compartidos:header desktop/tablet/móvil, tabbar, footer, buscador,
carrito, cuenta, panel de colecciones, modales/lightbox, avisos de versión,
consentimiento, bienvenida, feedback de operaciones y loaders. Fuentes en
`js/components/`, `js/quality/`, `js/admin/products/`, `js/admin/appearance/`.
Formularios:contacto, login/OTP/onboarding, perfil/direcciones, checkout,
producto/variantes/medios, colecciones y configuración administrativa.

Pruebas existentes:Node test runner, Playwright Chromium y harness runtime con
proyectos móviles/WebKit, emulador Firestore y pruebas de Rules, integración,
dominios comerciales, privacidad, sincronización, CSP, accesibilidad, SEO y
rendimiento. Las ejecuciones efectivas y sus límites se registran en QA_REPORT;
no se hereda aprobación de informes anteriores.

## Hallazgos y riesgos

Prioridades:P0 crítico inmediato; P1 alto; P2 medio; P3 mejora opcional.

| ID/prioridad/tipo | Ubicación y comportamiento actual | Esperado/impacto/causa | Corrección o siguiente paso |
| --- | --- | --- | --- |
| DEP-01 P2 MEDIUM confirmado, corregido local | `package-lock.json`, paquete `qs`6.16.0; npm audit informa GHSA-6pq8-jhm2-2vcw y propaga el aviso a Express | Evitar excepción/DoS al serializar ciertos arrays. Dependencia de herramientas de desarrollo, no servidor Express de la tienda. Un único origen produce dos avisos moderados | Actualización compatible a6.17.0; npm audit posterior0. No usar force ni atribuir una explotación productiva |
| DOC-01 P2 LOW confirmado, corregido local | No existían `DESIGN.md` ni los informes solicitados | Documentar autoridades y cobertura sin repetir informes históricos como evidencia vigente | Documentos nuevos enlazan arquitectura canónica y distinguen pruebas de pendientes |
| PERF-01 P2 MEDIUM advertencia confirmada | `audit:performance`:CSS de Inicio471KB y JS directo272KB sin comprimir | Presión de parseo/pintado posible; no demuestra por sí sola LCP/INP malos ni bytes transferidos reales | Medir trazas por ruta/dispositivo antes de dividir CSS/JS; no retirar estilos o listeners indiscriminadamente |
| QA-01 P1 HIGH riesgo de cobertura, no defecto reproducido | Guardado con sesión real de propietaria y proveedores autenticados no ejecutados | Hace falta aceptación en entorno autorizado con cuentas de prueba. Tests de dominio/emulador no equivalen a esa sesión | Continuar fase7 en harness runtime, luego aceptación autenticada; no escribir en producción |
| QA-02 P2 MEDIUM cobertura ampliada local | Matrices compartidas de formularios, rendimiento y canónicos no contenían360px; Pedidos sí | No extrapolar aprobación de320/390 a todos los formularios en360 | Añadido360 conservando320 y todas las aserciones anteriores; resultado vigente en QA_REPORT |
| ENV-01 P2 MEDIUM preparación de auditoría, corregida fuera del producto | Configuración temporal de E2E inicialmente inválida y segundo intento sin ruta de Chromium | El emulador sin Rules permite operaciones que el producto debe denegar; esa corrida no puede certificar seguridad | Se descartan18PASS/4FAIL y22 errores de lanzamiento; tercera preparación valida config/reglas antes de iniciar y se documenta por separado |
| HTTP-01 P2 MEDIUM reproducido, corregido local | `cloudflare/seguridad-cloudinary.js:jsonResponse`; OTP devolvía429 con espera en JSON, sin Retry-After | Los clientes HTTP deben poder respetar el plazo ya calculado en servidor; faltaba propagarlo | Agregar cabecera sólo cuando429 incluye retryAfterSeconds positivo y finito; pruebas de cuota/cooldown RED→GREEN; no cambia las cuotas |
| SEC-01 P2 MEDIUM reproducido, corregido local | `functions/api/telemetry.js:onRequestPost`; sin Content-Length o con valor menor aceptaba JSON >8192bytes (202) | Acotar recursos antes de parsear/reenviar; la cabecera no es autoridad del tamaño real | Lector de stream acotado en `functions/lib/operational-guard.js:readLimitedJson`; cancela al superar8192, responde413 y no reenvía. Tests UTF-8/cabecera falsa/cancelación/JSON inválido RED→GREEN |
| HTTP-02 P2 MEDIUM reproducido, corregido local | Siete adaptadores:cloudinary-delete, cloudinary-sign-audio-upload, coupon-validate, phone-availability, username-availability, paypal-create-order y paypal-capture-order | Sin sesión respondían400/500 pese a error de autenticación tipado401; confunde recuperación y diagnóstico, no era bypass de acceso | Reutilizar statusFromError conservando fallback de dominio;7 pruebas RED→GREEN,21 combinaciones de sesión/origen/método; suite ampliada139PASS |
| QA-03 P2 MEDIUM riesgo confirmado del auditor, corregido local | `scripts/auditar-contraste.mjs`; catch vacío y éxito global con cero candidatos aunque una página no pudiera evaluarse | Un error de cobertura no debe convertirse en aprobación visual | Registrar página/viewport/error, contabilizar cobertura y salir con error; etiquetar heurística como candidatos, no certificación WCAG |
| DOC-02 P3 LOW confirmado, corregido local | `tests/performance/README.md` afirmaba que las pruebas no se ejecutaban en CI, contradiciendo config/ci-stages.json | Futuros agentes deben repetir el stage vigente y distinguir laboratorio/campo | Documentar integración real, comandos locales, alcance de sonda y nueva regresión de scroll |
| QA-04 P2 MEDIUM reproducido, corregido local | `tests/performance/_helpers.js:waitLoaderGone`; timeout enviado como segundo argumento de waitForFunction y rechazo descartado | Playwright recibe opciones como tercer argumento; un loader bloqueado no debe aprobar por catch vacío. Algunos consumidores tenían aserción posterior, otros no | Corregir firma y propagar rechazo;2 pruebas RED→GREEN,16 pruebas de helpers/scheduling/navegación aprobadas en conjunto. No se quita ni acorta el loader de la aplicación |
| UI-01 P2 MEDIUM reproducido, corregido local | `tienda.js:initWaFloatVisibility`; un aviso podía aparecer sobre el flotante tras cambiar clases de html o cargarse CSS que mueve elementos sin redimensionarlos | El guard observaba sólo body y tamaños, no esos cambios de layout; el flotante debe ceder su zona/foco al aviso | Observar cambios relevantes de documento/estilos y carga de hojas, manteniendo coalescencia rAF y sin polling. Dos regresiones RED→GREEN;7/7pruebas dirigidas y matriz global posterior187/187PASS |
| QA-05 P2 MEDIUM confirmado, corregido local | `scripts/auditar-global-responsive-final.mjs:checkSurface/resetSurfaces`; espera fija140ms, clic forzado con errores descartados y clases modificadas fuera del controlador | Comprobar interacción y cierre reales; dos rAF pueden exceder140ms en un runner ocupado | Clic normal y espera de estado open/idle con límite3s, manteniendo geometría. Recorrido posterior186/187, no se declaró PASS ni se ocultó el solape restante |
| ENV-02 P2 MEDIUM confirmado, corregido en harness | `scripts/servidor-flujos-runtime.mjs`; Auth móvil del emulador dependía del resolver Google externo, con gapi503 en trazas | Custom Tokens locales no necesitan OAuth; no confundir caída externa con aceptación de sesión ni debilitar Rules | Omitir resolver sólo en fuente emulada, bloquear API externa en tests, conservar SDK oficial. Resultado final51/51PASS en3proyectos; producción no cambia |
| QA-06 P2 MEDIUM reproducido, corregido en auditor | `scripts/auditar-global-responsive-final.mjs:inspectMobileBottom`; podía medir el footer antes de window.load y sin comprobar que realmente llegó al final | La restauración de scroll de navegación puede ejecutarse después de la sonda; una captura a mitad de página no es evidencia de layout final incorrecto | Sonda con recurso tardío:579px antes de load→0px después. Esperar load y frames, desplazar instantáneamente sólo en el auditor y fallar si quedan >2px. Tres regresiones RED→GREEN;140pruebas relacionadas PASS. No se modifica el scroll del producto |

No se reprodujeron P0/P1 de seguridad en los casos ejecutados. Esto no significa
ausencia de vulnerabilidades. No se califican como fallos la ausencia de SPA,
contraseñas, multiempresa o una API de IA cuando no son funciones del negocio.

## Mapa de límites del servidor

Todos los nombres siguientes corresponden a archivos de `functions/api/`.
La clasificación es un inventario de la autoridad del código, no una afirmación
de haber autenticado cada proveedor. No inferir permisos por imports: comprobar
la llamada del handler y las validaciones del dominio delegado.

| Familia / adaptadores | Límite real y comportamiento que debe conservarse | Evidencia / límite |
| --- | --- | --- |
| admin-backfill-canonical-identity, admin-catalog-delete, admin-commerce-controls, admin-engagement, admin-import-job, admin-import-media, admin-wholesale | Super Admin verificado; validación de acción, tamaño/dominio y conflictos antes de escribir | Dominios Node + rechazo sin token; no ejecución administrativa productiva |
| admin-order-mutation | Según acción:Super Admin o staff de pedidos con permiso persistido; no aceptar rol enviado por cliente | Pruebas de rol/permiso, dominio de pedidos; rechazo sin token |
| admin-runtime-health, system-health, master-diagnostics | Super Admin para diagnóstico privado/dispatch; no ejecutar dispatch en esta auditoría | Rechazo sin token y dominios de salud; secretos no devueltos |
| cloudinary-sign-upload, cloudinary-sign-audio-upload, cloudinary-delete | Super Admin; firma sólo de parámetros permitidos; borrado respeta medios vinculados a trabajo privado | Rechazo sin token, CSP y contratos de medios; proveedor real pendiente |
| profile-avatar-upload, phone-availability, username-availability, claim-commerce-history | Identidad Firebase del servidor; UID/estado de cuenta; disponibilidad no devuelve propietario; historial por identidad verificada | Pruebas de cuentas y Rules; no consulta de perfiles productivos |
| email-otp-send, email-otp-verify | Públicas para iniciar sesión; cuota por IP/correo, cooldown y desafío de un solo uso; no enumerar cuentas | Tests de límites/concurrencia y OTP con Auth/Firestore demo; Resend real pendiente |
| coupon-validate, wholesale-quote | Usuario Firebase; precio/permisos/límites calculados por servidor, no valores del navegador | Dominios comerciales y rechazos sin sesión |
| order-email, order-email-drain | Creación/entrega e idempotencia gobernadas por dominio de pedidos y trabajos autorizados; no envío libre de correo | Tests de pedidos/drenado; ningún correo real enviado |
| paypal-config, paypal-create-order, paypal-capture-order, paypal-rate-refresh, paypal-webhook | Config pública saneada; creación/captura con identidad y pertenencia; webhook valida proveedor en dominio; refresco con autoridad del servidor | Tests de pagos y checkout ficticio; no captura ni pago real |
| public-catalog | GET público; sólo campos permitidos/productos publicados/colecciones visibles; caché pública de datos públicos, límite de solicitudes | Tests public-commerce y catálogo; no prueba de caché privada multitenant |
| visual-builder-public, visual-studio-global-public; visual-builder, visual-studio-global | Lecturas públicas saneadas separadas de edición privada Super Admin | Tests Visual Builder/seguridad; edición privada sin token rechazada |
| engagement, notifications | Acciones públicas/autenticadas/administrativas diferenciadas dentro del handler y dominio; pertenencia por UID y reautenticación donde aplica | Tests engagement/notificaciones/cuentas; no tratar toda la ruta como pública |
| push-admin, push-config, push-order-event, push-subscription, push-test | Operación de notificaciones de administración, no registro masivo de clientes; config/identidad/acción y límites propios | Sin configuración push algunas rutas responden503 antes del guard:eso no prueba autenticación por sí solo; tests de dominio complementarios |
| sheets-products-webhook, sheets-admin-webhook, sheets-engagement-webhook, sheets-sync-snapshot, local-commerce-webhook | Secretos server-to-server y entidad/acción permitida; no autenticar con un Origin ni confundir snapshots con endpoints públicos | Inspección de comparación de secretos y pruebas de sincronización; ningún secreto ni snapshot real consultado |
| sheets-product-sync, local-commerce | Super Admin para lectura/escritura; sincronización canónica y recuperación | Rechazo sin sesión y dominios de sincronización/local |
| catalog-sheet-sync-drain | OIDC GitHub Actions y validación del workflow/trabajos; drenado acotado | Pruebas de OIDC/cola; no dispatch ni drenado productivo |
| apps-script-bridge | Proxy de acciones explícitamente permitidas con validación correspondiente; no proxy abierto arbitrario | Contratos Apps Script/identidad/importación; aceptación con proveedor pendiente |
| geo-search, location-search, visitor-geo | Consulta pública de ubicación; alias comparte implementación; salida aproximada de visitante sin IP/coordenadas | Revisión de límites de consulta, caché y timeout; proveedor/geografía real no certificado |
| instagram-feed | Feed público saneado y caché; credencial sólo en servidor | Inspección del adaptador, sin extracción de credenciales |
| telemetry, site-activity, health | Telemetría/actividad públicas acotadas y saneadas; health GET/HEAD devuelve checks sin secretos, no diagnóstico privado completo | Telemetría tiene cuota por isolate; site-activity tiene cuota persistente por IP/global. health llama comprobaciones del backend:validar protección/caché del edge antes de prometer resistencia a abuso global |
| test-email | Operación privada autorizada, no formulario público de envío | Rechazo sin token; no envío real |

Sonda negativa adicional:33 adaptadores privados invocados directamente sin
token y con origen válido, env vacío y fetch bloqueado. Resultado:30rechazos401
y3respuestas503 por Push deshabilitado;0respuestas2xx y0solicitudes externas.
La primera sonda erró al asumir onRequest en sheets-sync-snapshot; se corrigió
la selección de onRequestPost y se repitió. Esa primera sonda no es un defecto
del producto. La sonda no sustituye pruebas con tokens de roles distintos.

No se identificó un modelo de organizaciones/tenants que justifique inventarlo.
El aislamiento aplicable es por UID/propietario/rol y trabajo privado del editor;
debe probarse con dos identidades demo distintas, no con un único Super Admin.

## Estados, formularios y acciones:matriz de revisión

| Superficie | Estados/acciones cubiertos por suites existentes y ampliadas | No extrapolar |
| --- | --- | --- |
| Inicio/colecciones | Galería, productos destacados, composición vacía/poblada, carga y navegación | No disponibilidad de Instagram/Firebase productivos |
| Catálogo/búsqueda | Filtros, sin coincidencias, color/precio/stock, tarjetas y selección | No inventario real completo ni todas las combinaciones del catálogo |
| Producto | Variantes/fotos asociadas, agotado, cantidades, carga rápida, reintento y scroll sin remontaje | No equivalencia a INP de campo |
| Login/alta | Correo→OTP→Continuar, datos inválidos, teléfono de otra cuenta, offline, permiso denegado, sesión y redirección | Google/Resend reales requieren sandbox/cuentas autorizadas; no agregar contraseña |
| Perfil | Persistencia, avatar, error de subida/reintento, identidad y consentimiento | No borrado externo de todos los proveedores |
| Carrito/checkout | Cantidad/color, persistencia, usuario requerido, cupón, envío, factura, stock, idempotencia, fallo/red/ticket | PayPal ficticio y emuladores, no compra/envío real |
| Admin productos/editor | Crear/editar, borradores privados, reabrir, guardar/conflicto/error, descartar explícito, medios y variantes, foco/scroll/rotación | Fixture de dominio no prueba Cloudinary real; aceptación de sesión real pendiente |
| Admin pedidos | Filtros, detalle, selección, devolución, pago/correo por permiso y estado, límites de pantalla | No envío/cambio de pedidos reales |
| Otros21 módulos/admin-images | Auditorías del stage admin, dominios Node y geometría por viewport | No convertir contrato estático en CRUD E2E aprobado de cada módulo |
| Ayuda/legal/contacto/404 | Navegación, layout y formularios relevantes | Revisión legal especializada no sustituida por Playwright |

Los estados se revisan según la función existente. Falta de permisos, error de
red y lista vacía no se consideran intercambiables. No se agregan ilustraciones,
loaders o toasts duplicados donde los componentes ya resuelven el caso.

## Estado por fase y continuidad

Actualización vigente:QA_REPORT contiene51E2E críticos,222comercio,
620/620administrativas sin reintentos,144/144canónicos,187/187globales y smoke18.
Rules teléfono18/username16/editor21 aprobados;140regresiones de operaciones/
rendimiento y7del flotante aprobadas. Los fallos previos del auditor están
explicados y sus comprobaciones pendientes se repitieron individualmente.
No afirmar por ello estabilidad global garantizada, certificación WCAG o
aprobación de producción. Los pendientes reales son externos/manuales.

| Fase | Comprobado y alcance pendiente |
| --- | --- |
| 1.Inventario | 19documentos/58adaptadores/23secciones admin, componentes, datos, rutas y límites de servidor documentados. No certifica cada acción CRUD |
| 2.Diseño | DESIGN consolidado a partir de identidad/tokens reales; muestras visuales revisadas. No rediseño; contraste configurable/manual pendiente |
| 3.Estados | Matriz de carga/vacío/error/permiso y suites de recuperación documentadas;620admin PASS con fixtures. No aceptación real de cada integración externa |
| 4.Formularios/login | 51E2E críticos/carrito en3proyectos y237Node de login/perfil. Google/Resend reales y aceptación con cuentas autorizadas pendientes |
| 5.Abuso | Cuotas existentes,429/Retry-After y límite real de telemetría corregidos y probados. No hay garantía de límites distribuidos en todas las rutas/edge |
| 6.Responsive/a11y | 144/144canónicos,187/187globales,smoke18,7regresiones del flotante,5tests reutilizables de a11y y38muestras de contraste. WCAG manual/hardware pendientes |
| 7.E2E | 51PASS finales,222comercio,620admin y dominios Node. Proveedores y operaciones reales no ejecutados; no sumar suites solapadas |
| 8.Seguridad/privacidad | Dependencias sin avisos npm,guards,Rules críticos y55controles adicionales de teléfono/username/editor aprobados. Retención/proveedores/legal especializados pendientes |
| 9.Rendimiento | 88tests de laboratorio, sondas públicas y scroll en7anchos registrados. No INP/p75 de campo ni garantía60FPS; advertencias de peso de Inicio siguen abiertas |
| 10.Documentación | DESIGN, auditoría, QA y arquitectura actualizados. Build y39preflight finales PASS. No declarar auditoría global completada |

Continuidad precisa:no repetir suites completas sin un cambio o riesgo nuevo.
Leer QA_REPORT y sus JSON/logs durables para conocer el alcance de cada prueba.
Para el siguiente nivel se requiere entorno sandbox y cuentas autorizadas para
proveedores y aceptación real, hardware y revisión manual de accesibilidad,
datos de campo y validación legal/retención. No compras ni borrados productivos.
No hacer push/merge/deploy sin instrucción nueva explícita de la propietaria.
