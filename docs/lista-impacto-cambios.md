## 2026-10-15 — Conocenos y encuadre inferior de fotos

Fuente funcional única: css/pages/institutional/about-maintenance.css. Reserva específica para header fijo desktop, sin duplicar reserva tablet ni agregar header móvil. Exterior de retratos sin proporción4/5 que recortaba marco; interior2/3 y object-position inferior para ambas fotos. Fotos y contenido de Barbi permanecen originales de #1129. Regresión existente public-initial-layout añade medición del gap y del límite inferior; revisión de primer frame y9anchos. Nuevas URLs se propagan por cargador de mantenimiento/navegación/store sin cambiar lógica; regenerar caché, CSP, flujos/diagnóstico y plan protegido desde fuentes. No cambios de datos ni permisos.
## 2026-10-15 — Logo de footer sin tarjeta

Retirar el soporte negro del footer solicitado por el propietario: fondo transparente, sin borde/sombra/padding y marca negra sobre rosa claro/oscuro. Fuentes: sistema-superficies-tintin.css y logotipo-marca.js (excepción de footer con prioridad sobre tinte rosa). Regresión existente de pie de perfil y páginas públicas actualiza resultado esperado; conservar carga real tardía, logo cargado, WhatsApp y navegación. Versiones y artefactos canónicos sólo distribuyen este ajuste. Sin cambios de header/mobile, Auth, datos comerciales ni proveedores.
## 2026-10-14 — Diagnóstico de conexiones y lecturas de Administración

Fuentes funcionales: lecturas-admin.js, flujo-conexiones-admin.js, estado-flujo.js y live-checks.js. Impacto: lecturas administrativas compartidas, recuperación de seguridad, monitor automático y etiquetas de evidencia de Sheets y servicios externos. No cambia configuración de proveedores, roles, Rules, dominios, stock, pedidos ni datos reales. Los consumidores transitivos sólo reciben URLs nuevas; shell, CSP, diagnóstico y plan de mantenimiento se regeneran desde sus fuentes. Validar cambio de cuenta durante lectura/recuperación, cancelación con solicitudes pendientes, rechazo persistente observable, fallos parciales sin perder resultados sanos, sandbox habilitado/incompleto y proveedor opcional apagado. Los acuses de otra versión conservan el estado sin confirmar.

## 2026-10-13 — Preparación antes de migrar autorizada por el titular

Reconciliación de Pedidos con main f5ffc5a y conservación del origen activo pages.dev separado del destino cutover tintinaccs.com. Generadores actualizan consumidores del origen, canonical/SEO/correo/monitor, CSP y URLs inmutables transitivas; no rediseño, datos históricos ni cambios externos. Sin DNS/custom domain, merge/publicación o operaciones comerciales reales. Evidencia PRECUTOVER_PEDIDOS_20261013.md; CI exacto y mantenimiento humano pendientes.

## 2026-10-12 — Pedidos Super Admin y conexiones indispensables

Interfaz existente de Pedidos, CSS acotado, fuente administrativa compartida, dominio de transiciones, guardado único estado/pago, inventario, auditLog, contactos autorizados y seguimiento/notificaciones/correo por modalidad. Sin rediseño de otros módulos ni cambio de infraestructura, URL o datos históricos. Archivo/restauración conserva el estado de pedidos finalizados. Pruebas y auditores reutilizan los contratos existentes; versiones transitivas y artefactos generados se actualizan sólo para distribuir las fuentes correctas. 435 pruebas Node y 48 de navegador PASS_LOCAL; límites y pendientes en el informe de renovación. Publicación requiere autorización final.

## 2026-10-12 — Checkout completo: stock, recuperación, ticket, privacidad y accesibilidad

