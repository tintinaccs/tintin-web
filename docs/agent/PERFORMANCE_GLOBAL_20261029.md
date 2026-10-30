# Reparación global de rendimiento — 2026-10-29

## Reparación de los tres fallos de CI40913551602/1

Sobre el candidato `0b7a6a48bb15323b314763eee0d96fab4e6d4d3f`, job123589864290, Inicio superó500ms al abrir carrito; Contacto descargó121 recursos propios frente a120; Envíos presentó ambos límites en sus intentos. No se heredan esos resultados al siguiente candidato ni se incrementan los presupuestos.

El runtime informativo cargaba `extension-revelado-marca.js` al abrir cualquier superficie. Ahora se solicita al abrir Cuenta, incluso si el runtime llega después de su apertura, y se conserva el caso de mapas. El carrito tiene su animación canónica propia: su apertura completa pasa de300 a180ms, conservando cierre, foco, movimiento reducido y las demás superficies.

La sonda empieza en captura de `window`, durante el clic real, antes del controlador que detiene la propagación en captura de `document`. Termina después del estado abierto y de dos frames; incluye trabajo síncrono y toda la animación, pero excluye las esperas de Playwright. La regresión específica introduce700ms de espera previa y200ms de trabajo/apertura, y exige medir el segundo período dentro del presupuesto original. La suite se ejecuta con un worker para evitar competencia entre pruebas que aplican CPU×4; se mantienen todos los casos y límites.

PASS_LOCAL dirigido: diez rutas públicas y una regresión de la sonda,11/11 sin reintentos. Inicio262ms y Envíos239ms en esa corrida; no son INP de campo ni evidencia de sesiones comerciales. La suite final y navegación del candidato se registran en CURRENT_STATE y en el recibo de seguimiento. URLs inmutables actualizadas desde el generador y auditor canónicos; no se modifican permisos, datos ni dependencias.

