# Estabilización del editor — nueva Fase 1, 25/10/2026

Autor: Codex /root. Base comprobada: `f9399a90c73398a18c877bcaf1985491d4085913`, igual a main remoto al comenzar. Rama: `codex/editor-estabilizacion-fase1-20261025`. El SHA del candidato se obtiene con `git rev-parse HEAD` y en el PR; este documento describe el delta desde esa base. Alcance: texto adjunto «TINTIN ACCESORIOS — FASE 1». Sus restricciones actuales prevalecen sobre autorizaciones históricas: **sin merge ni despliegue**.

## Resultado ejecutivo

Se reproduce y corrige un reinicio de scroll durante la edición cuando permanece un error de validación. Las imágenes de reseñas ahora abren el diálogo mediante botones nativos, con Enter/Espacio, Escape y devolución de foco. Se conserva el formulario y escritor existente. No cambia checkout, permisos, reglas, datos comerciales ni identidades de variantes.

La fase completa **no se certifica cerrada**: falta reproducir la lentitud de la sesión administrativa real y completar un perfil estadístico de memoria/listeners/foco durante reconstrucciones. Las pruebas sintéticas no acreditan producción, Safari ni teclado virtual físico. Los pendientes abajo conservan su alcance para continuar sin repetir el diagnóstico.

## Base, concurrencia y autoridad

Historial reciente inspeccionado: #1236 navegación y responsive, #1235 montaje del editor, #1234 opciones/stock, #1232 contraste, #1230 presentación. Abiertos al inicio: #1233 borradores privados (draft), #1228 retirada de colores/stock (draft), #1231 dependencia fast-uri. No se integran sus ramas ni se duplican cambios. El protocolo AGENTS pide merge protegido para implementaciones, pero el pedido expreso actual lo prohíbe. Además existe mantenimiento que puede fusionar PR elegibles automáticamente: presentar este candidato en borrador para impedir esa elegibilidad, sin modificar workflows ni protecciones.

Documentación previa: carpeta 00–17, contratos de versiones canónicas, protocolo de reparación y matriz de impacto. Sus resultados de otras bases no se heredan.

## Flujo actual y fuentes canónicas

`admin.html` conserva IDs/campos. `admin-app.js` abre Nuevo/Editar, monta fotos e inventario y registra `UnsavedGuard.track(serializeProductForm, prodGuardar)`. `interfaz-productos-adaptable.js` mueve los mismos nodos a secciones y sincroniza superficies; `controles-editor-producto.js` monta una vez por tarjeta y refresca sus controles. No es otro formulario.

`prodGuardar` comprueba rol y permisos, nombre/colección/precio/stock, completa flush de color/galería/portada y exige descripción/foto para publicar. Construye los campos editoriales/comerciales desde el formulario; la acción existente `saveProduct` usa baseline/CAS para conservar concurrencia y datos privados según rol. Sheets conserva su espejo y recuperación, no sustituye Firestore. Un blob local no debe persistirse como URL. Cancelar conserva guardia de cambios pendientes.

`products` contiene el estado comercial/editorial y medios; `productInventory` conserva costo/compras/mínimo/notas privados. `inventario-variantes.mjs` y el editor comercial conservan claves y semántica de stock. La vista previa no persiste. `galeria-producto.js` expone `TintinProductMedia`; `foto-variante.mjs` y consumidores de catálogo/ficha resuelven asociaciones. No se añade otra fuente de verdad.

## Inventario de hallazgos

