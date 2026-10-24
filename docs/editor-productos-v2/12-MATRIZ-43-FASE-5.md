# Matriz de las43 decisiones — auditoría fase5

Fuente original:01-DECISIONES-Y-ALCANCE.43 decisiones:33 SÍ y10 NO. Fuente auditada85d5061d6 más las correcciones de esta rama; no fases3/4 imaginadas. E1–E8 y comandos se definen en11-AUDITORIA-FASE-5. «Existente» indica soporte localizado y pruebas señaladas, **no aprobación completa del editorv2 ni producción**. Las diez NO no son diez defectos ni autorizan eliminar legado.

| Nº | Función | Decisión original | Estado real | Evidencia de código | Pruebas nuevas | Problema o límite |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Nombre del producto | SÍ | Existente legado; v2 bloqueado | admin-app:prodGuardar/serializeProductForm | E1/E3 | No hay escritor compatible v2 (B01). |
| 2 | Descripción | SÍ | Existente legado | admin-app:description | E1/E3 | No acredita editor nuevo ni validación visual de texto enriquecido. |
| 3 | Fotografías y galería | SÍ | Existente legado | fotos-por-color/fotos-por-variante/carga-imagenes | E3 | Uploads ficticios; Cloudinary real no probado. |
| 4 | Ordenar fotografías | SÍ | Parcial | fotos-por-variante; portada por color | E3 | Orden de fotos probado; no toda organización nueva de F3. |
| 5 | Precio de venta | SÍ | Existente general; motor v2 probado | inventario-variantes:productVariantPrice; dominio pedidos | E1/E4/E5 | Edición del override no está disponible en editor (B01). |
| 6 | Precio anterior y descuentos | SÍ | Existente con contrato v2 | productVariantPrice/priceBefore | E4 | No confundir descuento de precio anterior con cupón arbitrario. |
| 7 | Costo de compra | SÍ | Existente privado | productInventory.costUnit; reglas | E1/E5 | No se expone al cliente; persistencia editor probada con almacén ficticio. |
| 8 | Categoría | SÍ | Existente legado | prod-category; maestro-productos-core | E1/E2/E3 | No rediseño F3. |
| 9 | Colecciones | SÍ | Parcial | prod-collection; productBulkPatch | E1/E2/E3 | Campo/edición masiva existentes; pertenencia múltiple no acreditada. |
| 10 | Etiquetas de búsqueda | SÍ | Existente legado | prod-tags; filtros maestro/búsqueda | E1/E2/E3 | Sin novedad funcional de F3. |
| 11 | SKU general del producto | SÍ | Existente general | prod-sku; controlador duplicado | E1/E2/E3 | SKU por variante sigue excluido como novedad. |
| 12 | Vista previa | SÍ | Existente legado | vista-previa-producto; cambios de sección | E3 | Preview nuevo de todas las combinaciones v2 no disponible. |
| 13 | Crear, editar y guardar | SÍ | Parcial | prodGuardar/transaction; huella original | E1/E5 | v2 bloqueado; guardado público/privado por etapas (B01/M01). |
| 14 | Duplicar productos | SÍ | Existente v1; v2 protegido | productDuplicateData; prodDuplicar | E1/E2/E3 | Duplicar v2 se bloquea hasta escritor compatible. |
| 15 | Edición masiva | SÍ | Existente v1; v2 protegido | applyProductBulkTransaction | E1/E2/E3 | Lote no edita precios por combinación v2. |
| 16 | Variantes por color | SÍ | Existente color; motor v2 | namedVariantGroups/fotos-por-color | E3/E4 | Edición comercial v2 aún bloqueada. |
| 17 | Variantes por talle | SÍ | Existente genérico | resolveProductVariant/namedVariantGroups | E4/E5 | Falta UX v2; no se afirma prueba física de talles. |
| 18 | Variantes por material | SÍ | Existente genérico | namedVariantGroups; campo descriptivo material separado | E1/E4 | Material como opción genérica; UX v2 específica no probada. |
| 19 | Variantes personalizadas | SÍ | Existente genérico | namedVariantGroups/variants | E4 | No equivale a campos descriptivos arbitrarios (40 NO). |
| 20 | Agregar, editar y quitar opciones | SÍ | Parcial/protegido | reorderVariantInventory | E3/E4 | No elimina referencia guardada ni con stock0; nueva UX pendiente. |
| 21 | Combinaciones de variantes | SÍ | Motor probado; UI parcial | variantInventory/attributes/variantKey | E4/E5 | Tabla/guardado v2 completo no existe (B01). |
| 22 | Stock por variante | SÍ | Motor probado; UI v1 | applyVariantInventoryDeltas | E1/E3/E4/E5 | No activar editor v2 antes de escritor compatible. |
| 23 | Stock total automático | SÍ | Motor probado | productStockTotal/variantInventoryTotal | E4/E5/E6 | Suma finita o null; SEO corregido para agregado desactualizado (F02). |
| 24 | Precio por variante | SÍ | Parcial | productVariantPrice y cotización persistida | E4/E5/E6 | Motor sí; precio editable por fila en editor no (B01). |
| 25 | SKU por variante | NO | No incorporada como novedad | diff 85d5061d6..rama de auditoría y fuentes originales | E8 | SKU legado en importación/medios conservado; no se exige ni añade editor SKU por combinación. |
| 26 | Fotografías por variante | SÍ | Existente; identidad v2 probada | productVariantImage/variantMedia | E2/E3/E4/E5 | Medios reales no alterados ni probados en Cloudinary. |
| 27 | Círculos de colores | SÍ | Existente legado | swatch/colorHex; fotos-por-color | E3 | Teclado/aria de fixtures; lector físico no probado. |
| 28 | Editar varias variantes | SÍ | Parcial | maestro y stock por fila | E1/E3 | Lote integral de combinaciones/precios v2 no implementado. |
| 29 | Reordenar variantes | SÍ | Parcial | reorderVariantInventory/attributesKey | E3/E4/E5 | Identidad motor estable; UI completa F3 ausente. |
| 30 | Disponibilidad de variantes | SÍ | Parcial | active de fila; hasProductStock | E4/E5/E6 | Disponibilidad resuelta; controles editor v2 pendientes. |
| 31 | Estados del producto | SÍ | No completada | active; hasPublicProductFields | E3/E4/E8 | No hay ciclo draft/archive/unlisted aprobado e integrado (B02). |
| 32 | SEO para Google | SÍ | Parcial | functions/product.js; sitemap-products.xml.js | E6/E8 | SEO automático existe; título/descripción SEO editables no (B02). |
| 33 | URL personalizada | NO | No incorporada como novedad | diff 85d5061d6..rama de auditoría y fuentes originales | E8 | Aliases históricos/canonical conservados; no hay editor de URL personalizada nuevo. |
| 34 | Código de barras | NO | No incorporada como novedad | diff 85d5061d6..rama de auditoría y fuentes originales | E8 | No campo/flujo nuevo de código de barras en diff. |
| 35 | Peso y datos de envío | NO | No incorporada como novedad | diff 85d5061d6..rama de auditoría y fuentes originales | E8 | No nuevos campos de peso/envío; checkout existente conservado. |
| 36 | Proveedor/fabricante | NO | No incorporada como novedad | diff 85d5061d6..rama de auditoría y fuentes originales | E8 | Sin editor nuevo de proveedor/fabricante. |
| 37 | Canales de venta | NO | No incorporada como novedad | diff 85d5061d6..rama de auditoría y fuentes originales | E8 | Sin gestión nueva de canales de venta. |
| 38 | Inventario por sucursal | NO | No incorporada como novedad | diff 85d5061d6..rama de auditoría y fuentes originales | E8 | Sin motor nuevo por sucursal. |
| 39 | Videos y modelos 3D | NO | No incorporada como novedad | diff 85d5061d6..rama de auditoría y fuentes originales | E8 | Sin editor nuevo de video/3D; no se borran medios reales. |
| 40 | Campos personalizados | NO | No incorporada como novedad | diff 85d5061d6..rama de auditoría y fuentes originales | E8 | Sin constructor arbitrario de campos; atributos de variantes no son esta función. |
| 41 | Plantillas por producto | SÍ | No implementada | product.html fijo; sin selector de plantilla | E8 | Diseños propuestos aún sin aprobación; no construirlos por inferencia (B02). |
| 42 | Estadísticas por producto | SÍ | Parcial | renderGeneralStatistics/modelo-reinicios | E7/E8 | Ranking ID/cancelaciones corregido; falta ficha, variantes, evolución y contrato de netos (B02/M02). |
| 43 | Suscripciones y preventas | NO | No incorporada como novedad | diff 85d5061d6..rama de auditoría y fuentes originales | E8 | Sin suscripciones/preventas nuevas. |

Resultado:33 aprobaciones de producto no equivalen a33 funciones del editorv2 verificadas. Bloqueos B01/B02 impiden aprobar el conjunto. No hay evidencia de nuevas funciones rechazadas ni borrado de datos productivos en este diff. Preservación44–58 en13.
