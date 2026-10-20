## 2026-10-20 — Pedidos reales, filtros y barra de selección

Fuentes: pedidos-prueba.mjs (clasificación estricta 01–25 y alias de presentación), admin-app y renderers de Pedidos/fichas, estadísticas de perfil, comercio-local backend/cliente, notificaciones administrativas y CSS de comercio. La proyección se aplica antes de derivar listas y cifras, con muestra reversible exclusiva del Super Admin y preferencia por uid/navegador; las clientas conservan sólo historial real. No borra documentos, reasigna IDs/correlativos, modifica stock/pagos ni ejecuta limpieza externa de Sheets. Los alias son de presentación, no una migración de claves históricas. Selección sólo de pedidos reales: barra fija que respeta navegación móvil y visualViewport; controles de 44px y espacio reservado. Impacta Pedidos/Dashboard/Estadísticas/Usuarios/perfil/compradores/exportación, no Auth/Rules/cobros. Tests del lote y derivados se agregan al gate canónico de Pedidos, matriz responsive al spec existente; fixtures de pruebas comerciales generales usan códigos fuera del lote explícitamente excluido. Evidencia y límites en CURRENT_STATE. Caché, CSP, diagnóstico y mantenimiento se generan desde autoridades existentes.

## 2026-10-20 — Contraste de selección y entrada superior en todo el sitio

Fuentes: cargador-pagina.js, interfaz/hoja de Productos, espacio-modulos-admin.js, pasos de checkout, acceso y pestañas/pedidos de Perfil. El reset de scroll existente se comparte con apartados aceptados y posiciones guardadas por el bloqueo; la carga de datos y las entradas del usuario no reinician la posición. Las cápsulas seleccionadas respetan los tokens primarios con contraste frente al tema global. Impacta las 19 rutas inventariadas (incluida redirección y verificación estática), módulos y subapartados, sin cambios de datos, permisos, stock, Auth ni sincronización. Se conserva PR1173. Regresiones de navegador en seis viewports, estado/guardias y contraste, y cuatro contratos Node del reset, conectados a gates existentes. Versiones, CSP, diagnóstico y mantenimiento se regeneran canónicamente. Evidencia en CURRENT_STATE.

## 2026-10-20 — Acceso claro, navegación modal y stock por opción

Fuentes: admin-app.js (presentación de sesión y configuración explícita de inventario), login.html (retorno a la sección administrativa), shopify-commerce-admin.css (navegación durante el editor modal). El acceso sin sesión se diferencia de una restauración fallida; las cuentas internas vuelven sólo a una ruta administrativa local validada. No cambia persistencia, identidad, roles, App Check ni reglas. En editor compacto se evita que la barra lateral se superponga. Los productos sin inventario por variante pueden distribuir cantidades explícitas de un atributo, conservando la comparación transaccional con el inventario original; las matrices existentes permanecen intactas. Impacta vista previa, total de stock, reintentos y cantidades vendibles por opción. Pruebas reales del controlador, Auth/login y navegador; configuración sin cantidades no escribe. Caché, CSP, plan y diagnóstico se regeneran canónicamente. Los cambios comerciales pedidos por el titular se verifican separadamente en CURRENT_STATE.

## 2026-10-19 — Fotos por cualquier atributo o combinación

Fuentes: galeria-producto.js, foto-variante.mjs, editor fotos-por-color.js y nuevo fotos-por-variante.js. Impacto: ficha, miniaturas/selección inversa, carrito/checkout/favoritos, vistas compartidas y edición administrativa de asociaciones. Posición sólo para un atributo y cardinalidad exacta; combinaciones requieren asociación explícita. Se conservan filas específicas al editar color y se evita crear Color desde una forma. Tarjeta y ficha de pedido muestran origen registrado para distinguir manuales antes de la limpieza autorizada; no clasifican orígenes ausentes. Sin cambios comerciales reales, precios, stock o permisos. Se añaden matrices reales de variante/miniatura/editor al CI existente sin omitir controles. Caché transitiva, shell, CSP, diagnóstico y plan se regeneran canónicamente. Evidencia y límites en CURRENT_STATE.

## 2026-10-19 — Etapas de pedidos pastel y prioridad de clientes recientes

Presentación de Pedidos: pasos numerados, colores semánticos compartidos entre resumen/pasos/columnas/badges y tablero ajustado al ancho, con selección de etapa hasta1180px. El ciclo de negocio, transiciones, entregas y pagos conservan su autoridad. Usuarios ordena clientes por registro/login usando la suscripción actual y relega al equipo sin alterar cuentas ni roles. Mantiene filtros y orden manual. Se conserva el trabajo de Super Admin/Push del PR1169 y la medición móvil corregida de PR1167. Caché/CSP/diagnóstico y plan protegido se regeneran; evidencia y limitaciones en CURRENT_STATE.

