# Reparación global de rendimiento — 2026-10-29

Codex /root. Rama `codex/global-performance-repair-20261029`, base `a936e6dd91be338f00e104c11bc48b8dbc865ad3`.

Auditoría reproducida: `/workspace/audit-global-20261029/AUDITORIA-GLOBAL.md`, `findings.json` y sondas acompañantes. No se heredan sus PASS a los cambios actuales. Sin escrituras comerciales de producción.

Los seis informes externos suministrados están BLOCKED: el lector web no pudo abrirlos y los dominios no están autorizados por la política de red del entorno. Se solicitó su contenido; no se atribuyen métricas ni recomendaciones a informes no leídos.

| ID | Fuente canónica y corrección | Estado / evidencia |
|---|---|---|
| G01 | `index.html`, `gestion-imagenes.js`: WebP nuevos derivados del PNG vigente, sin reutilizar artes distintos; PNG original de respaldo y personalizaciones conservadas. | PASS_LOCAL: cuatro viewports, una descarga por banner; 109–163 KB frente a 1,7–2 MB. SSIM móvil 0,9756. |
| G02 | `scripts/lib/estilos-inicio.js`: compresión sintáctica de paquetes con Lightning CSS 1.33.0, dependencia de desarrollo fijada. | PASS_LOCAL del compilador; Inicio 483.284→394.495 bytes, Brotli local 74.080→52.094; Nosotros 401.182→335.022, Brotli 62.283→45.488. No se elimina CSS por cobertura de un único viewport: reglas responsive/estados siguen disponibles. |
| G03 | `carga-navegacion.js`, `catalogo-publico-api.js`, `public-catalog.js`, `favoritos-perfil.js`: catálogo del menú a demanda; favoritos por lotes de identidades, con proyección pública, validación, caché separada y límite de trabajo por solicitud. | PASS_LOCAL de lotes/permisos públicos y menú. PENDING: el pool de Inicio todavía requiere catálogo completo para selección aleatoria, combinador y destacados. No se impuso un límite que ocultara productos. |
| G04 | `css/pages/catalog/catalog-maintenance.css`: borde inicial de 1 px estrechaba el título; el flujo global lo quitaba después y cambiaba el salto de línea. | PASS_LOCAL: ancho del título estable 324,625 px y altura39 px en390; CLS de una comparación lenta .089185→.002480. |
| G05 | `revelado-desplazamiento-global.js`: deduplicación y medición de todos los candidatos antes de escribir clases. | PASS_LOCAL: tres candidatos, tres mediciones, cero lecturas tras escribir. Conserva exclusiones y movimiento reducido. |
| G06 | `alternancia-secciones.js`: descartar mutaciones dentro de overlays canónicos antes de medir el flujo. | PASS_LOCAL: cinco cambios del carrito, cero mediciones; una sección nueva sí se incorpora. |
| G07 | `catalogo.html`, `presentacion-colecciones.js`: una autoridad de botones y evento cancelable para filtrar sin recargar. | PASS_LOCAL: misma lista conserva nodos, cero mutaciones repetidas frente a cinco anteriores. |
| G08 | `iconos.js`, consumidores de colecciones: respaldo compartido únicamente para archivos existentes. | PASS_LOCAL: categorías conocidas, alias Bags y categorías personalizadas; ninguna ruta inventada. |
| G09 | `pedidos-perfil.js`: consulta inicial y suscripciones siguen sin paginar. | **PENDING / NOT_VERIFIED**. No se modificó este flujo privado. Un `limit()` aislado perdería historial y falsearía compras/total; ordenar sólo por createdAt excluiría registros históricos que usan updatedAt. Faltan verificación de esquema/índices y sesión QA autenticada para cerrar una paginación compatible con las identidades UID/correo y sus totales. No se acredita corregido. |
| G10 | `controles-editor-producto.js`, `interfaz-productos-adaptable.js`, `sugerencias-producto-interfaz.js`: refresco por campos afectados, excluir mutaciones de textos derivados, sugerencias sólo cuando cambia su perfil e índice de asociaciones. | PASS_LOCAL: tres letras, 81→3 consultas generales y 12→0 lecturas de fotos, también con1.000 combinaciones. |
| G11 | `controles-editor-producto.js`: galería de asociaciones de25 tarjetas por página; datos completos, foco y bloqueo de carga pendiente preservados. | PASS_LOCAL:1.000 combinaciones conservan1.000 unidades;1.065→25 tarjetas,10.144→2.868 nodos. |
| G12 | `editor-comercial-interfaz.js`: búsqueda agrupada120 ms y cancelación al desmontar/renderizar. | PASS_LOCAL: cinco letras,125→25 filas reconstruidas en matrices grandes. |
| G13 | `pedido-checkout-seguro.js`, `checkout-puente-correo.js`: aviso síncrono del requestId desde el escritor, sin consultar storage cada250 ms. | PASS_LOCAL: correlación exacta antes de borrar storage, también con storage bloqueado; sin pedidos ni correos reales. |
| G14 | `observability.js`: INP agregado por interacción, percentil98, memoria acotada; CLS por ventanas de sesión, sin reinicio al enviar; resumen sin textos ni nodos. | PASS_LOCAL de ventanas, agregación/percentil y privacidad. NOT_VERIFIED de recepción en producción: no se desplegó ni se enviaron pruebas reales. |
| G15 | `tests/performance/_helpers.js`: abrir/cerrar carrito real y exigir medición, quitar sonda artificial y distinguir respuesta de laboratorio de INP de campo. | PASS_LOCAL en Inicio/Catálogo; no se omite el gate cuando falta la medición. |