Fuentes: checkout.html, pedido-checkout-seguro, estado-navegacion-checkout, puente-correo, mantenimiento/hardening/confiabilidad, dominio de pedidos, apps-script-bridge y order-email. Lecturas protegidas de orders para recuperar/actualizar recibo; escritura servidor de estado notification* en pedidos y cola existente. No cambia inventario, precios, pago, autorización o reglas. UI informa correo de cuenta y habilita edición local de identidad; ticket usa el snapshot persistido. Caché transitiva del shell/versiones, CSP, flujo y manifiesto regenerados desde fuentes. Evidencia y pendientes en CURRENT_STATE. Publicación requiere autorización explícita del titular conforme al protocolo; no generar ventas/correos de prueba.

## 2026-10-12 — Esquema de color ante readiness tardío e inventario por contexto

El timeout de App Check conserva la paleta aplicada y el listener de appearance; no abre un esquema por defecto antes de recibir configuración autorizada. El token tardío sigue recuperando el esquema activo. Rechazos reales de Rules siguen reportados. Impacto: primer paint de todas las páginas públicas y salud login/perfil; sin cambio de Auth, enforcement, permisos, colores, compras ni dominio.3 regresiones específicas y URLs nuevas para el recurso publicado. Nueva suite de navegación usa páginas originales y servicios aislados, captura controles por estado y verifica apertura/cierre/retorno/tablet; no convierte descubrimiento en aprobación funcional completa.

## 2026-10-12 — Recuperación del cliente y confirmación remota del carrito

Listeners de perfil, navegación, favoritos, notificaciones, configuración y carrito esperan App Check y recuperan readiness tardío; rechazos reales de Rules siguen visibles. Perfil compartido de checkout mantiene identidad y singleflight sin lectura privada prematura. Favoritos hidratan precio/media del catálogo público actual y muestran disponibilidad desconocida cuando falta. Carrito conserva cambios pendientes contra acuses anteriores, bajas y cantidades reducidas; snapshots de caché/escrituras optimistas no son confirmación del servidor. Impacto: navegación entre ficha/carrito/checkout, recarga, modo offline, cambio de cuenta y errores de lectura. Regresiones de lógica y navegador con Auth/Firestore aislados; App Check del emulador es fixture y no certifica producción. Caché transitiva, shell, CSP y diagnóstico se regeneran canónicamente. Ningún cambio de Rules, dominio, pedidos reales ni cuentas ajenas. Auditoría funcional del Super Panel Admin diferida por alcance vigente; sus referencias compartidas sólo reciben URLs coherentes.

## 2026-10-12 — Privacidad del diagnóstico Auth y contrato de correo de diagnóstico

Fuente funcional: diagnostico-sesion omite query/console.info, rechaza datos anidados y campos sensibles/override; conserva80 eventos técnicos y errorCode. test-email autentica antes de consultar configuración y conserva HTTP401/403. Sin modificación de credenciales, roles, Rules, AppCheck, stock, pedidos, DNS ni remitentes; no enviar correo. Referencias de caché transitivas del grafo Firebase/Auth reciben versiones únicas; consumidores sólo cambian URLs. Generador shell, CSP, flujo y diagnóstico regenerados desde fuentes. Tests del módulo real con VM y endpoint original sin sesión; suites Auth/cuentas y CSP. Estado externo verificado de Sheets/AppsScript24 y lista20 en docs/agent/SEGURIDAD_20_PUNTOS_20261012.md. Mantenimiento nativo obligatorio del candidato final.

## 2026-10-12 — Fórmulas del espejo Productos tras alta y reintento

AppsScript prepara formato/validación/fórmulas antes de escribir identidad en ambas rutas. Reparación selectiva de celdas calculadas vacías; no pisa fórmulas ni valores manuales existentes. Sin cambios a servidores/headers/HTML/caché/Auth/Rules/catálogo/DNS/secretos/triggers. CampoStockactual de QA debe evaluarse0 después de actualizar AppsScript y re-sincronizar; validar también hoja→Firestore. Test169/169 sync, cuatro nuevos. No heredar verificación runtime de WebApp23: actualización revisada del mismo deployment todavía pendiente.
## 2026-10-11 — Importación QA: transporte autenticado de Sheets y contador de imágenes