# Ficha de producto y fotos por forma — 2026-10-19

Fuentes funcionales: tienda.js, foto-variante.mjs y product-maintenance.css. Selección de cualquier atributo/combinación, asociación bidireccional con fotos y miniaturas, autoridad de selección disponible inicial, identidad de fotografía al reordenar por stock, estados de agotado y cantidad. Foto del carrito respeta forma y combinación exacta; sin asociación sólo se admite foto general. Superficies relacionadas: ficha en desktop/laptop/tablet ambas orientaciones/mobile, representación de variantes en carrito/checkout/favoritos/catálogo/editor; los consumidores y cargadores reciben únicamente URLs coherentes de caché. No modifica inventario, precios, permisos, transacciones ni datos remotos. Pruebas de selección/galería, primer render, stock, carrito invitado, márgenes, teclado y formatos de variantes; detalle y límites en CURRENT_STATE. Shell, caché, CSP y manifiestos se regeneran por sus herramientas. Se conservan los arreglos anteriores y se difieren merge/publicación.
## 2026-10-19 — Inicio de ventas por día en Paraguay

Dashboard aplica el filtro canónico de Facturación y actualiza ambas vistas al cambiar el corte. Modo `today` en el endpoint/control ya existente, con medianoche determinada por el servidor en America/Asuncion e inclusión del límite exacto. No cambia métricas de usuarios o pedidos si no se seleccionan, ni historial, inventario, Rules o permisos. Nuevas regresiones de límites, preservación y dashboard; matriz visual extendida a ambos modos. Caché, diagnóstico y plan protegido se regeneran desde autoridades existentes. Evidencia y limitaciones en CURRENT_STATE.

## 2026-10-19 — Alineación de Imágenes y entrega del CSS responsive

Se alinea la grilla/encabezado interno de Imágenes con su barra compartida y se agrega comprobación de ambos bordes en cuatro tamaños. Ambas páginas usan responsive-2 para evitar el CSS anterior retenido en caché bajo la primera URL, observado en lectura pública. Baseline, plan y diagnóstico se regeneran; sin cambios de negocio ni controles. PR1165 ya integrado y aprobado por CI y salud de producción; se verifica la entrega de bytes del nuevo candidato.

## 2026-10-19 — Diseño administrativo fluido para todos los dispositivos

CSS compartido del panel e Imágenes: márgenes y contenedor centrados, hero compacto según espacio disponible, accesos sin palabras cortadas, métricas de escritorio y encabezados/formularios adaptables. Cubre móviles, laptop, escritorio y tablets verticales/horizontales, manteniendo cápsula móvil, lateral, roles, borradores y controladores existentes. Sin cambios de JavaScript de producción ni lógica comercial. Se agrega matriz Chromium de12 tamaños/23 secciones,13 fronteras de distribución, giro táctil e Imágenes al gate responsive existente; evidencia y límites en CURRENT_STATE. Caché y plan protegido se generan con herramientas canónicas.

## 2026-10-19 — Navegación móvil flotante del panel

Dashboard-control.css aplica una cápsula centrada de cinco accesos, superficies neutras y geometría flotante y drop-up sólido únicamente al panel, conservando tokens de Apariencia. El controlador móvil previo sale de admin-app a un módulo importado: mismos botones, permisos, navegación y cierre. Cierra antes de la guardia de enlaces en document, para que Imágenes con borrador no deje el fondo inerte. Escape del drop-up se resuelve antes del sidebar, sin robar el foco hacia el hamburger; el sidebar conserva su propia autoridad inert. Añade aislamiento/restauración de foco, salida limpia al girar o perder autorización y tamaño con viewport dinámico. Interfaz adaptable de Productos calcula el espacio inferior completo para evitar colisiones. Se calibra además el monitor de pruebas ante una cancelación nativa documentada del catálogo local en WebKit al abandonar login, con contrapruebas que conservan fallos reales; sin cambios de producción. Cinco regresiones de menú con controlador real y guardia, más regresión existente de selección usando navbar flotante; caché/versiones, diagnóstico y plan canónico regenerados. No cambia Auth, datos, Rules, stock, pedidos, correos ni workflows.

## 2026-10-19 — Rediseño y revisión de todo el panel

Dashboard/control CSS se limita a admin y admin-images y conserva los tokens administrativos. Nuevo buscador de módulos usa registro y navegación nativos, permisos y borradores. Presentación de métricas conserva sus IDs/controladores y estados desconocidos. Se corrige la ubicación de la paginación de Usuarios y el orden de Últimos pedidos con fechas ISO mediante el helper temporal existente. Impacto: chrome, formularios, tablas y tarjetas de los 25 módulos funcionales y Maestro; no modifica backend, Auth, Rules, roles, pagos, inventario ni sincronización. Fixtures de comercio activan el CSS real; regresiones nuevas se añaden a los gates responsive/sync existentes. Caché, CSP, diagnóstico y mantenimiento se regeneran desde fuentes canónicas. Evidencias y límites en CURRENT_STATE.

