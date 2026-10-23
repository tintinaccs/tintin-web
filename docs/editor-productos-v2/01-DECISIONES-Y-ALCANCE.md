# Decisiones funcionales y alcance

Fuente: PROMPT 0 entregado por la titular el 2026-10-23. **33 SÍ, 10 NO, 0 decisiones pendientes entre 1–43**. Aprobación funcional no equivale a implementación terminada. Referencias E1–E7: [arquitectura](02-ARQUITECTURA-ACTUAL.md).

| Nº | Función | Decisión | Evidencia previa conservada | Estado fase1 | Dependencias y riesgo |
| --- | --- | --- | --- | --- | --- |
| 1 | Nombre del producto | SÍ | E1: name; implementación visible en formulario/guardado. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 2 | Descripción | SÍ | E1: description; E4 vista previa. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 3 | Fotografías y galería | SÍ | E1/E3: imageUrl, imagesExtra. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 4 | Ordenar fotografías | SÍ | E3: controles move y drag/drop en fotos por variante; no acredita todo orden de galería. | parcial | Medios E3; fallback por posición H3. |
| 5 | Precio de venta | SÍ | E1: price; E6 cotización autoritativa. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 6 | Precio anterior y descuentos | SÍ | E1: priceBefore mayor que price; no confundir con motor de promociones. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 7 | Costo de compra | SÍ | E1: productInventory.costUnit privado. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 8 | Categoría | SÍ | E1: category. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 9 | Colecciones | SÍ | E1: collection; no asumir multiselección por ser plural en el pedido. | parcial | E1/colecciones; category y collection no equivalen a pertenencia múltiple. |
| 10 | Etiquetas de búsqueda | SÍ | E1: tags normalizados. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 11 | SKU general del producto | SÍ | E1/E2: sku general. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 12 | Vista previa | SÍ | E4: vista previa lee formulario, no persiste. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 13 | Crear, editar y guardar | SÍ | E1: prodGuardar; runtime autenticado NOT_VERIFIED. | existente | E1/reglas; guardados público/privado y sync separados H5. |
| 14 | Duplicar productos | SÍ | E2: productDuplicateData; copia inactiva y stock cero. | existente | E2; duplicar debe limpiar IDs nuevos y stock sin perder fotos. |
| 15 | Edición masiva | SÍ | E2: applyProductBulkTransaction; campos permitidos y conflicto. | existente | E2; guardia por huella y máscaras de campos; no admitir lote incompatible con matriz. |
| 16 | Variantes por color | SÍ | E1/E5: grupos genéricos; color y presentación E3. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 17 | Variantes por talle | SÍ | E1/E5: claves genéricas; UX de talle específica NOT_VERIFIED. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 18 | Variantes por material | SÍ | E1/E5: opción genérica y material descriptivo son conceptos distintos. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 19 | Variantes personalizadas | SÍ | E1/E5: grupos genéricos. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 20 | Agregar, editar y quitar opciones | SÍ | E1: parseo/guardado; preservación de identidad requiere regresión. | existente | E1/E5; reordenación positiva rechazada H2. |
| 21 | Combinaciones de variantes | SÍ | E5: resolveProductVariant; selección y matriz existentes. | existente | E5/E6; ambigüedad de cadenas, repetición de valores e IDs H2/H4. |
| 22 | Stock por variante | SÍ | E1/E5: variantInventory. | existente | E1/E5; concurrencia, sumas y reserva/devolución exacta. |
| 23 | Stock total automático | SÍ | E1/E2: suma de entradas; no derivar de purchased. | existente | E1/E5; preservar null/no controlado; no sumar purchased. |
| 24 | Precio por variante | SÍ | No acreditado de extremo a extremo; metadato price reconocido en E5 no prueba edición/cobro por variante. | parcial | E1/E5/E6/E7/importador/carrito; precio general actual H1. |
| 25 | SKU por variante | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. | no incorporada | E2/importador; NO nuevo, conservar metadatos legados. |
| 26 | Fotografías por variante | SÍ | E3: variantMedia y foto-variante compartida. | existente | E3/E5; misma identidad, precedencia de combinación y fallback H3. |
| 27 | Círculos de colores | SÍ | E3/E4: color y vista previa; comprobar accesibilidad en fase autorizada. | existente | E1/E3/E4/E5 según evidencia; preservar validación, permisos y compatibilidad. |
| 28 | Editar varias variantes | SÍ | E1: edición de cantidades; edición masiva de variantes independiente NOT_VERIFIED. | parcial | E1/E2; lote actual rechaza stock distribuido, no hay lote de combos. |
| 29 | Reordenar variantes | SÍ | E1: orden de definición; UI dedicada y estabilidad de claves NOT_VERIFIED. | parcial | E1/E5/carrito; H2/H4, IDs estables antes de habilitar arrastre. |
| 30 | Disponibilidad de variantes | SÍ | E5: variantStockLimit/hasProductStock; disponibilidad manual independiente NOT_VERIFIED. | parcial | E5; stock por opción sí; active por combinación no gobierna todo el flujo. |
| 31 | Estados del producto | SÍ | E1: active booleano; ciclo borrador/archivado separado NO acreditado. | parcial | E1/importador/publicación; active no cubre draft/archive independientes. |
| 32 | SEO para Google | SÍ | E7: metadata/JSON-LD generado; editor SEO específico NO acreditado. | parcial | E7; metadata automática existe; edición SEO específica no está en formulario/guardado. |
| 33 | URL personalizada | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. | no incorporada | Fuera del alcance nuevo; no eliminar datos ni APIs legadas. |
| 34 | Código de barras | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. | no incorporada | Fuera del alcance nuevo; no eliminar datos ni APIs legadas. |
| 35 | Peso y datos de envío | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. | no incorporada | Fuera del alcance nuevo; no eliminar datos ni APIs legadas. |
| 36 | Proveedor/fabricante | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. | no incorporada | Fuera del alcance nuevo; no eliminar datos ni APIs legadas. |
| 37 | Canales de venta | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. | no incorporada | Fuera del alcance nuevo; no eliminar datos ni APIs legadas. |
| 38 | Inventario por sucursal | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. | no incorporada | Fuera del alcance nuevo; no eliminar datos ni APIs legadas. |
| 39 | Videos y modelos 3D | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. | no incorporada | Fuera del alcance nuevo; no eliminar datos ni APIs legadas. |
| 40 | Campos personalizados | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. | no incorporada | Fuera del alcance nuevo; no eliminar datos ni APIs legadas. |
| 41 | Plantillas por producto | SÍ | Plantillas por producto NO acreditadas; plantillas de correo/páginas no demuestran esta función. | faltante | E1/E4/E7; sin selector/campo de plantilla por producto en rutas inspeccionadas. |
| 42 | Estadísticas por producto | SÍ | Estadísticas por producto completas NO acreditadas por la inspección documental. | parcial | E1 estadísticas/E8; ranking agrupa nombres, no ficha estadística por ID H6. |
| 43 | Suscripciones y preventas | NO | Fuera de nueva incorporación; preservar datos/API/comportamientos existentes. | no incorporada | Fuera del alcance nuevo; no eliminar datos ni APIs legadas. |

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