pushProductsToSheets añade Authorization Bearer al IDtoken existente en cada lote20; body/servidor/origen/roles/Firestore/pagos sin cambio. Corrige401 real después de commit del producto ficticio, conservando FAILED/reanudación. Resumen de preview cuenta imágenes no vacías, sin modificar datos. Caché transitiva de core/identidad/pipeline/apply/importer/calidad/loader/Admin versionada; generador de shell mantiene nuevo loader. Pruebas Phase2 incorporan3 casos de transporte original en VM. No cambia dominio, DNS, Shopify, credenciales, Auth, Rules ni catálogo real. QA permanece Inactivo/stock0 en colección oculta. Falta CI/revisión/integración y reintento real con acuse Sheets.
## Factura: selección previa, guion móvil y recuperación — 2026-10-11

Checkout deshabilita nombre/RUC hasta elegir contribuyente y agrega guion desde teclado numérico mediante un control explícito. El borrador conserva ck-taxpayer-type y valores fiscales al desmarcar/recargar; la selección válida limpia sólo su aviso anterior. Validador/RUC de 3–8 números y DV, backend/Firestore/Sheets/pagos/roles y datos reales conservados. Pruebas UI originales se reutilizan en el gate runtime existente mediante invoice-component.spec.js, sin modificar workflows. Caché transitiva de navegador versionada y CSP/diagnóstico regenerados. Runbook recoge NS Cloudflare ya observados; no cambia dominio/DNS/Shopify. Evidencia/limitaciones en CURRENT_STATE; revisión protegida propia pendiente.

## Inicio, bienvenida única y datos guardados — 2026-10-11

Se elimina el ocultamiento de inicio por welcome=1. Bienvenida requiere alta canónica activa de cliente, transacción de primera aparición, plazo de lecturas/App Check y cierre inmediato sin red; layout centrado/dvh/safe area y limpieza al cambiar UID. Admin sólo preview explícito. Nombre/apellido/WhatsApp y Rules conservados.

Checkout mantiene validación condicional y libreta existentes; completa tipo de contribuyente y preferencias de envío, conserva factura al comprar sin ella, rechaza guardado tras lectura fallida/cambio UID y muestra errores. Ubicación también se guarda en encomienda a puerta. Snapshot de Usuarios recupera factura desde checkoutDefaults para el espejo Sheets, sin segunda autoridad de datos. Cache transitiva, generador de shell y CSP/diagnóstico regenerados canónicamente. Pruebas: Auth/Firestore emulados con SDK/Rules reales, casos de UI controlados separados, recuperación/guardado y errores de lectura/identidad.

Migración sólo preparada: DNS web todavía Shopify y origen main pages.dev. Lectura pública de Authentication confirma destinos autorizados; captura DNS y backup verificado. El futuro candidato de dominio queda borrador, sin merge/deploy de cutover. No se modifican DNS, correo, stock, pedidos reales, App Check, MFA, workflows, protecciones ni revisores. Evidencia y límites: docs/agent/PREPARACION_DOMINIO_Y_BIENVENIDA_20261011.md.

## Snapshot HTTP Sheets - 2026-10-11

Wrapper interno conserva status HTTP y rechaza body nulo; snapshot exige array records y limita reintentos a lectura y fallos transitorios confirmados. Errores no incluyen HTML, secretos ni payloads. No altera permisos, stock, cuentas, endpoints, triggers, DNS o Shopify. Aplicacion Apps Script HEAD posterior a integracion; version Web App no se cambia. Regresiones VM usan funciones originales y verifican que mutaciones no reintenten. Harness publico admite CRLF sin cambiar sus aserciones.

## Reanudar importacion y sincronizar Sheets - 2026-10-10

