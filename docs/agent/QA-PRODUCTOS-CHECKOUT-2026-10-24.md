# QA de Productos, checkout y pago ficticio — 24/10/2026

Responsable: Codex /root. Base integrada: main9312c832, incluidos ticket PNG/WhatsApp (#1224) y galería compacta (#1226). La titular pidió corregir los fallos encontrados en estas funciones y sus vínculos, en escritorio, laptop, tablet vertical/horizontal y móvil; importes visibles en guaraníes. Este informe registra evidencia local anterior a CI. El cierre del SHA, merge y publicación se registra en el PR asociado.

## Hallazgos reproducidos

| Nivel | Problema | Resultado |
|---|---|---|
| HIGH | Nuevo producto intentaba leer `product.variants` con product null: agregar el primer color fallaba. | Reproducido en cuatro tamaños con el controlador real. La misma corrección llegó en #1226 y se conserva, con regresión de guardado real. |
| MEDIUM | Quitar la última opción del borrador fallaba aunque no tuviera unidades. | Permite volver a un producto simple conservando la cantidad anterior. Con unidades, conserva la opción y pide dejarlas en cero. Sólo aplica al alta todavía no persistida; no elimina referencias de productos guardados. |
| HIGH | Activar precios por combinación reemplazaba cantidades recién editadas por cero. | La conversión toma las cantidades actuales y conserva referencias. Pide distribuir el inventario cuando falta; no asigna silenciosamente un agregado positivo. El guardado comercial real recibe y conserva stock/precio individuales. |
| MEDIUM | El aviso de un pago confirmado mostraba Gs.6 para un pedido de Gs.45.000: etiquetaba el importe de liquidación como guaraníes. | Usa el total canónico del pedido en guaraníes, validado como entero positivo. El aviso parcial describe el estado sin mostrar una conversión extranjera ni atribuir un importe no convertido a Gs. |
| HIGH | Cancelar el pedido después de crear la orden del proveedor no impedía solicitar la captura. | Vuelve a leer el pedido y aplica la validación canónica antes de llamar al proveedor. Reproducción con el servidor real y proveedor ficticio; tras el ajuste no se solicita captura ni se vuelve a descontar stock. |
| HIGH | El rechazo asíncrono al renderizar el botón PayPal quedaba sin aviso y como promesa no atendida. | Espera el render y presenta el error; puede volver a mostrar el pago. |
| HIGH | Una descarga fallida del SDK dejaba la promesa rechazada en caché y no admitía reintento en la página. | Retira el script fallido y libera la promesa para descargarlo nuevamente. |

## Matriz de pantallas

| Categoría | Resoluciones CSS |
|---|---|
| Móvil vertical | 320×568, 390×844, 430×932 |
| Móvil horizontal | 844×390 |
| Tablet vertical | 768×1024, 820×1180 |
| Tablet horizontal | 1024×768, 1180×820 |
| Laptop | 1280×720, 1366×768 |
| Escritorio | 1440×900, 1920×1080, 2560×1440 |

El editor ejecuta ocho recorridos por tamaño: crear/guardar; convertir y guardar con precio individual sin perder stock; doble toque/clic durante la escritura; error y reintento; reabrir y editar el mismo producto; quitar la última opción sin unidades; impedir quitarla con unidades; validación repetida tras desplazar el formulario. Verifica objetivos de Guardar de al menos44px, accesibilidad en viewport, ausencia de desbordamiento del formulario y datos persistidos. Usa DOM, estilos/tipografía, controles y funciones CRUD canónicos, sin reemplazar prodGuardar por una función vacía. Identidad, almacenamiento y servicios externos del navegador son ficticios; el guardado comercial ejecuta también saveProductEditor real con IO aislada.

Las pruebas existentes cubren fotos/cargas pendientes, conservación de borradores, acciones, vista previa, stock, cupones, factura, avance/retroceso y recibo; se ejecutan como regresión, sin cambiar sus expectativas para ocultar fallos. PayPal añade13 recorridos con cancelación, error temporal y reintento, más dos escenarios específicos de carga/render del SDK. Sólo se simula el SDK/proveedor y las respuestas externas; el cliente de pago del sitio es el original.

## Compra completamente ficticia

La integración usa Firestore Emulator1.22.0, sólo loopback y proyecto demo-tintin-commerce-integration. El artefacto local procede del componente oficial de Google Cloud SDK; se verificó el checksum de su archivo de distribución. No usa la base de producción.

Recorrido con producto, colección, cliente y pedido sintéticos:

1. Guarda el producto con el escritor comercial real y una variante de dos unidades.
2. Rechaza una cotización manipulada sin reservar stock.
3. Confirma el pedido de Gs.45.000 y reserva una unidad; repetir la solicitud no duplica pedido ni reserva.
4. Ejecuta las funciones reales createPaypalOrder/capturePaypalOrder y sus llamadas REST. OAuth y proveedor se simulan; todas las llamadas de Firestore se dirigen al emulador. El simulador bloquea cualquier otro servicio externo.
5. Rechaza un importe de captura incorrecto sin marcar el pedido como pagado.
6. Simula un fallo temporal del proveedor y permite reintentar con la misma clave de idempotencia.
7. Confirma el pago, conserva una sola reserva y no repite la captura al volver a solicitarla.
8. Comprueba que el aviso del administrador muestra Gs.45.000.
9. Registra un reembolso ficticio completo; cancelar y repetir la cancelación restituye el inventario una sola vez.
10. En un segundo pedido, abre el pago y después cancela el pedido: el intento de capturarlo se rechaza antes de llamar al proveedor y conserva el stock restituido.

La conversión técnica necesaria por el procesador se conserva como dato interno; no se confunde con el total comercial en guaraníes. La prueba no acredita una transferencia o un cobro real, credenciales reales del proveedor, entrega real de correos, login real de Firebase ni funcionamiento en un dispositivo físico/Safari. Chrome se ejecuta con viewport/tacto emulados. No se modificaron productos, clientes, pedidos, pagos ni stock reales.

## Evidencia local

- 296 pruebas Chromium de Productos/editor comercial, disponibilidad, cupones, factura, navegación y recibo: PASS_LOCAL sobre la combinación con #1224/#1226.
- 15 pruebas del SDK de pago ficticio: PASS_LOCAL; los dos casos de recuperación fallaban antes del ajuste.
- 458 pruebas de comercio y76 del editor/administrador: PASS_LOCAL. Las18 de pagos están incluidas en comercio, no se suman dos veces.
- 11 pruebas integradas REST/CAS sobre Firestore local: PASS_LOCAL, incluida compra/pago/reembolso/cancelación ficticios.
- 104 recorridos de guardado con las hojas de estilo completas y tipografía canónica: PASS_LOCAL. Se inspeccionaron capturas de móvil390, tablet768/1024, laptop1366 y escritorio1920: acciones visibles, campos y controles sin recortes horizontales. Build Pages,39 comandos de preflight, plan de protección y derivados finales: PASS_LOCAL. Las capturas canónicas se guardan en artifacts/qa-productos para los artefactos de CI.
- Los casos nuevos se incorporan a los gates existentes de administración, comercio y reglas; no quedan sólo como pruebas manuales de esta sesión.

No se hereda PASS_CI de los PR anteriores al candidato nuevo. CI y producción del SHA final: PENDING al preparar este informe. Las comprobaciones de producción serán de sólo lectura.
