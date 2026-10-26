## Actualización posterior — reorganización visual26/10/2026

| Comprobación nueva | Resultado | Evidencia |
| --- | --- | --- |
|333 casos del editor, guardado y fotografías |APROBADA: última ejecución de cada caso;326 matriz+13 repetición con6 solapados |evidencias/rediseno-visual/matriz-casos.json; acceptance.log; last.log |
|320,390,600,768,1024,1440px; navegación, datos, acciones y consola |APROBADA en Chromium |product-editor-studio.spec; capturas antes/después |
|Estado de publicación único y datos privados |APROBADA |Casos nuevos y regresiones de permisos |
|Workspace/editor comercial/editorial Node |APROBADA44/44 |domain-final.log |
|Preservación de corrección de Perfil integrada |APROBADA6/6; fuente idéntica a main |profile-preservation.log |
|Preflight integrado |APROBADA39/39 |preflight.json |
|Benchmark nuevo de campo, dispositivos físicos, proveedor y sesión real |NO EJECUTADA |Límites de08-REDISENO-VISUAL.md |
|CI y producción del rediseño |NO EJECUTADA al publicar; recibo final en PR |No se hereda CI anterior |

La matriz siguiente conserva la ejecución histórica de Fase6.

---

# Matriz de pruebas final

Todos los PASS siguientes son locales/sintéticos o emulados, según la columna de evidencia.
La inspección estática no se contabiliza como una prueba aprobada.

| Área | Prueba | Resultado | Evidencia |
| --- | --- | --- | --- |
| Fotos | Subir archivos, cola, error, reintento y cancelar pendiente | APROBADA local | product-save-responsive / carga unificada; products-responsive / foto local |
| Fotos | Reemplazar conservando orden y asociaciones | APROBADA local | product-save-responsive / galería única guarda, reabre y conserva asociaciones |
| Fotos | Quitar asociaciones y referencias sin borrar biblioteca | APROBADA local | product-save-responsive / galería única; private-work-media-guard Node |
| Fotos | Ampliar, cerrar y recuperar foco | APROBADA local | product-save-responsive / galería única; product-color-gallery |
| Fotos | Reordenar y elegir cuarta portada | APROBADA local | galería única guarda/reabre; orden y portada1–20 |
| Fotos | Foto por color/combinación, guardar y recuperar | APROBADA local | product-color-gallery; product-save-responsive |
| Público | Portada y selección en tarjeta/búsqueda/ficha/carrito/favoritos | APROBADA local | cards-browser24; search-responsive; product-shape-selection; Node favoritos5 incluido en610 |
| Variantes | Simple, múltiples colores y atributos combinados | APROBADA local | inventario pertinente/simple/sin-control/color-talle; core Node |
| Variantes | Cantidad, total,0 y sin control | APROBADA local | matriz/lote/orden; configurar stock; inventario pertinente |
| Privados | Costo unitario independiente, campos privados y permisos | APROBADA local | editor-comercial/maestro/product-workspaces Node; Rules233+privacidad21 |
| Variantes | Retiro/restauración conserva identidad, precio, foto y stock | APROBADA local | retiro y restauración; Node; integración Firestore retiro/reserva/cancelación/restauración |
| Variantes | Nueva opción V1 positiva no pierde cantidades al quitar | APROBADA tras corrección | legacy-quantity-before FAIL; editor-regressions-final PASS |
| Editorial | Cancelar sin cambios y con cambios/autoguardado | APROBADA local | ciclo editorial y diálogo sin pérdida, seis anchos |
| Editorial | Guardar borrador incompleto sin publicar | APROBADA local | ciclo editorial; Node nuevo incompleto; workspace |
| Editorial | Recuperar después de reabrir administrador y respaldo de sesión | APROBADA local | reabrir administrador recupera servidor y respaldo de sesión |
| Editorial | Editar activo conserva público hasta guardar | APROBADA local | crear incompleto/salir/recuperar/publicar/editar; retiro y restauración |
| Editorial | Archivar y reabrir mismo producto, stock intacto | APROBADA local | archivar y restaurar exige acción explícita |
| Editorial | Estado real de servidor, fallo de escritura y red | APROBADA local | fallo de red; fotos pendientes; salida con escritura en vuelo |
| Editorial | Sesiones concurrentes y CAS | APROBADA local | workspace / conflicto; Firestore integración; Node permisos/huellas |
| Editorial | Paginación y carga parcial de borradores | APROBADA local | Borradores carga páginas/fallo/reintento; Firestore205 trabajos |
| Compra | Precio público, selección, foto, disponibilidad y carrito | APROBADA local | shape/color-choice/search; contratos Node |
| Compra | Identificador y precio recibidos por contrato de checkout | APROBADA emulada | Editor → checkout público → pedido, Firestore |
| Compra | Reserva, concurrencia, cancelación idempotente e historia | APROBADA emulada | commerce-firestore; retired-option-checkout helper; orders Node |
| Responsive | 320/390/600/768/1024/1440 y tamaños adicionales | APROBADA local | matrices Chromium; capturas cancelar-ancho.png |
| Responsive | Orientación, viewport reducido y acciones visibles | APROBADA local | workspace altura reducida; reflujo equivalente; rotación |
| Accesibilidad | Foco, Tab, Escape, táctil emulado y diálogos | APROBADA local | workspace y ciclo editorial; salida con escritura en vuelo |
| Zoom | Reflujo equivalente200%720CSSpx/DPR2, no zoom nativo | APROBADA emulada | reflujo equivalente a zoom200%; reflujo-200.png |
| Calidad | Sin multiplicar escrituras al abrir/cerrar cinco veces | APROBADA local | reabrir cinco veces no multiplica escrituras |
| Calidad | Pageerror en recorridos instrumentados | APROBADA local | ciclo editorial, editor comercial y responsive con captura de pageerror |
| Rendimiento | Comparación de eventos/DOM antes/después | APROBADA local, limitada | RENDIMIENTO.md;500→0 reemplazos; medianas descriptivas62→39ms |
| Entrega | Build, referencias, caché y preflight | APROBADA local | build; preflight39; plan protegido; verificaciones finales |
| Externo | Auth/Cloudinary/Sheets reales en staging | NO EJECUTADA | EXT-01; no staging/identidad de prueba configurados |
| Dispositivos | Safari/iOS físico, teclado virtual, lector, safe areas no nulas | NO EJECUTADA | DEV-01; el navegador emulado no sustituye hardware |
| Zoom | Zoom nativo en navegador/dispositivo real | NO EJECUTADA | DEV-01; reflujo equivalente registrado por separado |
| Rendimiento | Perfil sintético histórico1/2/5/10/20 fotos | NO EJECUTADA | Excluido expresamente de la tanda amplia; no se presenta como aprobado. Comparación nueva en RENDIMIENTO.md. |
| Publicación | CI del candidato, merge y deploy | NO EJECUTADA | REL-01; expresamente no autorizados |

## Ejecuciones y resolución de fallos

| Ejecución | Resultado real |
| --- | --- |
| Node final con lock exacto |610/610,0 fallos/omisiones. Incluye favoritos. |
| Privacidad / Rules |21/21 y233/233 controles reales del emulador. |
| Integración REST/CAS Firestore |15/15. |
| Matriz Chromium amplia |423/428 PASS;5 FAIL de URL de fixture. No se presenta como428PASS. |
| Fixture de vista previa corregida |10/10 PASS en ejecución separada. |
| Tarjetas |24/24 PASS. |
| Regresión de cantidades V1, antes |1 FAIL reproducido: Oro2 desaparecía. |
| Regresiones finales después del guard |64/64 PASS; incluyen esos10 tamaños y la regresión nueva. |
| Perfil aislado |1 medición base y1 final aprobadas con500/0 reemplazos exigidos. |
| Preflight |39 comandos aprobados; recibo por comando en evidencias/preflight.json. |

Cobertura de navegador consolidada: **454 casos distintos**, todos con última ejecución aprobada.
Es la unión de casos entre tandas; no una corrida única de ese tamaño. Los repetidos
conservan su historial y no se suman como cobertura nueva. La corrección final del
guard se repite sobre los recorridos afectados; backend, checkout y Rules no cambiaron.

Resultados individuales Node y emulador: [pruebas-node.json](evidencias/pruebas-node.json).
Resultados individuales navegador, duraciones y fallos previos: [pruebas-navegador.json](evidencias/pruebas-navegador.json).
Entorno y fuentes: [huellas.json](evidencias/huellas.json). Intentos anteriores con
dependencias inválidas y perfil inicial invalidado: [intentos-previos.json](evidencias/intentos-previos.json).

## Cada caso de navegador