Se altera solo el coordinador create-only de importacion: IDs recuperados del mismo job van a Sheets sin reescritura; productos ajenos se omiten. Sheets no confirmado mantiene estado reintentable y libera busy aunque falle el push de recuperacion. Contadores incluyen registros omitidos por reconciliacion fresca. 7 regresiones incluidas en suite CI Phase2 (56 PASS). Versiones propagadas desde apply a importer, quality y loader con HTML y generador canonico. Sin cambios backend, Rules, stock, roles, App Check, Shopify, DNS ni datos reales.

## Interacciones reales — 2026-10-11

Filtro global acepta continuación programática de guardas y mantiene antirrebote de pulsaciones humanas. Login difiere banner automático de privacidad y confirma documento ya creado ante carrera; errores de permisos sin documento siguen rechazados. Cache coherente propagada a módulos dependientes y HTML mediante generador canónico. Phone API sólo agrega inyección de adaptadores para emuladores con defaults de producción intactos. Sin cambios de Rules, roles, stock, precios, proveedores o workflows.

Fixture público respeta envoltorio, categoría y colección; rendimiento exige hidratación/stock y respeta origen configurado. Capturas sidebar usan outputPath. Nueva suite completa obligatoria vía audit:login-profile cubre correo/OTP/perfil/sesión, errores, carrito/checkout inicial, cuenta y rechazo de roles; Auth/Firestore reales emulados, mail local y App Check no emulado. Detalle/evidencia y límites en docs/agent/REAL_INTERACTIONS_20261011.md. Merge sujeto a checks y revisión protegida exacta; no renueva sellos históricos.

## Auditoria Sheets - 2026-10-10

Unico cambio funcional: preparar validaciones del espejo de Auditoria antes de escribir JSON. No altera filas de encabezado, validaciones editables de pedidos/productos, roles, Auth, stock, precios, endpoints, Shopify ni DNS. Snapshot fallido conserva contenido. Test VM reproduce rechazo K20 y verifica aislamiento. Actualizacion live Apps Script pendiente de integracion aprobada.

## Restaurar colecciones del preview - 2026-10-10

Lectura fresca de colecciones Firestore antes de restaurar un preview local. No escribe catalogo ni aplica jobs. Mantiene exclusion por busy y Super Admin; fallo de lectura conserva el preview previo y muestra error. Versionado propagado a importador, calidad-interfaz y cargador-pagina con referencias HTML coherentes. Test de regresion de colecciones y suites existentes 21 PASS. Sin cambios DNS.

## Registro 2026-10-10: alertas operativas opcionales e historicas

- Perfil movil: tabs en filas para que todas las opciones queden visibles. CSS perfil y referencia HTML versionadas; auditor global conservado sin excepciones nuevas. Sin cambio de datos ni logica de perfil.
- Backend system-health y conciliacion checkout; UI administrativa del diagnostico y su version de cache.
- Sin cambios de precios, stock, pedidos, usuarios, Auth, Rules, DNS, origen publico o credenciales. Sin envios de correos ni activacion PayPal.
- Ventas historicas identificadas por el contrato de comercio-local; compras web y fallos explicitos mantienen alerta. Se informa el numero de registros excluidos del requisito email.
- PayPal deshabilitado se muestra neutral NO APLICA con estilos SKIPPED existentes; sandbox activo/configuracion rota siguen FAIL. Backend no declara PayPal productionReady.
- Roles cliente/invitado sin cambio; endpoint mantiene requireSuperAdmin. Cache UI versionada por injector; manifiesto regenerado desde fuente.
- Regresion: tests de system-health/backend/render y checkout operacional, sin debilitar controles. UI desplegada pendiente de integracion aprobada.

# Lista obligatoria de impacto

Esta lista se completa para cada cambio. Marcar una parte como “no aplica” requiere una razón concreta.

## Registro del 2026-10-10: login, OTP y Envíos

