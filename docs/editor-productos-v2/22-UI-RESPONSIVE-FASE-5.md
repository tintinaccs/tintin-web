# Fase 5 — Presentación responsive y superficies públicas

Fecha de trabajo: 25/10/2026 (America/Buenos_Aires; ejecuciones UTC del 26/10).
Agente: Codex /root. Base: `a6e197e5382cf694caf6d07272e6450a2dfe5b5b`,
cabeza recuperada de Fase 4 / #1240. Rama: `codex/editor-responsive-auditoria-fases5-6`.
Esta fase y la auditoría siguiente se entregan juntas sobre Fase 4, sin fusionar ni desplegar.

## Sistema visual y editor conservados

Se reutilizan Montserrat, rosa #F8AACA, ciruela #713C53, superficies claras y
bordes suaves. El editor de Fase 4 ya es un espacio dedicado: oculta el sidebar,
conserva Volver, nombre/estado, acciones persistentes y los controles originales.
La galería de Fase 2 y las opciones/inventario de Fase 3 continúan en el mismo
formulario. No se crea otro editor, tema, galería de producto o modal de reseñas.

Las pruebas ejecutan el formulario/controlador, estilos completos y writer reales,
con identidad, almacenamiento y proveedores sintéticos. Las medidas y capturas
no acreditan una sesión autenticada productiva ni un teclado de hardware.
La matriz final, comandos, resultados y límites están en [Fase 6](23-AUDITORIA-FINAL-FASE-6.md).

## Correcciones demostradas

| ID | Clasificación / causa / impacto | Corrección y evidencia |
| --- | --- | --- |
| UI01 | MEDIUM: tocar una de las cuatro reseñas abre la lista de 23 adicionales; no contiene ni amplía la captura tocada. | El diálogo existente alterna lista/imagen ampliada. Conserva las 27 referencias originales; anterior/siguiente y flechas de teclado; imagen con `object-fit:contain`, estado anunciado y cierre nativo. Regresión RED sobre la base antes de implementar; siete tamaños verifican selección, navegación, Escape, foco y ancho. |
| UI02 | MEDIUM: `loadCollections` retorna de caché reciente y evita consultar el edge hasta 30 minutos. La imagen escrita por administración no llega al encabezado en ese intervalo. | Emite caché inmediatamente y revalida mediante el mismo endpoint/single-flight. Navegación y presentaciones suscritas reciben la respuesta nueva; sin red conserva respaldo. Prueba ejecuta el encabezado canónico con portada antigua/nueva. No promete actualizar instantáneamente todas las pestañas ya abiertas. |
| UI03 | MEDIUM preventivo: la revalidación podría bloquear el primer render del catálogo si su política espera exclusivamente la promesa final. | La política usa `onData` y libera `catalogVisibilityReady` con el primer snapshot. La respuesta posterior actualiza esa misma política. Prueba retiene la red y verifica que la política está lista antes de resolverla. El auditor admite esa API y conserva pruebas negativas de ausencia de carga/política. |
| UI04 | LOW: la API acota la lista de progreso y devuelve `limited`; el panel ignoraba esa señal. | El panel informa que puede haber trabajos guardados fuera de la lista. Prueba de listado recibe `limited:true` y exige el aviso, además de continuar el borrador. Paginación/retención siguen pendientes; no se borran trabajos ni archivos para resolver el límite. |
| UI05 | MEDIUM: en320/390 el selector comparte fila con guía/vista previa y recorta el rótulo (80,53px disponibles frente a111,38px medidos para «Todos los campos» en390). | Grid de dos filas sólo en workspace móvil: selector ocupa ancho completo; guía y vista previa conservan acceso, y guía abierta ocupa su fila. Dos regresiones RED; comprueban texto medido, selección larga, guía, foco y ancho antes de captura. |
| UI06 | MEDIUM: acciones desktop ocupan1864px en viewport1920 y fuerzan otra fila, desproporcionadas respecto del formulario. | Desde1024px el grupo usa ancho natural y botones sin expansión, alineados con Volver/título. Dos RED; suite completa del workspace repetida23/23 después. |

UI07 (MEDIUM, corrección adicional 26/10): al revalidar membresía de colecciones,
el catálogo recibía una lista ya filtrada por el store. Una colección recuperada
no recuperaba sus productos. Se reprodujo con el store real, caché Aros, metadata
retenida y actualización canónica que elimina un aro y cambia stock de un reloj:
RED esperaba reloj/stock3 y recibía[]; la corrección recarga mediante
`ensureCurrentPage` al cambiar membresía, sin guardar un segundo catálogo.
Una portada nueva con idéntica membresía no provoca esa recarga. La ficha visible
conserva su suscripción y selección; búsqueda en páginas informativas se actualiza
incluso si la proyección anterior estaba vacía. Ubicaciones: política de catálogo
(`catalogVisibilityReady`) y store (`ensureProductsForCurrentPage`). Regresiones:
`home-review-gallery.spec.js` y `product-fast-path.test.mjs`. Versionado transitivo
`editor-f56-2`; no hay cambios de precios, stock persistido, Rules o checkout.

