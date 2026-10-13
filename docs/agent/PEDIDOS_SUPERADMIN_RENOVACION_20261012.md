# Pedidos Super Admin — renovación del 12/10/2026

Estado: implementación local finalizada el 13/10/2026; pendiente de CI, revisión y autorización de producción.
Base: 7196040 (main). Rama: codex/pedidos-superadmin-renovado-20261012.
URL conservada: https://tintinaccesorios.pages.dev. Sin cambios de DNS, SSL, OAuth, App Check, reglas o configuración de infraestructura.

## Inspección anterior a la implementación

Se revisaron admin.html, estilos compartidos y tokens, shopify-commerce-admin.js, admin-app.js, pedidos-superadmin-crud.js, integridad-inventario-admin.js, order-admin-domain.js, admin-order-mutation, notificaciones, correo y reintentos, contactos-pedido, pedidos-perfil, inventario, reglas, permisos y pruebas existentes.

| Área solicitada | Implementación encontrada y decisión |
|---|---|
| Diseño y pantallas | Una experiencia de comercio ya montaba Pedidos sobre el listado antiguo. Se renueva esa misma vista y su drawer; no se agrega otro módulo. |
| Funciones y botones | Se reutilizan creación manual, editor completo, exportación, reenvío y papelera, además de las acciones canónicas de estado/pago. |
| Estados | Existían pendiente, confirmado, preparando, listo_retiro, en_camino y entregado. Se completan listo, incidencia y devuelto en un contrato compartido. Retirado conserva el valor entregado y cambia su etiqueta según modalidad. |
| Base de datos y relaciones | orders contiene snapshot de cliente, entrega y artículos. products mantiene reservas. auditLog ya registra antes/después y responsable. orderTrash se conserva. Sin migración ni borrado de historia. |
| Clientes y seguimiento | Se reutilizan la fuente de pedidos de la cuenta, las notificaciones y sus enlaces al pedido. La línea de tiempo usa el mismo ciclo; retiro excluye enviado. |
| Pagos | Estado separado de preparación; confirmar no implica cobrar. Se distingue parcialmente pagado cuando está registrado, sin inventar importe abonado. No cambia PayPal ni cobranza. |
| Inventario | La mutación del servidor conserva reconciliación transaccional, precondiciones por documento y variantes. Cancelación libera una vez; devolución no presume mercadería vendible ni reembolso. |
| Entrega | Delivery/express, encomienda y retiro conservan los datos existentes. Coordenadas reales o dirección+ciudad alimentan Maps. Sin ubicación válida se informa el faltante. |
| Notificaciones e historial | Se reutilizan notifications, correo transaccional y auditLog. Se elimina el envío automático duplicado del cliente administrativo. El servidor audita en la misma transacción. |
| Permisos | Se preservan permisos dinámicos; el servidor autentica Super Admin antes de consultar contactos o mutar pedidos. Pago/reenvío conservan el permiso específico del personal autorizado. |
| Dispositivos | La tabla anterior no era un tablero por etapas. Se agregan columnas con scroll interno, pestañas móviles y detalles adaptados a pantalla completa. |
| Errores y duplicaciones | El listener paginado de comercio perdía páginas posteriores al recibir snapshots; se reutiliza la fuente administrativa existente. Se corrige conflicto de versión inicialmente vacía, falsas confirmaciones masivas y doble mutación de estado/pago. |
| Carga y actualización | Una fuente administrativa alimenta tablero y consumidores existentes. Super Admin obtiene el conjunto completo; otros roles mantienen su límite previo. Render inicial discreto, actualización por tarjeta, caché por revisión de contactos/historial y recuperación explícita. |

## Resultado implementado

- Gestión de pedidos abre el tablero con cinco etapas y seis contadores reales; incidentes/cancelados/devueltos, históricos, compradores y borrados permanecen accesibles.
- Tarjetas compactas con fecha, tiempo, cliente, artículos/cantidades, total, pago, entrega, estado, detalle y acción siguiente. Búsqueda, pago, entrega, ordenamiento y selección se conservan por cuenta.
- Panel derecho con cliente, productos/fotos/variantes, totales y descuentos registrados, entrega, observaciones, estado/pago, historial y responsable. El guardado de estado+pago es una única mutación.
- WhatsApp del cliente, Google Maps y Enviar a Fito usan enlaces calculados por el servidor autorizado; no se envían mensajes. Fito sólo aparece para delivery conforme al contrato existente.
- Los movimientos se confirman en servidor antes de reflejarlos. Clave de cambio y versión base evitan doble acción y borradores que pisan otra sesión. El endpoint administrativo exige versión para las actualizaciones.
- Nueva notificación del tablero abre el pedido exacto, no vuelve a anunciar el snapshot inicial ni el mismo ID. Sonido sólo con habilitación expresa y permiso del navegador.
- Archivar/restaurar un pedido entregado conserva entrega, pago y reserva históricos; no lo transforma en una cancelación ni repone stock.
- Claro/oscuro heredan los tokens administrativos existentes, Montserrat y la identidad de Tintin. Botones táctiles, foco/cierre/teclado, áreas seguras y movimiento reducido.