Mantener Firestore, Sheets, catálogo, carrito, checkout, pedidos, inventario, medios, permisos y auditoría. Un NO limita la incorporación nueva: **no autoriza borrar datos, APIs o comportamientos**. No crear sistemas paralelos. No migrar/borrar datos comerciales ni publicar sin autorización específica. PROMPT0 autorizó documentación y PR. El pedido posterior autoriza fase1 de auditoría/plan, sin cambios funcionales ni fase2.

## Lectura de estados fase1

Clasificación estática: **23 existentes, 9 parciales, 1 faltante y 10 no incorporadas**. «Existente» indica implementación localizada, no PASS de producción. «Faltante» se limita al editor y rutas inspeccionadas; no niega APIs de otros módulos. Las diez NO son decisiones de producto, no diez defectos. Detalles H1–H6 en la auditoría. La evidencia inicial se conserva como fotografía del PROMPT0; la inspección ampliada de fase1 prevalece para la arquitectura actual.


## Delta de fase2 comercial

La matriz anterior conserva su clasificación de fase1. La titular aprobó continuar mediante el pedido expreso de fase2 motor comercial, sin publicación. Precio por variante, stock nullable, referencias estables y adaptación de consumidores se implementan bajo opt-in; la interfaz antigua no habilita edición de v2 y no se inicia el rediseño completo. No equivale a cerrar las33 funciones aprobadas: estados editoriales, plantillas, estadísticas por ID y otras capacidades visuales siguen en sus fases autorizables posteriores. Funciones44–58 y las diez NO no se eliminan. Contrato real y evidencia en10-MOTOR-COMERCIAL-FASE-2.
