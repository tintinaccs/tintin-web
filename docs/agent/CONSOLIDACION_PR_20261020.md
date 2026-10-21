# Consolidación autorizada de los nueve PR abiertos

Codex /root. El titular pidió «MERGEA TODO» y «continua». Base: dc6da947a4d0d88de4dc7f1b353faa5982c242f7, que conserva las entregas1175,1179,1183 y1184. Se integran las historias mediante merges normales en una rama aislada; el PR de consolidación pasará las comprobaciones obligatorias antes de publicar. Los originales se cerrarán como incorporados sólo después de acreditar el merge y la publicación del conjunto.

| PR | Tratamiento en el candidato |
| --- | --- |
|929|Cutover ya presente: dominio, Auth, App Check, consumidores y espera de redirects conservan la implementación vigente. Merge sin cambios de tráfico, DNS o catálogo.|
|1122|Recuperación al cerrar Google, OTP automático, límites por variante y consulta del producto antes de sumar, recomendaciones con elección de opciones y limpieza del punto al cambiar entrega. Se conserva la selección de fotos más específica vigente. Se excluyen reglas antiguas de Historia, reloj y orden móvil de la ficha que chocan con el diseño posterior y quitan el espacio de los botones.|
|1134|Validación de Rules e identidad del mismo SHA antes del despliegue manual; Chromium en Diagnóstico Maestro. Se mantienen entorno y confirmación de Rules. Este merge no ejecuta ese despliegue.|
|1146|Comprobación de versión al retomar pestaña, historial y conexión; mantiene marcador por página, recuperación App Check, aviso único, decisión del usuario y borradores. El reloj conserva cover vigente.|
|1154|Favorito personal separado del Me gusta, sin duplicar avisos ni contadores. Dirección principal ya implementada: conserva el vacío actual y evita resucitar la dirección anterior.|
|1156|La revisión cruda, comparación estable y concurrencia ya están cubiertas por el editor1175. Se reutiliza productFingerprint y su suite, sin añadir otro comparador. ID canónico y guardado legado sin enviar variants undefined; nuevas regresiones de colores disponibles.|
|1170|Fuente Apps Script y regresión para retirar líneas WEB_ ausentes del snapshot completo, conservando manuales, gastos, fórmulas y formato. No instala el motor ni modifica hojas reales.|
|1180|Encabezados rosa difuminados, selección como bloque hermano, editor autenticado y filtro de avisos de prueba; navegador local por defecto y servidor previo a los gates.|
|1182|Tarjetas editables por color, permisos, huella de concurrencia, borradores y cambio de cuenta; feed e historia Instagram con fallback, módulos locales responsive y bundle canónico de Nosotros. Incluye el avance concurrente9d58fca0 con rutas, servidor y contratos.|

## Evidencia del candidato

PASS_LOCAL:507 pruebas Node de dominios afectados;54 Chromium de tarjetas/editor/avisos;16 Historia y reloj;12 Perfil, sin reintentos. Auditorías de integraciones, imágenes, aislamiento de acceso, tipografía, colores, accesibilidad estática, integridad CSS y contratos UI aprobadas. La ampliación ejecutó1750 casos Node:1746 pasaron y cuatro se aislaron (reloj OTP, dos hashes CSP anteriores a regeneración y lista antigua sin Instagram). Los29 casos de esos tres archivos pasaron al corregir la expectativa de la nueva sección y regenerar CSP. Otros39 Chromium de marca, Maestro y apertura de ficha pasaron; el barrido responsive ampliado ejecutó221 casos:208 pasaron inicialmente; los13 fallos aislados se cerraron con16 casos de Historia/reloj,12 de Perfil y25 de galería/ficha aprobados. Se conserva el contrato actual de tarjeta móvil con botones dentro de su superficie. CI y producción permanecen PENDING hasta obtener evidencia del SHA final. Los resultados históricos de los PR originales no se heredan.