## 2026-10-18 — Espacio de trabajo coherente en todo el panel

Fuentes: registro-maestro existente; nuevo espacio-modulos-admin.js/css y carga desde admin/admin-images. Presentación compartida para los 25 módulos funcionales y Maestro: navegación entre áreas visibles, acceso al filtro nativo, formularios adaptables, etiquetas y tablas con teclado. Observa montajes tardíos/reconstrucciones sin interceptar eventos comerciales. Conserva editor de Productos, lienzo visual, permisos, guardia de borradores y autoridades de datos. Impacta presentación de todas las secciones; no cambia persistencia, Auth, Rules, pedidos, inventario ni envíos. Nueve regresiones nuevas en el gate responsive y 96 de comercio; evidencias y límites en CURRENT_STATE. Caché, diagnóstico y plan se regeneran con herramientas canónicas.

## 2026-10-19 — Reconciliar PR1152 con main c3085d9a

Se conservan maestro de Productos, selección para pedidos y aviso de verificación de main, junto a su migración de publicación automática. No se alteran controles/workflows respecto de esa base. Stock/fotos y aviso por página continúan en sus autoridades existentes; plan y derivados se regeneran.

## 2026-10-18 — Integrar PR1155 en PR1152

Se preservan mosaico/paginación de Productos, acciones admin y distribución móvil de Tu selección de main46c10ef5. Catálogo con stock y avisos por página siguen compartiendo sus autoridades existentes. Se regeneran plan nativo y diagnóstico contra la nueva base.

## 2026-10-18 — Reconciliar PR1153 en PR1152

Se conserva el CSS y referencia de Tu selección de main b982cb77; no cambia la lógica de stock ni los avisos por página. Se regeneran plan nativo y diagnóstico contra main vigente.

## 2026-10-18 — Aviso limitado a la página abierta al reconciliar PR1150

Se conserva la solución de datos sin recarga de PR1151 y las mejoras de PR1150. site-version.json agrega un mapa de hashes HTML generado desde el manifiesto canónico; vigilancia-version compara sólo la ruta abierta y mantiene fallback para publicaciones anteriores/rutas dinámicas. El verificador valida el mapa exacto. Una publicación de Producto no avisa en Inicio cuando su página no cambia. La selección de fotos disponibles y agotados al final siguen en el renderer compartido. No cambia Firestore, Rules, roles, permisos ni el mecanismo de revisión humana. Se propagan las URLs inmutables y se regenera el plan contra mainc81257c0. Evidencia en CURRENT_STATE.

## 2026-10-17 — Tarjetas con stock y validación global de avisos

PR1152 conserva la foto de una variante disponible y deshabilita colores agotados en las tarjetas compartidas. Se reconcilia con PR1151/main64a17c4a, conservando su única separación de sincronización de datos y avisos de versión. Se amplían regresiones a19rutas, ambas orientaciones y stock/foto actualizados sin TTL ni aviso. No se crean nuevas revisiones, permisos, Rules ni lógica por rol/dispositivo. Referencias inmutables y protección nativa se regeneran desde las fuentes; evidencia y límites en CURRENT_STATE.
## 2026-10-18 — Productos: interfaz adaptable, fase 1

Fuentes: shopify-commerce-admin.js/css y nuevo helper de presentación products/interfaz-productos-adaptable.js. Tabla canónica se presenta como mosaico3 desktop/2 compacto, con alternativa Lista; foto contain y selección separada. Selección sobrevive filtros/páginas con indicación visible; acciones existentes y autorización se conservan. Formulario admin.html mantiene campos y handlers, reorganizados por secciones en el DOM; editor compacto ocupa visualViewport con acciones visibles. Biblioteca y guard nativo prevalecen sobre el editor; Tab/Escape y retorno de foco abarcan ficha/editor; ocultar la sección desde navegación nativa libera el scroll y conserva el borrador. Impacta presentación de Productos y manejo de teclado compartido del drawer; Pedidos tiene51 regresiones aprobadas, Colecciones conserva sus6 pruebas de integración compartidas. No altera dominio de datos, serializer, Firebase Rules, controladores CRUD, inventario, públicos, compras ni integraciones. Assets con URLs nuevas; caché/CSP/diagnóstico y mantenimiento protegidos se generan por herramientas canónicas. Nuevas15 pruebas agregadas al comando existente audit:admin-responsive; no se modifican comandos sellados de fase8 ni mecanismos de control. Evidencia y límites en CURRENT_STATE.
## 2026-10-18 — Verificación de producción y controles automáticos del titular

