# Editor de productos — única versión vigente

Decisión de la titular26/10/2026: conservar exclusivamente el editor construido
en seis fases, unificado con sus correcciones posteriores. Las propuestas visuales
anteriores no constituyen versiones disponibles ni instrucciones de implementación.

## Autoridad de la entrega

Entrega vigente: continuación final de Fase6, PR#1244, rama
`codex/editor-fase6-integracion-20261026`, cabeza
8b171b76fe8d2442c6f69b3025707fb3f44ada48, integrada
8e922503881d49e17e24fbe4c14a39f2c43bf9dc. Incluye los antecedentes ya integrados
por#1241; no se recupera su presentación anterior como otra versión.
Se mantienen también#1245 y Perfil#1246 de main e78a9de2f.

| Fase de la versión vigente | Código y contrato conservados |
| --- | --- |
|1 — Estabilización |Scroll, foco, entrada Nuevo/Editar y controles originales |
|2 — Fotografías |Galería única: carga, reemplazo, portada, orden, ampliación y asociaciones |
|3 — Opciones e inventario |Atributos agrupados, V1/V2, identidad comercial, disponibilidad y costos privados |
|4 — Simplificación UX |Textos, ayudas y controles depurados; galería sin reconstrucciones redundantes |
|5 — Borradores y guardado |Cancelar/Guardar cambios, recuperación privada, CAS, salida explícita y publicación segura |
|6 — Integración y auditoría |Contratos editor→catálogo→carrito→compra; evidencias, compatibilidad y pendientes explícitos |

Este documento es la única entrada de producto/editor. Los informes técnicos de
las fases conservan pruebas fechadas; no habilitan otros diseños. La numeración de
propuestas anteriores no modifica este contrato.

## Edición contextual del producto

Sobre main899a685 (#1248) se reúne el producto completo junto a la galería:
fotos seleccionables, colores encima, campos comerciales/editoriales originales
y opciones por categoría. Es continuidad de esta misma versión de seis fases.
Evidencia vigente: [EDICION-CONTEXTUAL-PRODUCTO.md](EDICION-CONTEXTUAL-PRODUCTO.md).

## Implementación única

- `admin.html` conserva el formulario y sus IDs canónicos.
- `admin-app.js` conserva el controlador y serializer originales.
- `interfaz-productos-adaptable.js` organiza ese formulario; no monta una copia.
- `shopify-commerce-admin.css` contiene la presentación administrativa vigente.
- `galeria-unificada.js` es la galería del editor; los módulos de asociaciones se
  utilizan internamente y no montan galerías competidoras.
- `controles-editor-producto.js` y el editor comercial comparten los atributos,
  precios, cantidades e identificadores originales.
- `espacio-trabajo-producto.js` conserva el progreso privado; la publicación sigue
  en el escritor comercial, sin otro checkout ni motor de pagos.

No hay selector de versión del editor, navegación studio ni hoja alternativa
editor-producto-studio. La propuesta#1247 quedó cerrada sin merge y su CI fue
cancelada. No forma parte de esta entrega. Se retiran las especificaciones e ilustraciones
visuales previas y los restos de guía que ya no se montaban.

Las plantillas de ficha pública y las variantes de un producto son funciones
comerciales de esta misma versión, no versiones alternativas del editor.

## Validación y publicación

Esta unificación se verifica en su propia rama y CI. No se heredan los resultados
de la propuesta retirada. Las pruebas usan almacenamiento e identidad ficticios;
no crean pagos, pedidos ni modificaciones productivas. Se conserva el requisito
de merge protegido y verificación posterior. Las validaciones físicas y de
proveedores continúan identificadas como pendientes, sin afirmar cierre global.

Resultados y recibo de esta unificación: `UNIFICACION-SEIS-FASES.md`.

Avances generales del proyecto y pendientes externos:
[Seguimiento conciliado](../agent/SEGUIMIENTO_PENDIENTES_20261026.md).

## Continuación responsive del 27/10/2026

Sobre#1256, tablet utiliza dos columnas desde720px; móvil conserva una columna.
El estado de guardado y Reintentar tienen una sola región en la cabecera.
Es la misma versión del editor: [TABLET-Y-AVISO-GUARDADO.md](TABLET-Y-AVISO-GUARDADO.md).
El informe ESPACIO-EDICION-RESPONSIVO registra el ajuste anterior de#1254; su
columna única en tablet queda sustituida por esta corrección, sin recuperar#1249.