Base publicada `34aa0f3b`; evidencia detallada en `docs/agent/AUDITORIA_MULTIDISPOSITIVO_20261010.md` y CURRENT_STATE.

- Páginas: login (teclado) y Envíos (lecturas y tarifas); las restantes reciben únicamente referencias transitivas de caché del shell.
- Componentes: coordinación compartida de sesión en conexiones y logo canónico de cuenta/carrito/catálogo, sin cambiar imagen, CSS ni geometría. Se conservan la tipografía itálica y todas las precargas.
- Firestore: reservas server-side en la colección privada existente `emailOtpRateLimits`; Rules sin cambios, lectura/escritura cliente rechazada. Contador por correo separado del código; conserva cuota legacy cuando existe el documento previo. No hay migración destructiva ni cambios de pedidos/precios/stock.
- Auth: mismo UID, sesión, nombre/WhatsApp mínimos, proveedores y validación; MFA sólo propuesta revisable, sin activación ni excepciones nuevas. OTP conserva seis dígitos y cinco minutos.
- Checkout/pagos/Sheets: contratos ejecutados y comportamiento conservado; ninguna escritura real de prueba. Reserva de cuota y contador de intentos aplican antes de contactar al proveedor.
- Diagnósticos/caché/CSP: artefactos regenerados por helpers oficiales; sin renovar sellos de producción ni modificar controles/revisores/workflows.
- Compatibilidad: 14 tamaños y ambas orientaciones para Google/correo; Chromium/Firefox/WebKit reales con emulación de pantalla y toque. Dispositivos físicos no ensayados.
- Cierre: CI/revisión protegida/integración/publicación del SHA nuevo pendientes hasta su evidencia propia. MFA y restauración remota requieren los prerrequisitos externos documentados.

## Inventario inicial

- [ ] Páginas HTML afectadas.
- [ ] Módulos JavaScript afectados.
- [ ] CSS, tokens y componentes compartidos afectados.
- [ ] Colecciones, documentos e índices de Firestore afectados.
- [ ] Firestore Rules y permisos afectados.
- [ ] Authentication y perfiles afectados.
- [ ] Carrito, checkout, pedidos, pagos, promociones o stock afectados.
- [ ] Correos, webhooks y automatizaciones afectadas.
- [ ] SEO, datos estructurados, analítica y diagnósticos afectados.
- [ ] Datos existentes que requieren compatibilidad o migración.

## Viewports

- [ ] 1920 × 1080.
- [ ] 1440 × 900.
- [ ] 1280 × 720.
- [ ] 1024 × 768.
- [ ] 768 × 1024.
- [ ] 390 × 844.
- [ ] 320 × 568.

Revisar orientación, scroll, foco, teclado, modales, menús, tablas, formularios, imágenes, loaders y barras fijas.

## Roles

- [ ] Invitado.
- [ ] Cliente.
- [ ] Viewer.
- [ ] Agente.
- [ ] Admin.
- [ ] Super Admin.
- [ ] Cuenta bloqueada.
- [ ] Sesión vencida.

## Estados funcionales

- [ ] Carga inicial.
- [ ] Éxito.
- [ ] Sin datos.
- [ ] Error recuperable.
- [ ] Permiso denegado.
- [ ] Sin conexión o conexión lenta.
- [ ] Reintento automático o manual sin duplicados.
- [ ] Doble clic y solicitudes repetidas.
- [ ] Datos cambiados en otra pestaña.
- [ ] Regreso desde login o pago sin perder contexto.

## Seguridad

- [ ] El navegador no es autoridad final para datos sensibles.
- [ ] La acción está protegida en Firestore Rules o backend.
- [ ] No se exponen secretos ni datos personales.
- [ ] Los textos del usuario no se interpretan como HTML.
- [ ] Se validan tipo, tamaño, formato, límites y propiedad.
- [ ] Se prueban accesos permitidos y denegados.
- [ ] La acción administrativa deja auditoría.

