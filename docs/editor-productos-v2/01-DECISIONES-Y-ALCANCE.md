# Decisiones funcionales y alcance

Fuente: PROMPT 0 entregado por la titular el 2026-10-23. **33 SÍ, 10 NO, 0 decisiones pendientes entre 1–43**. Aprobación funcional no equivale a implementación terminada. Referencias E1–E7: [arquitectura](02-ARQUITECTURA-ACTUAL.md).

| Nº | Función | Decisión | Correspondencia inspeccionada / límite |
| --- | --- | --- | --- |
| 1 | Nombre del producto | SÍ | E1: name; implementación visible en formulario/guardado. |
| 2 | Descripción | SÍ | E1: description; E4 vista previa. |
| 3 | Fotografías y galería | SÍ | E1/E3: imageUrl, imagesExtra. |
| 4 | Ordenar fotografías | SÍ | E3: controles move y drag/drop en fotos por variante; no acredita todo orden de galería. |
| 5 | Precio de venta | SÍ | E1: price; E6 cotización autoritativa. |
| 6 | Precio anterior y descuentos | SÍ | E1: priceBefore mayor que price; no confundir con motor de promociones. |
| 7 | Costo de compra | SÍ | E1: productInventory.costUnit privado. |
| 8 | Categoría | SÍ | E1: category. |
| 9 | Colecciones | SÍ | E1: collection; no asumir multiselección por ser plural en el pedido. |
| 10 | Etiquetas de búsqueda | SÍ | E1: tags normalizados. |
| 11 | SKU general del producto | SÍ | E1/E2: sku general. |
| 12 | Vista previa | SÍ | E4: vista previa lee formulario, no persiste. |
| 13 | Crear, editar y guardar | SÍ | E1: prodGuardar; runtime autenticado NOT_VERIFIED. |
| 14 | Duplicar productos | SÍ | E2: productDuplicateData; copia inactiva y stock cero. |
| 15 | Edición masiva | SÍ | E2: applyProductBulkTransaction; campos permitidos y conflicto. |
| 16 | Variantes por color | SÍ | E1/E5: grupos genéricos; color y presentación E3. |
| 17 | Variantes por talle | SÍ | E1/E5: claves genéricas; UX de talle específica NOT_VERIFIED. |
| 18 | Variantes por material | SÍ | E1/E5: opción genérica y material descriptivo son conceptos distintos. |
| 19 | Variantes personalizadas | SÍ | E1/E5: grupos genéricos. |
| 20 | Agregar, editar y quitar opciones | SÍ | E1: parseo/guardado; preservación de identidad requiere regresión. |
| 21 | Combinaciones de variantes | SÍ | E5: resolveProductVariant; selección y matriz existentes. |
| 22 | Stock por variante | SÍ | E1/E5: variantInventory. |
| 23 | Stock total automático | SÍ | E1/E2: suma de entradas; no derivar de purchased. |
| 24 | Precio por variante | SÍ | No acreditado de extremo a extremo; metadato price reconocido en E5 no prueba edición/cobro por variante. |
| 25 | SKU por variante | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. |
| 26 | Fotografías por variante | SÍ | E3: variantMedia y foto-variante compartida. |
| 27 | Círculos de colores | SÍ | E3/E4: color y vista previa; comprobar accesibilidad en fase autorizada. |
| 28 | Editar varias variantes | SÍ | E1: edición de cantidades; edición masiva de variantes independiente NOT_VERIFIED. |
| 29 | Reordenar variantes | SÍ | E1: orden de definición; UI dedicada y estabilidad de claves NOT_VERIFIED. |
| 30 | Disponibilidad de variantes | SÍ | E5: variantStockLimit/hasProductStock; disponibilidad manual independiente NOT_VERIFIED. |
| 31 | Estados del producto | SÍ | E1: active booleano; ciclo borrador/archivado separado NO acreditado. |
| 32 | SEO para Google | SÍ | E7: metadata/JSON-LD generado; editor SEO específico NO acreditado. |
| 33 | URL personalizada | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. |
| 34 | Código de barras | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. |
| 35 | Peso y datos de envío | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. |
| 36 | Proveedor/fabricante | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. |
| 37 | Canales de venta | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. |
| 38 | Inventario por sucursal | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. |
| 39 | Videos y modelos 3D | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. |
| 40 | Campos personalizados | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. |
| 41 | Plantillas por producto | SÍ | Plantillas por producto NO acreditadas; plantillas de correo/páginas no demuestran esta función. |
| 42 | Estadísticas por producto | SÍ | Estadísticas por producto completas NO acreditadas por la inspección documental. |
| 43 | Suscripciones y preventas | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. |

## Funciones propias que deben conservarse

El prompt enumera 15 conceptos sin asignar explícitamente cada número. Se numeran 44–58 en el mismo orden, sin añadir decisiones.

| Nº | Función | Campo actual | Evidencia |
| --- | --- | --- | --- |
| 44 | Material | `material` | E1; prod-material |
| 45 | Medidas | `measurements` | E1; prod-measurements |
| 46 | Color/acabado | `colorFinish` | E1; prod-color-finish |
| 47 | Cuidados | `care` | E1; prod-care |
| 48 | Resistencia al agua | `waterResistance` | E1; prod-water-resistance |
| 49 | Garantía | `warranty` | E1; prod-warranty |
| 50 | Talle/ajuste | `sizeFit` | E1; prod-size-fit |
| 51 | Contenido del paquete | `packageContents` | E1; prod-package-contents |
| 52 | Cantidades compradas | `productInventory.purchased` | E1; prod-purchased |
| 53 | Stock mínimo | `productInventory.stockMinimum` | E1; prod-stock-minimum |
| 54 | Notas internas | `productInventory.internalNotes` | E1; prod-internal-notes |
| 55 | Destacado | `destacado` | E1/E2; prod-destacado |
| 56 | Distintivos | `badge; oferta como indicador separado` | E1/E2; prod-badge, prod-oferta |
| 57 | Stock cero frente a no controlado | `stock: 0 frente a null/ausente` | E1/E5: cero agotado; vacío no controlado |
| 58 | Asociaciones de fotos por variantes/combinaciones | `variantMedia; imageUrl; imagesExtra` | E1/E3/E5; atributos identifican combinación |

## Restricciones

Shopify es referencia de experiencia, sin dependencia nueva ni conversión de Tintin. Conservar rosa #F8AACA, ciruela #713C53, blanco/marfil y Montserrat; reutilizar el tema canónico vigente, sin reemplazar avances concurrentes.

Mantener Firestore, Sheets, catálogo, carrito, checkout, pedidos, inventario, medios, permisos y auditoría. Un NO limita la incorporación nueva: **no autoriza borrar datos, APIs o comportamientos**. No crear sistemas paralelos. No migrar/borrar datos comerciales ni publicar sin autorización específica. Este pedido sólo autoriza documentos y PR documental, no fases funcionales.
