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
