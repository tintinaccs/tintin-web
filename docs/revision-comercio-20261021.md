# Revisión de comercio y experiencia — 21/10/2026

Responsable: Codex /root. Base: main `6dfad3020` (incluye Perfil, iconos y respaldo cifrado de1192). Alcance solicitado por la titular: stock/checkout, totales, seguimiento, catálogo/ficha, consistencia visual, formularios, rendimiento, operación administrativa, seguridad, recuperación, accesibilidad y SEO. El carrito persistente ya fue validado por la titular; sus regresiones relacionadas se conservan.

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
| Recuperación | Salud/conciliación y recuperación de correo; tests de copia cifrada con cifrado/descifrado real y comparación de bytes. El estado de respaldos remotos actuales no se infiere de documentación histórica. |
| Accesibilidad | Etiquetas, error, foco, teclado, región offline; diálogo integrado con el gestor canónico de accesibilidad, acciones48px y viewport bajo. |
| Google/WhatsApp | HTML inicial con canonical/social/Product JSON-LD, indexación de privados y actualización cliente coherente con variantes. |

## Límites concretos

- Dos regresiones de cantidades en navegador no pudieron inicializar el SDK real porque la red del entorno rechazó los cuatro módulos de www.gstatic.com (ERR_TUNNEL_CONNECTION_FAILED / HTTP403). El mismo runtime pasa sus contratos Node; no se marca aprobada esa integración de navegador. Las otras62 pruebas del conjunto pasaron.
- El emulador de Firestore no pudo descargar `cloud-firestore-emulator-v1.22.0.jar` desde el proveedor: ejecución local de reglas BLOCKED. Se conserva el gate de CI; no se sustituye por PASS ni se cambian reglas.
- No se hizo restauración nueva sobre una base remota, ni se modificó producción para probar stock/pagos/notificaciones. Los tests usan fixtures y almacenamiento aislado. Descifrar y recuperar bytes en pruebas no certifica el snapshot remoto actual.
- CI y producción requieren evidencia del SHA final. Resultados de main o de una cabeza anterior no certifican esta rama.

## Evidencia de esta rama

- 452/452 Node: checkout, carrito, catálogo, búsqueda, pedidos, pagos, cifrado y notificaciones. Incluye mutaciones negativas del auditor para impedir retirar tags, variantes, visibilidad o reintroducir un segundo buscador.
- 210/210 Chromium de UI pública/administrativa: producto, variantes, selección, catálogo/colecciones, panel y push; mobile/tablets en ambas orientaciones, laptop y desktop.
- 126/126 combinaciones del auditor canónico (18 páginas ×7 dimensiones).
- 62/64 Chromium de dominio:15 del nuevo agotado,8 de búsqueda, ficha, accesibilidad, SEO, módulos y2 controles de cantidades. Dos integraciones de cantidades adicionales están bloqueadas por el CDN, como se detalla arriba.
- 8/8 recorridos de búsqueda repetidos después de retirar el controlador competidor; precio anterior/descuento visibles y navegación por teclado conservados. Auditor de búsqueda desktop/mobile aprobado con colecciones reales de fixture.
- Build, CSP, rutas, caché y protección se regeneran desde autoridades; no se eliminan comprobaciones para superar el cambio de controlador.

La titular confirmó expresamente: «Sí, apartarla al confirmar el pedido». Se implementa para nuevos checkouts. Tres pruebas del dominio transaccional cubren clientas simultáneas, reintentos, pago/confirmación sin doble descuento, cancelación/reapertura y campos manipulados;83/83 pruebas iniciales del dominio público/pedidos/pagos y484/484 del lote checkout/pedidos/pagos/sync aprobadas. No hay migración de pedidos históricos ni vencimiento automático añadido.

## Ampliación solicitada: header y Pulseras

- Header público: la misma fuente de superficies extiende fondo y blur mediante una cola enmascarada de32–56px debajo del área del encabezado. No cambia altura, layout ni nitidez del texto y la cola no captura punteros.10 dimensiones aprobadas, incluidas ambas orientaciones.
- Colecciones del panel comercial: se reutiliza `unifyWristCollections` que ya usa el sitio y el panel anterior. Pulseras es principal; listado, total, filtros, ficha, clasificación y vista de productos incluyen categorías históricas. No altera snapshots crudos para concurrencia ni borra productos/documentos. El enlace Ver productos aplica el filtro al controlador visible. Caso13+9=22 aprobado en10 dimensiones;20/20 Chromium del conjunto header/colecciones.