Codex /root. Rama `codex/global-performance-repair-20261029`, base inicial `a936e6dd91be338f00e104c11bc48b8dbc865ad3`; integración posterior de `eac9a327` (#1273).

Auditoría reproducida: `/workspace/audit-global-20261029/AUDITORIA-GLOBAL.md`, `findings.json` y sondas acompañantes. No se heredan sus PASS a los cambios actuales. Sin escrituras comerciales de producción.

Los seis informes externos suministrados están BLOCKED: el lector web no pudo abrirlos y los dominios no están autorizados por la política de red del entorno. Se solicitó su contenido; no se atribuyen métricas ni recomendaciones a informes no leídos.

| ID | Fuente canónica y corrección | Estado / evidencia |
|---|---|---|
| G01 | Se adopta íntegramente el hero sin pérdida de main #1273, sus PNG de respaldo y sus pruebas de fidelidad. El ensayo WebP con pérdida de esta rama se retiró al integrar main. | PASS_LOCAL de cuatro comparaciones RGBA y precarga/snapshot. La reducción vigente es31,2–34,5%, con píxeles idénticos, no92–94%. Los109–163 KB y SSIM.9756 describen sólo el ensayo descartado. |
| G02 | `scripts/lib/estilos-inicio.js`: compresión sintáctica de paquetes con Lightning CSS 1.33.0, dependencia de desarrollo fijada. | PASS_LOCAL del compilador; Sobre main #1273: Inicio483.620→394.539 bytes, Brotli local74.281→52.151; Nosotros401.348→335.038, Brotli62.370→45.547. No se elimina CSS por cobertura de un único viewport: reglas responsive/estados siguen disponibles. |
| G03 | `carga-navegacion.js`, `catalogo-publico-api.js`, `public-catalog.js`, `favoritos-perfil.js`: catálogo del menú a demanda; favoritos por lotes de identidades, con proyección pública, validación, caché separada y límite de trabajo por solicitud. | PASS_LOCAL de lotes/permisos públicos y menú. G03/Inicio implementado 2026-10-30: índice compacto completo, fichas por superficies presentes y bloques por categoría a demanda; selección compatible sobre todo el pool. PASS_LOCAL229 Node y3 Chromium dirigidos; Galería informativa también a demanda;21/21 Chromium finales de rendimiento/Inicio/visual, sin subir presupuesto120. CI/publicación del candidato se acreditan aparte. Edge recorre/cachea el snapshot y rechaza truncamiento a5000, no oculta un subconjunto arbitrario. |
| G04 | `css/pages/catalog/catalog-maintenance.css`: borde inicial de 1 px estrechaba el título; el flujo global lo quitaba después y cambiaba el salto de línea. | PASS_LOCAL: ancho del título estable 324,625 px y altura39 px en390; CLS de una comparación lenta .089185→.002480. |
| G05 | `revelado-desplazamiento-global.js`: deduplicación y medición de todos los candidatos antes de escribir clases. | PASS_LOCAL: tres candidatos, tres mediciones, cero lecturas tras escribir. Conserva exclusiones y movimiento reducido. |
| G06 | `alternancia-secciones.js`: descartar mutaciones dentro de overlays canónicos antes de medir el flujo. | PASS_LOCAL: cinco cambios del carrito, cero mediciones; una sección nueva sí se incorpora. |
| G07 | `catalogo.html`, `presentacion-colecciones.js`: una autoridad de botones y evento cancelable para filtrar sin recargar. | PASS_LOCAL: misma lista conserva nodos, cero mutaciones repetidas frente a cinco anteriores. |
| G08 | `iconos.js`, consumidores de colecciones: respaldo compartido únicamente para archivos existentes. | PASS_LOCAL: categorías conocidas, alias Bags y categorías personalizadas; ninguna ruta inventada. |
| G09 | `pedidos-perfil.js` e `indice-pedidos-perfil.js`: índice privado proyectado de100 por página, readTime fijo, detalles iniciales5 y diez por Cargar más; revisión de perfil y listeners visibles. | Implementado 2026-10-30. PASS_LOCAL de controlador, tres geometrías Chromium y consulta REST contra Firestore emulado con Rules reales: UID/correos verificados, fechas legacy, snapshot, cuenta ajena/bloqueada y totales completos. Se enumera todo el índice de metadatos para exactitud; sólo se hidratan detalles visibles/enlace profundo. Sin migración ni cambio de reglas. CI/publicación del nuevo SHA y sesión real de producción se distinguen; esta última NOT_VERIFIED. |
| G10 | `controles-editor-producto.js`, `interfaz-productos-adaptable.js`, `sugerencias-producto-interfaz.js`: refresco por campos afectados, excluir mutaciones de textos derivados, sugerencias sólo cuando cambia su perfil e índice de asociaciones. | PASS_LOCAL: tres letras, 81→3 consultas generales y 12→0 lecturas de fotos, también con1.000 combinaciones. |
| G11 | `controles-editor-producto.js`: galería de asociaciones de25 tarjetas por página; datos completos, foco y bloqueo de carga pendiente preservados. | PASS_LOCAL:1.000 combinaciones conservan1.000 unidades;1.065→25 tarjetas,10.144→2.868 nodos. |
| G12 | `editor-comercial-interfaz.js`: búsqueda agrupada120 ms y cancelación al desmontar/renderizar. | PASS_LOCAL: cinco letras,125→25 filas reconstruidas en matrices grandes. |
| G13 | `pedido-checkout-seguro.js`, `checkout-puente-correo.js`: aviso síncrono del requestId desde el escritor, sin consultar storage cada250 ms. | PASS_LOCAL: correlación exacta antes de borrar storage, también con storage bloqueado; sin pedidos ni correos reales. |
| G14 | `observability.js`: INP agregado por interacción, percentil98, memoria acotada; CLS por ventanas de sesión, sin reinicio al enviar; resumen sin textos ni nodos. | PASS_LOCAL de ventanas, agregación/percentil y privacidad. NOT_VERIFIED de recepción en producción: no se desplegó ni se enviaron pruebas reales. |
| G15 | `tests/performance/_helpers.js`: abrir/cerrar carrito real y exigir medición, quitar sonda artificial y distinguir respuesta de laboratorio de INP de campo. | PASS_LOCAL en Inicio/Catálogo; no se omite el gate cuando falta la medición. |

## Informes externos

SpeedVitals Hicjlc y onSOcx; Site24x7 público suministrado; PageSpeed2o2e4ri953 móvil/escritorio; LoadFocus e9573fdc1b699a4c1ebef439c9a5d465: **BLOCKED**, no leídos. Acceso web reiterado sin resultado y ningún controlador del navegador conectado disponible. La usuaria pidió que lo gestione el agente; no se le vuelve a exigir copiar resúmenes. No se reproduce el readkey del enlace en Git.

No se puede afirmar coincidencia, diferencia ni exhaustividad de la unión hasta acceder a esos resultados. Tampoco se pueden comparar puntuaciones tomadas en fechas/dispositivos distintos como si fueran una misma ejecución.

## Mediciones anteriores a integrar #1273 — no acreditan el candidato actual

Antes de integrar #1273: una muestra por ruta/versión en Chromium local,390×844, CPU×4,80 ms y200.000 bytes/s de bajada: Inicio LCP21.640→8.700 ms; catálogo CLS .089185→.002480. Ambas versiones usaron el mismo catálogo público capturado, sin escrituras. Firebase/Cloudinary bloqueados por red; no son fallos atribuidos al producto. Inicio aún supera5 s bajo este perfil; no se declara resuelto todo el rendimiento ni se convierten estas muestras en Web Vitals de campo.

La auditoría anterior de producción tenía tres muestras de Inicio (mediana17.216 ms) y dos del catálogo (CLS .177338); esos valores son otra sesión y no se mezclan con la comparación local.

## Verificación y entrega

Evidencia de trabajo: `/workspace/tintin-performance-evidence/`. **Integración con main #1273:**402/402Node PASS,89/89Chromium PASS sin reintentos (fidelidad, seis pestañas, guardado, variantes, disponibilidad, teclado, movimiento y responsividad),10/10 rutas públicas PASS con apertura real del carrito y3/3 casos extra de demanda del menú en Nosotros PASS. Las15 combinaciones de Inicio/Catálogo/Nosotros en320,390,768,1024 y1440 px no desbordan. Hay capturas390/1440 en `screenshots/`; muestran el estado degradado real del entorno: Firebase y Cloudinary bloqueados, sin reemplazar las URL originales de las fotos.

Build de páginas, CSP, diagnóstico, rutas, caché y preflight local PASS.65 archivos del plan de mantenimiento respecto de eac9a327 se verifican mediante la protección canónica; no se cambian sus controles ni metadatos de aprobación. Se requiere CI del SHA final. Las mediciones anteriores de compresión con pérdida no se atribuyen a esta integración.

## Hallazgos adicionales coincidentes con #1273

| ID | Problema y fuente | Estado |
|---|---|---|
| G16 | `rendimiento-imagenes.js` elevaba todas las imágenes visibles a prioridad alta, compitiendo con la portada. | PASS_LOCAL integrado: prioridad explícita conservada y miniaturas en auto. |
| G17 | El mismo runtime procesaba listas sin cota y alternaba lecturas/escrituras de geometría. | PASS_LOCAL integrado: deduplicación, lecturas previas a escrituras y lote acotado. |
| G18 | La portada esperaba una transición de opacidad adicional después de descargar y decodificar. | PASS_LOCAL integrado: primer frame opaco en cuatro dispositivos y portada completa. |

Las evidencias históricas de esa publicación están en `RENDIMIENTO-GLOBAL-20261029.md`; no se presentan como pruebas del candidato combinado.

Actualización2026-10-30: G03/Inicio y G09 implementados con pruebas locales nuevas; CI/publicación del candidato en CURRENT_STATE/recibo. Informes externos originales y aceptación autenticada real siguen NOT_VERIFIED. No merge ni despliegue manual de esta rama. No se han modificado pedidos, productos, stock, precios ni cuentas de producción.

CI del candidato: se repara la auditoría estática del alias de Bolsos y el fixture que eliminaba el helper puro. El buscador comercial aplica el filtrado pendiente al perder foco, evitando reemplazar campos que ya se están editando; nueva regresión de identidad/foco y stock con reloj controlado. Evidencia final de cada SHA en el PR y el recibo de revisión, sin heredar checks previos.
