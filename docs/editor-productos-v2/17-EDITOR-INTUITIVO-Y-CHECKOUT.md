# Editor intuitivo, visión local y compatibilidad con checkout

Fecha: 24/10/2026. Agente: Codex /root. Base: main18bd9f5d. Alcance autorizado: simplificar el editor para quien viene de Shopify, mejorar contraste y comprobar prioritariamente el pedido; visión sin API facturada ni prueba temporal.

## Experiencia

Fotos precede a Producto, Precio, Opciones/inventario y Detalles. Se mantienen columnas y panel lateral existentes; al apilarse se conserva el orden. Guía rápida opcional con cinco accesos: Fotos, Información, Precio, Opciones y stock, Revisar todo. No obliga a completar un asistente ni guarda automáticamente. Los mismos nodos, valores, eventos, permisos y guardado canónico siguen vigentes.

Tres superficies: lienzo gris, tarjeta clara y campo suavemente teñido por la marca, con bordes perceptibles y foco existente. Las opciones indican «Quitar» en lugar de «×», conservando bloqueo cuando el controlador protege inventario/historial. Los materiales sugeridos se ordenan según categoría (por ejemplo, cartera); sólo se completan si la persona los elige.

## Reconocimiento sin servicio facturado

TinyCLIP40M (MIT), ONNX Runtime Web1.22.0 (MIT) y assets locales versionados. Una acción explícita carga unos52MB decimales de modelo/runtime; el navegador puede conservarlos en caché. El trabajo ocurre en un worker del dispositivo. No hay claves, cuentas, tarjeta, prueba temporal, endpoint de inferencia, API de pago, fallback facturado o envío de fotos a un proveedor de IA. Se usan el almacenamiento/ancho de banda del sitio y los recursos del dispositivo existentes; no se contrata infraestructura nueva.

El modelo8M se evaluó y descartó por señal insuficiente en las imágenes existentes. El40M reconoció carteras y relojes revisados; la prueba automatizada ejecuta de verdad ambos casos y una imagen blanca con abstención. Esto no equivale a exactitud garantizada ni a validación de todo el catálogo. Se sugieren familias de producto (carteras, aros, collares/cadenas, pulseras, relojes, anillos, billeteras, accesorios para cabello, llaveros, brazaletes, earcuffs, tobilleras, joyeros y gafas). No se crea una categoría inexistente ni se aplica nada automáticamente. Ante señal baja, empate, otro objeto o fallo, se permite completar manualmente.

Se analiza la portada actual, incluida la vista local pendiente de subir. Cancelar, cambiar foto/producto o cerrar el editor invalida respuestas anteriores. La acción de aplicar sólo cambia la categoría elegida y emite los eventos nativos; no genera variantes ni cambia precio/stock/material. La estimación de colores existente se conserva. Acero inoxidable, cuero genuino y cuero sintético requieren confirmación por ficha/proveedor: no se presentan como hechos deducidos de la imagen.

Los pesos de inferencia son una extracción del grafo visual del modelo ONNX público fijado a una revisión y SHA256. Se dividen en dos partes menores de25MiB para Pages; el worker recompone y comprueba el hash antes de ejecutar. Etiquetas precomputadas eliminan el tokenizador/modelo de texto del navegador. Procedencia, tamaños, hashes y licencias están en assets-tintin/vision y vendor/onnxruntime-web-1.22.0; NOTICE conserva sin cambios los avisos originales. scripts/vision/preparar-modelo-local.py permite reproducirlos con dependencias de desarrollo, sin dependencia Python en producción. Cambios futuros de bytes de assets requieren nuevos nombres/versiones.

## Seguridad y publicación

WebAssembly sólo está autorizado en la respuesta del worker exacto. Documentos públicos, checkout y admin conservan sus políticas; no se habilita eval de JavaScript ni ningún origen externo. El generador CSP y tres auditores comparten la validación de esa excepción; las negativas rechazan wildcard, eval, conexiones amplias y falta de sustitución explícita de la CSP del worker. Pages local de Wrangler4.152.0 comprobó una sola política efectiva del worker, cache immutable y ausencia de permiso WASM en checkout. No cambian API, Auth, reglas, proveedores de pago ni esquemas comerciales.

El constructor de diagnóstico reconoce imports integrados de Node (module, worker_threads) en bibliotecas universales, sin marcarlos como archivos locales inexistentes. Conserva las referencias locales y los gates, con regresión del manifiesto generado. Los imports Node de ONNX están en ramas que no se ejecutan en el navegador.

## Checkout: evidencia local

223 pruebas de checkout/carrito/variantes aprobadas;163 pruebas adicionales de pedidos/pagos/presentación aprobadas (hay solapamiento entre suites; no se presenta la suma como casos únicos). La nueva integración REST/CAS real en emulador recorre: editor crea producto → reordena atributos conservando clave → carrito compone borrador → política de checkout público → pedido recalcula precio/foto → reserva → reintento idempotente → cancelación/reintento libera una sola vez. También conserva las pruebas previas de concurrencia, conflictos y lote mixto:9/9.

El caso verifica precio individual45000Gs frente a base30000Gs, foto del color correcto, referencia opaca estable, cantidad de variante2→1→2, total agregado4 restaurado, y medios preservados. No hay fuentes comerciales de checkout/carrito/pedidos alteradas por el rediseño; la compatibilidad se prueba consumiendo sus autoridades existentes.

140 Chromium sin reintentos: formulario, matriz, fotos y responsive320–1920px, ambas orientaciones; seis nuevos escenarios de guía/contraste y visión real local/cancelación.134 pruebas administrativas y CSP aprobadas antes del último refuerzo de integridad, más5 pruebas de visión/diagnóstico actuales. Capturas390/1440 inspeccionadas con animaciones deshabilitadas. Build/rutas/CSP/diagnóstico/caché y auditoría de estilos aprobados. 39 comandos de preflight completos y15 pruebas de seguridad/visión/diagnóstico aprobados.69 Chromium adicionales de disponibilidad, navegación y recibo de checkout aprobados. Integridad y CI del SHA final se registran al ejecutarse.

## Límites

No se hicieron pedidos, cobros, correos o modificaciones de productos reales. No se probó en dispositivos físicos/Safari ni se realizó CRUD autenticado en producción. La inferencia puede abstenerse o fallar por CORS, memoria, descarga o compatibilidad; el formulario y guardado siguen disponibles. No se declara paridad exacta con Shopify ni detección fiable de materiales. La publicación de esta entrega queda separada de su implementación y validación.
