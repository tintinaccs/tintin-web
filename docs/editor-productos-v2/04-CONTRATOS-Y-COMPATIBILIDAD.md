# Contratos y compatibilidad

Este documento enlaza las autoridades y registra el modelo observado; no crea un esquema paralelo.

## Datos actuales

- products: name, sku general, category, collection, description, price, priceBefore, stock, active, oferta, destacado, badge, tags; imageUrl/imagesExtra/variantMedia; variants/variantInventory; material, measurements, colorFinish, care, waterResistance, warranty, sizeFit, packageContents. Campos opcionales legados se conservan: no hacer reemplazos totales ni limpiar atributos desconocidos sin estudio de consumidores.
- productInventory con el mismo ID: costUnit, purchased, stockMinimum, internalNotes. Datos privados, no incluirlos en catálogo, metadata ni payload público.
- variants acepta representaciones existentes; [productVariantGroups/resolveProductVariant](../../js/core/store/inventario-variantes.mjs) interpretan grupos y selecciones. Metadatos price/sku/imageUrl/stock/active/colorHex/swatch no son grupos de opciones.
- variantInventory es opcional: entradas `{variant, stock}`; null/ausente conserva inventario agregado. No inventar una segunda matriz. Cambiar orden de atributos no debe convertir una selección válida en inválida ni perder su clave de reserva histórica.
- stock cero significa agotado; vacío/null/ausente significa no controlado en los flujos que admiten esa representación. No convertirlo a cero por normalización visual. purchased no es stock disponible.

## Dinero y variantes

Guaraníes como números enteros; formato Gs. sólo de presentación. El guardado observado exige priceBefore entero mayor que price, o vacío. No confundirlo con descuentos arbitrarios/cupones.

Precio por variante está aprobado pero **contrato completo pendiente de definición y autorización de fase**: no inferir que el metadato price ya gobierna catálogo/carrito/cobro. Antes de cambiarlo, definir fallback, precedencia, límites y persistencia del precio histórico, y migrar todos los consumidores juntos. SKU por variante NO se incorpora; un NO no permite limpiar datos legados.

## Fotos

Reutilizar [foto-variante](../../js/components/images/foto-variante.mjs) y sus editores. Mantener portada, galería y asociaciones por color/combinación; reordenar no debe reasignar fotos por índice. Completar cargas antes de guardar; una vista previa local no es una URL persistente. Cambios de identidad/orden deben conservar fotos plateadas y doradas existentes. Orden visual plateado antes de dorado debe contrastarse con la autoridad de presentación actual, sin reasignar stock ni fotos mediante índices.

## Consumidores y operaciones

- [Contratos comerciales](../contratos-comercio.md): lineId estable producto/variante, revalidación de precio/estado/stock en checkout, snapshot de pedido y reserva/devolución idempotentes. La vista previa no cobra ni escribe stock.
- [Sincronización productos](../sincronizacion-productos-canonica.md): products público, productInventory privado y Productos en Sheets. No crear otro espejo ni reintroducir Catálogo web.
- La edición agregada desde Sheets con inventario distribuido se rechaza según el contrato canónico; no repartir cantidades arbitrariamente. Ventas concurrentes requieren precondiciones/transacción, no sobreescrituras.
- [Firestore rules](../../firestore.rules) y permisos existentes son límites obligatorios. Ocultar un botón no autoriza una operación. Preservar auditoría y evidencia de conflictos/reintentos.
- [Versionado](../arquitectura-versiones-canonicas.md): actualizar consumidores y generadores existentes cuando una fase modifique código; esta fase documental no modifica shell/CSP/caché/manifest de producción.

No migrar productos/pedidos reales, eliminar datos, alterar integraciones o publicar por el solo hecho de tener aprobado este plan.


## Propuesta fase1 — pendiente de aprobación

La siguiente es una propuesta de evolución del modelo existente. **No son campos ya implementados**. No crear una segunda colección comercial, un carrito alternativo ni otro resolvedor. Cambios de esquema y lectores se implementan juntos, con proyecciones compatibles derivadas y sin edición independiente de dos autoridades.

### Identidad y autoridad única por combinación

- Mantener products/{id}. Proponer marcador variantSchemaVersion:2 y configuración de atributos/opciones con IDs opacos estables, nombre y orden visual separados. Antes de implementar, fijar forma exacta en fixtures y contrato de esquema; no generarlos desde la posición ni desde nombre mutable.
- Evolucionar **variantInventory existente** a registro de combinaciones: variantId estable, selección `{attributeId: optionId}`, stock entero o null, price opcional entero, priceBefore opcional y active booleano. No guardar precios en variantMedia. Variants (grupos legados) y etiquetas variant se conservan como proyecciones de compatibilidad, no como otra autoridad editable.
- variantMedia conserva fotos y asociaciones; para v2 referencia el mismo variantId o una selección parcial explícita por IDs. Asociaciones completas prevalecen sobre color genérico. El resolvedor existente se amplía para v1/v2 y devuelve identidad, selección, precio efectivo, disponibilidad y referencias de medios; consumidores no recomponen esos datos por índice.
- IDs no cambian al reordenar ni renombrar. La cadena visible se calcula para presentación. Pedidos históricos y variantInventoryItems guardados no se renombrarán; tabla de correspondencia legada queda dentro del modelo del producto cuando resulte inequívoca. Una selección ambigua se rechaza con motivo, nunca se asigna por suposición.
- Limitar combinaciones a1000 y mantener límites de nombres/cantidades actuales; comprobar tamaño máximo de documento antes de aceptar. No implementar un producto cartesiano ilimitado. Los datos no estructurados antiguos siguen con lector v1; no hacer backfill masivo.

