# Fase 05 — Integridad del flujo comercial

Responsable: Codex /root. 2026-11-02. Base `b1107b3fc7fd711709832620ea738c814d6462a6` (#1311), rama `codex/phase05-commerce-flow`. Alcance actualizado por instrucción del propietario: recorrido comercial completo. No certifica el cierre global ni la seguridad03A.

## Recorrido y autoridades

Producto/variante en `products` → selección y clave estable → escritor único `sincronizacion-carrito.js` (local y `users/{uid}/cart`) → `politica-checkout.js` compone intención → `pedido-checkout-seguro.js` conserva requestId y valida respuesta → cliente `/api/apps-script-bridge` → `preparePublicCheckoutOrder` relee configuración/perfil/productos y cotiza → `createOrderAdmin` confirma atómicamente pedido, secuencia y reserva mediante CAS → recibo y perfil consultan ese pedido → notificaciones/mirror existentes procesan la misma identidad.

El cliente no determina precios ni stock. `public_${uid}_${requestId}` identifica la operación; reintentar no reserva dos veces. Transferencia crea pedido con pago pendiente. PayPal sólo acredita tras captura válida del proveedor; los ensayos usan simulador. Cancelar restaura la reserva una sola vez. No se agrega sincronización paralela, índices ni colección nueva.

## Problemas demostrados y correcciones

| Gravedad | Evidencia y efecto anterior | Corrección canónica |
| --- | --- | --- |
| HIGH | `nucleo-metodos-pago`/política pública podían recuperar opciones desde espejos legacy aun existiendo catálogo explícito vacío o deshabilitado. El callback asíncrono podía publicar una configuración anterior. | Catálogo explícito manda, incluso vacío/inválido; servidor y UI comparten normalizador. Fallback sólo si la propiedad no existe; callbacks descartan revisiones viejas. |
| HIGH | Tarifas forzadas para dos ciudades y defaults15000/25000 alteraban configuración administrativa; ausencia se convertía en cero. | `configuredShippingPrice` conserva cero explícito y representa ausencia como pendiente. Todas las superficies afectadas usan esa función. Se elimina deliberadamente la regla anterior de25000 por la instrucción actual de respetar exactamente administración. |
| HIGH | `ok:true` incompleto podía confirmar y vaciar carrito; limpiar todo eliminaba compras agregadas durante la respuesta. | Respuesta requiere identidad/pedido/líneas/importes válidos y cuenta coincidente. Consumir sólo cantidades del snapshot confirmado sobre el carrito más reciente, dentro del escritor serial y de la misma generación de sesión. |
| HIGH | Ruta pública Apps Script aún delegaba en creador histórico incompatible con matriz de variantes. | Dispatcher rechaza `createOrder` con `canonical_checkout_required`; creación sólo en Cloudflare. Espejos autenticados conservados. La actualización del WebApp desplegado sigue pendiente de acceso/deployment externo. |
| MEDIUM | Recarga/BFCache de entrada completada podía reabrir checkout; requestId esperaba sincronización remota para cerrarse. | history.state, popstate y pageshow persistido dirigen a inicio; submit bloquea entradas completadas. Cerrar intento antes de esperar el carrito remoto. |
| MEDIUM | qty0 podía convertirse en1; clave V2 dependía del catálogo disponible en la página. | Cero se rechaza; variantKey explícita identifica la línea consistentemente entre páginas. |
| MEDIUM | Configuración parcial de transportes perdía campos legacy; sin ciudades desaparecía el departamento del retiro. | Fallback por campo, retiro Central conforme al servidor actual. |
| MEDIUM | Enlace de logística describía envío pendiente como gratuito y monto exacto a cobrar. | Texto distingue pendiente, cero explícito y encomienda abonada al transportista; conserva productos, variantes, cantidades y entrega reales. |

## Modalidades reales y edge cases

La administración actual configura listas de ciudades y tarifas; no tiene flags por modalidad. Delivery y encomienda sólo admiten sus ciudades configuradas. Una lista explícita vacía no recupera ciudades legacy. Retiro `__retiro__`/Central ya está soportado siempre por el servidor. No se inventan flags, transportistas, paquetes, estados ni costos. Efectivo sólo delivery; encomienda requiere transferencia y productos prepagados con envío abonado al recibir, conforme al contrato existente. PayPal requiere catálogo permitido (si existe), configuración activa y servicio disponible. Catálogo explícito sin métodos bloquea avanzar sin perder formulario.

El mensaje a Fito usa el constructor `contactos-pedido.mjs`, destino actual del repositorio y líneas reales del pedido, sin texto de paquetes verdes. No hay otro campo de destinatario configurable en el modelo inspeccionado; no se inventa. Se comprueba el texto y URL codificada, nunca se abre/envía un mensaje real.

Cobertura: cliente autenticado y acceso requerido conservando carrito, perfil nuevo/existente y defaults, variantes agotadas/eliminadas, última unidad concurrente, cambio de cotización, entrega/pago deshabilitados, costo cero/pendiente/parcial, red fallida, respuesta incompleta, doble clic, reintento con misma identidad, cuenta cambiada, compras añadidas durante confirmación, Back, recarga y BFCache. No se fuerza recarga ni se invalida sesión para actualizar datos.

## Verificación y límites

- 590 pruebas Node de carrito/checkout/pedidos/pagos/sincronización PASS, sin skips. Incluyen nuevos RED→GREEN de configuración, confirmación, consumo parcial, claves y texto de logística.
- CodeQL inicial detectó dos alertas de filtrado HTML en la fixture nueva de pagos: se sustituye regex por el parser/helper existente `removeFixtureScripts`, sin desactivar reglas. El SHA corregido se valida nuevamente.
- Navegador Chromium con fixtures: resultados finales en CURRENT_STATE; no se utilizan pedidos ni proveedores reales. Auditorías de pedidos seguros, entrega y carrito PASS_LOCAL.
- Integración Firestore real aislada añadida para catálogo canónico, pago pendiente, reserva única y rechazo sin escritura. Se mantiene la suite existente de concurrencia/CAS, cancelación y PayPal simulado. Ejecución local BLOCKED: descarga del JAR oficial desde storage.googleapis.com denegada por la red; debe acreditarse con el job de emulador de CI, nunca sustituyendo producción.
- Caché, shell, CSP, diagnóstico y protección se actualizan con constructores oficiales; tags propagados no provocan avisos por cambios comerciales ni recargas forzadas.
- PR/CI/fusión/publicación requieren resultados terminales propios, registrados en el recibo de esta entrega. No se hereda PASS productivo de04. No hubo compras, cobros, transferencias, cambios de pedidos/inventario real, migraciones destructivas ni mensajes reales.
- Pendientes externos: desplegar/revalidar el retiro de la ruta pública del WebApp Apps Script; F01-RULES HIGH (autoridad de metadata de inventario) sigue en03A. Índices desplegados, credenciales/proveedores, dispositivos físicos y entrega real de notificaciones no se acreditan aquí. La fase queda con reservas explícitas hasta resolver esos puntos.