| # | Archivo / caso | Último resultado | Ejecución |
| ---: | --- | --- | --- |
|1|`cart/color-choice-browser.spec.js:8` · elegir no agrega; colores conservan líneas, precios y fotos hasta checkout v2=false|APROBADA|browser-locked|
|2|`cart/color-choice-browser.spec.js:8` · elegir no agrega; colores conservan líneas, precios y fotos hasta checkout v2=true|APROBADA|browser-locked|
|3|`catalog/search-responsive.spec.js:7` · búsqueda tolerante y recuperación de filtros 320×568|APROBADA|browser-locked|
|4|`catalog/search-responsive.spec.js:7` · búsqueda tolerante y recuperación de filtros 390×844|APROBADA|browser-locked|
|5|`catalog/search-responsive.spec.js:7` · búsqueda tolerante y recuperación de filtros 844×390|APROBADA|browser-locked|
|6|`catalog/search-responsive.spec.js:7` · búsqueda tolerante y recuperación de filtros 768×1024|APROBADA|browser-locked|
|7|`catalog/search-responsive.spec.js:7` · búsqueda tolerante y recuperación de filtros 1024×768|APROBADA|browser-locked|
|8|`catalog/search-responsive.spec.js:7` · búsqueda tolerante y recuperación de filtros 1180×820|APROBADA|browser-locked|
|9|`catalog/search-responsive.spec.js:7` · búsqueda tolerante y recuperación de filtros 1366×768|APROBADA|browser-locked|
|10|`catalog/search-responsive.spec.js:7` · búsqueda tolerante y recuperación de filtros 1920×1080|APROBADA|browser-locked|
|11|`catalog/search-responsive.spec.js:37` · página informativa carga búsqueda al usarla y conserva texto temprano 390×844|APROBADA|browser-locked|
|12|`catalog/search-responsive.spec.js:37` · página informativa carga búsqueda al usarla y conserva texto temprano 844×390|APROBADA|browser-locked|
|13|`catalog/search-responsive.spec.js:37` · página informativa carga búsqueda al usarla y conserva texto temprano 1366×768|APROBADA|browser-locked|
|14|`catalog/search-responsive.spec.js:59` · motor comercial v2 comparte precio y descuento entre tarjeta y búsqueda|APROBADA|browser-locked|
|15|`ui-ux/editor-comercial-v2.spec.js:11` · editor Tintin app: foco, sugerencias y campos preservados 320x568|APROBADA|browser-locked|
|16|`ui-ux/editor-comercial-v2.spec.js:11` · editor Tintin app: foco, sugerencias y campos preservados 390x844|APROBADA|browser-locked|
|17|`ui-ux/editor-comercial-v2.spec.js:11` · editor Tintin app: foco, sugerencias y campos preservados 844x390|APROBADA|browser-locked|
|18|`ui-ux/editor-comercial-v2.spec.js:11` · editor Tintin app: foco, sugerencias y campos preservados 768x1024|APROBADA|browser-locked|
|19|`ui-ux/editor-comercial-v2.spec.js:11` · editor Tintin app: foco, sugerencias y campos preservados 1024x768|APROBADA|browser-locked|
|20|`ui-ux/editor-comercial-v2.spec.js:11` · editor Tintin app: foco, sugerencias y campos preservados 1366x768|APROBADA|browser-locked|
|21|`ui-ux/editor-comercial-v2.spec.js:11` · editor Tintin app: foco, sugerencias y campos preservados 1920x1080|APROBADA|browser-locked|
|22|`ui-ux/editor-comercial-v2.spec.js:11` · editor Tintin app: foco, sugerencias y campos preservados 3840x2160|APROBADA|browser-locked|
|23|`ui-ux/editor-comercial-v2.spec.js:43` · editor comercial real: matriz, lote, orden y vista previa 320x700|APROBADA|editor-regressions-final|
|24|`ui-ux/editor-comercial-v2.spec.js:43` · editor comercial real: matriz, lote, orden y vista previa 390x844|APROBADA|editor-regressions-final|
|25|`ui-ux/editor-comercial-v2.spec.js:43` · editor comercial real: matriz, lote, orden y vista previa 844x390|APROBADA|editor-regressions-final|
|26|`ui-ux/editor-comercial-v2.spec.js:43` · editor comercial real: matriz, lote, orden y vista previa 768x1024|APROBADA|editor-regressions-final|
|27|`ui-ux/editor-comercial-v2.spec.js:43` · editor comercial real: matriz, lote, orden y vista previa 1024x768|APROBADA|editor-regressions-final|
|28|`ui-ux/editor-comercial-v2.spec.js:43` · editor comercial real: matriz, lote, orden y vista previa 1440x900|APROBADA|editor-regressions-final|
|29|`ui-ux/editor-comercial-v2.spec.js:77` · reconocimiento real local: carteras, relojes y abstención sin API externa|APROBADA|browser-locked|
|30|`ui-ux/editor-comercial-v2.spec.js:100` · editor Apple-inspired: resúmenes, teclado y movimiento reducido 320x700|APROBADA|browser-locked|
|31|`ui-ux/editor-comercial-v2.spec.js:100` · editor Apple-inspired: resúmenes, teclado y movimiento reducido 768x1024|APROBADA|browser-locked|
|32|`ui-ux/editor-comercial-v2.spec.js:100` · editor Apple-inspired: resúmenes, teclado y movimiento reducido 1024x768|APROBADA|browser-locked|
|33|`ui-ux/editor-comercial-v2.spec.js:100` · editor Apple-inspired: resúmenes, teclado y movimiento reducido 1440x900|APROBADA|browser-locked|
|34|`ui-ux/editor-comercial-v2.spec.js:135` · editor contraste Tintin: ejemplos, superficies y foco 320x700|APROBADA|browser-locked|
|35|`ui-ux/editor-comercial-v2.spec.js:135` · editor contraste Tintin: ejemplos, superficies y foco 390x844|APROBADA|browser-locked|
|36|`ui-ux/editor-comercial-v2.spec.js:135` · editor contraste Tintin: ejemplos, superficies y foco 844x390|APROBADA|browser-locked|
|37|`ui-ux/editor-comercial-v2.spec.js:135` · editor contraste Tintin: ejemplos, superficies y foco 768x1024|APROBADA|browser-locked|
|38|`ui-ux/editor-comercial-v2.spec.js:135` · editor contraste Tintin: ejemplos, superficies y foco 1024x768|APROBADA|browser-locked|
|39|`ui-ux/editor-comercial-v2.spec.js:135` · editor contraste Tintin: ejemplos, superficies y foco 1440x900|APROBADA|browser-locked|
|40|`ui-ux/editor-comercial-v2.spec.js:135` · editor contraste Tintin: ejemplos, superficies y foco 1920x1080|APROBADA|browser-locked|
|41|`ui-ux/product-color-gallery.spec.js:20` · sugerencia de color requiere decisión explícita: aceptar|APROBADA|browser-locked|
|42|`ui-ux/product-color-gallery.spec.js:20` · sugerencia de color requiere decisión explícita: descartar|APROBADA|browser-locked|
|43|`ui-ux/product-color-gallery.spec.js:36` · galería y editor de tres fotos por color en 320px|APROBADA|browser-locked|
|44|`ui-ux/product-color-gallery.spec.js:36` · galería y editor de tres fotos por color en 390px|APROBADA|browser-locked|
|45|`ui-ux/product-color-gallery.spec.js:36` · galería y editor de tres fotos por color en 709px|APROBADA|browser-locked|
|46|`ui-ux/product-color-gallery.spec.js:36` · galería y editor de tres fotos por color en 768px|APROBADA|browser-locked|
|47|`ui-ux/product-color-gallery.spec.js:36` · galería y editor de tres fotos por color en 1024px|APROBADA|browser-locked|
|48|`ui-ux/product-color-gallery.spec.js:36` · galería y editor de tres fotos por color en 1440px|APROBADA|browser-locked|
|49|`ui-ux/product-color-gallery.spec.js:36` · galería y editor de tres fotos por color en 1920px|APROBADA|browser-locked|
|50|`ui-ux/product-color-gallery.spec.js:64` · el inventario conserva sus colores y destruir el editor cancela la detección pendiente|APROBADA|browser-locked|
|51|`ui-ux/product-color-gallery.spec.js:80` · orden y portada general con 1 fotografías|APROBADA|browser-locked|
|52|`ui-ux/product-color-gallery.spec.js:80` · orden y portada general con 2 fotografías|APROBADA|browser-locked|
|53|`ui-ux/product-color-gallery.spec.js:80` · orden y portada general con 3 fotografías|APROBADA|browser-locked|
|54|`ui-ux/product-color-gallery.spec.js:80` · orden y portada general con 4 fotografías|APROBADA|browser-locked|
|55|`ui-ux/product-color-gallery.spec.js:80` · orden y portada general con 5 fotografías|APROBADA|browser-locked|
|56|`ui-ux/product-color-gallery.spec.js:80` · orden y portada general con 10 fotografías|APROBADA|browser-locked|
|57|`ui-ux/product-color-gallery.spec.js:80` · orden y portada general con 20 fotografías|APROBADA|browser-locked|
|58|`ui-ux/product-color-gallery.spec.js:101` · miniaturas y colores respetan el mismo orden global 320x568|APROBADA|browser-locked|
|59|`ui-ux/product-color-gallery.spec.js:101` · miniaturas y colores respetan el mismo orden global 390x844|APROBADA|browser-locked|
|60|`ui-ux/product-color-gallery.spec.js:101` · miniaturas y colores respetan el mismo orden global 667x375|APROBADA|browser-locked|
|61|`ui-ux/product-color-gallery.spec.js:101` · miniaturas y colores respetan el mismo orden global 768x1024|APROBADA|browser-locked|
|62|`ui-ux/product-color-gallery.spec.js:101` · miniaturas y colores respetan el mismo orden global 1024x768|APROBADA|browser-locked|
|63|`ui-ux/product-color-gallery.spec.js:101` · miniaturas y colores respetan el mismo orden global 1280x720|APROBADA|browser-locked|
|64|`ui-ux/product-color-gallery.spec.js:101` · miniaturas y colores respetan el mismo orden global 1440x900|APROBADA|browser-locked|
|65|`ui-ux/product-color-gallery.spec.js:101` · miniaturas y colores respetan el mismo orden global 1920x1080|APROBADA|browser-locked|
|66|`ui-ux/product-color-gallery.spec.js:124` · editor conserva fotos exactas de combinación y color en 320x568|APROBADA|browser-locked|
|67|`ui-ux/product-color-gallery.spec.js:124` · editor conserva fotos exactas de combinación y color en 667x375|APROBADA|browser-locked|
|68|`ui-ux/product-color-gallery.spec.js:124` · editor conserva fotos exactas de combinación y color en 768x1024|APROBADA|browser-locked|
|69|`ui-ux/product-color-gallery.spec.js:124` · editor conserva fotos exactas de combinación y color en 1024x768|APROBADA|browser-locked|
|70|`ui-ux/product-color-gallery.spec.js:124` · editor conserva fotos exactas de combinación y color en 1440x900|APROBADA|browser-locked|
|71|`ui-ux/product-color-gallery.spec.js:146` · ficha real minimalista, orden y controles en 320px|APROBADA|browser-locked|
|72|`ui-ux/product-color-gallery.spec.js:146` · ficha real minimalista, orden y controles en 390px|APROBADA|browser-locked|
|73|`ui-ux/product-color-gallery.spec.js:146` · ficha real minimalista, orden y controles en 709px|APROBADA|browser-locked|
|74|`ui-ux/product-color-gallery.spec.js:146` · ficha real minimalista, orden y controles en 768px|APROBADA|browser-locked|
|75|`ui-ux/product-color-gallery.spec.js:146` · ficha real minimalista, orden y controles en 1024px|APROBADA|browser-locked|
|76|`ui-ux/product-color-gallery.spec.js:146` · ficha real minimalista, orden y controles en 1280px|APROBADA|browser-locked|
|77|`ui-ux/product-color-gallery.spec.js:146` · ficha real minimalista, orden y controles en 1440px|APROBADA|browser-locked|
|78|`ui-ux/product-color-gallery.spec.js:146` · ficha real minimalista, orden y controles en 1920px|APROBADA|browser-locked|
|79|`ui-ux/product-color-gallery.spec.js:192` · las sugerencias agrupan varias fotos y respetan el cambio manual|APROBADA|browser-locked|
|80|`ui-ux/product-color-gallery.spec.js:210` · paleta administrativa y reemplazo manual se conservan al serializar|APROBADA|browser-locked|
|81|`ui-ux/product-color-gallery.spec.js:225` · color descriptivo sincroniza foto responsive y miniatura en 390px|APROBADA|browser-locked|
|82|`ui-ux/product-color-gallery.spec.js:225` · color descriptivo sincroniza foto responsive y miniatura en 1440px|APROBADA|browser-locked|
|83|`ui-ux/product-editor-final.spec.js:21` · ciclo editorial y diálogo sin pérdida 320|APROBADA|editor-regressions-final|
|84|`ui-ux/product-editor-final.spec.js:21` · ciclo editorial y diálogo sin pérdida 390|APROBADA|editor-regressions-final|
|85|`ui-ux/product-editor-final.spec.js:21` · ciclo editorial y diálogo sin pérdida 600|APROBADA|editor-regressions-final|
|86|`ui-ux/product-editor-final.spec.js:21` · ciclo editorial y diálogo sin pérdida 768|APROBADA|editor-regressions-final|
|87|`ui-ux/product-editor-final.spec.js:21` · ciclo editorial y diálogo sin pérdida 1024|APROBADA|editor-regressions-final|
|88|`ui-ux/product-editor-final.spec.js:21` · ciclo editorial y diálogo sin pérdida 1440|APROBADA|editor-regressions-final|
|89|`ui-ux/product-editor-final.spec.js:48` · descartar es explícito y un error de escritura conserva el borrador|APROBADA|browser-locked|
|90|`ui-ux/product-editor-final.spec.js:58` · retiro y restauración de opción guardada preserva el producto público hasta guardar|APROBADA|editor-regressions-final|
|91|`ui-ux/product-editor-final.spec.js:75` · reabrir administrador recupera servidor y respaldo de sesión sin publicar|APROBADA|browser-locked|
|92|`ui-ux/product-editor-final.spec.js:85` · reabrir cinco veces no multiplica escrituras del borrador|APROBADA|editor-regressions-final|
|93|`ui-ux/product-editor-final.spec.js:97` · reflujo equivalente a zoom 200%, orientación y táctil conservan acciones|APROBADA|editor-regressions-final|
|94|`ui-ux/product-editor-final.spec.js:112` · salida con escritura en vuelo bloquea decisiones contradictorias|APROBADA|editor-regressions-final|
|95|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 320x568|APROBADA|browser-locked|
|96|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 390x844|APROBADA|browser-locked|
|97|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 430x932|APROBADA|browser-locked|
|98|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 540x900|APROBADA|browser-locked|
|99|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 600x960|APROBADA|browser-locked|
|100|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 768x1024|APROBADA|browser-locked|
|101|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 820x1180|APROBADA|browser-locked|
|102|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 844x390|APROBADA|browser-locked|
|103|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 1024x768|APROBADA|browser-locked|
|104|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 1180x820|APROBADA|browser-locked|
|105|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 1366x768|APROBADA|browser-locked|
|106|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 1920x1080|APROBADA|browser-locked|
|107|`ui-ux/product-save-responsive.spec.js:169` · Nuevo y Editar conservan formulario visible con cabecera real 3840x2160|APROBADA|browser-locked|
|108|`ui-ux/product-save-responsive.spec.js:187` · viewport reducido y restauración no dejan el editor vacío ni pierden el borrador|APROBADA|browser-locked|
|109|`ui-ux/product-save-responsive.spec.js:200` · carga unificada conserva pendientes ante fallo, reintenta y permite cancelar|APROBADA|browser-locked|
|110|`ui-ux/product-save-responsive.spec.js:215` · galería única con 1 imágenes conserva orden y portada|APROBADA|browser-locked|
|111|`ui-ux/product-save-responsive.spec.js:215` · galería única con 2 imágenes conserva orden y portada|APROBADA|browser-locked|
|112|`ui-ux/product-save-responsive.spec.js:215` · galería única con 3 imágenes conserva orden y portada|APROBADA|browser-locked|
|113|`ui-ux/product-save-responsive.spec.js:215` · galería única con 4 imágenes conserva orden y portada|APROBADA|browser-locked|
|114|`ui-ux/product-save-responsive.spec.js:215` · galería única con 5 imágenes conserva orden y portada|APROBADA|browser-locked|
|115|`ui-ux/product-save-responsive.spec.js:215` · galería única con 10 imágenes conserva orden y portada|APROBADA|browser-locked|
|116|`ui-ux/product-save-responsive.spec.js:215` · galería única con 13 imágenes conserva orden y portada|APROBADA|browser-locked|
|117|`ui-ux/product-save-responsive.spec.js:221` · galería única guarda, reabre y conserva asociaciones 390x844|APROBADA|browser-locked|
|118|`ui-ux/product-save-responsive.spec.js:221` · galería única guarda, reabre y conserva asociaciones 844x390|APROBADA|browser-locked|
|119|`ui-ux/product-save-responsive.spec.js:221` · galería única guarda, reabre y conserva asociaciones 768x1024|APROBADA|browser-locked|
|120|`ui-ux/product-save-responsive.spec.js:221` · galería única guarda, reabre y conserva asociaciones 1024x768|APROBADA|browser-locked|
|121|`ui-ux/product-save-responsive.spec.js:221` · galería única guarda, reabre y conserva asociaciones 1366x768|APROBADA|browser-locked|
|122|`ui-ux/product-save-responsive.spec.js:221` · galería única guarda, reabre y conserva asociaciones 1920x1080|APROBADA|browser-locked|
|123|`ui-ux/product-save-responsive.spec.js:272` · opciones agrupadas, inventario y referencias seguras 390x844|APROBADA|editor-regressions-final|
|124|`ui-ux/product-save-responsive.spec.js:272` · opciones agrupadas, inventario y referencias seguras 844x390|APROBADA|editor-regressions-final|
|125|`ui-ux/product-save-responsive.spec.js:272` · opciones agrupadas, inventario y referencias seguras 768x1024|APROBADA|editor-regressions-final|
|126|`ui-ux/product-save-responsive.spec.js:272` · opciones agrupadas, inventario y referencias seguras 1024x768|APROBADA|editor-regressions-final|
|127|`ui-ux/product-save-responsive.spec.js:272` · opciones agrupadas, inventario y referencias seguras 1366x768|APROBADA|editor-regressions-final|
|128|`ui-ux/product-save-responsive.spec.js:272` · opciones agrupadas, inventario y referencias seguras 1920x1080|APROBADA|editor-regressions-final|
|129|`ui-ux/product-save-responsive.spec.js:343` · la sugerencia es contextual y jamás crea una opción sin confirmación|APROBADA|browser-locked|
|130|`ui-ux/product-save-responsive.spec.js:355` · inventario pertinente y persistente: simple|APROBADA|editor-regressions-final|
|131|`ui-ux/product-save-responsive.spec.js:355` · inventario pertinente y persistente: sin-control|APROBADA|editor-regressions-final|
|132|`ui-ux/product-save-responsive.spec.js:355` · inventario pertinente y persistente: color-talle|APROBADA|editor-regressions-final|
|133|`ui-ux/product-save-responsive.spec.js:8` · 320x568 / nuevo producto real: opciones y guardado 320x568|APROBADA|browser-locked|
|134|`ui-ux/product-save-responsive.spec.js:52` · 320x568 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|135|`ui-ux/product-save-responsive.spec.js:70` · 320x568 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|136|`ui-ux/product-save-responsive.spec.js:92` · 320x568 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|137|`ui-ux/product-save-responsive.spec.js:106` · 320x568 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|138|`ui-ux/product-save-responsive.spec.js:118` · 320x568 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|139|`ui-ux/product-save-responsive.spec.js:130` · 320x568 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|140|`ui-ux/product-save-responsive.spec.js:143` · 320x568 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|141|`ui-ux/product-save-responsive.spec.js:155` · 320x568 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|142|`ui-ux/product-save-responsive.spec.js:8` · 390x844 / nuevo producto real: opciones y guardado 390x844|APROBADA|browser-locked|
|143|`ui-ux/product-save-responsive.spec.js:52` · 390x844 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|144|`ui-ux/product-save-responsive.spec.js:70` · 390x844 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|145|`ui-ux/product-save-responsive.spec.js:92` · 390x844 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|146|`ui-ux/product-save-responsive.spec.js:106` · 390x844 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|147|`ui-ux/product-save-responsive.spec.js:118` · 390x844 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|148|`ui-ux/product-save-responsive.spec.js:130` · 390x844 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|149|`ui-ux/product-save-responsive.spec.js:143` · 390x844 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|150|`ui-ux/product-save-responsive.spec.js:155` · 390x844 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|151|`ui-ux/product-save-responsive.spec.js:8` · 430x932 / nuevo producto real: opciones y guardado 430x932|APROBADA|browser-locked|
|152|`ui-ux/product-save-responsive.spec.js:52` · 430x932 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|153|`ui-ux/product-save-responsive.spec.js:70` · 430x932 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|154|`ui-ux/product-save-responsive.spec.js:92` · 430x932 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|155|`ui-ux/product-save-responsive.spec.js:106` · 430x932 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|156|`ui-ux/product-save-responsive.spec.js:118` · 430x932 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|157|`ui-ux/product-save-responsive.spec.js:130` · 430x932 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|158|`ui-ux/product-save-responsive.spec.js:143` · 430x932 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|159|`ui-ux/product-save-responsive.spec.js:155` · 430x932 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|160|`ui-ux/product-save-responsive.spec.js:8` · 844x390 / nuevo producto real: opciones y guardado 844x390|APROBADA|browser-locked|
|161|`ui-ux/product-save-responsive.spec.js:52` · 844x390 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|162|`ui-ux/product-save-responsive.spec.js:70` · 844x390 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|163|`ui-ux/product-save-responsive.spec.js:92` · 844x390 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|164|`ui-ux/product-save-responsive.spec.js:106` · 844x390 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|165|`ui-ux/product-save-responsive.spec.js:118` · 844x390 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|166|`ui-ux/product-save-responsive.spec.js:130` · 844x390 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|167|`ui-ux/product-save-responsive.spec.js:143` · 844x390 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|168|`ui-ux/product-save-responsive.spec.js:155` · 844x390 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|169|`ui-ux/product-save-responsive.spec.js:8` · 768x1024 / nuevo producto real: opciones y guardado 768x1024|APROBADA|browser-locked|
|170|`ui-ux/product-save-responsive.spec.js:52` · 768x1024 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|171|`ui-ux/product-save-responsive.spec.js:70` · 768x1024 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|172|`ui-ux/product-save-responsive.spec.js:92` · 768x1024 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|173|`ui-ux/product-save-responsive.spec.js:106` · 768x1024 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|174|`ui-ux/product-save-responsive.spec.js:118` · 768x1024 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|175|`ui-ux/product-save-responsive.spec.js:130` · 768x1024 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|176|`ui-ux/product-save-responsive.spec.js:143` · 768x1024 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|177|`ui-ux/product-save-responsive.spec.js:155` · 768x1024 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|178|`ui-ux/product-save-responsive.spec.js:8` · 820x1180 / nuevo producto real: opciones y guardado 820x1180|APROBADA|browser-locked|
|179|`ui-ux/product-save-responsive.spec.js:52` · 820x1180 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|180|`ui-ux/product-save-responsive.spec.js:70` · 820x1180 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|181|`ui-ux/product-save-responsive.spec.js:92` · 820x1180 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|182|`ui-ux/product-save-responsive.spec.js:106` · 820x1180 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|183|`ui-ux/product-save-responsive.spec.js:118` · 820x1180 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|184|`ui-ux/product-save-responsive.spec.js:130` · 820x1180 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|185|`ui-ux/product-save-responsive.spec.js:143` · 820x1180 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|186|`ui-ux/product-save-responsive.spec.js:155` · 820x1180 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|187|`ui-ux/product-save-responsive.spec.js:8` · 1024x768 / nuevo producto real: opciones y guardado 1024x768|APROBADA|browser-locked|
|188|`ui-ux/product-save-responsive.spec.js:52` · 1024x768 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|189|`ui-ux/product-save-responsive.spec.js:70` · 1024x768 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|190|`ui-ux/product-save-responsive.spec.js:92` · 1024x768 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|191|`ui-ux/product-save-responsive.spec.js:106` · 1024x768 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|192|`ui-ux/product-save-responsive.spec.js:118` · 1024x768 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|193|`ui-ux/product-save-responsive.spec.js:130` · 1024x768 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|194|`ui-ux/product-save-responsive.spec.js:143` · 1024x768 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|195|`ui-ux/product-save-responsive.spec.js:155` · 1024x768 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|196|`ui-ux/product-save-responsive.spec.js:8` · 1180x820 / nuevo producto real: opciones y guardado 1180x820|APROBADA|browser-locked|
|197|`ui-ux/product-save-responsive.spec.js:52` · 1180x820 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|198|`ui-ux/product-save-responsive.spec.js:70` · 1180x820 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|199|`ui-ux/product-save-responsive.spec.js:92` · 1180x820 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|200|`ui-ux/product-save-responsive.spec.js:106` · 1180x820 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|201|`ui-ux/product-save-responsive.spec.js:118` · 1180x820 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|202|`ui-ux/product-save-responsive.spec.js:130` · 1180x820 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|203|`ui-ux/product-save-responsive.spec.js:143` · 1180x820 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|204|`ui-ux/product-save-responsive.spec.js:155` · 1180x820 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|205|`ui-ux/product-save-responsive.spec.js:8` · 1280x720 / nuevo producto real: opciones y guardado 1280x720|APROBADA|browser-locked|
|206|`ui-ux/product-save-responsive.spec.js:52` · 1280x720 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|207|`ui-ux/product-save-responsive.spec.js:70` · 1280x720 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|208|`ui-ux/product-save-responsive.spec.js:92` · 1280x720 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|209|`ui-ux/product-save-responsive.spec.js:106` · 1280x720 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|210|`ui-ux/product-save-responsive.spec.js:118` · 1280x720 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|211|`ui-ux/product-save-responsive.spec.js:130` · 1280x720 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|212|`ui-ux/product-save-responsive.spec.js:143` · 1280x720 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|213|`ui-ux/product-save-responsive.spec.js:155` · 1280x720 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|214|`ui-ux/product-save-responsive.spec.js:8` · 1366x768 / nuevo producto real: opciones y guardado 1366x768|APROBADA|browser-locked|
|215|`ui-ux/product-save-responsive.spec.js:52` · 1366x768 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|216|`ui-ux/product-save-responsive.spec.js:70` · 1366x768 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|217|`ui-ux/product-save-responsive.spec.js:92` · 1366x768 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|218|`ui-ux/product-save-responsive.spec.js:106` · 1366x768 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|219|`ui-ux/product-save-responsive.spec.js:118` · 1366x768 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|220|`ui-ux/product-save-responsive.spec.js:130` · 1366x768 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|221|`ui-ux/product-save-responsive.spec.js:143` · 1366x768 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|222|`ui-ux/product-save-responsive.spec.js:155` · 1366x768 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|223|`ui-ux/product-save-responsive.spec.js:8` · 1440x900 / nuevo producto real: opciones y guardado 1440x900|APROBADA|browser-locked|
|224|`ui-ux/product-save-responsive.spec.js:52` · 1440x900 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|225|`ui-ux/product-save-responsive.spec.js:70` · 1440x900 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|226|`ui-ux/product-save-responsive.spec.js:92` · 1440x900 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|227|`ui-ux/product-save-responsive.spec.js:106` · 1440x900 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|228|`ui-ux/product-save-responsive.spec.js:118` · 1440x900 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|229|`ui-ux/product-save-responsive.spec.js:130` · 1440x900 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|230|`ui-ux/product-save-responsive.spec.js:143` · 1440x900 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|231|`ui-ux/product-save-responsive.spec.js:155` · 1440x900 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|232|`ui-ux/product-save-responsive.spec.js:8` · 1920x1080 / nuevo producto real: opciones y guardado 1920x1080|APROBADA|browser-locked|
|233|`ui-ux/product-save-responsive.spec.js:52` · 1920x1080 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|234|`ui-ux/product-save-responsive.spec.js:70` · 1920x1080 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|235|`ui-ux/product-save-responsive.spec.js:92` · 1920x1080 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|236|`ui-ux/product-save-responsive.spec.js:106` · 1920x1080 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|237|`ui-ux/product-save-responsive.spec.js:118` · 1920x1080 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|238|`ui-ux/product-save-responsive.spec.js:130` · 1920x1080 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|239|`ui-ux/product-save-responsive.spec.js:143` · 1920x1080 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|240|`ui-ux/product-save-responsive.spec.js:155` · 1920x1080 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|241|`ui-ux/product-save-responsive.spec.js:8` · 2560x1440 / nuevo producto real: opciones y guardado 2560x1440|APROBADA|browser-locked|
|242|`ui-ux/product-save-responsive.spec.js:52` · 2560x1440 / activar precios por combinación conserva las cantidades recién editadas|APROBADA|browser-locked|
|243|`ui-ux/product-save-responsive.spec.js:70` · 2560x1440 / color opcional sin reparto de stock y básicos de publicación|APROBADA|browser-locked|
|244|`ui-ux/product-save-responsive.spec.js:92` · 2560x1440 / doble toque o doble clic mientras guarda crea un solo producto|APROBADA|browser-locked|
|245|`ui-ux/product-save-responsive.spec.js:106` · 2560x1440 / un fallo al guardar conserva el formulario y permite reintentar sin duplicados|APROBADA|browser-locked|
|246|`ui-ux/product-save-responsive.spec.js:118` · 2560x1440 / reabrir lo guardado y editar usa el mismo producto|APROBADA|browser-locked|
|247|`ui-ux/product-save-responsive.spec.js:130` · 2560x1440 / una opción nueva sin stock se puede quitar y conserva el stock simple anterior|APROBADA|editor-regressions-final|
|248|`ui-ux/product-save-responsive.spec.js:143` · 2560x1440 / quitar una opción con stock conserva datos y explica cómo corregirla|APROBADA|editor-regressions-final|
|249|`ui-ux/product-save-responsive.spec.js:155` · 2560x1440 / cada intento inválido muestra el error aunque se haya desplazado el formulario|APROBADA|browser-locked|
|250|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 320x568|APROBADA|browser-locked|
|251|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 375x667|APROBADA|browser-locked|
|252|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 390x844|APROBADA|browser-locked|
|253|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 430x932|APROBADA|browser-locked|
|254|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 667x375|APROBADA|browser-locked|
|255|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 768x1024|APROBADA|browser-locked|
|256|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 820x1180|APROBADA|browser-locked|
|257|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 1024x768|APROBADA|browser-locked|
|258|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 1180x820|APROBADA|browser-locked|
|259|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 1280x720|APROBADA|browser-locked|
|260|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 1366x768|APROBADA|browser-locked|
|261|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 1440x900|APROBADA|browser-locked|
|262|`ui-ux/product-shape-selection.spec.js:38` · forma, foto y compra coherentes en 1920x1080|APROBADA|browser-locked|
|263|`ui-ux/product-shape-selection.spec.js:73` · combinaciones: la foto exacta prevalece sobre el color genérico y las fotos compartidas conservan la elección|APROBADA|browser-locked|
|264|`ui-ux/product-shape-selection.spec.js:84` · variantes en filas y stock global vacío conservan fotos y estados correctos|APROBADA|browser-locked|
|265|`ui-ux/product-shape-selection.spec.js:93` · un cambio de stock reordena miniaturas y conserva la foto elegida por identidad|APROBADA|browser-locked|
|266|`ui-ux/product-shape-selection.spec.js:105` · opciones largas y ausencia de fotos o atributos no desbordan ni bloquean la ficha|APROBADA|browser-locked|
|267|`ui-ux/product-shape-selection.spec.js:118` · una forma sin foto asignada no muestra otra forma del mismo color|APROBADA|browser-locked|
|268|`ui-ux/product-shape-selection.spec.js:128` · cantidad respeta el stock de la forma y no duplica eventos al actualizar|APROBADA|browser-locked|
|269|`ui-ux/product-shape-selection.spec.js:139` · ANILLO CRISTAL importado: forma y foto en orden sin metadata en 320x568|APROBADA|browser-locked|
|270|`ui-ux/product-shape-selection.spec.js:139` · ANILLO CRISTAL importado: forma y foto en orden sin metadata en 390x844|APROBADA|browser-locked|
|271|`ui-ux/product-shape-selection.spec.js:139` · ANILLO CRISTAL importado: forma y foto en orden sin metadata en 667x375|APROBADA|browser-locked|
|272|`ui-ux/product-shape-selection.spec.js:139` · ANILLO CRISTAL importado: forma y foto en orden sin metadata en 768x1024|APROBADA|browser-locked|
|273|`ui-ux/product-shape-selection.spec.js:139` · ANILLO CRISTAL importado: forma y foto en orden sin metadata en 820x1180|APROBADA|browser-locked|
|274|`ui-ux/product-shape-selection.spec.js:139` · ANILLO CRISTAL importado: forma y foto en orden sin metadata en 1024x768|APROBADA|browser-locked|
|275|`ui-ux/product-shape-selection.spec.js:139` · ANILLO CRISTAL importado: forma y foto en orden sin metadata en 1180x820|APROBADA|browser-locked|
|276|`ui-ux/product-shape-selection.spec.js:139` · ANILLO CRISTAL importado: forma y foto en orden sin metadata en 1366x768|APROBADA|browser-locked|
|277|`ui-ux/product-shape-selection.spec.js:139` · ANILLO CRISTAL importado: forma y foto en orden sin metadata en 1440x900|APROBADA|browser-locked|
|278|`ui-ux/product-shape-selection.spec.js:139` · ANILLO CRISTAL importado: forma y foto en orden sin metadata en 1920x1080|APROBADA|browser-locked|
|279|`ui-ux/product-shape-selection.spec.js:157` · Color: variante y miniatura en ambos sentidos en 320x568|APROBADA|browser-locked|
|280|`ui-ux/product-shape-selection.spec.js:157` · Tamaño: variante y miniatura en ambos sentidos en 320x568|APROBADA|browser-locked|
|281|`ui-ux/product-shape-selection.spec.js:157` · Sabor: variante y miniatura en ambos sentidos en 320x568|APROBADA|browser-locked|
|282|`ui-ux/product-shape-selection.spec.js:157` · Color: variante y miniatura en ambos sentidos en 667x375|APROBADA|browser-locked|
|283|`ui-ux/product-shape-selection.spec.js:157` · Tamaño: variante y miniatura en ambos sentidos en 667x375|APROBADA|browser-locked|
|284|`ui-ux/product-shape-selection.spec.js:157` · Sabor: variante y miniatura en ambos sentidos en 667x375|APROBADA|browser-locked|
|285|`ui-ux/product-shape-selection.spec.js:157` · Color: variante y miniatura en ambos sentidos en 768x1024|APROBADA|browser-locked|
|286|`ui-ux/product-shape-selection.spec.js:157` · Tamaño: variante y miniatura en ambos sentidos en 768x1024|APROBADA|browser-locked|
|287|`ui-ux/product-shape-selection.spec.js:157` · Sabor: variante y miniatura en ambos sentidos en 768x1024|APROBADA|browser-locked|
|288|`ui-ux/product-shape-selection.spec.js:157` · Color: variante y miniatura en ambos sentidos en 1024x768|APROBADA|browser-locked|
|289|`ui-ux/product-shape-selection.spec.js:157` · Tamaño: variante y miniatura en ambos sentidos en 1024x768|APROBADA|browser-locked|
|290|`ui-ux/product-shape-selection.spec.js:157` · Sabor: variante y miniatura en ambos sentidos en 1024x768|APROBADA|browser-locked|
|291|`ui-ux/product-shape-selection.spec.js:157` · Color: variante y miniatura en ambos sentidos en 1366x768|APROBADA|browser-locked|
|292|`ui-ux/product-shape-selection.spec.js:157` · Tamaño: variante y miniatura en ambos sentidos en 1366x768|APROBADA|browser-locked|
|293|`ui-ux/product-shape-selection.spec.js:157` · Sabor: variante y miniatura en ambos sentidos en 1366x768|APROBADA|browser-locked|
|294|`ui-ux/product-shape-selection.spec.js:157` · Color: variante y miniatura en ambos sentidos en 1920x1080|APROBADA|browser-locked|
|295|`ui-ux/product-shape-selection.spec.js:157` · Tamaño: variante y miniatura en ambos sentidos en 1920x1080|APROBADA|browser-locked|
|296|`ui-ux/product-shape-selection.spec.js:157` · Sabor: variante y miniatura en ambos sentidos en 1920x1080|APROBADA|browser-locked|
|297|`ui-ux/product-shape-selection.spec.js:176` · motor v2 cambia precio/foto por selección sin marcar sin control como agotado 390|APROBADA|browser-locked|
|298|`ui-ux/product-shape-selection.spec.js:176` · motor v2 cambia precio/foto por selección sin marcar sin control como agotado 1366|APROBADA|browser-locked|
|299|`ui-ux/product-shape-selection.spec.js:190` · plantilla default conserva selección y compra canónicas|APROBADA|browser-locked|
|300|`ui-ux/product-shape-selection.spec.js:190` · plantilla gallery conserva selección y compra canónicas|APROBADA|browser-locked|
|301|`ui-ux/product-shape-selection.spec.js:190` · plantilla unknown conserva selección y compra canónicas|APROBADA|browser-locked|
|302|`ui-ux/product-workspaces.spec.js:8` · crear incompleto, salir, recuperar, publicar, editar sin reemplazar público y recuperar cambios|APROBADA|browser-locked|
|303|`ui-ux/product-workspaces.spec.js:25` · fallo de red conserva trabajo pendiente, bloquea salida silenciosa y reintenta|APROBADA|browser-locked|
|304|`ui-ux/product-workspaces.spec.js:30` · publicación en vuelo bloquea doble acción y salida, sin duplicar producto|APROBADA|browser-locked|
|305|`ui-ux/product-workspaces.spec.js:40` · Borradores lista progreso privado y permite continuar sin inventario público ficticio|APROBADA|browser-locked|
|306|`ui-ux/product-workspaces.spec.js:56` · conflicto de progreso no pisa otra pestaña y no publica|APROBADA|browser-locked|
|307|`ui-ux/product-workspaces.spec.js:62` · fotos pendientes: fallo guarda texto, recuperar advierte y reintento/cancelación no pierde fotos previas|APROBADA|browser-locked|
|308|`ui-ux/product-workspaces.spec.js:75` · archivar y restaurar exige acción explícita y no cambia stock|APROBADA|browser-locked|
|309|`ui-ux/product-workspaces.spec.js:85` · espacio dedicado 320x568|APROBADA|browser-locked|
|310|`ui-ux/product-workspaces.spec.js:85` · espacio dedicado 390x844|APROBADA|browser-locked|
|311|`ui-ux/product-workspaces.spec.js:85` · espacio dedicado 844x390|APROBADA|browser-locked|
|312|`ui-ux/product-workspaces.spec.js:85` · espacio dedicado 768x1024|APROBADA|browser-locked|
|313|`ui-ux/product-workspaces.spec.js:85` · espacio dedicado 1366x768|APROBADA|browser-locked|
|314|`ui-ux/product-workspaces.spec.js:85` · espacio dedicado 1920x1080|APROBADA|browser-locked|
|315|`ui-ux/product-workspaces.spec.js:93` · progreso y acciones con altura reducida 320x568|APROBADA|browser-locked|
|316|`ui-ux/product-workspaces.spec.js:93` · progreso y acciones con altura reducida 390x844|APROBADA|browser-locked|
|317|`ui-ux/product-workspaces.spec.js:93` · progreso y acciones con altura reducida 844x390|APROBADA|browser-locked|
|318|`ui-ux/product-workspaces.spec.js:93` · progreso y acciones con altura reducida 768x1024|APROBADA|browser-locked|
|319|`ui-ux/product-workspaces.spec.js:93` · progreso y acciones con altura reducida 1024x768|APROBADA|browser-locked|
|320|`ui-ux/product-workspaces.spec.js:93` · progreso y acciones con altura reducida 1920x1080|APROBADA|browser-locked|
|321|`ui-ux/product-workspaces.spec.js:109` · sección elegida legible sin recorte 320|APROBADA|browser-locked|
|322|`ui-ux/product-workspaces.spec.js:109` · sección elegida legible sin recorte 390|APROBADA|browser-locked|
|323|`ui-ux/product-workspaces.spec.js:124` · acciones compactas junto al título en escritorio 1366|APROBADA|browser-locked|
|324|`ui-ux/product-workspaces.spec.js:124` · acciones compactas junto al título en escritorio 1920|APROBADA|browser-locked|
|325|`ui-ux/product-workspaces.spec.js:132` · Borradores carga páginas, conserva la lista tras fallo y reintenta el mismo cursor sin duplicar|APROBADA|browser-locked|
|326|`ui-ux/products-responsive-phase-one.spec.js:11` · foto local visible y guardado espera subida en producto y colección 320x700|APROBADA|browser-locked|
|327|`ui-ux/products-responsive-phase-one.spec.js:11` · foto local visible y guardado espera subida en producto y colección 390x844|APROBADA|browser-locked|
|328|`ui-ux/products-responsive-phase-one.spec.js:11` · foto local visible y guardado espera subida en producto y colección 844x390|APROBADA|browser-locked|
|329|`ui-ux/products-responsive-phase-one.spec.js:11` · foto local visible y guardado espera subida en producto y colección 768x1024|APROBADA|browser-locked|
|330|`ui-ux/products-responsive-phase-one.spec.js:11` · foto local visible y guardado espera subida en producto y colección 1024x768|APROBADA|browser-locked|
|331|`ui-ux/products-responsive-phase-one.spec.js:11` · foto local visible y guardado espera subida en producto y colección 1366x768|APROBADA|browser-locked|
|332|`ui-ux/products-responsive-phase-one.spec.js:11` · foto local visible y guardado espera subida en producto y colección 1920x1080|APROBADA|browser-locked|
|333|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 320x568|APROBADA|browser-locked|
|334|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 390x844|APROBADA|browser-locked|
|335|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 667x375|APROBADA|browser-locked|
|336|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 768x1024|APROBADA|browser-locked|
|337|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 820x1180|APROBADA|browser-locked|
|338|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 1024x768|APROBADA|browser-locked|
|339|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 1180x820|APROBADA|browser-locked|
|340|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 1280x720|APROBADA|browser-locked|
|341|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 1366x768|APROBADA|browser-locked|
|342|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 1440x900|APROBADA|browser-locked|
|343|`ui-ux/products-responsive-phase-one.spec.js:97` · editor minimal: botones, stock y tarjetas accesibles 1920x1080|APROBADA|browser-locked|
|344|`ui-ux/products-responsive-phase-one.spec.js:140` · variantes visuales conservan formatos previos y bloquean controles del total distribuido|APROBADA|browser-locked|
|345|`ui-ux/products-responsive-phase-one.spec.js:157` · editor real por secciones conserva campos y acciones 320x700|APROBADA|browser-locked|
|346|`ui-ux/products-responsive-phase-one.spec.js:157` · editor real por secciones conserva campos y acciones 390x844|APROBADA|browser-locked|
|347|`ui-ux/products-responsive-phase-one.spec.js:157` · editor real por secciones conserva campos y acciones 844x390|APROBADA|browser-locked|
|348|`ui-ux/products-responsive-phase-one.spec.js:157` · editor real por secciones conserva campos y acciones 768x1024|APROBADA|browser-locked|
|349|`ui-ux/products-responsive-phase-one.spec.js:157` · editor real por secciones conserva campos y acciones 1024x768|APROBADA|browser-locked|
|350|`ui-ux/products-responsive-phase-one.spec.js:157` · editor real por secciones conserva campos y acciones 1440x900|APROBADA|browser-locked|
|351|`ui-ux/products-responsive-phase-one.spec.js:186` · la navegación autenticada no tapa las acciones del editor 320x568|APROBADA|browser-locked|
|352|`ui-ux/products-responsive-phase-one.spec.js:186` · la navegación autenticada no tapa las acciones del editor 390x844|APROBADA|browser-locked|
|353|`ui-ux/products-responsive-phase-one.spec.js:186` · la navegación autenticada no tapa las acciones del editor 768x1024|APROBADA|browser-locked|
|354|`ui-ux/products-responsive-phase-one.spec.js:186` · la navegación autenticada no tapa las acciones del editor 1024x768|APROBADA|browser-locked|
|355|`ui-ux/products-responsive-phase-one.spec.js:186` · la navegación autenticada no tapa las acciones del editor 1180x820|APROBADA|browser-locked|
|356|`ui-ux/products-responsive-phase-one.spec.js:186` · la navegación autenticada no tapa las acciones del editor 844x390|APROBADA|browser-locked|
|357|`ui-ux/products-responsive-phase-one.spec.js:205` · configurar stock por color exige cantidades explícitas y recalcula total y vista previa|APROBADA|editor-regressions-final|
|358|`ui-ux/products-responsive-phase-one.spec.js:228` · producto nuevo en tablet agrega opciones sin evaluar variantes nulas 768x1024|APROBADA|browser-locked|
|359|`ui-ux/products-responsive-phase-one.spec.js:228` · producto nuevo en tablet agrega opciones sin evaluar variantes nulas 1024x768|APROBADA|browser-locked|
|360|`ui-ux/products-responsive-phase-one.spec.js:247` · editor conserva navegación y acciones accesibles al abrir y cerrar 390|APROBADA|browser-locked|
|361|`ui-ux/products-responsive-phase-one.spec.js:247` · editor conserva navegación y acciones accesibles al abrir y cerrar 775|APROBADA|browser-locked|
|362|`ui-ux/products-responsive-phase-one.spec.js:247` · editor conserva navegación y acciones accesibles al abrir y cerrar 1024|APROBADA|browser-locked|
|363|`ui-ux/products-responsive-phase-one.spec.js:268` · selección persiste al filtrar; barra móvil, lista y foco de búsqueda operan sin perder datos|APROBADA|browser-locked|
|364|`ui-ux/products-responsive-phase-one.spec.js:282` · ficha móvil a pantalla completa atrapa Tab, cierra con Escape y devuelve el foco|APROBADA|browser-locked|
|365|`ui-ux/products-responsive-phase-one.spec.js:292` · foto vertical, horizontal y faltante no se recorta ni invade controles|APROBADA|browser-locked|
|366|`ui-ux/products-responsive-phase-one.spec.js:307` · la biblioteca queda sobre el editor y Escape cierra sólo la biblioteca|APROBADA|browser-locked|
|367|`ui-ux/products-responsive-phase-one.spec.js:318` · cancelar respeta el guard nativo: seguir editando conserva datos y descartar vuelve al listado|APROBADA|browser-locked|
|368|`ui-ux/products-responsive-phase-one.spec.js:336` · validación revela campos y pone el mensaje en foco sin perder valores|APROBADA|browser-locked|
|369|`ui-ux/products-responsive-phase-one.spec.js:342` · selección entre páginas y barra sobre navegación sin tapar el último producto|APROBADA|browser-locked|
|370|`ui-ux/products-responsive-phase-one.spec.js:357` · foto principal completa en editor real y rotación conserva borrador y acciones superiores|APROBADA|browser-locked|
|371|`ui-ux/products-responsive-phase-one.spec.js:366` · salir de Productos libera el scroll y regresar conserva el editor visible|APROBADA|browser-locked|
|372|`ui-ux/products-responsive-phase-one.spec.js:376` · vista previa conectada, cantidades y fotos sin desbordes 320x700|APROBADA tras corrección|editor-regressions-final|
|373|`ui-ux/products-responsive-phase-one.spec.js:376` · vista previa conectada, cantidades y fotos sin desbordes 390x844|APROBADA tras corrección|editor-regressions-final|
|374|`ui-ux/products-responsive-phase-one.spec.js:376` · vista previa conectada, cantidades y fotos sin desbordes 600x900|APROBADA tras corrección|editor-regressions-final|
|375|`ui-ux/products-responsive-phase-one.spec.js:376` · vista previa conectada, cantidades y fotos sin desbordes 768x1024|APROBADA tras corrección|editor-regressions-final|
|376|`ui-ux/products-responsive-phase-one.spec.js:376` · vista previa conectada, cantidades y fotos sin desbordes 820x1180|APROBADA tras corrección|editor-regressions-final|
|377|`ui-ux/products-responsive-phase-one.spec.js:376` · vista previa conectada, cantidades y fotos sin desbordes 1024x768|APROBADA|editor-regressions-final|
|378|`ui-ux/products-responsive-phase-one.spec.js:376` · vista previa conectada, cantidades y fotos sin desbordes 1180x820|APROBADA|editor-regressions-final|
|379|`ui-ux/products-responsive-phase-one.spec.js:376` · vista previa conectada, cantidades y fotos sin desbordes 1366x768|APROBADA|editor-regressions-final|
|380|`ui-ux/products-responsive-phase-one.spec.js:376` · vista previa conectada, cantidades y fotos sin desbordes 1440x900|APROBADA|editor-regressions-final|
|381|`ui-ux/products-responsive-phase-one.spec.js:376` · vista previa conectada, cantidades y fotos sin desbordes 1920x1080|APROBADA|editor-regressions-final|
|382|`ui-ux/products-responsive-phase-one.spec.js:428` · galería agrega varias fotos y quita la elegida sin borrar fotos pendientes ni cambiar la portada|APROBADA|browser-locked|
|383|`ui-ux/products-responsive-phase-one.spec.js:469` · controles seleccionados conservan texto legible con el tema real 1200|APROBADA|browser-locked|
|384|`ui-ux/products-responsive-phase-one.spec.js:469` · controles seleccionados conservan texto legible con el tema real 1440|APROBADA|browser-locked|
|385|`ui-ux/products-responsive-phase-one.spec.js:469` · controles seleccionados conservan texto legible con el tema real 1920|APROBADA|browser-locked|
|386|`ui-ux/products-responsive-phase-one.spec.js:492` · cambiar apartado reinicia el editor sin perder el borrador 320|APROBADA|browser-locked|
|387|`ui-ux/products-responsive-phase-one.spec.js:492` · cambiar apartado reinicia el editor sin perder el borrador 390|APROBADA|browser-locked|
|388|`ui-ux/products-responsive-phase-one.spec.js:492` · cambiar apartado reinicia el editor sin perder el borrador 768|APROBADA|browser-locked|
|389|`ui-ux/products-responsive-phase-one.spec.js:492` · cambiar apartado reinicia el editor sin perder el borrador 1440|APROBADA|browser-locked|
|390|`ui-ux/products-responsive-phase-one.spec.js:535` · un error persistente no reinicia scroll ni foco al editar precio|APROBADA|browser-locked|
|391|`ui-ux/products-responsive-phase-one.spec.js:554` · abrir conserva producto oculto y visibilidad manual independiente de la cantidad|APROBADA|browser-locked|
|392|`ui-ux/products-responsive-phase-one.spec.js:579` · editor ocupa el área bajo Productos sin barras anidadas 320x568|APROBADA|browser-locked|
|393|`ui-ux/products-responsive-phase-one.spec.js:579` · editor ocupa el área bajo Productos sin barras anidadas 390x844|APROBADA|browser-locked|
|394|`ui-ux/products-responsive-phase-one.spec.js:579` · editor ocupa el área bajo Productos sin barras anidadas 844x390|APROBADA|browser-locked|
|395|`ui-ux/products-responsive-phase-one.spec.js:579` · editor ocupa el área bajo Productos sin barras anidadas 768x1024|APROBADA|browser-locked|
|396|`ui-ux/products-responsive-phase-one.spec.js:579` · editor ocupa el área bajo Productos sin barras anidadas 1024x768|APROBADA|browser-locked|
|397|`ui-ux/products-responsive-phase-one.spec.js:579` · editor ocupa el área bajo Productos sin barras anidadas 1180x820|APROBADA|browser-locked|
|398|`ui-ux/products-responsive-phase-one.spec.js:579` · editor ocupa el área bajo Productos sin barras anidadas 1366x768|APROBADA|browser-locked|
|399|`ui-ux/products-responsive-phase-one.spec.js:579` · editor ocupa el área bajo Productos sin barras anidadas 1440x900|APROBADA|browser-locked|
|400|`ui-ux/products-responsive-phase-one.spec.js:579` · editor ocupa el área bajo Productos sin barras anidadas 1920x1080|APROBADA|browser-locked|
|401|`ui-ux/products-responsive-phase-one.spec.js:605` · fotos por color ordenadas y editables 320x700|APROBADA|browser-locked|
|402|`ui-ux/products-responsive-phase-one.spec.js:605` · fotos por color ordenadas y editables 768x1024|APROBADA|browser-locked|
|403|`ui-ux/products-responsive-phase-one.spec.js:605` · fotos por color ordenadas y editables 1440x900|APROBADA|browser-locked|
|404|`ui-ux/products-responsive-phase-one.spec.js:630` · stock maestro retira opciones guardadas sin destruir cantidades ni referencias|APROBADA|editor-regressions-final|
|405|`ui-ux/products-responsive-phase-one.spec.js:654` · portada por color es explícita, reordenable y conserva metadatos de variante|APROBADA|browser-locked|
|406|`ui-ux/products-responsive-phase-one.spec.js:676` · carga múltiple espera archivos, conserva fallidos y reintenta sin duplicar los subidos|APROBADA|browser-locked|
|407|`ui-ux/products-responsive-phase-one.spec.js:693` · salir con fotos masivas pendientes activa el guard real sin subir ni borrar imágenes|APROBADA|browser-locked|
|408|`ui-ux/products-responsive-phase-one.spec.js:715` · panel completo mantiene título, acciones y cantidades sin solaparse 320x700|APROBADA|browser-locked|
|409|`ui-ux/products-responsive-phase-one.spec.js:715` · panel completo mantiene título, acciones y cantidades sin solaparse 390x844|APROBADA|browser-locked|
|410|`ui-ux/products-responsive-phase-one.spec.js:715` · panel completo mantiene título, acciones y cantidades sin solaparse 768x1024|APROBADA|browser-locked|
|411|`ui-ux/products-responsive-phase-one.spec.js:715` · panel completo mantiene título, acciones y cantidades sin solaparse 1024x768|APROBADA|browser-locked|
|412|`ui-ux/products-responsive-phase-one.spec.js:715` · panel completo mantiene título, acciones y cantidades sin solaparse 1280x720|APROBADA|browser-locked|
|413|`ui-ux/products-responsive-phase-one.spec.js:715` · panel completo mantiene título, acciones y cantidades sin solaparse 1440x900|APROBADA|browser-locked|
|414|`ui-ux/products-responsive-phase-one.spec.js:740` · editor estilo Shopify: columnas, estado, SEO y acciones 320x568|APROBADA|browser-locked|
|415|`ui-ux/products-responsive-phase-one.spec.js:740` · editor estilo Shopify: columnas, estado, SEO y acciones 390x844|APROBADA|browser-locked|
|416|`ui-ux/products-responsive-phase-one.spec.js:740` · editor estilo Shopify: columnas, estado, SEO y acciones 844x390|APROBADA|browser-locked|
|417|`ui-ux/products-responsive-phase-one.spec.js:740` · editor estilo Shopify: columnas, estado, SEO y acciones 768x1024|APROBADA|browser-locked|
|418|`ui-ux/products-responsive-phase-one.spec.js:740` · editor estilo Shopify: columnas, estado, SEO y acciones 1024x768|APROBADA|browser-locked|
|419|`ui-ux/products-responsive-phase-one.spec.js:740` · editor estilo Shopify: columnas, estado, SEO y acciones 1280x800|APROBADA|browser-locked|
|420|`ui-ux/products-responsive-phase-one.spec.js:740` · editor estilo Shopify: columnas, estado, SEO y acciones 1440x900|APROBADA|browser-locked|
|421|`ui-ux/products-responsive-phase-one.spec.js:740` · editor estilo Shopify: columnas, estado, SEO y acciones 1920x1080|APROBADA|browser-locked|
|422|`ui-ux/products-responsive-phase-one.spec.js:775` · editor guiado: fotos primero, contraste y borrador 320x700|APROBADA|browser-locked|
|423|`ui-ux/products-responsive-phase-one.spec.js:775` · editor guiado: fotos primero, contraste y borrador 390x844|APROBADA|browser-locked|
|424|`ui-ux/products-responsive-phase-one.spec.js:775` · editor guiado: fotos primero, contraste y borrador 844x390|APROBADA|browser-locked|
|425|`ui-ux/products-responsive-phase-one.spec.js:775` · editor guiado: fotos primero, contraste y borrador 768x1024|APROBADA|browser-locked|
|426|`ui-ux/products-responsive-phase-one.spec.js:775` · editor guiado: fotos primero, contraste y borrador 1024x768|APROBADA|browser-locked|
|427|`ui-ux/products-responsive-phase-one.spec.js:775` · editor guiado: fotos primero, contraste y borrador 1440x900|APROBADA|browser-locked|
|428|`ui-ux/products-responsive-phase-one.spec.js:793` · visión es opcional, aplica sólo la categoría elegida y descarta resultados de otra foto|APROBADA|browser-locked|
|429|`ui-ux/product-card-colors.spec.js:16` · tarjeta cambia foto inmediatamente y conserva color en 320px|APROBADA|cards-browser|
|430|`ui-ux/product-card-colors.spec.js:16` · tarjeta cambia foto inmediatamente y conserva color en 390px|APROBADA|cards-browser|
|431|`ui-ux/product-card-colors.spec.js:16` · tarjeta cambia foto inmediatamente y conserva color en 768px|APROBADA|cards-browser|
|432|`ui-ux/product-card-colors.spec.js:16` · tarjeta cambia foto inmediatamente y conserva color en 1024px|APROBADA|cards-browser|
|433|`ui-ux/product-card-colors.spec.js:16` · tarjeta cambia foto inmediatamente y conserva color en 1280px|APROBADA|cards-browser|
|434|`ui-ux/product-card-colors.spec.js:16` · tarjeta cambia foto inmediatamente y conserva color en 1440px|APROBADA|cards-browser|
|435|`ui-ux/product-card-colors.spec.js:16` · tarjeta cambia foto inmediatamente y conserva color en 1920px|APROBADA|cards-browser|
|436|`ui-ux/product-card-quick-edit.spec.js:31` · tarjeta ordenada y stock por color en 320x740|APROBADA|cards-browser|
|437|`ui-ux/product-card-quick-edit.spec.js:31` · tarjeta ordenada y stock por color en 390x844|APROBADA|cards-browser|
|438|`ui-ux/product-card-quick-edit.spec.js:31` · tarjeta ordenada y stock por color en 600x960|APROBADA|cards-browser|
|439|`ui-ux/product-card-quick-edit.spec.js:31` · tarjeta ordenada y stock por color en 768x1024|APROBADA|cards-browser|
|440|`ui-ux/product-card-quick-edit.spec.js:31` · tarjeta ordenada y stock por color en 1024x768|APROBADA|cards-browser|
|441|`ui-ux/product-card-quick-edit.spec.js:31` · tarjeta ordenada y stock por color en 820x1180|APROBADA|cards-browser|
|442|`ui-ux/product-card-quick-edit.spec.js:31` · tarjeta ordenada y stock por color en 1180x820|APROBADA|cards-browser|
|443|`ui-ux/product-card-quick-edit.spec.js:31` · tarjeta ordenada y stock por color en 1366x768|APROBADA|cards-browser|
|444|`ui-ux/product-card-quick-edit.spec.js:31` · tarjeta ordenada y stock por color en 1440x900|APROBADA|cards-browser|
|445|`ui-ux/product-card-quick-edit.spec.js:31` · tarjeta ordenada y stock por color en 1920x1080|APROBADA|cards-browser|
|446|`ui-ux/product-card-quick-edit.spec.js:67` · una actualización remota conserva el borrador y detecta el conflicto al guardar|APROBADA|cards-browser|
|447|`ui-ux/product-card-quick-edit.spec.js:82` · cambiar de cuenta descarta la cantidad pendiente y el color de la sesión anterior|APROBADA|cards-browser|
|448|`ui-ux/product-card-quick-edit.spec.js:98` · guardar un estado propio conserva la cantidad pendiente de p-reloj|APROBADA|cards-browser|
|449|`ui-ux/product-card-quick-edit.spec.js:98` · guardar un estado propio conserva la cantidad pendiente de p-pulsera|APROBADA|cards-browser|
|450|`ui-ux/product-card-quick-edit.spec.js:109` · colección puntual y visibilidad desde tarjetas 390|APROBADA|cards-browser|
|451|`ui-ux/product-card-quick-edit.spec.js:109` · colección puntual y visibilidad desde tarjetas 1440|APROBADA|cards-browser|
|452|`ui-ux/product-card-quick-edit.spec.js:133` · un controlador aún cargando restaura la selección confirmada de producto y colección|APROBADA|cards-browser|
|453|`ui-ux/product-editor-final.spec.js:121` · quitar una opción nueva no pierde cantidades de una matriz histórica de stock|APROBADA tras corrección|editor-regressions-final|
|454|`ui-ux/product-editor-final.spec.js:6` · galería: eventos sin cambios conservan nodos y foco|APROBADA|performance-after-final|
