# Revisión global y decisiones comerciales — 2 noviembre 2026

Fuente: respuestas directas de la titular en la conversación de revisión global.
Base revisada: `39744311216e525919a1f781a03fb854d92e45fd`.
Autor: Codex /root. Este documento registra requisitos; no acredita su implementación.
La titular autorizó implementar y fusionar los cambios mediante PR y controles existentes.
No autoriza operaciones comerciales reales para probar, eliminación de datos ni bypass.

## Método y alcance

Revisar código y configuración antes de preguntar. Consultar sólo una duda concreta
que no resuelvan el código o estas respuestas; explicar evidencia y efecto comercial.
Preservar lo correcto. La revisión abarca tienda y panel, todos los dispositivos.
Separar defecto reproducido, diferencia con una regla acordada, función nueva y
verificación remota pendiente. No presentar informes históricos como PASS actual.

## Reglas acordadas

| Área | Regla |
| --- | --- |
| Reserva | Un pedido pendiente mantiene el stock reservado hasta que la titular lo cancele. |
| Cancelación | Solicitud por cuenta o WhatsApp; aprobación de la titular. En cada cancelación preguntar qué stock devolver. |
| Precios e historial | Conservar precio confirmado y nombre/foto/variante/precio originales del producto en pedidos anteriores. |
| Cambios | La clienta solicita y la titular aprueba. Consultar cómo resolver cada diferencia de precio. |
| Dirección | Cambiar el perfil no modifica pedidos confirmados. Una dirección nueva se solicita aparte; recalcular delivery y confirmar la diferencia. |
| Agotados | Visibles al final. Una variante agotada permanece seleccionada, indica agotado y bloquea comprar. Alertar solamente cuando se agota, no por stock bajo. |
| Orden del catálogo | Novedades primero. Revisar la prioridad actual de productos editados/destacados antes de modificarla. |
| Búsqueda | Ante cero resultados, ofrecer sólo similares. |
| Ficha | Datos esenciales visibles; detalles adicionales desplegables. Datos reales por modelo. |
| Acceso | Conservar el flujo actual de inicio de sesión para comprar. |
| Carrito | Conservar en el dispositivo al cerrar sesión. Comunicar cambios de precio/stock al avanzar al checkout. No se decidió una nueva política de fusión de carritos. |
| Formulario cliente | Preguntar guardar o descartar antes de salir con cambios. |
| Venta presencial | Una venta nueva confirmada descuenta stock automáticamente; no volver a descontar ventas históricas importadas. |
| Cobros | Dashboard: dinero cobrado por productos y envío separados. Registrar reembolsos y restarlos de lo cobrado. |
| Bolsos bajo pedido | Seña 50%; si el proveedor no tiene el bolso, reembolsar la seña. |
| Pedido mixto | Todo junto cuando llegue el bolso; seña 50% de todos los productos, sin envío. |
| Delivery | Saldo de productos y delivery completo al recibir. El envío no se fracciona ni integra el cálculo de la seña. |
| Encomienda | Productos totalmente pagados antes del despacho; envío a la transportadora al recibir. |
| Retiro | Transferencia previa o efectivo al retirar en San Lorenzo. |
| Plazos | Delivery lunes a sábado, corte 11:00; después, siguiente día de reparto. Cada bolso tiene su plazo cargado por modelo, contado desde seña verificada y disponibilidad confirmada. No imponer 2–3 días a todos. |
| Fecha prevista | Calcular automáticamente y permitir ajuste de la titular; un ajuste manual actualiza fecha y envía correo automáticamente. |
| Estados bajo pedido | Esperando seña; seña verificada; encargado al proveedor; recibido en Tintin; esperando saldo; listo para entregar. |
| Comprobante | Llega por WhatsApp; la titular marca que lo recibió y verifica/registra el pago. No se pidió carga web del comprobante. |
| Perfil/pedido | Estado, productos/variantes/total, pago, fecha prevista, historial de estados y seguimiento de encomienda. |
| Permisos | Preparar permisos por tarea para delegar después. No conceder accesos reales como parte de las pruebas. |
| Editor | Conservar borrador ante desconexión y ofrecer recuperación. Bloqueo temporal para un segundo editor; liberar al cerrar, con vencimiento de respaldo. |
| Confirmaciones | Cancelar, reembolsar, eliminar/archivar producto, cambios masivos de precio/stock, marcar pagado y cambiar permisos. |
| Auditoría | Quién/cuándo: precios/stock, producto/fotos, pagos/reembolsos, estados, dirección/envío del pedido, permisos y configuración. |
| Sheets | Firestore sigue siendo autoridad. Si Sheets falla, continuar operando, avisar y reintentar sincronización. |
| Inicio Admin | Accesos a pedidos nuevos, pagos por revisar, preparación/entrega, bolsos/saldos, cobros/envíos, productos/stock y alertas. |
| Alertas Admin | Nuevo pedido, comprobante por revisar, cambio solicitado, agotado, bolso listo con saldo, error Sheets y correo fallido. La alerta de stock bajo quedó descartada por respuesta posterior. |
| Correos cliente | Confirmación, pago verificado, bolso disponible/saldo, listo para retirar, despachado/seguimiento, cambio importante de fecha, cancelación y reembolso registrado. |
| Fallo de correo | Avisar desde el primer fallo y reintentar automáticamente sin duplicar el pedido. |