El ciclo real de PR1160 confirmó validación y merge sin aprobación. El monitor automático recibe verification_only para evitar el refresco de tasas reservado al dispatch manual/cron existente. La autorización automaticControlMaintenance se consulta únicamente en main: también los controles del titular pueden actualizarse mediante plan exacto, hashes y CI, sin otra aprobación manual. Un candidato no puede habilitar esa política cambiando su propio flag. Se conservan restricciones de autor/origen, alcances, sellos, SHA y todos los checks. Impacto limitado a Actions, preparación/validación del plan, pruebas y evidencia; sin cambios de cálculos de pagos, permisos de cuentas o lógica de tienda.

## 2026-10-18 — Publicación automática tras CI

Migración administrativa expresamente autorizada por el titular: workflow de mantenimiento usa workflow_run del CI de PR y código confiable de main; valida plan/hashes/alcances, autor y origen, apps/workflows/eventos de CI y SHA exacto antes de integrar y disparar auditoría/monitor de producción. El entorno manual anterior deja de participar; se mantienen los checks obligatorios. El auditor histórico continúa verificando main, y la integridad del candidato se valida mediante el plan técnico completo. Impacto: Actions, configuración y validadores de mantenimiento, pruebas y documentación. Incluye el aviso de spam del PR1157 con su mismo HTML/CSS ya verificado, sin cambiar lógica de acceso, tienda, Auth, Firestore, pagos, correos ni credenciales. Activación administrativa inicial y prueba real del ciclo pendientes; instrucciones únicas en docs/agent/MANTENIMIENTO_FLUJOS.md.

## 2026-10-17 — Estadísticas y devolución manual al borrar pedidos

Fuentes canónicas: Pedidos Super Admin y renderer estadístico existentes. Nuevo controlador autenticado admin-commerce-controls delega selección/reposición/restauración en order-trash-controls y los reinicios en statistics-controls. Mismo commit para pedido, stock, variantes, auditoría y revisión pública; versiones y precondiciones obligatorias, propietario exclusivo, sin reembolso externo. Estadísticas usa anclas por indicador, sin alterar operaciones originales; deshacer el reinicio vuelve al historial. Papelera conserva recuperación y borrado definitivo existente. Un reintento de creación no resucita un pedido archivado. Ventas locales se gestionan en su libro propio. Perfiles se recalculan desde orders con el sincronizador existente. Impacta Admin, inventario público, historial del cliente, resumen de cuenta, caché/CSP/diagnóstico; no modifica Rules, dominio ni datos en pruebas. Regresiones de cantidades/variantes/concurrencia/idempotencia, permiso/origen/sesión y seis Chromium en320/768/1440. Evidencia y límites en CURRENT_STATE.

## 2026-10-17 — Separar revisiones de datos y versiones de aplicación

Fuentes: cambios-tienda, vigilancia-version y estado-productos. Las revisiones confirmadas sincronizan datos sin pedir recarga; Inicio/catálogo omiten el TTL tras la señal y la ficha conserva su suscripción de stock. Sin cambios de formularios, almacenamiento, usuarios, permisos, Rules, pedidos, pagos, dominio o integraciones. El aviso de versión nueva sigue dependiendo de las referencias JS/CSS. Shell y consumidores sólo reciben las referencias transitivas de caché, con CSP/diagnóstico/baseline regenerados. Pruebas: versiones, reconexión, administración y sync; seis viewports de la regresión UI actualizada quedan para CI por falta del binario Chromium local. Evidencia y límites en CURRENT_STATE.

## 2026-10-16 — Super Admin y sincronización confirmada

Fuente de negocio: controladores autenticados de pedidos/catálogo/comercio y escrituras existentes del titular. Se incorpora settings/siteRevision con nonce+timestamp, watcher público de lectura puntual y mismo aviso Actualizar/Más tarde. No cambia permisos comerciales ni fuerza recarga: publicar la revisión no bloquea ni repite una operación ya confirmada. Impacta administración, galería/biblioteca, perfil, notificaciones y middleware; las Rules restringen la nueva escritura al titular. Paginación compartida completa usuarios/productos/colecciones sin perder límites por consulta; fusión del perfil elige revisión nueva; edición visible del pedido y aviso de clienta se confirman atómicamente. Ventas locales responde a señal sin pisar borradores; sidebar móvil conserva espacio del aviso. Las integraciones Sheets siguen su confirmación/webhook externo. Reporte por módulo, pruebas y límites en docs/agent/AUDITORIA_SUPERADMIN_20261016.md. Requiere CI y revisiones nativas de mantenimiento/production-rules; no se toca la migración de workflows independiente.

## 2026-10-16 — Portada y fidelidad de imágenes con reseñas reales

