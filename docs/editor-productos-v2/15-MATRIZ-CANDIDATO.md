# Matriz de aceptación del candidato integrado

Esta matriz sustituye la fotografía de fase5 anterior para el nuevo candidato. PASS_LOCAL acredita fixtures/modelos/controladores; no significa producción autenticada ni CI remota aprobada. Funciones 44–58 continúan con sus campos canónicos y pruebas de preservación en maestro-productos-controlador.

| Nº | Función | Decisión | Implementación y evidencia local |
| --- | --- | --- | --- |
| 1 | Nombre del producto | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 2 | Descripción | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 3 | Fotografías y galería | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 4 | Ordenar fotografías | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 5 | Precio de venta | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 6 | Precio anterior y descuentos | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 7 | Costo de compra | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 8 | Categoría | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 9 | Colecciones | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 10 | Etiquetas de búsqueda | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 11 | SKU general del producto | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 12 | Vista previa | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 13 | Crear, editar y guardar | SÍ | prodGuardar real + escritor CAS + REST emulado; público/privado/auditoría atómicos v2 |
| 14 | Duplicar productos | SÍ | productDuplicateData: v2 inactivo, stock cero y metadatos conservados |
| 15 | Edición masiva | SÍ | applyProductBulkTransaction / saveProductBulk: lote mixto CAS, preserva overrides |
| 16 | Variantes por color | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 17 | Variantes por talle | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 18 | Variantes por material | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 19 | Variantes personalizadas | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 20 | Agregar, editar y quitar opciones | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 21 | Combinaciones de variantes | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 22 | Stock por variante | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 23 | Stock total automático | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 24 | Precio por variante | SÍ | Matriz editable y resolvedor común; commerce457 + Chromium v2 |
| 25 | SKU por variante | NO | No añadida como novedad; datos/API históricos preservados |
| 26 | Fotografías por variante | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 27 | Círculos de colores | SÍ | Conservada en formulario/componentes canónicos; regresiones de controlador, medios y responsive |
| 28 | Editar varias variantes | SÍ | Selección múltiple de filas y lote validado antes de aplicar |
| 29 | Reordenar variantes | SÍ | Orden separado de referencias opacas; controles y pruebas de atributos |
| 30 | Disponibilidad de variantes | SÍ | Disponibilidad por fila; sin convertir agotado en borrador |
| 31 | Estados del producto | SÍ | active/draft/archived y compatibilidad active; No listado no se añade |
| 32 | SEO para Google | SÍ | SEO editable/fallback; metadata/OG/canonical/JSON-LD sin URL personalizada |
| 33 | URL personalizada | NO | No añadida como novedad; datos/API históricos preservados |
| 34 | Código de barras | NO | No añadida como novedad; datos/API históricos preservados |
| 35 | Peso y datos de envío | NO | No añadida como novedad; datos/API históricos preservados |
| 36 | Proveedor/fabricante | NO | No añadida como novedad; datos/API históricos preservados |
| 37 | Canales de venta | NO | No añadida como novedad; datos/API históricos preservados |
| 38 | Inventario por sucursal | NO | No añadida como novedad; datos/API históricos preservados |
| 39 | Videos y modelos 3D | NO | No añadida como novedad; datos/API históricos preservados |
| 40 | Campos personalizados | NO | No añadida como novedad; datos/API históricos preservados |
| 41 | Plantillas por producto | SÍ | default/gallery comparten renderer; plantilla desconocida vuelve a default |
| 42 | Estadísticas por producto | SÍ | ID, variantes y evolución mensual; líneas pagadas brutas, cobertura/limitaciones visibles |
| 43 | Suscripciones y preventas | NO | No añadida como novedad; datos/API históricos preservados |

No se presenta una revisión propia como auditoría humana independiente. CI del SHA y pruebas de producción se registran aparte. La conversión de stock agregado a matriz exige revisión de reservas; la edición v1 existente se conserva.