## Datos e integridad

- [ ] Existe una única fuente de verdad.
- [ ] La escritura es atómica o idempotente cuando corresponde.
- [ ] Los reintentos no duplican pedidos, pagos, correos ni stock.
- [ ] Los pedidos conservan valores históricos.
- [ ] Las variantes tienen stock independiente cuando corresponde.
- [ ] Los documentos antiguos siguen funcionando.
- [ ] Existe reversión o respaldo para cambios masivos.

## Rendimiento

- [ ] No se agregan listeners duplicados.
- [ ] Los listeners se liberan al abandonar la vista.
- [ ] No se carga el catálogo completo sin necesidad.
- [ ] Imágenes y fuentes tienen tamaño y estrategia correctos.
- [ ] Se evita CLS y bloqueo del hilo principal.
- [ ] No se añade un loader para ocultar una espera evitable.
- [ ] Las consultas respetan el presupuesto de lecturas.

## Accesibilidad

- [ ] Navegación completa con teclado.
- [ ] Foco visible y orden lógico.
- [ ] Labels y nombres accesibles.
- [ ] Errores asociados al campo correcto.
- [ ] Contraste suficiente.
- [ ] Área táctil adecuada.
- [ ] Movimiento reducido respetado.
- [ ] No se comunica información únicamente con color.

## SEO y analítica

- [ ] Título, descripción, canonical y Open Graph coherentes.
- [ ] Datos estructurados actualizados cuando aplica.
- [ ] URL y redirecciones preservadas.
- [ ] Eventos analíticos no se duplican.
- [ ] No se envían datos sensibles a analítica.
- [ ] Errores relevantes quedan registrados con versión.

## Matriz de impactos frecuentes

### Precio o promoción

Revisar tarjeta, producto, carrito, checkout, pedido histórico, correo, panel, analítica, SEO de producto, reglas y validación confiable.

### Header, navegación o sesión

Revisar todas las páginas, estados autenticados, contador del carrito, menú desktop/tablet/mobile, foco, scroll, tienda cerrada y cuenta bloqueada.

### Rol o permiso

Revisar interfaz, rutas, Firestore Rules, permisos dinámicos, auditoría, acciones masivas y pruebas negativas.

### Pedido, pago o stock

Revisar idempotencia, transacciones, reintentos, correos, historial, cancelación, restauración de inventario, panel y perfil del cliente.

### Contenido administrable

Revisar editor, vista previa, publicación, sanitización, fallback, SEO, caché, todas las páginas consumidoras y datos antiguos.

## Cierre

- [ ] Auditorías locales correctas.
- [ ] Pull Request describe alcance, riesgo y rollback.
- [ ] Todas las comprobaciones de GitHub están verdes.
- [ ] El cambio está integrado en `main`.
- [ ] El despliegue terminó correctamente.
- [ ] No quedaron archivos, imports, estilos o TODO obsoletos.
- [ ] Documentación y registro de mantenimiento actualizados.


## Aviso de importacion restaurada - 2026-10-11

Badge distingue actividad de esta sesion del estado persistido: APLICANDO solo mientras apply esta activo; RUNNING restaurado es REANUDABLE; FAILED requiere reintento. Flag local no se persiste ni cambia autoridad del job. Versiones de cuatro recursos y HTML coherentes mediante generador cache; no modifica CRUD, stock, catalogo, permisos, DNS ni servicios. Verificacion publicada posterior a integracion; 56 regresiones PASS_LOCAL.


## Checkout: ticket confirmado y presentación — 2026-10-11