Fuentes: index.html, galería nueva resenas-clientas.js/css, mas-vendidos.js y contrato estructural de Inicio existente en1140. Originales: Drive TINTIN-IMAGES y RAR del titular. Fotos y banners se copian byte a byte; fallback de gestión-imagenes y precargas comparten versión, para evitar volver a variantes antiguas tras Firestore. Procesamiento/widget/panel de imágenes preservan la fuente validada y generan una miniatura separada. Más vendidos conserva tarjetas canónicas y disponibilidad de variantes, muestra sólo la selección explícita de Superadmin y responde a catálogo en vivo. Tema compartido elimina divisorias entre secciones/footer sin alterar las tarjetas blancas. Se conservan identidad, stock, URLs firmadas, App Check, datos y política de indexación. Superficies relacionadas: imágenes de productos/colecciones, Nosotros, editor visual, caché/CSP/shell generados y fondos alternados #1139. Pruebas de galería cubren 4 iniciales, 23 diferidas, X visible, Escape, foco, scroll y no duplicación al reabrir; selección y fidelidad tienen regresiones específicas. Estado/evidencia en CURRENT_STATE.

## 2026-10-15 — Reconciliación final de Producto y Actions

La CI38836038807 confirmó 342 pruebas de navegador en Chromium/WebKit y los controles de build, artefactos y seguridad. La X restante no era funcional: el auditor de catálogo exigía la sintaxis vieja de importación lateral. Reconoce ahora la importación nombrada actual, manteniendo el requisito de que la política preceda al store; 15/15 controles PASS_LOCAL.

Base e858d20d: se preservan las mejoras ya publicadas de imágenes y retratos de PR1135. Producto toma la precarga una sola vez al iniciar y shell/ficha comparten esa operación; si una CPU tarda más de 30 s, la respuesta ya tomada sigue alimentando ficha y relacionados sin descargar de nuevo. Las solicitudes posteriores mantienen el vencimiento normal de 30 s. Regresión Node simula el vencimiento durante la respuesta; 9 Chromium 320–1920 con CPU ×4 y Firebase bloqueado confirman una lectura individual, una de catálogo y tres relacionadas.

La lista de Actions queda: dependencias de PR1116/1117/1118 integradas y verificadas; PR1135 MERGED; PR1122 independiente; PR1134 con CI38802283841 SUCCESS pero bloqueado sólo por la migración administrativa revisada de workflows. No cambia Rules ni se eluden controles. Pendientes del candidato: generadores, CI exacta, mantenimiento humano y Pages.

## 2026-10-15 — Corrección del fixture de galería detectada por CI

CI38805533328 del SHA9586a6df:291 pruebas runtime aprobadas y51 fallas de product-color-gallery (17casos×3proyectos) por ReferenceError de _pdRenderedSignature en el simulador que extrae el renderer real. Se inicializa ese estado en el harness, como los otros estados privados de la galería. Se conservan todas las aserciones de fotos, miniaturas, inventario, editor, tamaños y controles; no se cambian timeouts ni código de compra para pasar CI.20 Chromium de galería aprobados tras el ajuste; matriz escritorio/móvil y WebKit del nuevo SHA pendiente de CI. WebKit local se descargó pero faltan bibliotecas del host; no atribuir PASS local a ese motor. El diagnóstico se regenera después del fixture final y se revalidan las70huellas protegidas.

## 2026-10-15 — Contraste del logo al conservar el footer personalizado

La reconciliación de1135 conserva el fondo elegido por Super Admin. Se protege también la norma anterior del titular: apariencia-global asigna únicamente el filtro del logo según la luminosidad del fondo elegido y los dos tokens de marca; al retirar la personalización libera ese filtro para volver a la alternancia existente. No modifica el fondo por el logo. Dos Chromium390/1440 verifican rosa claro→logo rosa oscuro, rosa oscuro→logo rosa claro, fondo intacto al ocultar/mostrar otra sección y recuperación de la alternancia al limpiar la configuración. PASS_LOCAL. Versiones y plan se regeneran después del shell final.

## 2026-10-15 — Candidato integrado: Producto y X de Actions

Codex /root. Base9055392f. Se reconcilian la ficha rápida, las correcciones funcionales del PR1135 y las dependencias de los PR1116/1117/1118 en un único candidato, conservando PR1131/1133. Normalización y transporte públicos mantienen su única autoridad; los SDK de realtime se cargan después de poder pintar la ficha. Se comprueban caché, borrados/categorías tardíos, visibilidad y stock en vivo. Las versiones inmutables de ambos candidatos se alinean antes de regenerar CSP, plan y diagnóstico. Las correcciones de workflows quedan exclusivamente en PR1134, actualizado a229696f2 con build reproducible; el contrato requiere migración revisada del mecanismo, sin modificar sus hashes ni eludir controles.