| ID / clasificación | Evidencia, impacto y corrección |
| --- | --- |
| A1 HIGH, corregido | `enhanceProductEditor` llamaba `showSection(..., Boolean(message))` en cada entrega de MutationObserver. Con error visible, modificar precio genera nodos de resumen, activa observer y acaba en `TintinPageScroll.reset(card)`. La regresión cuenta 1 reset inesperado en base y 0 en candidato; comprueba scroll y foco. Sólo un mensaje nuevo inicia esa navegación. |
| A2 CORRECT con límite | `syncProductSurfaces` reinicia al pasar cerrado→abierto; `showSection` reinicia al cambiar apartado voluntariamente. Tests conservan ese contrato y borrador. `resetEntryScroll` también escucha entrada/load/pageshow: la carga tardía durante una sesión de edición no está reproducida aquí y sigue como hipótesis independiente. |
| B1 MEDIUM, pendiente | `fotos-por-color.render` destruye widgets y usa `replaceChildren`, y el editor por combinación también reconstruye. Agregar color dispara render por input; analizar sugerencias puede renderizar por foto. El costo crece con fotos; no se atribuye todo congelamiento a este mecanismo sin perfil de sesión. La preservación de foco en asignación por checkbox requiere una regresión adicional. |
| B2 CORRECT con límite | `installEditorControls` usa WeakSet/mounted y la interfaz bandera installed; listeners de fotos se retiran al destruir. No prueba ausencia universal de listeners duplicados o de memoria retenida. Observer del formulario agrupa por microtask, no por frame: puede haber varias entregas por acción. |
| C1 CORRECT local | Orden y portada con 1,2,3,4,5,10,20 fotos: botón primera foto conserva todas las URLs en orden y portada general actualiza input. Galería/ficha públicas tienen regresiones independientes de selección. No equivale a guardar autenticado y consultar la tarjeta real después. |
| C2 LOW, ambigüedad UX | Primera foto de color, primera foto de combinación y portada general son tres operaciones diferentes con apariencia similar. No se eliminan: combinación específica prevalece sobre color; portada general es `imageUrl`. |
| D1 MEDIUM, pendiente de Fase 2 | `renderProducts` filtra active/inactive/soldout; selector no tiene apartados draft/archived, aunque el editor guarda `publicationStatus`. Inactivos agrupa estados distintos. No crear una conversión histórica ni confundir agotado con borrador. #1233 afecta privacidad y se revisa antes de diseñar la lista. |
| E1 CORRECT local con límites | Matrices Chromium existentes cubren móvil vertical/horizontal, tablet ambas orientaciones, laptop y escritorio; comprueban ancho, acciones, permisos y guardado sintético. Safari, teclado físico/virtual y dispositivos reales no acreditados. |
| F1 MEDIUM, corregido | `resenas-clientas.js` sólo registraba click en `#tt-reviews-more`; las cuatro imágenes visibles eran figuras sin acción. Se envuelven en botones nativos que abren el mismo diálogo diferido, sin duplicar la galería. Al cerrar vuelve el foco al disparador real. Seis anchos prueban click y teclado. |

## Medios de extremo a extremo

`imageUrl` es portada general; `imagesExtra` aporta imágenes generales; `variantMedia` conserva filas con atributos y `imageUrls` ordenadas. `fotos-por-color` mantiene asociaciones/apariencias; `fotos-por-variante` maneja selección específica y comparte botones/arrastre de orden. `appendPhotoOrderControls` identifica foto por clave normalizada, no por índice de variante; vuelve al control después de ordenar. No se cambian límites técnicos ni formatos.

La galería compartida agrega portada, extras y medios únicos; con selección prioriza asociaciones coincidentes, específicas antes de genéricas, y evita ofrecer fotos de otro color como fallback. La ficha pública conserva miniaturas y selección sincronizada (suite product-color-gallery); tarjetas usan resolvedores existentes. La prueba de cuarta foto comprueba serialización y input de portada, **no un commit en Firestore seguido de una lectura pública**. Esa última ida/vuelta permanece NOT_VERIFIED para sesión autenticada; suites del controlador cubren guardado con almacén simulado.

Colecciones: uploader comparte la espera de flush y la regresión de foto local/subida de colección se ejecutó en siete tamaños. No se certifican todas las portadas de colecciones reales. Las imágenes principales públicas conservan la acción de ampliar y miniaturas, cubierta con fixture del renderer real.

## Rendimiento reproducible

Archivo: `tests/ui-ux/products-responsive-phase-one.spec.js`, casos «perfil sintético». Activar `EDITOR_PROFILE_BASELINE=1` sirve el módulo de interfaz desde `git show f9399a90c:...` sin modificar el árbol. Ejecutar con un worker y sin reintentos, servidor loopback. Perfil monta galería real con producto sintético guardado para evitar inferencia de colores sobre la red. Interacciones miden input+change hasta dos frames; apertura incluye navegador/fixture, no latencia de Firestore. Una observación por caso, sin CPU throttling y con carga concurrente variable: **no permite inferir una mejora de velocidad por esta corrección de scroll**.

| Fotos | Abrir base/candidato ms | Foto base/candidato ms | Color base/candidato ms | Stock base/candidato ms | Mutaciones al agregar color base/candidato |
| --- | --- | --- | --- | --- | --- |
| 1 | 634 / 680 | 30 / 22 | 44 / 30 | 31 / 33 | 14 / 14 |
| 2 | 487 / 518 | 22 / 24 | 56 / 49 | 29 / 33 | 15 / 15 |
| 5 | 540 / 370 | 27 / 22 | 49 / 31 | 52 / 34 | 18 / 18 |
| 10 | 664 / 379 | 31 / 23 | 53 / 31 | 38 / 33 | 23 / 23 |
| 20 | 734 / 332 | 63 / 20 | 98 / 30 | 35 / 40 | 33 / 33 |

