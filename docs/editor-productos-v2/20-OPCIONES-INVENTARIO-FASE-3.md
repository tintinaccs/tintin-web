# Opciones, variantes e inventario — Fase 3

25/10/2026, Codex /root. Rama `codex/opciones-inventario-fase3-20261025`. Base `746e944d0d05abf45d9f00d55d3448913352fa6f`, cabeza de Fase2/PR1238 al comenzar. Fase1/PR1237 (`0f57f327a`) y Fase2/PR1238 permanecen OPEN/no integrados; main remoto sigue `f9399a90c`. Esta fase incluye ambos trabajos por ascendencia, sin fusionar sus PR ni heredar sus resultados. Entrega apilada sobre la rama de1238, lista para revisión. Prohibidos merge y deploy por la instrucción expresa actual, que prevalece sobre la autorización permanente de AGENTS.

## Problemas comprobados y estructura anterior

- `variantBuilder` ofrecía paleta rápida, selector, chips individuales repetidos por línea y textarea técnico. No agrupaba visualmente todas las opciones del mismo atributo ni ofrecía renombrado/reordenación contextual.
- El mismo bloque contenía opciones, inventario y total general bloqueado. La matriz V2 tenía toolbar de lote/orden siempre visible además de sus filas.
- `installEditorControls` conservaba un listener legacy que podía cambiar `prod-active` según la cantidad si faltaban los campos editoriales/V2. Se elimina esa vinculación: editar cantidades nunca decide publicación.
- La galería Fase2 tenía otro control de círculo visual. Se concentra en la opción de color; las fotos permanecen en la galería única.
- La heurística de foto no reconoce nombres comerciales. Evidencia con píxeles sintéticos: BordóRGB128,0,32→rojo; Oliva128,128,0→dorado; blanco255,255,255→sin propuesta; gris170,170,170→plateado. No se considera clasificación precisa del producto.

## Estructura nueva

«Opciones y variantes»: un constructor con grupos Color, Talle, Material, Forma, Diseño, Modelo, grupos existentes y Otro grupo. Cada grupo reúne valores y acciones. Agregar detecta duplicados y explica cómo corregirlos. Nombre comercial y círculo hexadecimal son distintos; cambiar círculo no renombra la opción ni modifica cantidades. Fotos conduce al único centro visual de Fase2. Disponibilidad conduce al inventario.

Renombrar es explícito y sólo para opciones pendientes seguras. No renombra opciones guardadas ni opciones que ya tienen fotos asociadas. Antes de quitar/renombrar una opción pendiente con cantidades/precios en matriz V2, pide revisar esos datos para no perderlos al reconstruir combinaciones. Reordenar opciones usa el textarea canónico y el reconciliador existente; nunca asigna cantidades por índice.

Paleta y sugerencia por foto son asistencia plegada. «Sugerir desde portada» ejecuta el estimador existente sólo por petición; Usar sugerencia prepara el nombre en el campo, no crea una variante. Se permite corregirlo antes de Agregar. Respuestas de otra foto/producto/opciones se descartan. Un fallo permite seguir manualmente. No hay sobrescritura automática de selecciones, inferencia pagada ni precisión inventada.

El textarea original permanece en «Editar opciones en texto», plegado y sincronizado. La protección V1 también se aplica a sus eventos: un producto guardado no puede quitar/renombrar valores originales ni reordenar colores que aún dependan de fotos históricas por posición. No es una autorización de migración ni una nueva API comercial. V2 mantiene su protección canónica del servidor.

«Inventario y disponibilidad»: stock general editable cuando corresponde; si existe distribución/matriz, se ocultan sus controles de total editables y se muestra resumen derivado. Las cantidades se editan en las filas originales. Productos sin opciones ocultan las acciones de preparar combinaciones. Productos V1 con opciones y stock agregado conservan el control agregado hasta una configuración explícita: no se distribuye el stock automáticamente. La navegación histórica `inventory` muestra ambos bloques como un recorrido de opciones+stock; `availability` accede directamente al segundo.

V2 conserva tarjetas paginadas de25 filas, precio/anterior por combinación, disponibilidad, claves y edición múltiple. Toolbar de lote/orden pasa a un apartado técnico secundario. No se crea otra matriz. Los controles se mueven como nodos existentes conservando handlers, IDs y permisos.