Superficies: checkout.html, pedido-checkout-seguro, hardening/fiabilidad/estado del checkout, CSS de resumen y métodos de pago. El resultado confirmado debe permanecer visible mientras se limpia y sincroniza el carrito; las recuperaciones y pasos no deben convertir una compra terminada en un carrito vacío. El ticket se descarga/comparte/imprime sólo por acción del usuario. Probar fracaso sin confirmación, ausencia de duplicados y carrito vacío ordinario, además de layouts320/390/768/1024/1280/1440/1920 en Chromium/WebKit. Las URLs transitivas y artefactos CSP/diagnóstico/caché se regeneran; fuentes de datos, notificaciones, autorización y dominio conservados.


### 2026-10-11 — Paneles y presentación de boutique, continuación del ticket

Fuentes: galeria-producto.js, tienda.js, tema-unificado-tintin.css, product-maintenance.css, panel-colecciones.js, coherencia-visual.css. Impacto: tarjetas de inicio/catálogo/colecciones/recomendaciones; selección de fotos y color en ficha; cabeceras de catálogo/carrito/cuenta/notificaciones en todas las páginas públicas. Consumidores administrativos de la paleta reciben sólo actualización de referencia, sin cambiar datos ni permisos. Validar selección bidireccional y srcset, stock sin rayas, geometría compacta, scroll de recomendaciones, CTA de catálogo, cierre y espacio de navegación móvil. Regenerar caché transitiva, shell, CSP, diagnóstico y plan protegido exacto contra main. Pruebas runtime usan renderizadores reales con fixtures sin operaciones comerciales.
# Auth y caché de comercio local — 2026-10-12

Referencia web sin versión causaba dos identidades de Auth, una cacheada con diagnóstico antiguo. Comercio local usa el mismo cliente API versionado que el resto del Admin y renueva sólo su consumidor HTML. Gate canónico detecta imports web sin query de archivos ya versionados; módulos servidor conservan imports normales. Sin cambios a permisos, catálogo, pedidos, stock, secretos o dominio. Evidencia: docs/agent/COMPROBACIONES_CIERRE_20261012.md.

## Capacidad física de Productos en Sheets — 2026-10-12

Fuente: apps-script/ProductosUnificados.gs, helper compartido por ambas rutas de sincronización de producto. Antes de copiar plantilla o escribir identidad, ampliar sólo filas físicas faltantes; reutilizar capacidad libre sin mover filas existentes. Verificar hoja llena, capacidad sobrante, plantilla vacía, fórmulas relativas y conservación de valores manuales.172/172 tests sync PASS_LOCAL; aprobación/merge y publicación del deployment existente pendientes. El job QA real confirmó media Cloudinary y reanudación tras ampliar una fila manualmente; ese workaround no sustituye la publicación del código. No cambiar triggers, propiedades, URL, permisos ni dominio.

## Diagnóstico nativo WebKit en CI — 2026-10-12

Fuente: tests/runtime/runtime-error-monitor.js, compartido por las pruebas runtime. Reconocer cancelación nativa batchGet del proyecto demo únicamente al salir del documento y con stack SDK oficial; registrar como browserDiagnostic. Errores/rechazos JS y otros destinos/contextos siguen fallando. Verificar positivos y negativos con EventEmitter, luego runtime Linux/WebKit en Actions. No modifica producción, Firestore Rules, OAuth, App Check ni URL.
# Checkout y capturas del cliente — 2026-10-12

Regresión CI de carga informativa: catálogo y prioridad se montan al usar productos, con dependencia estática obligatoria en el store. Conserva filtros, stock y menú bajo demanda. Contacto/Envíos pasan presupuesto intacto de 120 solicitudes con 115 medidas localmente y pruebas de búsqueda que rechazan productos inactivos. Se actualiza el auditor de catálogo para verificar el mismo orden obligatorio en el store; controles de seguridad/mantenimiento intactos. Configuración real corroborada en lectura con TinyFish y límites registrados en CURRENT_STATE.

