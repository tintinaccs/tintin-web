# Revisión de distribución y navegación — 25/10/2026

Responsable: Codex /root (GPT-6). Base: `9839f4597`, posterior a PR1234 y PR1235. Rama local: `codex/admin-mobile-navigation-20261025`. Solicitud: recorrer pantallas y entregar una lista comprobable de problemas para revisión/aplicación posterior; continuar las correcciones de las tres capturas aportadas. No se publica esta rama ni se modifica la autenticación.

## Hallazgos concretos

| Prioridad | Problema y evidencia | Alcance | Estado de esta rama |
| --- | --- | --- | --- |
| MEDIUM | Los botones del inicio estaban desplazados a la izquierda. `ajuste-inicio.css`, regla móvil de `.tt-hero-content`, reservaba un mínimo de 84px a la derecha frente a 16–28px a la izquierda. Las pruebas previas comprobaban contención, pero no el eje del hero. | Inicio, ancho menor a 768px. | Corregido localmente: relleno simétrico, medición del centro real del hero y cinco tamaños nuevos. |
| HIGH | El editor ocultaba el menú lateral mediante dos reglas `tt-product-editor-open` con `visibility:hidden !important`. El menú no podía utilizarse mientras se agregaba/editaba. | Editor, móvil/tablet/escritorio. | Corregido localmente: el lateral conserva su funcionamiento; móvil mantiene el cajón cerrado hasta pulsar la hamburguesa. La navegación inferior sigue oculta durante la edición para no tapar Guardar. |
| HIGH | Al habilitar el lateral, su capa protegida de 300/320 quedaba por debajo del editor de 8500 y del fondo del menú. Mostrarlo sin resolver el orden de capas no permitía usarlo. | Menú sobre editor. | Corregido localmente: lateral 8600, fondo 8550, editor 8500; se comprueba el elemento que realmente recibe el toque. Se reserva el ancho del lateral en pantallas mayores a 540px y se observa su cambio de ancho. |
| HIGH | La captura de iPhone muestra la barra inferior alejada del borde durante el desplazamiento. La barra estaba fija a un borde CSS sin seguimiento explícito de `visualViewport`; el fallo específico no se reprodujo en Chromium. | Superpanel móvil, barras del navegador/teclado. | Seguimiento de altura y desplazamiento del viewport visible implementado. Tres pruebas con tres alturas y tres posiciones de scroll pasan en Chromium. La reproducción/cierre específico en Safari/iPhone sigue NOT_VERIFIED. |

El editor ahora declara `aria-modal=false`: permite acceder a la navegación externa. Las bibliotecas y otros diálogos que sí son modales conservan sus reglas y controles. El guardado pendiente no se elimina ni se sustituye al abrir el menú.

## Recorrido ejecutado

- Auditor canónico de páginas: **126/126 combinaciones aprobadas**, 18 documentos × 7 resoluciones: 320×568, 390×844, 768×1024, 1024×768, 1280×720, 1440×900 y 1920×1080.
- Documentos: inicio, catálogo, producto, colecciones, checkout, contacto, envíos, nosotros/about, preguntas frecuentes, cambios/devoluciones, privacidad, términos, 404, login, perfil, administración e imágenes. `nosotros.html` y `about.html` se contabilizan por separado porque son documentos distintos del inventario canónico.
- Panel: **23 secciones por cada una de 12 resoluciones**, incluidas 320–2560px y orientaciones vertical/horizontal; 26 pruebas del primer recorrido de módulos aprobadas. El recorrido completo posterior de panel/inicio: **70/70 aprobadas**, incluye menú con editor, último control alcanzable sobre la barra, cambios de altura, Imágenes, rotación y cabecera/pie públicos.
- Editor: primera batería **100/102 aprobadas**; dos pruebas antiguas todavía exigían ocultar la navegación de tablet, contrario al pedido actual. Se actualizaron esos recorridos para comprobar lateral disponible y acciones del editor accesibles, conservando la comprobación de cierre. Repetición dirigida: **6/6 aprobadas**, incluidos móvil/tablet, guardado de borrador, foco y validación. No se declara aprobada la ejecución inicial con dos fallos.
- Build Pages, rutas, CSP, diagnóstico y caché aprobados sobre las fuentes funcionales finales. Preflight de sintaxis/imports aprobado. Los manifiestos se regeneran después de cerrar la evidencia.

Las 23 secciones del panel: Inicio, Estadísticas, Usuarios, Ventas locales, Clientes que compraron, Espejos Sheets, Pedidos, Mayoristas, Productos, Colecciones, Mensajes, Auditoría, Flujo de conexiones, Diagnóstico, Correos, Notificaciones push, Páginas, Configuración, Roles/permisos, Apariencia, Importar, Reseñas y Me gusta.

## Qué significan y qué no significan los resultados

El barrido usa HTML/CSS y controladores locales existentes, con datos de prueba cuando corresponden. No necesita credenciales productivas ni permite a visitantes reales entrar al panel. El recorrido de módulos activa sus superficies para comprobar geometría y campos visibles; no acredita que cada integración de negocio haya cargado datos reales o ejecutado sus operaciones.

El auditor de páginas detecta desborde, superficies vacías y geometría del shell. **No prueba por sí solo que cada detalle estético de todos los estados esté perfecto.** Las capturas revisadas se concentran en Inicio390, dashboard390 y menú/editor390/768; no se afirma inspección visual individual de las126 combinaciones.

### Pendientes explícitos

1. Safari/iPhone real: comprobar barra al desplazar las barras del navegador, con teclado abierto/cerrado y después de girar. WebKit descargó, pero no puede ejecutarse en este entorno por bibliotecas GTK4, Graphene, Harfbuzz ICU, Manette, Hyphen y GLES ausentes; no existe `sudo` para instalarlas. No se simula una aprobación de Safari con Chromium.
2. Estados autenticados con datos reales: permisos efectivos, guardado remoto, errores de APIs, sincronización e integraciones de cada módulo no quedan certificados por este recorrido visual. No se amplían permisos ni se debilitan Auth/App Check/Rules.
3. Estados visuales no presentes en fixtures: formularios poblados por cada integración, mensajes largos inesperados y combinaciones particulares de datos requieren su recorrido correspondiente. No se enumeran como defectos sin reproducción.
4. CI y producción de esta rama: NOT_VERIFIED. Los cambios son locales; la publicación anterior de PR1234/1235 no acredita estas fuentes.

## Evidencia

- `artifacts/canonical-viewports/report.json` y `report.txt`: inventario de126 casos, cero hallazgos de los criterios automáticos.
- `artifacts/global-responsive-review/inicio-390.png`: centrado del hero corregido.
- `artifacts/global-responsive-review/menu-editor-390.png`, `menu-editor-768.png`, `menu-editor-1366.png`: capas de navegación sobre formulario del shell, con movimiento reducido; no son operaciones de negocio.
- `/tmp/tintin-all-pages-audit.log`, `/tmp/tintin-all-modules-audit.log`, `/tmp/tintin-global-shell-regression.log`, `/tmp/tintin-global-editor-regression.log`, `/tmp/tintin-editor-navigation-final.log`: resultados originales y repetición dirigida.
- `/tmp/tintin-shell-build-final.log`, `/tmp/tintin-global-preflight.log`, `/tmp/tintin-webkit-install.log`: build, sintaxis y limitación de WebKit.

No se añaden fallos hipotéticos a la lista. Un resultado local favorable no se presenta como prueba de todas las pantallas físicas ni de producción.