## Implementación y evidencia por bloque

1. **Resumen derivado de cuentas (F02-STATS): PASS_PRODUCTION del artefacto.** Consulta paginada por
   identidad y puente histórico normalizado; deduplicación documental y readTime
   compartido; publicación CAS sobre revisiones leídas antes del cálculo. Reintento
   de conflicto acotado; error/presupuesto conserva el resumen anterior. No cambia
   el significado histórico de totalSpent por una definición nueva de caja.
   PR #1317 fusionado en c25421dfe78d83f2dff744b7861c41f28f139641;
   CI 41546610554/1 del head y 41550063208/1 de main SUCCESS. Publicación
   Cloudflare SUCCESS y monitor 41550066223/1 SUCCESS. No acredita datos reales
   de cuentas ni índices remotos con credenciales de clientas.
2. **Caja, señas, saldos y reembolsos: PENDING.** Existe estado parcial, pero el
   mutador actual no registra importes de seña/saldo. Extender la autoridad existente
   con montos y estados coherentes antes de presentar dinero efectivamente cobrado.
3. **Retiro efectivo: PASS_LOCAL, CI/merge/publicación pendientes del segundo PR.**
   Backend, cliente y selector real permiten efectivo en retiro si está habilitado;
   encomienda conserva transferencia previa. Textos y FAQ incluyen reparto de
   lunes a sábado, corte 11:00 y siguiente día de reparto. 354 pruebas Node y
   preflight completo PASS; casos de navegador ampliados, pendientes de CI.
   **Cancelación con decisión de stock: PENDING.** Sigue liberando inventario
   automáticamente; requiere decisión explícita con regresiones de inventario.
4. **Plazos, estados bajo pedido, cambios y seguimiento: PENDING.** El Admin puede
   mostrar estimatedDeliveryAt si existe, pero el mutador revisado no permite editarlo
   y el perfil no muestra ese campo. Implementar sobre ciclo/autoridades existentes.
5. **Catálogo, formularios y editor: PENDING de contraste/implementación.** Agotados
   al final ya existe. Orden por actividad comercial difiere de novedades estrictas.
   El editor actual usa revisión/CAS y borradores; no confundirlo con bloqueo exclusivo.
6. **Alertas, correos, permisos e historial: PENDING de contraste/implementación.**
   Reutilizar notificaciones y colas actuales; no duplicar infraestructuras.
7. **Aceptación global: NOT_VERIFIED.** CI/deploy del nuevo SHA por recibo de PR;
   Rules publicadas, versión WebApp, índices y aceptación autenticada/proveedores
   requieren evidencia propia. GSC Wizard bloqueado por suscripción en la revisión.

No activar todos los Skills a la vez ni declarar aplicadas estas reglas por guardar
este documento. Cada bloque debe cerrar pruebas, PR, fusión y publicación aplicable.