Aviso de carrito compartido, bienvenida persistente e historial anterior, enlaces a pedido con detalle desplegado, referencia obligatoria en entrega a puerta, tarjetas de pago centradas, recuperación de ciudad/entrega y notificaciones canónicas de cambios administrativos. Correo admin: Super Admin, Maps, contacto cliente y WhatsApp Fito exclusivo de delivery con formato confirmado por el usuario. No hay envíos automáticos nuevos ni compras reales de prueba. Versiones de caché propagadas a consumidores comunes para todas las pantallas correspondientes. Pruebas/evidencia y límites en CURRENT_STATE; producción pendiente del nuevo CI y revisión del mantenimiento protegido. Mismo origen público.

## 2026-10-12 - Reconciliacion del borrador de dominio con main 71960405

Superficies: origen publico/Firebase authDomain, consumidores de origen servidor, SEO, referencias transitivas de cache del shell, CSP y manifiesto. Fuente funcional conservada de main; 126 fuentes comparadas y limitadas a origen/versionado. No modifica datos, stock, precios, pagos, autorizacion, Rules ni configuracion externa. Plan protegido calculado despues de los generadores, sin cambiar alcance/sellos. Evidencia y limites locales en CURRENT_STATE.

Maestro tras el cambio de origen: VERSION interna y URL de entrada alineadas con nueva identidad inmutable; codigo funcional y auditores preservados. Se valida el bloque de contratos Maestro antes de regenerar CSP/manifiesto y plan protegido.
## 2026-10-14 — Notificaciones atómicas, stock por variante y superficies completas

Pedido canónico y notifications comparten descriptor e idempotencia: recibido y transición completa delivery/pickup, sin depender del navegador de Superadmin para persistencia. Disponibilidad y primera tupla positiva centralizadas en inventario-variantes; fotos por color conservan cromaticidad, ficha/server metadata/cards/catalog/search/favorites/editor visual usan disponibilidad real. Agotados al final con etiqueta inclinada sobre foto y compras bloqueadas. Runtime único alterna superficies visibles a ancho de viewport a través de wrappers; estilos/generador público conservan script en todas las páginas, blanco de tarjetas y unión difuminada. Perfil tabs pierde sticky; mapa compartido obtiene límite independiente de navegador y descarta coordenadas inválidas/GPS tardío tras elección manual. Sin cambios comerciales reales, roles, Auth, Rules, dominios, permisos ni infraestructura. Gates existentes incorporan regresiones de navegador; versionado transitivo y derivados canónicos deben quedar estables antes del plan protegido y CI.

## 2026-10-15 — Logos compartidos y excepción semántica WhatsApp
El filtro canónico preserva blanco del footer sobre soporte negro y acota el tamaño de logos en headers de desktop/tablet. Según aclaración del propietario, móvil conserva únicamente su navegación inferior, sin barra arriba. Se conservan flags de configuración, controladores y login independiente. Tokens WhatsApp verde/blanco y migración de preferencias/caché anteriores; CTA públicos coherentes. Se reconcilia main e4279c23 preservando historia, misión, Pulseras y perfil. Impacta CSS/JS de marca, referencias transitivas y derivados CSP/diagnóstico/caché/plan. No hay cambios de datos, Rules, Auth, pagos ni proveedores. Evidencia y límites en CURRENT_STATE.
## 2026-10-15 — Optimización PageSpeed multidispositivo

Inicio incorpora main sin incluir footer, conservando secciones y bloques editables. Carrusel: variantes de entrega de imágenes, inicio de animación visible y geometría cacheada; orden, enlaces, gestos y movimiento reducido conservados. Aviso compartido de conexión cambia aside por div para usar role=status válido. Los demás consumidores sólo reciben versiones de caché transitivas y CSP/diagnóstico regenerados. Sin cambios en datos existentes, Firestore, Rules, Auth, App Check, precios, stock, pedidos, pagos, correos o automatizaciones. SEO noindex de pages.dev conservado por decisión explícita del titular. Chromium/WebKit en 12 viewports, tablet vertical/horizontal y límites de breakpoint; evidencia y restricciones en CURRENT_STATE.