## Autoridades y contratos preservados

| Campo/componente | Responsabilidad |
| --- | --- |
| `variants`, `prod-variants-text` | Definición/orden canónicos de grupos/opciones. La presentación no guarda una copia paralela. |
| `variantInventory`, `variantCommerceVersion` | Matriz comercial existente, atributos y referencias opacas. No se convierten productos históricos automáticamente. |
| `inventario-variantes.mjs` | Reconciliación, stock, precio, compatibilidad, reservas e identidades. Sin cambios de motor en esta fase. |
| `editor-comercial-core.mjs` | Borrador/parche comercial y guardas. Sin cambios. |
| `editor-comercial-interfaz.js` | Filas originales; se reorganiza toolbar y mejora explicación de errores. |
| `variantMedia`, `fotos-por-color` | Fotos y círculos. El constructor solicita lectura/edición al controlador de galería existente mediante eventos del formulario; no mantiene otro mapa persistente. |
| `prodGuardar`, escritor CAS | Guardado, concurrencia, permisos, serialización y auditoría originales. Sólo se agrega lectura del baseline para presentación/protección V1. |
| Sheets | Mismo espejo, columnas, máscaras y guardias; sin escrituras ni nueva distribución desde Sheets. |

## Semántica de inventario y errores

Cero significa agotado. Null/vacío representa sin control cuando el modelo lo admite. Disponibilidad de fila, publicación y cantidad son conceptos independientes. Una fila puede quedar desactivada conservando unidades e identidad; guardar como borrador no depende de que tenga stock.

La prueba inicial intentó cambiar una fila ya guardada de finita a null y el motor la rechazó correctamente: `assertVariantCompatibility` protege también el modo de control de stock. Se conserva esa regla; no se relaja para hacer pasar la prueba. Ahora se explica: conservar control, usar0 para agotado o desactivar disponibilidad. Se prueba null en una combinación nueva que el modelo sí admite. No se elimina historia potencial ni se reinterpreta una reserva anterior.

Opciones guardadas muestran explicación y acciones destructivas deshabilitadas. Las pendientes asociadas a fotos piden revisar asociaciones; las pendientes con cantidades/precios piden revisarlos. Duplicado devuelve mensaje accionable, no borra silenciosamente el texto.

## Evidencia local, sin datos reales

- Pruebas de dominio:68 PASS (editor comercial, controlador, inventario de variantes, foto de selección y colores); sincronización221 PASS. Repetición de subconjunto tras protección V1:54 PASS. Son suites solapadas, no se suman como casos únicos.
- Primeros13 Chromium de seis tamaños y matriz/lote/orden aprobados;10 casos finales de aceptación aprobaron después de las correcciones: cinco colores, nombre nuevo seguro, círculos, cantidades4/2/0, precio55000, disponibilidad desactivada, borrador invariable, reapertura, referencias al reordenar, null nuevo, producto simple y Color+Talle con precio65000 frente a45000.
- Se cuenta0 llamadas a reset al agregar una opción y se conserva foco del campo de alta. Las pruebas de navegación de Fase1 y galería de Fase2 se repiten en la tanda amplia; no se hereda su PASS anterior.
- La primera tanda amplia se interrumpe por fixtures antiguos que pulsaban paleta ahora plegada y esperaban dos líneas para un grupo. Se actualizan para abrir explícitamente asistencia y esperar la representación agrupada, conservando cantidades y guardado.27 regresiones dirigidas PASS después. No se presenta esa ejecución interrumpida como aprobación global.
- El primer caso nuevo de renombrado detectó un bloqueo incorrecto por filas de medios vacías: ahora sólo una asociación con fotografías impide renombrar una opción pendiente. Otra regresión detectó que reapertura no refrescaba el baseline de protección; su huella forma parte de la actualización de presentación.
- Capturas sintéticas en `artifacts/options-phase3/390x844.png`, `844x390.png`, `768x1024.png`, `1024x768.png`, `1366x768.png`, `1920x1080.png`; móvil/laptop inspeccionados. Screenshots finales desactivan animaciones para evitar fotografiar el fade a media opacidad. No son dispositivos físicos.