PASS_LOCAL:302 pruebas Node22 de cuentas, seguridad, operaciones, perfil, estadísticas, transporte y catálogo.27 pruebas de parsing/shell también pasan en Node22 con parse5v8.25 Chromium de producto, inventario y menú de colecciones en320–1920 sobre main integrado;8 Chromium adicionales sobre el candidato combinado validan carga con Firebase bloqueado, tres tarjetas reales, render único, actualización de stock y6 casos de bienvenida. Los13 casos anteriores de SEO/tarjetas conservan evidencia separada previa a la combinación; CI final debe revalidar toda la superficie.192 controles de Rules y prueba REST real200peticiones/límite20 en emulador aprobados;18 controles de teléfono/identidad aprobados con Firebase13/rules-testing6/CLI15.33. npm audit:0 vulnerabilidades. Arquitectura, storeGate75/75, rendimiento, App Check y presupuesto de lecturas aprobados.

Correcciones de pruebas de CI: el fixture del emulador prepara lectura y commit de un documento independiente antes de medir concurrencia, conservando200peticiones, límite20,5s de producción y rechazo de un isolate frío. El contrato de deadline usa reloj controlado: no aborta a49ms y sí a50ms para OAuth/GET/commit, sin depender de duración RSA o carga del runner; no aumenta timeout de producción. CSP se regenera después de fusionar imports inline. No se rebajan aserciones, cuotas, permisos ni Rules.

PENDING:build y CI del SHA final, revisión humana de mantenimiento, merge y verificación de Pages. Rules modificadas se validan sólo en emulador hasta su despliegue oficial y revisión production-rules; no afirmar publicación de Rules ni escrituras comerciales. No se crean cuentas/pedidos/pagos/correos reales. La migración de PR1134 no puede aprobarse mediante el mantenimiento ordinario. PR1122 mantiene sus cambios de interfaz antiguos separados: su CI funcional pasó y la X corresponde a protección/conflictos, sin evidencia de un defecto vigente de main que justifique reintroducir ese rediseño.

## 2026-10-15 — Revisión de las X de Actions solicitada por el titular

Se revisan ejecuciones y checks nativos, sin eliminar historial ni inventar un PASS. Main9055392f tiene CI38794447458 y salud38799815593 SUCCESS. Las X de pull_request_target son controles separados de las pruebas funcionales.

| Caso | Causa comprobada | Corrección o requisito vigente |
| --- | --- | --- |
| PR1116,1117,1118 | Repository audit falla en Reject generated artifact drift; mantenimiento indica Huella candidata incorrecta: package-lock.json | Se reúnen las versiones propuestas de Firebase de pruebas/CLI, Playwright y parse5; se instala y verifica el lockfile, regenera manifiesto y renuevan las huellas mediante el generador canónico. No cambia el SDK CDN público. |
| PR1134 | Reject generated artifact drift; Protected flow maintenance rechaza cambios al mecanismo de control | Rama actualizada con main y manifiesto regenerado en preparación separada. Los dos workflows requieren migración administrativa revisada: no se incluyen en el mantenimiento ordinario de Producto ni se elude ese control. |
| PR1135 | Pruebas funcionales38765766270 SUCCESS; dispatch38798216820 falla porque PR/main cambiaron | Correcciones reconciliadas con main9055392f e incorporadas al candidato de Producto; se renuevan plan y CI del SHA final. No se hereda aprobación. |
| PR1122 | Pruebas38494442098 SUCCESS y controles protegidos pendientes; rama antigua con conflictos | Conservar como revisión independiente de cambios funcionales; no integrar su rediseño previo sobre Producto para ocultar una X. Requiere reconciliación y revisión del SHA vigente. |
| Historial PR1131/1133 | Revisiones previas o canceladas | Reemplazadas por ejecuciones finales y merges ya confirmados; no necesitan cambios retrospectivos. |

La validación local de las dependencias encontró una carrera del fixture de cuota: la primera conexión a un proyecto nuevo del emulador agotaba el plazo antes de las200 peticiones. Se preparan lectura y commit de un documento emulado independiente antes de medir; se conservan límite20,200peticiones, rechazo429/503, comparación con cuota persistida e isolate frío. Sin cambiar límites ni tiempo de producción.

## 2026-10-15 — Arranque rápido de ficha y recomendaciones

Codex /root, base9055392f, conservando PR1131. El grafo estático de producto y su política de visibilidad arrastraba Firebase/Auth; además relacionados se solicitaba después de App Check, el catálogo repintaba la ficha y las fotos recomendadas esperaban lazy. Se extrae la metadata pública de colecciones a una única fuente pura, reutilizada por su store existente, y el SDK del documento se carga dinámicamente. Producto evalúa su store desde el head e inicia su UI sin esperar DOMContentLoaded. Precarga pública inicia documento y catálogo en paralelo, con caché fresca, single-flight, timeout y transporte válido30s; no actúa en otras páginas ni previews. Edge/caché pintan y programan relacionados sin esperar SDK/App Check; el listener sigue tomando control de precio/stock cuando está listo. Se conservan visibilidad canónica y guardas contra eliminación, cambios de categoría y respuestas antiguas. Render idéntico no reinicia galería; cambios de stock sí actualizan. Tres fotos recomendadas eager/async; otras listas siguen lazy. SSR entrega texto escapado y stock; compra espera hidratación. Navegación reutiliza el catálogo sin solicitud duplicada.