### Precio y disponibilidad

- Precio efectivo: override válido de combinación seleccionada; si está ausente/null, products.price. Ausente no significa0. Propuesta: precios vendibles enteros1..1e9 PYG, conforme al editor actual; no habilitar gratis por coerción de cadena vacía. El servidor valida tipos y rangos, nunca acepta precio del navegador como autoridad.
- Precio anterior efectivo: override opcional de combinación cuando exista; si hereda precio, puede heredar priceBefore general; si sobreescribe precio y no define anterior, no mostrar un descuento heredado engañoso. Debe superar el precio efectivo o quedar null. Costo permanece sólo en productInventory; no proponer costo por variante sin decisión adicional.
- Ficha y carrito muestran el mismo precio resuelto; catálogo puede mostrar «Desde»/rango de variantes disponibles (propuesta visual a aprobar). SEO representa precio/rango sin publicar costo privado ni afirmar disponibilidad de variantes agotadas.
- Con matriz v2: stock por combinación entero0..1e6 o null=no controlado. Total agregado = suma de **todas** las cantidades finitas, incluso de combinaciones temporalmente no disponibles; si cualquier combinación tiene stock no controlado, total=null. Si ninguna matriz, conservar stock legado. Disponibilidad=producto activo y combinación activa y límite de stock aplicable; desactivar no destruye cantidades.
- Reservar sólo líneas finitas y devolverlas exactamente una vez. Las líneas no controladas conservan huella histórica de selección y política sin inventar cantidades. El estado de control al crear la reserva se conserva para no devolver cantidades a una combinación convertida posteriormente sin revisión.
- No permitir eliminar una opción/combinación con stock o reservas activas; ofrecer desactivar y conservar IDs. Evitar que cambio de control de stock invalide reservas ya existentes. Requiere pruebas de concurrencia e intervención explícita ante cambios incompatibles.

### Escrituras, sincronización y compatibilidad

- Documento v1 sin marcador: comportamiento actual intacto. Optar por v2 sólo al guardar una edición autorizada, tras vista previa de correspondencias y validación; no modificar el catálogo real en una migración automática.
- Todos los escritores deben conocer el marcador: admin, edición masiva/tarjeta, Sheets, importador, reservas, cancelaciones, restauración. Un escritor viejo no debe reemplazar una matriz v2 ni eliminar propiedades por devolver sólo `{variant,stock}`. Hasta compatibilidad completa, el guardado nuevo permanece bloqueado.
- price/stock/fotos de combinación comparten identidad y revisión; campos derivables no son editables por separado. Productos+inventario privado deben validarse en transacción compatible con roles; sync externa no puede formar parte de esa atomicidad. Conservar estados de guardado parcial y reintento canónicos.
- Sheets: mantener columnas actuales, máscaras y guard409; no serializar todo el nuevo modelo como opciones editables. Precio general sigue fallback; override por combinación no se borra al cambiar columna Precio. No añadir columnas ni cambiar Apps Script desplegado sin aprobación específica. Probar viajes de ida/vuelta, actualización parcial y snapshots viejos.
- Importador: conservar precios/fotos por variante en la proyección revisada; previsualizar advertencias, identidad/duplicados y soporte de stock mixto. No sobrescribir una edición v2 con campos vacíos de un CSV viejo. Idempotencia del job no sustituye este contrato.
- Carrito: persistir variantId para v2; adaptar schemaVersion de líneas y reglas de claves permitidas de Firestore conjuntamente. Conservar tt_cart y rutas existentes. Reconciliar cadenas v1 a identidad estable sólo si inequívocas; resolver colisiones por política explícita sin duplicar cantidades y preservar ediciones pendientes. Notificar selección que requiere revisión.
- Servidor: validar token/rol/origen, releer producto y combinación, recalcular precio/subtotal/envío/descuento autorizado/total antes del commit; snapshot de pedido con variantId, selección y precio histórico. Cambios de cotización exigen revisión de clienta, no aceptación silenciosa. Mantener requestId, CAS y política reserve-on-checkout.
- Reglas/APIs públicas: ampliar allowlists y validaciones conscientemente, sin filtrar campos privados. No dar por válido un nuevo campo porque un rol privilegiado pueda escribirlo.

Esta propuesta necesita aprobación antes de fase2; el detalle de stock mixto, rango de precios y semántica de estados/plantillas/estadísticas se registra como decisión de la titular, no como función implementada.