UI01: `js/pages/home/resenas-clientas.js`, `css/pages/home/resenas-clientas.css`.
UI02: `js/pages/collections/datos-publicos-colecciones.js`; consumidores originales
`estado-colecciones.js`, `carga-colecciones.js` y presentación de colecciones.
UI03: `js/pages/catalog/politica-visibilidad-catalogo.js`.
UI04: `js/admin/shopify-commerce-admin.js`, carga y presentación de trabajos privados.
UI05: `css/admin/shopify-commerce-admin.css`, sólo `tt-product-workspace-active` hasta767px.
UI06 usa el mismo CSS, desde1024px; mantiene la disposición móvil existente.
El único override nuevo `width:100% !important` vence el `width:auto !important`
preexistente de ese selector; no se aplican overrides globales.

La persistencia de portada de colección sigue en `collGuardar` y su documento
`collections`; no se añade caché o autoridad paralela. La API pública proyecta
`image/imageUrl`, el normalizador elige `image`, y el encabezado usa esa referencia
antes de los respaldos. La corrección cambia la lectura/revalidación, no la imagen
comercial guardada. El edge mantiene sus ventanas de caché existentes.
La prueba ya existente de `maestro-productos-controlador.test.mjs` ejecuta
`collGuardar`, exige esperar la portada antes del payload, comprueba el nuevo
`collections/nuevos.image` y cero escrituras cuando la carga falla. Se reejecutó
dentro de las suites Node de esta auditoría.

## Accesibilidad e interacción

Botones nativos para ampliar reseñas, nombre accesible por captura, controles de
44 px, flechas, contador anunciado, Escape, diálogo nativo y retorno al disparador.
Al pasar de la lista a imagen se lleva foco al cierre antes de ocultar la lista.
La página recupera su overflow previo al cerrar. La lista se sigue descargando
sólo al abrir «Ver más reseñas»; ampliar una captura no requiere cargar las otras.
No se deforman ni recortan las conversaciones originales.

El editor conserva ayuda plegable, navegación por secciones, foco visible,
contrastes y movimiento reducido. La prueba nueva reduce la altura visible,
comprueba que Guardar recibe el toque en su centro, conserva nombre/precio,
recorre Tab/Shift+Tab y guarda progreso. Es una simulación de reducción de área,
no una certificación del teclado virtual de Safari.

## Capturas de navegador

Antes, código de Fase 4: [390](evidencias-f56/resenas-antes-390.png),
[1440](evidencias-f56/resenas-antes-1440.png).
Después: [320](evidencias-f56/review-enlarged-320.png),
[horizontal 844](evidencias-f56/review-enlarged-844.png),
[tablet 768](evidencias-f56/review-enlarged-768.png),
[tablet horizontal 1024](evidencias-f56/review-enlarged-1024.png),
[1920](evidencias-f56/review-enlarged-1920.png).
Comparaciones del mismo viewport: [después390](evidencias-f56/review-enlarged-390.png)
y [después1440](evidencias-f56/review-enlarged-1440.png).
Las ilustraciones anteriores del editor se retiraron para mantener una sola
referencia visual. Capturas actuales y su ejecución propia:
[Versión única](../product-editor-refactor/UNIFICACION-SEIS-FASES.md).
Las medidas y resultados fechados de esta fase conservan su alcance histórico.
Las capturas muestran la cuarta reseña después de probar anterior/siguiente;
las aserciones anteriores verifican que se abrió originalmente la tercera elegida.
No se afirma comparación pixel a pixel con una referencia aprobada inexistente.

## Impacto, versiones y reversión

Cambian bytes de cuatro módulos funcionales, del CSS de reseñas y de la navegación móvil del editor. Se regeneran
el bundle de Inicio, URLs transitivas inmutables, baseline de caché, plan de
protección y diagnóstico mediante autoridades existentes. Los demás cambios de
imports/HTML mantienen una URL única por recurso; no cambian la lógica de compra.
Checkout y pagos reciben únicamente la propagación de referencias compartidas.

Puede revertirse este delta de presentación mediante un commit normal, conservando
Fases 1–4 y sus protecciones de privacidad. No revertir Rules ni borrar productos,
inventario, progreso o medios para deshacer una modificación visual. La auditoría
final exige integrar primero la cadena revisada y validar su SHA conjunto con CI,
staging autorizado y dispositivos representativos.