Auditores siguen las funciones movidas a metadata pura y la programación real de relacionados. El auditor de cuota reconoce la versión literal existente sin cambiar el runtime ni su requisito de una carga sólo en Checkout. Fixtures de catálogo dejan pasar storeGate al servidor canónico, evitando simular una tienda cerrada por una respuesta del recurso incorrecto. No se modifican datos reales, permisos, reglas ni proveedores.

## 2026-10-16 — Arranque más liviano de fondos alternados

La fuente única `js/theme/alternancia-secciones.js` deja de programar recálculos por scripts de datos, diálogos fijos, atributos sin cambio y escrituras propias que no afectan el flujo. Sólo vuelve a medir al cambiar una sección real, su visibilidad, tamaño o estructura; conserva la actualización al revelar una sección mediante clase. También evita reescribir el tono ya aplicado. No modifica colores, geometría, App Check, sesión, comercio, datos ni dominio. Dos regresiones Chromium cubren las mutaciones inertes y el cambio de tono después de ocultar una sección. El experimento Lighthouse local con la misma página pública y el recurso sustituido sólo en el navegador de prueba reduce ese módulo de 463 ms a 308 ms de scripting; no equivale a una medición oficial de PageSpeed ni elimina los costes externos restantes. El teardown de las pruebas runtime marca el cierre de página antes de `page.close`: conserva los fallos reales y clasifica sólo la cancelación exacta del emulador WebKit ocurrida durante ese cierre.

## 2026-10-15 — Menos layout forzado durante el arranque

Se integra el PR1131 existente en lugar de duplicar la optimización del carrusel y sus variantes responsive. Fuentes adicionales: index.html precarga sólo el banner WebP correspondiente al viewport antes de los scripts bloqueantes; alternancia-secciones.js agrupa las lecturas antes de escribir y omite observar sus propias escrituras y las inserciones de tarjetas que no alteran estructura/tamaño; tienda.js sustituye sondeo por frame/intervalo por eventos de avisos superpuestos y una temporización de restauración. Conserva el retorno temprano sin avisos del PR1131 y reserva el espacio durante animaciones de entrada. Superficies relacionadas: privacidad, feedback del carrito, WhatsApp, tarjetas blancas, perfil y fondos públicos; sin cambiar comercio, sesión, App Check, política noindex ni dominio. Regresiones: selección/descarga única del banner, mutaciones ajenas sin medir, avisos insertados/ocultos/retirados, scroll320–1920, perfil y carrusel. Referencias de caché, CSP, plan y diagnóstico se regeneran canónicamente.

## 2026-10-15 — Tarjetas y agotados en todas las listas

Codex /root. Pedido ampliado dentro del PR1133: imágenes de tarjetas transparentes, divisoria gris entre imagen y descripción y estado agotado distinguible en capturas (imagen atenuada, tarjeta gris y aviso horizontal gris grande centrado). Fuente única compartida tema-unificado-tintin.css y sistema-superficies-tintin.css; incluye tarjetas de catálogo, compartidas y editor visual, con etiquetas compactas en búsqueda/favoritos. No se editan fotos originales. Otros productos prioriza isPurchasable canónico y no reintroduce agotados con helpers antiguos; catálogo conserva su orden disponibles→agotados. No cambios de datos, precios, permisos ni stock.

## 2026-10-15 — Diamante y contraste inverso del logo del footer

Codex /root. About: facetas internas del diamante convergen en la punta y dejan de cruzarse como X. Footer compartido: conserva la secuencia y fondos existentes; el tinte alfa del logo usa primary sobre light y accent sobre pink, sin tarjeta. Dos filtros SVG usan los tokens de marca; la regla data-tt-flow-block prevalece sobre el fallback CSS por posición. Referencias y caché actualizadas desde fuentes. Evidencia y límites en docs/agent/CURRENT_STATE.md.

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

## 2026-10-18 — Productos responsive y selección

