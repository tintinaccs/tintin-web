# Fase 02 — Responsive, interacción y accesibilidad públicas

Fecha: 2026-11-02 UTC. Autor: Codex /root, GPT-6, Linux Cloud.
Base: **5b694fe4adaa9e356f3c2f8e74d2de5ca0f5adde** (#1308, fusionada).
Rama: `fix/phase02-public-responsive-20261102`.

La titular redefinió explícitamente la fase 02 como reparación visual pública.
El antiguo alcance de seguridad se conserva como **03A**, antes del comercio
03B. Los HIGH de la auditoría 01 permanecen abiertos; esta fase no repara Rules,
pedidos, precios, stock, autenticación ni persistencia comercial.

## Base y autoridades

Se consultaron main y PR abiertas de nuevo. main coincidía con la base; #1306
seguía abierta en `976601a99772e5390448b8da2edda79d9d6c1429`, sin modificarla.
La fase 01 tiene CI posterior 41370328636/1, CodeQL 41370329571/1 y salud de
producción 41370330002/1 SUCCESS. Son evidencia de su SHA, no del candidato 02.

Se respetan DESIGN.md, identidad, Montserrat, tokens semánticos y componentes
existentes. Instrucciones leídas selectivamente: tintin-design-quality,
tintin-accessibility, frontend-design, ui-ux-pro-max y design-taste-frontend
(directorio taste-frontend). La consulta de UX sobre foco devolvió Focus States.
Se usan como referencia del diseño existente; no se introducen paletas, fuentes,
assets externos, animaciones, dependencias ni una composición de plantilla.
El catálogo nativo executor volvió a devolver `skills: []`: leer esos archivos
no demuestra activación nativa. El bloqueo de 00 sigue abierto.

Autoridades modificadas: tema-unificado-tintin.css para foco público,
product-maintenance.css para sus controles más específicos, cargador-pagina.js
para posición de entrada, y calidad-interfaz.js para el respaldo de recarga.
No hay un nuevo sistema de diseño ni una segunda implementación de scroll.

## Problemas demostrados y reparación

| ID / severidad | Evidencia anterior | Corrección / consumidores |
| --- | --- | --- |
| V02-01 MEDIUM | En cargador-pagina.js, load/pageshow sólo respetaban haber abierto un panel. Cuatro regresiones nuevas de pointerdown, keydown, wheel y touchstart terminaban con scroll 0 en vez de 540 | La interacción consume la posición inicial. Los listeners son pasivos y de una sola ejecución. Se conserva el reset explícito y la entrada por navegación/bfcache; afecta a todos los consumidores del cargador |
| V02-02 MEDIUM | topOnReload de calidad-interfaz.js volvía a poner 0 en una recarga aunque el cargador ya había resuelto la entrada; una quinta regresión nueva falló | El respaldo no escribe si existe TintinPageScroll. Sigue disponible cuando el cargador no está presente. Evita que la carga tardía de UI Quality interrumpa lectura/edición |
| V02-03 MEDIUM | Tres pruebas de foco real fallaron en login, checkout y producto: rosa o rosa translúcido sobre blanco. Contacto ya tenía foco oscuro | El tema público y las reglas específicas de la ficha usan color-text-primary para el contorno de teclado. Se conservan botones rosas, marca, estados, sombras y tokens; no se alteran estilos administrativos |
| V02-C01 CORRECT | La ficha ya alinea sus columnas al inicio, mantiene una galería sticky y reserva proporción. Doce casos con descripción de 3100 caracteres y precios extensos no desbordan; el espacio interior final de la galería no supera 32 px | Se conserva su estructura. No se estira la fotografía ni se oculta/reduce la descripción para aparentar que cabe |

Las capturas de foco son fixtures del componente real y su cascada, sin datos
de clientas. Los casos de scroll ejecutan el tramo real de entrada del cargador
en navegador con una imagen cuya respuesta se retiene hasta después de la
interacción: se prueba un load real tardío, no sólo un evento simulado.

## Superficies y dispositivos

El inventario canónico sigue siendo el de 01. Se revisaron las 16 entradas HTML
públicas, incluida la compatibilidad nosotros: Inicio, Catálogo, Colecciones,
Producto, Checkout, Login/registro, Perfil/pedidos, About, Contacto, Envíos,
Cambios/devoluciones, Preguntas frecuentes, Términos, Privacidad y404. Buscar,
resultados, categorías, filtros, carrito, cuenta y menús son componentes del
shell compartido; no se inventan páginas independientes para ellos.

- Matriz canónica:320×568,360×640,390×844,768×1024,1024×768,1280×720,
  1440×900 y1920×1080. El auditor incluye18 documentos, también admin aislado.
- Casos nuevos de ficha:320,390,600,767,768,820,844,1024,1025,1280,1440 y1920px,
  con alturas390–1080. Incluyen límites y anchos intermedios, no sólo referencias.
- Se mantienen texto largo, precios actual/anterior, object-fit:contain,
  márgenes, controles de 44 px y alineación inicial de foto/información.
- El smoke comprueba18 rutas, loader, recursos, errores JS locales y redirecciones;
  también abre Buscar/Cuenta/Carrito/menús en móvil, tablet y escritorio.
- Formularios y cuenta/consentimiento tienen las pruebas existentes de geometría,
  foco y recuperación. Las transacciones y sesiones comerciales no se simulan
  como evidencia de compras reales ni se prueban creando usuarios/pedidos reales.

## Pruebas y límites

Resultados locales que ya terminaron:

- Base:80 pruebas de navegador y144/144 geometrías PASS, antes de corregir.
- Scroll:10/10 pruebas Node PASS después; cinco de ellas son regresiones nuevas.
- Suite canónica de UI/UX:20/20 casos nuevos PASS, registrados una sola vez desde
  phase8-ui-ux.spec.js mediante public-content-reflow.cases.js.
- Interacciones:49 pruebas PASS:39 de registro con transporte simulado, 3 de
  historial paginado y 7 de helpers UI/a11y (foco, diálogos, errores, offline,
  carga y movimiento reducido). No equivalen a sesiones o compras reales.
- Smoke final:18 rutas y ciclos de paneles PASS.
- Gates de estilos, colores, arquitectura, shell público, producto, UI/UX y
  accesibilidad PASS. Colores:153 tokens públicos y36 administrativos conservados.
- Protección local PASS:78 registros/544 archivos; plan canónico de32 archivos
  y28 registros afectados, validación remota del head final obligatoria.
- Build:pages y caché PASS:410 archivos,67 cargas dinámicas; ninguna URL duplicada
  ni URL inmutable reutilizada con bytes diferentes.

Geometría final aislada: **PASS_LOCAL, 144/144 combinaciones**, exit0.
La ejecución concurrente previa tuvo timeouts de12 s y fue interrumpida. Había
dos vCPU (`cpu.max=200000 100000`), dos suites amplias con dos workers cada una
y otros navegadores simultáneos; load average 13,87. Esas suites locales
interrumpidas NO se cuentan como PASS. El reintento geométrico conserva el
plazo/assertions originales y se ejecuta solo. CI debe terminar por separado.

La primera integración del nuevo spec en el comando npm chocó con los auditores
8/10 que exigen una lista exacta. Se conservó el comando y sus auditores, y los
casos nuevos se registran desde el spec ya canónico. No se debilitó el gate.

Los conteos se solapan. No equivalen a cobertura exhaustiva ni certificación
WCAG. Chromium del sistema 151 y Node 24 en Cloud; CI usa su runtime/Chromium
fijados. Safari/WebKit, teléfonos físicos, lectores de pantalla, CWV de campo y
recorridos autenticados completos con proveedores reales quedan NOT_VERIFIED.
Las herramientas de geometría usan fixtures aislados donde corresponde.

## Publicación reproducible y continuación

Los bundles, URLs HTML, CSP, diagnóstico, site-version y huellas de protección
se derivan de los generadores existentes. Los cambios en tienda.js,
estado-productos y cargadores/consumidores de navegación son sólo propagación
de URLs inmutables: no cambia su lógica comercial. No se agrega un workflow.
La regresión nueva forma parte de test:phase8-ui; scroll forma parte de
audit:public-shell. Se preserva la regla de avisos de actualización sin forzar
recargas ni borrar carrito, borradores o sesiones.

Recibo de PR, head final, run/intento, fusión y verificaciones posteriores:
[PR de esta rama](https://github.com/tintinaccs/tintin-web/pulls?q=is%3Apr+head%3Afix%2Fphase02-public-responsive-20261102).
No heredar un PASS del base ni de un head anterior; no cerrar02 con CI pendiente.
Las capturas se conservan localmente en artifacts/phase02 y en los artefactos
de pruebas de Actions cuando se ejecuta la suite canónica.

Comandos: npm run build:pages; node --test tests/navigation/page-entry-scroll.test.mjs;
npm run audit:public-shell; npm run test:phase8-ui; npm run test:phase10-a11y;
npm run audit:canonical-viewports; npm run test:pages. Para el navegador local
se usó PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium; los scripts directos
usan el adaptador ya existente de 01, sin modificar assertions ni deadlines.

Siguiente trabajo funcional: 03A, autorización de inventario y autoridad Apps
Script. Los siete hallazgos de 01 siguen abiertos. La aceptación global 09 sigue
bloqueada por los HIGH y las verificaciones externas, aunque la publicación
visual alcance PASS_CI.