## Pruebas y evidencia local

Datos de prueba aislados. Los fixtures de navegador bloquean solicitudes externas y usan los módulos originales. Las pruebas de dominio ejecutan la implementación original sobre Firestore simulado con precondiciones; no modifican pedidos reales.

Comando Node: node --test tests/orders/*.test.mjs tests/profile/order-history-display.test.mjs tests/payments/*.test.mjs tests/operations/order-staff-permission.test.mjs tests/sync/*.test.mjs tests/checkout/*.test.mjs
Resultado: 423/423 PASS_LOCAL, incluidos creación manual/checkout, estados por modalidad, conflictos, idempotencia, cancelaciones, inventario, notificaciones, historial, autenticación de contactos y archivo/restauración.

Comando navegador: node scripts/auditar-super-admin-responsive.mjs
Resultado: 45/45 PASS_LOCAL (6 regresiones de comercio + 39 del tablero). Incluye dos páginas administrativas simultáneas, clics repetidos reales, fallo de operación, offline/online, mil pedidos y límites de tarjetas, filtros/recarga/identidad DOM/scroll, aviso y sonido, historial, pérdida de sesión, teclado, zoom y movimiento reducido. El gate ahora prueba la implementación real, reemplazando la tabla artificial anterior.

Tamaños comprobados (ancho × alto): 320×568, 360×640, 375×812, 390×844, 414×896, 430×932; 568×320, 667×375, 844×390, 932×430; 768×1024, 820×1180, 1024×768, 1180×820; 1280×800, 1366×768, 1440×900, 1920×1080, 2560×1440; 900×1180, 1023×800, 741×900, 1500×950, 2880×1620.

Auditores: Pedidos (32 comprobaciones), comercio, contratos arquitectónicos, tipografía, esquema de color e integridad CSS: PASS_LOCAL.

Logs locales: C:/Users/USER/AppData/Local/Temp/tintin-orders-node-critical.log, tintin-orders-browser-release.log, tintin-orders-audit-final.log, tintin-orders-commerce-final.log y tintin-orders-architecture.log.
Capturas revisadas: C:/Users/USER/AppData/Local/Temp/tintin-orders-review-20261012/pedidos-{320,768,1440,1920}.png y detalle-{320,1440}.png. El comando de navegador genera esas capturas si TINTIN_REVIEW_DIR está definido.

## Límites y pendientes expresos

- PASS_LOCAL no certifica hardware físico, Safari/Firefox ni conectividad real de dos dispositivos. Las sesiones simultáneas del navegador comparten un backend simulado; las precondiciones del servidor se prueban por separado en el dominio real.
- Sin pedidos, pagos, correos o mensajes reales. La entrega efectiva de correo a una casilla y notificaciones de una venta real no se verifican creando operaciones productivas.
- Los enlaces de WhatsApp/Maps se validaron sin abrir ni enviar contactos reales. Los históricos sin campos no se completan con información inventada.
- El conjunto completo de pedidos de Super Admin consume lecturas proporcionales al historial; la interfaz limita tarjetas inicialmente a 30 por etapa. No se agregó un contador paralelo ni un servicio de agregación.
- El cambio de estado requiere pasos válidos. No se permite cancelar un envío para reponer stock automáticamente; devolución/incident/revisión corresponden según la etapa. Una devolución no dispara reembolso por sí sola.
- Maciel ausente de la configuración de envíos y la comprobación de llegada de correo de producción provienen de la inspección previa del checkout: fuera del alcance de esta renovación y sin modificar.
- CI del candidato, preview, revisión de mantenimiento protegido y autorización final de publicación pendientes. No heredar aprobaciones de checkout anterior ni de main.

No se afirma ausencia total de errores. Se conserva este informe con la evidencia concreta y se actualiza ante resultados del candidato.