Tu selección: sólo distribución móvil de sus filas; tarjeta blanca preservada. Admin Productos: mosaico3/2 columnas, fotos grandes contenidas, indicadores, selección/acciones existentes y detalle técnico. Lectura operativa paginada completa sólo para superadmin; roles acotados sin cambio de Rules. Activación masiva exige resultado confirmado y conserva pendientes ante fallo. Reutiliza CRUD, permisos, stock/variantes, auditoría, Sheets y avisos existentes; no agrega esquema ni dependencias. Las suites nuevas se registran en audit:admin-sync y audit:admin-responsive, ambos usados por CI/Maestro. Evidencia local: 34 Chromium únicos (6 existentes,21 nuevos mosaico/editor,7 selección),16 Node sincronización,28 controles sync y42 multimedia. CI/publicación y verificación remota pendientes; no se ejecutaron eliminaciones ni compras reales.

## 2026-10-18 — Maestro de Productos y pedidos existentes

Admin Productos: editor nativo/duplicación segura, SKU/galería/indicadores, selección persistente y edición masiva atómica con vista previa. Agregar selección sólo abre un pedido existente para revisión; guardado usa el backend canónico de pedidos/inventario y conserva su identidad. Impacta admin.html, admin-app, comercio/CSS, helper responsive y editor de pedidos; nuevos módulos puros e interfaz sin dependencias. No cambia Rules, Auth, backend de pagos, borrado global ni datos comerciales existentes. Registro de suites en gates Admin, actualización de referencias de caché, baseline/plan y artefactos canónicos. Véase CURRENT_STATE para evidencia y límites.


## 2026-10-19 — Texto breve de cookies

Resumen del componente compartido de consentimiento simplificado para todas las páginas y dispositivos. Cambia texto visible; mantiene elección y comportamiento de estadísticas. Importadores/versiones, CSP y diagnóstico se regeneran para entregar los nuevos bytes. Evidencia en CURRENT_STATE.


## 2026-10-19 — Super Admin adaptable y notificaciones identificadas

Navegación agrupada y búsqueda desde lateral/cajón mediante controles existentes; superficies rosadas suaves, logo original blanco, campos táctiles de 44px y tipografía móvil sin zoom. Aplica al shell y las 26 superficies del registro Maestro, incluida Imágenes. Push corrige destinos históricos y ventanas que fallan al navegar; el pedido consume la suscripción autenticada, conserva destino tardío/reintento y elimina el parámetro al abrir. Login identifica el perfil del servidor, conserva auth_time y deduplicación; no publica correos ni datos de envío. Iconos derivados originales sólo en app/admin/push. Telemetría y espejo local refrescan visibles sin pisar borradores; API autenticada canónica renueva 401. Auditor push alinea sus comprobaciones con el guard central vigente y el aviso explícito de pantalla bloqueada. Sin operaciones reales, cambios de roles, Rules, infraestructura ni dominio. Evidencia por módulo y límites en SUPERADMIN_REVIEW_20261019 y CURRENT_STATE.


## 2026-10-19 — Rendimiento del candidato consolidado

El loader comparte la preferencia canónica y difiere el runtime de estadísticas hasta el permiso afirmativo. Reduce tres módulos innecesarios para visitas sin consentimiento, conserva consentimiento guardado y posterior, y mantiene presupuestos de rendimiento. Referencias de caché del loader y derivados se regeneran. La ficha/variantes y el stock no cambian por esta optimización; la devolución de pedidos de prueba queda explícitamente autorizada pero pendiente de acceso autenticado y verificación de origen.
## 2026-10-19 — Productos: editor visual, vista previa y galería acumulativa

Fuentes: interfaz-productos-adaptable.js, vista-previa-producto.js, admin-app.js y shopify-commerce-admin.css. Campos y guardado canónicos conservados; reorganización visual, miniaturas de stock y vista previa sin escrituras. Galería usa carga/biblioteca existentes y conserva sus fotos pendientes mediante cleanupPrevious:false, también en cargadores de colores/combinaciones; otros consumidores del widget mantienen su comportamiento por defecto. Ajuste de foco específico de la ficha de Productos para Safari/WebKit. Impacto relacionado: administración de imágenes recibe sólo la URL versionada del mismo widget; CSP, caché y diagnóstico se regeneran desde sus fuentes. No cambia catálogo real, permisos, precios efectivos, inventario, pedidos ni proveedores. Verificación: pruebas de Productos, galería, controladores, permisos, foco y geometría móvil/tablet/laptop/desktop; límites de producción en CURRENT_STATE.md.
## 2026-10-20 — Comparación concurrente del editor de Productos

Fuente: admin-app.js, listener de catálogo y guardado transaccional del editor. Impacto: edición de precios/datos, stock total y por variante, representación histórica de opciones, reintentos después de fallo de inventario privado o sincronización. La comparación usa el documento original; la interfaz conserva el saneado. La huella completa sigue detectando cambios reales de otra sesión y productos borrados. No cambia esquema, permisos, reglas, cantidades reales, borrado ni contraseñas. Regresión en maestro-productos-controlador.test.mjs; caché, plan protegido y diagnóstico se generan con las herramientas existentes. Evidencia y límites en CURRENT_STATE.
