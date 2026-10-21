# Revisión de comercio y experiencia — 21/10/2026

Responsable: Codex /root. Base integrada: main `4202dd26e` (incluye Perfil, iconos y respaldo cifrado de #1192). Alcance solicitado por la titular: stock/checkout, totales, seguimiento, catálogo/ficha, consistencia visual, formularios, rendimiento, operación administrativa, seguridad, recuperación, accesibilidad y SEO. El carrito persistente ya fue validado por la titular; sus regresiones relacionadas se conservan.

## Cambios con evidencia

- **MEDIUM — Checkout sin salida explícita tras agotarse una opción.** `pedido-checkout-seguro.js` mostraba sólo `error-4` y “Revisar carrito” al confirmar; los pasos anteriores sólo comprobaban que hubiera líneas. Se agrega comprobación anticipada contra Firestore servidor, con plazo8s, sin reservas ni escrituras comerciales. Se conserva validación final autoritativa y requestId estable. La titular confirmó luego la reserva inmediata de pedidos públicos nuevos: se aparta atómicamente antes del pago, sin aplicar descuentos a históricos/manuales. Diálogo común, responsive, teclado y Escape: Ver catálogo → `/catalogo`; Cerrar/Escape → `/`. Ajusta sólo cantidades/líneas afectadas; conserva el resto. No atribuye el agotamiento a otra persona sin evidencia.
- **MEDIUM — Recorte silencioso por stock realtime.** El runtime ya limitaba/quitaba líneas al releer el carrito. Ahora comunica esa reducción una sola vez, después de guardar la proyección, con identidad capturada. Checkout usa el mismo diálogo; ignora otra identidad, confirmación en curso, recibo y pago PayPal pendiente. No se altera persistencia, sincronización remota ni política comercial.
- **MEDIUM — Búsqueda sin tolerancia a erratas y criterios divergentes.** Catálogo exigía una subcadena completa; el panel ya admitía palabras separadas. Ambos usan ahora la misma fuente: acentos, palabras en cualquier orden, SKU, categoría, descripción, etiquetas y variantes. Una edición/transposición por palabra de al menos4 letras, sin tolerancia para códigos numéricos. Se retira el buscador clásico competidor: tienda.js delega al controlador idempotente del shell. El panel conserva precio anterior/descuento y prioridad exacta entre disponibles; el catálogo conserva el orden comercial, agotados al final y sus filtros. Índice por objeto y debounce existentes; sin consultas adicionales.
- **MEDIUM — JSON-LD de cliente ignoraba inventario por variante.** La metadata del primer HTML ya usaba `hasProductStock`, pero `tienda.js` podía volver a anunciar InStock usando sólo el agregado. Ahora el cliente aplica la misma política de disponibilidad, también en el estado inicial de la ficha.
- **LOW — Descripción alternativa omitida en ficha y metadata de cliente.** Se admite `description` cuando `desc` está vacío. Características siguen mostrando exclusivamente material/medidas/cuidados/etc. reales y escapados. No se inventan dimensiones, garantía, materiales ni propiedades.
- **LOW — Autocompletado incompleto en checkout.** Nombre, correo y dirección reciben tokens estándar; correo declara teclado apropiado. Se conservan borradores, validación y permisos.
- **LOW — Metadato de categoría de favorito incorrecto.** La tarjeta del catálogo serializaba la función `catLabel` en lugar de la categoría del producto. Usa ahora `cardCategory`, escapado.

## Cobertura de lo solicitado

| Área | Revisión y criterio |
| --- | --- |
| Carrito | Validación manual del titular; regresiones de cantidades, variantes, persistencia y cambios de identidad. No se reinventa el runtime. |
| Stock y concurrencia | Dominio servidor con precondiciones atómicas, reintentos409, pruebas simultáneas de última variante; diálogo anticipado y respuesta final. Los nuevos pedidos públicos reservan al registrarse, aunque el pago esté pendiente; el servidor impide desactivar la reserva desde el navegador. Cancelación/rechazo libera una vez y reapertura valida/aparta de nuevo. Históricos/manuales conservan su política. |
| Totales y envío | Cotización autoritativa, cambio de precio/envío exige reconfirmar, ciudades/tarifas, encomienda y cupones. No se introduce un motor paralelo de descuentos. |
| Seguimiento y notificaciones | Estados canónicos, correo recuperable e idempotente, destino push/propiedad del pedido y pruebas existentes. |
| Catálogo | Buscador compartido, filtros, vacío/reinicio, variantes y agotados al final; límite público1000 y umbral operativo800 conservados. |
| Ficha | Descripción alternativa, características reales, fotos/variante, disponibilidad y SEO coherentes. Completar datos comerciales ausentes requiere información real del producto. |
| Consistencia visual | Se conserva la fuente global de tokens/superficies tipográficas, focus y controles; no se superpone un segundo tema. Pruebas públicas y administrativas responsive. |
| Formularios | Tokens de autocompletado; validación accesible y conservación del borrador existente. |
| Rendimiento | Suite completa de65 pruebas aprobada: cargas iniciales, imágenes, CLS, consultas/listeners, catálogo por demanda y dimensiones320–1440. Buscador probado con1000 entradas. |
| Administración | Suites de pedidos y navegación entre módulos/acciones/edición, búsqueda y borradores. No se cambian estados ni se escriben pedidos/productos reales para probar. |
| Seguridad | Políticas públicas y servidor: datos vigentes, permisos, propiedad, bloqueo y cotización; auditoría estática aprobada. No se cambian Rules ni se rebajan permisos. |
| Recuperación | Salud/conciliación y recuperación de correo; tests de copia cifrada con cifrado/descifrado real y comparación de bytes. Se verificó el workflow remoto39647692594 y su artefacto cifrado; ver detalle de alcance al cierre. |
| Accesibilidad | Etiquetas, error, foco, teclado, región offline; diálogo integrado con el gestor canónico de accesibilidad, acciones48px y viewport bajo. |
| Google/WhatsApp | HTML inicial con canonical/social/Product JSON-LD, indexación de privados y actualización cliente coherente con variantes. |

## Límites concretos

- Dos regresiones de cantidades en navegador no pudieron inicializar el SDK real porque la red del entorno rechazó los cuatro módulos de www.gstatic.com (ERR_TUNNEL_CONNECTION_FAILED / HTTP403). El mismo runtime pasa sus contratos Node; no se marca aprobada esa integración de navegador. Las otras62 pruebas del conjunto pasaron.
- El emulador de Firestore no pudo descargar `cloud-firestore-emulator-v1.22.0.jar` desde el proveedor: ejecución local de reglas BLOCKED. Se conserva el gate de CI; no se sustituye por PASS ni se cambian reglas.
- No se hizo restauración nueva sobre una base remota, ni se modificó producción para probar stock/pagos/notificaciones. Los tests usan fixtures y almacenamiento aislado. Descifrar y recuperar bytes en pruebas no certifica el snapshot remoto actual.
- CI y producción requieren evidencia del SHA final. Resultados de main o de una cabeza anterior no certifican esta rama.

## Evidencia de esta rama

- Lote inicial 452/452 Node: checkout, carrito, catálogo, búsqueda, pedidos, pagos, cifrado y notificaciones. Incluye mutaciones negativas del auditor para impedir retirar tags, variantes, visibilidad o reintroducir un segundo buscador.
- Lote inicial 210/210 Chromium de UI pública/administrativa: producto, variantes, selección, catálogo/colecciones, panel y push; mobile/tablets en ambas orientaciones, laptop y desktop.
- Lote inicial 126/126 combinaciones del auditor canónico (18 páginas ×7 dimensiones).
- Lote inicial 62/64 Chromium de dominio:15 del nuevo agotado,8 de búsqueda, ficha, accesibilidad, SEO, módulos y2 controles de cantidades. Dos integraciones de cantidades adicionales están bloqueadas por el CDN, como se detalla arriba.
- 8/8 recorridos de búsqueda repetidos después de retirar el controlador competidor; precio anterior/descuento visibles y navegación por teclado conservados. Auditor de búsqueda desktop/mobile aprobado con colecciones reales de fixture.
- Build, CSP, rutas, caché y protección se regeneran desde autoridades; no se eliminan comprobaciones para superar el cambio de controlador.

La titular confirmó expresamente: «Sí, apartarla al confirmar el pedido». Se implementa para nuevos checkouts. Tres pruebas del dominio transaccional cubren clientas simultáneas, reintentos, pago/confirmación sin doble descuento, cancelación/reapertura y campos manipulados;83/83 pruebas iniciales del dominio público/pedidos/pagos y484/484 del lote checkout/pedidos/pagos/sync aprobadas. No hay migración de pedidos históricos ni vencimiento automático añadido.

## Ampliación solicitada: header y Pulseras

- Header público: la misma fuente de superficies extiende fondo y blur mediante una cola enmascarada de32–56px debajo del área del encabezado. No cambia altura, layout ni nitidez del texto y la cola no captura punteros.10 dimensiones aprobadas, incluidas ambas orientaciones.
- Colecciones del panel comercial: se reutiliza `unifyWristCollections` que ya usa el sitio y el panel anterior. Pulseras es principal; listado, total, filtros, ficha, clasificación y vista de productos incluyen categorías históricas. No altera snapshots crudos para concurrencia ni borra productos/documentos. El enlace Ver productos aplica el filtro al controlador visible. Caso13+9=22 aprobado en10 dimensiones;20/20 Chromium del conjunto header/colecciones.

## Cierre de la reserva y conciliación

El pedido que acaba de reservar sus propias unidades conserva su resumen durante la petición y el pago PayPal: los consumidores canónicos del carrito, guardias y navegación respetan el estado en curso. El recibo indica la reserva real. Recargar PayPal recupera por UID/referencia el pedido pendiente sin volver a crearlo, y su módulo consume la referencia aunque cargue tarde. La referencia en sessionStorage contiene sólo UID, orderId, savedAt y paymentPending; nunca dirección ni tokens. Cancelados/rechazados no se restauran como compra terminada.

Evidencia local del cierre: 404/404 Node checkout/pedidos/pagos/catálogo/carrito; 191/191 de sincronización/productos y buscador; 50/50 del dominio de pedidos al añadir liberación explícita de cancelados y rechazados sin pago; 16/16 Chromium de disponibilidad, identidad, navegación y PayPal tardío. Los lotes se solapan y no se suman como pruebas únicas.

Se integra #1195 desde main mediante merge normal. Se extiende la misma capa enmascarada del header, sin añadir un segundo fondo; el ocultamiento contempla también su extensión para no dejar halo. Se conservan las regresiones de transparencia/píxeles y ambas evidencias documentales. Los derivados y el plan se regeneran contra main8081ab515. La verificación final de la interfaz conciliada, CI y publicación siguen pendientes hasta obtener resultados del SHA correspondiente.

Recuperación de PayPal ya pagado al recargar: consulta al servidor para evitar estado offline obsoleto, muestra comprobante y limpia carrito/requestId una sola vez; no reinicia el pago. Caso pendiente conserva carrito y reserva. Contrato de recuperación cubre ambas salidas e identidad.

Respaldo remoto comprobado por API de GitHub: run39647692594, main6dfad3020, concluido success. La etapa Exportar Firestore fue omitida: esta ejecución preparó una copia cifrada del último export completo y la conservó correctamente. Artefacto firestore-encrypted-39647692594, 12.229.272 bytes, creado2026-10-21T17:53:21Z, no vencido al consultar y con expiración2026-10-22T17:53:20Z. Esto verifica la copia cifrada disponible; no certifica fecha del snapshot original ni una restauración real remota. No se descargó ni expuso contenido comercial. Consulta: https://github.com/tintinaccs/tintin-web/actions/runs/39647692594.

Rendimiento del candidato conciliado:65/65 Chromium PASS_LOCAL. Transparencia/ocultamiento del header:20/20 PASS_LOCAL. El fixture de cambio de sesión se sincroniza con una barrera explícita de lectura para no depender de150ms de reloj bajo carga.

Cierre de interfaz conciliada:230/230 Chromium UI,126/126 combinaciones canónicas,65/65 rendimiento y16/16 disponibilidad/PayPal sin reintentos. Gate tipográfico detectó una declaración redundante de fuente en el diálogo: retirada para heredar la fuente canónica sin añadir otra definición. Tipografía, colores, integridad CSS y arquitectura modular PASS_LOCAL. PR #1196 publicado; CI y producción pendientes de la cabeza corregida, sin heredar el preview del SHA anterior.

Ampliación de validación administrativa: el auditor y el recorrido anterior exigían llamar al filtro de la tabla oculta. Se actualizan para comprobar el controlador visible y la categoría canónica; regresiones negativas rechazan perder el alias, el enlace de navegación, el reinicio de búsqueda o volver al puente antiguo.66/66 contratos y el recorrido de colección Relojes con una sola fila visible PASS_LOCAL;71/72 recorridos anteriores ya aprobados, con su única expectativa antigua corregida y repetida. El lote adicional de gates sólo conserva BLOCKED en el runtime con emulador, porque falla la descarga del mismo JAR; las30 pruebas de login/ubicación previas sí pasan. La batería administrativa restante y CI del nuevo SHA siguen pendientes.

Batería administrativa adicional202/202 Chromium PASS_LOCAL. El análisis CodeQL del SHA14880a4 informó dos alertas nuevas de severidad alta. Se reemplaza la eliminación de nodos ejecutables mediante expresión regular en la maqueta del checkout por el parser canónico removeFixtureScripts (también retira precargas de módulos). El análisis de la nueva cabeza debe confirmar su resultado: no se descartan alertas ni se desactiva CodeQL. Sin cambios de negocio adicionales.

Conciliación de #1193: se incorpora main4202dd26e mediante merge normal. Se conservan edición rápida, tarjetas adaptables y consentimiento/ejemplos del acceso. El selector editable de colección compara categorías canónicas y muestra Pulseras en productos históricos Brazaletes; la visibilidad usa el documento fuente cuando falta el principal. Se actualiza el caso13+9 para el contador y selector nuevos. CodeQL del SHAec8809b60 PASS, sin alertas nuevas tras sustituir la expresión regular por el parser canónico; se exige CI nueva del árbol integrado. No se hereda el resultado del SHA anterior.

Sobre main4202dd26e:69/69 contratos de sincronización administrativa PASS_LOCAL;16 recorridos de consentimiento,6 del módulo de comercio y10 de Pulseras aprobados. El último grupo comprueba contador22, selección Pulseras de un producto histórico Brazaletes y conservación de los9 documentos crudos. Se ajusta la inicialización de datos del fixture compartido para conservar su nueva fuente de colecciones. Gates estáticos de Fase8/Fase10, tipografía, protección y caché aprobados; regeneración final y CI/publicación pendientes del árbol conciliado.