Son registros de mutaciones childList, no número de renders completos. Nodos agregados por color:10,11,14,19,29 en ambos candidatos; stock3 en todos. Una long task de59ms en base/20 fotos, ninguna en candidato; no prueba eliminación sostenida de tareas largas. `performance.memory` devolvió10MB redondeados en todos: insuficiente para demostrar consumo real o fugas. Falta CDP heap preciso, repeticiones/p50/p95, trazas con observadores/render y conteo de listeners tras abrir/cerrar repetidamente.

## Pruebas y evidencia

- Chromium:149/149 en suites completas `products-responsive-phase-one`, `product-color-gallery`, `home-review-gallery` antes de añadir matriz1–20. Sin reintentos; cubre seis tipos de viewport, subida pendiente/fallida, stock, error, guardia de borrador, permisos de interfaz, acciones, fotos y reseñas.
- Matriz adicional orden/portada:7/7. El primer intento falló por comparar URL relativa con URL sanitizada absoluta y luego selector de portada incorrecto; se corrige el fixture/aserción por pathname, sin modificar runtime de fotos ni debilitar el orden esperado.
- Perfil final:5/5 base y5/5 candidato, galería real montada; logs `/tmp/editor-profile-{baseline,current}-final.log`. Los perfiles anteriores con galería sin montar no se usan en la tabla.
- Regresión de scroll:base FAIL esperado (`/tmp/editor-scroll-before.log`), candidato PASS (`/tmp/editor-scroll-after.log`). Capturas `/workspace/tintin-web/artifacts/editor-phase1/error-{before,after}.png`; after inspeccionada visualmente. Son fixtures, no capturas de producción.
- Node:45/45, `maestro-productos-controlador.test.mjs`, `variant-image.test.mjs`, `page-entry-scroll.test.mjs`. Guardado real del controlador con SDK/almacén simulado; no escritura productiva.
- Build Pages y caché canónicos aprobados; diagnóstico regenerado desde su constructor. Ver CURRENT_STATE y PR para gates posteriores del SHA final. No se atribuye CI de main al candidato.

## Diseño posterior y relevo

Galería única propuesta: biblioteca del producto ordenada una sola vez, una acción explícita «Portada del producto» y asociaciones por color/combinación dentro de cada foto; explicar qué portada verá la selección pública. Conservar las URLs/filas/claves existentes y derivar su presentación, sin inventar colección paralela. Diseñar antes la compatibilidad de todos los lectores, upload pendiente/error y teclado. No migrar automáticamente ni ampliar límites sin evaluar almacenamiento/documento/costo y móviles.

Borradores: lista dedicada con filtro `publicationStatus`, recuento/paginación desde autoridad actual, acciones continuar/archivar/publicar con validaciones y permisos; separar filtros de disponibilidad. Conciliar #1233 antes de implementar exposición/privacidad. Inventario: inventariar builder, textarea avanzado, matriz comercial, fotos por color/combinación y controles de tarjeta; muchos controles editan representaciones distintas, no duplicados eliminables automáticamente.

Continuación exacta: revisar HEAD/PR remotos; ejecutar tests citados; instrumentar render y listeners con CDP; repetir medidas aisladas; verificar cuarta portada en escritor→proyección pública con fixtures; ampliar colecciones; revisar Safari/teclado virtual cuando haya entorno. No tocar pagos ni producción. Antes de cualquier publicación futura exigir autorización expresa y CI del SHA exacto. Esta fase no autoriza ejecutar el rediseño propuesto.

## Delta final: foco de asignación reproducido y corregido

Después del inventario se añadió una aserción de foco tras desmarcar foto3 de Dorado: FALLA en390px (el checkbox nuevo está inactivo porque el anterior fue retirado). `fotos-por-color.render` ahora identifica el control activo por su aria-label y transfiere foco al reemplazo lógico con preventScroll. Es continuidad del control tras render, sin restaurar coordenadas ni enmascarar un reset global. Se conserva el render/persistencia actual y la selección. La suite completa de galería ampliada pasa42/42, incluyendo siete anchos que verifican foco de asignación y siete cantidades de fotos. Log RED `/tmp/editor-photo-focus-before.log`, final `/tmp/editor-gallery-final.log`. Sustituye el pendiente de regresión de checkbox de B1; otras reconstrucciones y perfil exhaustivo siguen pendientes. Admin-app sólo renueva el import inmutable de fotos; su lógica comercial permanece idéntica.

Los datos de rendimiento de la tabla corresponden al candidato antes de este delta de foco; no se presentan como mediciones posteriores a él. Preflight tuvo un primer FAIL de reproducibilidad del manifiesto durante trabajo concurrente sobre los archivos locales; repetido con árbol estable: **39 comandos PASS**, exit0 (`/tmp/editor-preflight-stable.log`, `artifacts/ci/preflight.json`). No se relaja el auditor. Captura adicional desktop1366 inspeccionada: `test-results/product-minimal-1366x768.png` (salida temporal reemplazable al repetir Playwright).