Se actualizan expectativas obsoletas sin relajar presupuestos: abrir producto por su botón accesible en lugar del centro ocupado por controles; badge Agotado con active=true/stock0; atributos de color agotado independientes del orden; vacío de dirección vigente. La prueba de ocho OTP diarios fija el reloj al mediodía para no cruzar el cambio de cuota UTC durante sus ocho intervalos simulados; mantiene200→429 y ocho envíos exactos. No se modifica el límite de producción.

Caché, bundles, CSP, plan protegido y manifiestos se regeneran desde sus autoridades, con URL nueva para los bytes modificados. El plan compara las huellas contra main vigente; conserva78 registros y544 archivos. No se alteran protecciones de rama, revisores, reglas Firestore, credenciales ni umbrales para forzar la integración.

## Límites de publicación

Merge y despliegue web están autorizados. La publicación de código no acredita la instalación de Apps Script, la conexión profesional de Instagram/secretos Meta, OAuth real, notificación física, compras, pagos ni escrituras comerciales. No se ejecutan esas operaciones. Instagram conserva su enlace/fallback si no existe conexión. Las colas históricas de datos y tareas comerciales no quedan completadas por integrar estos PR.


## Seguimiento del control de bienvenida

La CI39519261730 confirmó build reproducible y sin drift, dominio, CSS e integraciones. El siguiente contrato detectó una referencia literal histórica en el auditor de confiabilidad, aunque los dos consumidores usan la misma URL vigente. El auditor lee ahora la versión canónica del baseline y mantiene todas las otras condiciones. audit:reliability y7 regresiones de actividad pasan. Se regeneran plan y manifiestos; CI del nuevo SHA y publicación siguen PENDING hasta evidencia remota. La desconexión temporal del entorno se recuperó sin descartar los commits publicados.


## Conciliación del avance concurrente y del fixture

Incluye fb95aa72 de1182 mediante merge normal. La cobertura de Pages pasa a scripts/lib/rutas-pages.js, consumida por rutas, CSP y auditor final; el conjunto de100 rutas coincide exactamente con el candidato previo. Trece pruebas Node de rutas, monitor e iconos pasan. Se conservan AGENTS y documentos de coherencia añadidos en ese avance.

La CI39520598235 aprobó contratos, operaciones, Rules, Maestro y navegación pública antes de detectar un consumidor de prueba pendiente: quantity-browser importaba el comparador retirado de1156 aunque el renderer actual no lo usa. Se migra el fixture al renderer canónico y la regresión de etiquetas/suma/readonly/reinicio pasa en Chromium sin reintentos. No se restaura una implementación paralela ni se modifica el producto. Se repiten los controles completos del nuevo SHA.1182 queda temporalmente borrador para evitar dos publicaciones paralelas del mismo conjunto.


## Último avance de marca

Se incorpora también cb8e28ee de1180 mediante merge normal: el logo desktop/tablet conserva el PNG original y blanco frente al tinte global. Se mantienen las regresiones reforzadas de marca y superficies. La hoja modificada usa una URL nueva consolidated-2 y ambos bundles se regeneran desde sus fuentes; no se reutiliza la URL de la vista previa previa. CI y producción del nuevo SHA quedan pendientes hasta evidencia remota.1180 permanece borrador para publicar el conjunto por1185.


## Conciliación final del smoke de encabezados

Codex /root: CI39522066942 del candidato fb95aa72 aprobó los contratos y187/187 geometrías, pero su smoke final todavía exigía encabezado desktop blanco sin degradado. Ese supuesto contradice el rosa difuminado aprobado y las regresiones de marca. El smoke comprueba ahora el degradado exacto F8AACA/FDECF2 con94% de opacidad, blur18 sólo de fondo y contenido sin filtro; conserva blanco, bordes, opacidad y acciones de las otras superficies. No se cambia CSS ni producto. El candidato conjunto d456bbeb pasó1755/1755 Node y114/114 Chromium sin reintentos; la CI del nuevo SHA y producción siguen pendientes.
