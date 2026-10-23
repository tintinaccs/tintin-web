# Corrección de selección de productos — 2026-10-23

El reloj mNtMiiHXmxISMWURMtTy guarda Material, Talle y Diseño como atributos de una sola opción. El carrito de la captura los ordena Diseño/Material/Talle y la lectura pública actual los devuelve Material/Talle/Diseño. La validación anterior dependía de esa posición. La solución es compartida para el catálogo completo, sin editar los productos individualmente.

## Conexiones

- Catálogo y carrito conservan selecciones válidas aunque cambie el orden de los atributos.
- Checkout del servidor reconoce la selección y normaliza el artículo antes de la reserva transaccional.
- Stock por opción busca la misma selección en su matriz existente; descuenta y devuelve sobre la clave guardada, sin renombrar matrices comerciales.
- Fotos por variante interpretan la selección en el orden de atributos del producto.
- Productos sin opciones conservan su selección vacía. Características fijas se completan automáticamente si el borrador no incluye selección. Cuando hay varias opciones reales, la selección debe ser válida y disponible.
- Metadatos price/sku/imageUrl/imageUrls/stock/active/colorHex/swatch no se interpretan como opciones comprables.
- Mensajes de checkout distinguen opciones que cambiaron o faltan del error genérico.
- Cargas estáticas y dinámicas reciben referencias coherentes de caché desde los generadores existentes.

## Alcance y límites

Se inspeccionó el snapshot público de 222 productos activos: 49 con opciones/atributos, 23 sólo con características fijas, 8 con varios atributos, 25 con stock por variante. La estructura, precios y stock revisados no presentaron otras inconsistencias. El detalle por producto está en catalogo-variantes-20261023.json. Los productos inactivos no están disponibles en este endpoint. Esta lectura no ejecuta compras ni acredita funcionamiento de producción.

Por instrucción explícita del usuario no se añadieron ni ejecutaron pruebas en la reparación. Se revisó el diff y se generaron los artefactos necesarios. Pruebas funcionales, CI y publicación quedan NOT_VERIFIED. No se modificaron productos reales ni se crearon pedidos.