## Informes externos

SpeedVitals Hicjlc y onSOcx; Site24x7 público suministrado; PageSpeed2o2e4ri953 móvil/escritorio; LoadFocus e9573fdc1b699a4c1ebef439c9a5d465: **BLOCKED**, no leídos. Acceso web reiterado sin resultado y ningún controlador del navegador conectado disponible. La usuaria pidió que lo gestione el agente; no se le vuelve a exigir copiar resúmenes. No se reproduce el readkey del enlace en Git.

No se puede afirmar coincidencia, diferencia ni exhaustividad de la unión hasta acceder a esos resultados. Tampoco se pueden comparar puntuaciones tomadas en fechas/dispositivos distintos como si fueran una misma ejecución.

## Mediciones comparables y límites

Una muestra por ruta/versión en Chromium local,390×844, CPU×4,80 ms y200.000 bytes/s de bajada: Inicio LCP21.640→8.700 ms; catálogo CLS .089185→.002480. Ambas versiones usaron el mismo catálogo público capturado, sin escrituras. Firebase/Cloudinary bloqueados por red; no son fallos atribuidos al producto. Inicio aún supera5 s bajo este perfil; no se declara resuelto todo el rendimiento ni se convierten estas muestras en Web Vitals de campo.

La auditoría anterior de producción tenía tres muestras de Inicio (mediana17.216 ms) y dos del catálogo (CLS .177338); esos valores son otra sesión y no se mezclan con la comparación local.

## Verificación y entrega

Evidencia de trabajo: `/workspace/tintin-performance-evidence/`. Contratos nuevos/globales31PASS; regresiones relacionadas395 casos (392 iniciales, tres fallos aislados corregidos/repetidos: entorno Chromium e identidades de versiones). Chromium dirigido24PASS, comercio7PASS, paridad del menú12 casos cubiertos tras corregir un export roto detectado durante la ejecución, rendimiento real2PASS. Los gates de build, caché, protección y el SHA final se registran al cerrar; no se heredan estos resultados a producción.

Este resultado sigue **en curso**: G03/Inicio, G09, informes externos y aceptación autenticada pendientes. No merge ni despliegue manual de esta rama. No se han modificado pedidos, productos, stock, precios ni cuentas de producción.