Los recorridos ejecutan el controlador y escritor reales con SDK, identidad, proveedor y almacenamiento sintéticos. Público: el motor de selección/precio/stock se ejecuta sobre lo guardado; se repite galería/ficha pública con fixtures. No se hacen pedidos, compras, mensajes ni cambios reales. CI del SHA exacto, CRUD autenticado, Safari/lector y teclado físico siguen separados de PASS_LOCAL. El recibo final de pruebas/build/PR se registra al completarlos.

## Recibo de entrega y corrección final

[PR1239](https://github.com/tintinaccs/tintin-web/pull/1239), OPEN/listo para revisión, base rama de1238, sin auto-merge. Primer commit funcional `4e49d96835ed3327ba4eca6a169cab843095a47d`; corrección posterior de visibilidad, recibo y derivados se consultan en la cabeza del mismo PR. No merge ni deploy autorizados.

Tanda amplia:309 PASS/22 FAIL en331 casos, sin reintentos. Los13 de cabecera medían también el nuevo input oculto de Otro grupo; los3 de contraste pulsaban asistencia plegada. Se conservan las comprobaciones y se mide sólo lo visible/abre explícitamente asistencia: repetición16/16 PASS (`phase3-layout-regression.log`). Los otros6 encontraron un defecto real de transición: la interfaz ocultaba inventario configurado si el texto de opciones estaba vacío. Se corrige para conservar visible toda fila existente; repetición6/6 PASS (`phase3-stock-visibility-final.log`) mantiene íntegros los requisitos44px, geometría, no solapamiento y edición del stock. No se filtran las filas para ocultar el problema.

Aceptación final de grupos/stock/sugerencias/simple/null/Color+Talle:10/10 PASS (`phase3-final-targeted.log`), con foco conservado al reconstruir acciones y0 resets al agregar. Las22 fallas de la tanda anterior no se cuentan como331PASS de una ejecución que no ocurrió. Dominio68, sync221 y subconjunto54 aprobados; conteos solapados. Build/caché y39 comandos preflight aprobaron antes de la última condición de visibilidad y se regeneran/reverifican sobre esa corrección antes del push final. Capturas adicionales del inventario en `artifacts/options-phase3/inventory-{ancho}x{alto}.png`, móvil inspeccionado. La CI completa de main no se hereda a un PR apilado.

Cierre del candidato corregido:12/12 Chromium adicionales PASS (`phase3-ready-acceptance.log`): seis controles de inventario/44px y seis recorridos completos de grupos/guardar/reabrir. «Disponibilidad» enfoca una fila visible correspondiente a la opción, no el total oculto ni otra variante al cambiar el orden. Se conserva foco al reconstruir/reordenar acciones. Build Pages/caché y39 comandos preflight finales exit0 (`phase3-final-build.log`, `phase3-final-preflight.log`). Plan canónico:5 fuentes protegidas/18 registros. Sin merge ni publicación, estado del PR y SHA definitivo se registran en el recibo posterior.

SHA funcional corregido: `b09756acd343146a9b7490592ce892f88abc807f`. El commit posterior sólo incorpora este recibo y diagnóstico generado. PR1239 permanece listo para revisión, apilado sobre1238, sin auto-merge. Consultar su cabeza para el SHA de entrega con documentación; no atribuirle CI de main.

## Riesgos, reversión y Fase 4

No se ofrece renombrado general de identidades históricas: el modelo usa nombres como atributos además de claves opacas. Para habilitarlo haría falta diseñar aliases/IDs de presentación y adaptar medios/consumidores/Sheets con una estrategia aprobada; no adivinar correspondencias ni migrar datos reales.

V1 con medios posicionales debe revisar asociaciones antes de reordenar. La restricción evita que Plateado adopte la foto de Dorado. Las matrices conservan precios y CAS, pero no se acredita producción por estos fixtures. El estimador de colores sigue siendo aproximado: saturación, iluminación, fondo y metales pueden producir nombres erróneos.

Reversión: revertir el delta de presentación por commit normal, mantener fases1/2 y regenerar URLs/caché/plan/CSP/diagnóstico. No hay nuevos campos persistidos, reglas ni migración que revertir. No restaurar productos/pedidos sobre producción.

Decisiones para Fase4: flujo editorial de borradores/publicación separado del stock; renombrado histórico sólo con diseño de identidad compatible; accesibilidad física; eventualmente filtros/paginación adicionales antes de ampliar matrices. No modificar checkout ni reservas por un ajuste de interfaz.
