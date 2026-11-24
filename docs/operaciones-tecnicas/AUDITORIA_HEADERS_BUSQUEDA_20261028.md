# Headers, navegación y búsqueda — 28 de octubre de 2026

Implementación y evidencia: Codex `/root`, base `5a2ea0f6`, rama local `work`.
Alcance: navegación pública compartida y conexiones con catálogo, carrito y cuenta.
La instrucción posterior de la titular prevalece: **el header y la barra móvil
permanecen visibles al abrir la búsqueda**, incluso durante las pruebas de teclado.
No se realizó despliegue ni escritura comercial en servicios externos.

## 1. Diagnóstico inicial

| Severidad | Ubicación / evidencia | Consecuencia y corrección |
| --- | --- | --- |
| HIGH | `control-paneles.js:syncViewport` reducía `--tt-panel-nav-space` de108 px a12 px al detectar teclado; `encabezado-movil.css` mantiene la barra abierta en una capa superior | Panel y navegación competían por el mismo espacio. Mantener la reserva de navegación y calcular su borde inferior desde el mismo viewport visual que utiliza el panel. No aumentar capas ni ocultar el header. |
| HIGH | `lockScroll` aplicaba `touchAction:none` al body fijo | El bloqueo se transmite a los descendientes e impide gestos de desplazamiento. Conservar body fijo/restauración de estilos y permitir los gestos internos. |
| MEDIUM | `control-busqueda.js:searchProducts` ordenaba primero por stock y cortaba en diez | Un exacto agotado podía quedar detrás de alternativas; coincidencias posteriores no eran accesibles. Exactos primero; mantener stock como desempate del resto y presentar todas las coincidencias del catálogo compartido. |
| MEDIUM | `renderResults` interpretaba un índice vacío como carga pendiente | Un catálogo vacío volvía a solicitar/renderizar carga. Separar carga confirmada de cantidad de resultados. |
| MEDIUM | `ensureProductsForSearch` descartaba opciones; el demand loader sólo ejecutaba una vez | Reintentar no transmitía `force`; reabrir en una página informativa podía conservar un snapshot indefinidamente. Propagar opciones y consultar el store con su TTL/single-flight en cada apertura. |
| MEDIUM | La animación precedía al foco; el controlador cancelaba debounce al pulsar flechas sin ejecutar la consulta pendiente | Riesgo de perder activación del teclado en Safari y de navegar resultados de la consulta anterior. Foco dentro del gesto de apertura, sin mover de nuevo el cursor al terminar; ejecutar consulta pendiente antes de navegar. |
| MEDIUM | Publicaciones repetidas del mismo catálogo reconstruían los nodos de resultados | Se perdía scroll y estabilidad. Ignorar snapshots idénticos conservando debounce y DOM actuales. |
| LOW | URL vacía de imagen se resolvía contra location.href | El navegador intentaba cargar el documento como imagen. Mostrar placeholder para URL ausente o imagen fallida, sin inventar fotos. |
| LOW | Nombre y metadatos usaban `nowrap`/elipsis; input carecía del rol combobox | Nombres truncados y relación accesible incompleta. Permitir líneas, añadir limpieza explícita, rol y estado expandido. |

La evidencia anterior procede del código y de pruebas locales. No se presenta una
emulación del viewport como reproducción certificada en un iPhone real.

## 2. Inventario y archivos modificados

Autoridades inspeccionadas:

- `entrada-navegacion-publica.js`, `recursos-navegacion.js`, `registro-paneles.js`, `control-paneles.js`: montaje, recursos, máquina de estados, overlays, foco y scroll.
- `escritorio/encabezado-escritorio.css`, `tableta/encabezado-tableta.css`, `movil/encabezado-movil.css`, controladores/indicadores por dispositivo: navegación excluyente por ancho.
- `panel-busqueda.js`, `control-busqueda.js`, `busqueda-productos.mjs`: markup, índice y relevancia compartida con catálogo.
- `estado-productos.js`, `catalogo-publico-api.js`, `politica-visibilidad-catalogo.js`, `functions/api/public-catalog.js`: transporte, TTL, normalización, publicación, categorías y proyección pública.
- `estado-ruta.js`, `navegacion-autenticacion.js`, runtime canónico del carrito y registro de paneles: rutas activas, sesión, roles, contador y acciones reales.
- `functions/product.js`, metadatos de catálogo y generadores de rutas/CSP: fichas, canonicals y comportamiento público.

Cambios funcionales:

| Archivo | Cambio |
| --- | --- |
| `js/components/navigation/compartido/control-paneles.js` | Coordenadas compartidas de viewport, reserva móvil permanente, atributo de búsqueda activa, foco temprano y scroll táctil sin desbloquear el fondo. |
| `css/components/navigation/movil/encabezado-movil.css` | Posición de barra visible coordinada con viewport visual durante búsqueda; vuelve a su geometría normal al cerrar. |
| `css/components/navigation/compartido/paneles.css` | Límite de altura de búsqueda de escritorio según el viewport disponible, también en ventanas/tablets anchas con teclado. |
| `css/components/navigation/compartido/busqueda.css` | Cuadrícula con limpiar/cerrar, texto multilínea, input de16 px para evitar zoom automático de foco en Safari. |
| `js/components/navigation/compartido/panel-busqueda.js` | Botón accesible de limpieza. |
| `js/components/navigation/compartido/control-busqueda.js` | Exactos primero, todas las coincidencias, alternativas aproximadas etiquetadas, catálogo vacío, errores/reintento, descarte de UI tardía tras cierre y navegación de teclado consistente. |
| `js/components/navigation/compartido/carga-navegacion.js` | Revalidación mediante el store al abrir nuevamente, manteniendo carga diferida y promesas compartidas. |
| `js/core/store/estado-productos.js` | Propaga opciones de recarga al store existente. |
| `js/cargador-pagina.js` | Evita que load/pageshow inicial tardío reinicie scroll después de utilizar un panel; preserva resets explícitos y bfcache. |
| `scripts/auditar-firestore-lecturas-presupuesto.js` | Comprueba la carga del controlador realtime en su asignación real; antes dependía de un literal de una función ajena. No cambia presupuesto ni acceso. |
| `tests/catalog/search-authority.test.mjs`, `tests/catalog/search-responsive.spec.js`, `tests/navigation/header-responsive.spec.js` | Exactos agotados, más de diez resultados, barra visible con teclado simulado, limpieza/foco, scroll, vacío/error/reintento y nuevo límite geométrico. |

Los demás cambios JS/HTML son referencias transitivas a esas mismas autoridades:
`recursos-navegacion.js`, `inicio-control-paneles.js`, `entrada-navegacion-publica.js`,
`inicio-navegacion-publica.js`, `tienda.js` y el generador
`scripts/sincronizar-inicio-navegacion-publica.js`.
Los consumidores HTML actualizados son: `404`, `about`, `cambios-devoluciones`,
`catalogo`, `checkout`, `collections`, `contact`, `envios`, `index`, `login`,
`perfil`, `preguntas-frecuentes`, `privacidad`, `product` y `terminos`.
Los bundles `css/generated/inicio.css` y `nosotros.css`, baseline de caché,
`diagnostic-manifest.json` y `site-version.json` se producen desde los generadores
existentes. No se mantiene una segunda implementación ni un CSS derivado manual.

## 3. Frontend y comportamiento final

Una sola máquina de estados conserva menús, cuenta, carrito, notificaciones y
búsqueda. La barra de navegación móvil no se oculta al buscar. La barra
ocupa su franja separada en el borde inferior del viewport visible; con teclado
puede desplazarse junto a ese borde, pero **no invade los resultados**. Este es el
ajuste necesario para cumplir la instrucción posterior de mantenerla visible.

El panel tiene scroll independiente, nombres completos e imágenes con proporción
conservada. Con áreas muy bajas, una tarjeta larga puede ocupar más de una
pantalla del scroller: su principio y su final deben seguir siendo alcanzables.
Cerrar/Escape libera foco, restaura el disparador y la posición del documento,
limpia la consulta y retira backdrop/inert mediante la autoridad existente.
Con menos de320 px de altura visual, la barra conserva iconos y controles de44 px,
reduce su altura y oculta únicamente sus etiquetas visuales (los aria-label
permanecen). La búsqueda reduce rellenos y mantiene una región desplazable
positiva incluso con200 px de viewport. Al recuperar espacio vuelve a su tamaño
normal. No se añade otra suscripción de resize: se reutilizan resize/scroll de
visualViewport y la agrupación por requestAnimationFrame ya existentes.

## 4. Backend e integraciones

**No hay cambios de Functions, Firestore, índices, reglas, Auth, Storage ni Apps
Script.** Se inspeccionó la API pública real: lista blanca de campos, publicación,
identidad de documentos, rate limit, manejo de errores y caché edge existente.
La corrección de `force` pertenece al adaptador frontend que llama al store.
No hay endpoint nuevo, dependencia ni permiso público adicional.

La API compartida mantiene TTL edge de10 s y TTL local de10 s. La búsqueda no hace
una petición por cada tecla: debounce de120 ms sobre el catálogo ya compartido;
las lecturas concurrentes se reúnen en el single-flight existente. Reabrir vuelve
al store, que decide por TTL. Las respuestas pintan la consulta vigente, no una
captura de la consulta con que empezó la descarga.

## 5. Búsqueda e indexación

Lectura no destructiva de `https://tintinaccs.com/api/public-catalog?resource=products`
durante esta sesión: **265 productos, 265 IDs únicos,0 con active:false**, y sin los
campos privados comprobados (`costPrice`, `supplier`, `internalNotes`). **No existe
un nombre exactamente ELIORA en esa respuesta**. Las pruebas de prioridad usan
fixtures explícitos, nunca productos agregados al catálogo real.

Se conserva la autoridad existente de nombres, precios comerciales/variantes,
fotos, publicación y categorías. La búsqueda normaliza tildes, mayúsculas,
espacios y términos, con aproximación de un error como criterio secundario.
Resultados aproximados llevan la etiqueta correspondiente. No se crean índices
de Firestore: este flujo no ejecuta consultas textuales contra la base de datos.

La búsqueda del header no genera URLs de consultas ni páginas indexables. El
catálogo mantiene su canonical y la ficha sigue utilizando su renderer/metadatos
existentes. No se modifica SEO global, sitemap ni estrategia de redirecciones.

## 6. Responsive y navegadores

Breakpoints conservados del contrato: móvil320–767px, tablet768–1024px,
escritorio desde1025px. Una tablet ancha utiliza el header de escritorio y conserva
el límite de búsqueda del viewport visual.

Se ejercitan tamaños intermedios y extremos con Chromium Linux disponible en el
entorno. La batería de búsqueda incluye320×568,390×844,768×1024,844×390,
1024×768,1180×820,1366×768,1440×900,1920×1080 y3840×2160, según cada caso.
El header añade los bordes767/768/769/1024/1025, landscape,2560px y otros tamaños.
El auditor responsive recorre12 anchos y13 rutas públicas.

Los cambios de teclado se simulan mediante eventos resize/scroll de un
visualViewport de prueba. El desplazamiento táctil usa eventos CDP sobre el
scroller real en un contexto hasTouch con viewport nativo, independiente de la
simulación del teclado. **No acredita Safari/iOS, Chrome Android físico ni navegador
integrado de iPhone.** Tampoco sustituye pruebas físicas de notch/safe areas o zoom.

## 7. Pruebas

| Comando / batería | Resultado observado |
| --- | --- |
| `npm run build` | PASS: Pages, rutas, CSP, diagnóstico e integridad/cache;380 archivos versionados y67 cargas dinámicas. |
| `npm run test:products-sync` | PASS:222 pruebas. |
| `npm run test:cart-persistence` | PASS:30 pruebas. |
| `npm run test:accounts` | PASS:72 pruebas. |
| `npm run test:commerce` | PASS:463 pruebas de comercio/checkout/pagos/carrito/Auth (algunas se superponen con las suites específicas). |
| `node --test tests/auth/*.test.mjs` | PASS:79 pruebas. |
| `node --test tests/navigation/*.test.mjs` | PASS:18 pruebas, incluida carga tardía tras usar navegación. |
| Unitarios específicos de búsqueda/caché/autoridad | PASS:12 pruebas; también incluidos en productos. |
| `header-responsive.spec.js` |83 casos del header aprobados;15 casos relevantes de paneles/foco/teclado/gestos reejecutados al cierre,15 aprobados. |
| `search-responsive.spec.js` |23/23 aprobadas en la ejecución completa final. Tras ampliar la cobertura a200px de altura visual, 8/8 recorridos de teclado/scroll aprobados al cierre;15/15 de paneles aprobados. |
| `npm run audit:unified-navigation` | PASS: arquitectura modular, shell, contrato unificado, responsive12 anchos/13 rutas y búsqueda real sobre fixtures. |
| `npm run audit:headers` | PASS:0 problemas en14 tamaños de320 a1920px. |
| `npm run audit:public-shell` | PASS: shell y3 pruebas del generador/entrada/estilos. |
| `npm run audit:architecture-contracts` | PASS. |
| `npm run audit:styles` | PASS. |
| `npm run audit:phase10` | PASS:12 comprobaciones de accesibilidad. |
| `npm run audit:phase11` | PASS:1179 comprobaciones de SEO/publicación. |
| Sintaxis JS y `git diff --check` | PASS. |

Regresión ampliada (loaders, geometría inicial, marca móvil, footer, perfil y
avisos de versión): **82 aprobadas,8 fallidas,1 omitida**. Las ocho fallas son
el marcador `data-tt-image-phase5` del logo de404 y la superficie inicial de Login
con tamaño0 en siete anchos. Se contrastaron ambas causas ejecutando los casos
404/320 contra una copia intacta de `5a2ea0f6` en otro servidor: **ambos fallan
igual en la base**. No son pruebas nuevas fallidas por los cambios de búsqueda.
La omitida requiere `TT_PAGES_FUNCTIONS_PREVIEW`; no se inventó un preview.

Las ejecuciones intermedias de pruebas nuevas detectaron fixtures que intentaban
pulsar un header autooculto al desplazar la página, mediciones durante la
animación/inercia táctil y lecturas de geometría entre dos frames distintos.
La recuperación de red se habilita al pulsar Reintentar, evitando una recuperación
automática previa al clic que hacía desaparecer el botón bajo prueba. Se corrigieron los recorridos sin retirar los controles de foco,
visibilidad, límites, scroll o contenido. No se declara verde la ejecución
intermedia combinada que registró esas fallas.

Las pruebas de navegador usan catálogos de prueba interceptados explícitamente;
no crean productos permanentes. Los scripts standalone que no aceptan el
executablePath del entorno utilizaron un enlace temporal al Chromium instalado,
sin cambiar el navegador/dependencias del proyecto.
No hay comandos independientes de lint ni typecheck en package.json; se utiliza
validación de sintaxis de los JS modificados, gates canónicos y build de Pages.
No se añadieron dependencias ni se ejecutó ningún comando de despliegue.

## 8. Seguridad, sesión y carrito

Se conservan normalización de texto, URLs de imagen seguras, escape por textContent,
proyección pública de campos, filtro de visibilidad/publicación, contratos de precio
y stock, suscripción de sesión y persistencia de carrito. Las pruebas de cuentas,
Auth y comercio emplean los fixtures/mocks existentes. No se realizaron compras,
pedidos, usuarios, correos ni escrituras de prueba en producción.

No hay una sesión real autenticada disponible en este entorno. Las verificaciones
de roles y sesión son de contrato/locales; no se afirma una prueba manual de
Super Admin/clienta con credenciales de producción.

## 9. Pendientes y límites

- Validar teclado real en Safari de iPhone y Chrome Android, incluyendo orientación,
  cierre/reapertura, safe areas, zoom y navegadores integrados.
- Validar recorridos autenticados reales y persistencia del carrito en dispositivos
  físicos con cuentas de prueba autorizadas.
- Producción mantiene su versión publicada hasta una publicación autorizada.
- No se certifican datos privados, conexión privilegiada a Firestore/Sheets ni
  consola del proveedor; la comprobación externa fue la API pública de lectura.
- Persisten las dos causas preexistentes de la regresión ampliada descritas arriba.
- Un sondeo externo posterior de ficha y colecciones no pudo completarse: el proxy
  del entorno devolvió503 con `upstream connect error`. No demuestra un fallo del
  sitio ni certifica esos recorridos en producción; se conserva la lectura inicial
  del catálogo como evidencia puntual, no como monitor de disponibilidad.

## 10. Estado final

**PASS_LOCAL** para la implementación y los casos específicos documentados.
La regresión ampliada conserva las fallas preexistentes descritas; producción y
dispositivos físicos permanecen **NOT_VERIFIED**. Ver secciones 7 y 9.
Sin despliegue, cambios destructivos ni modificación de lógica comercial.

## Seguimiento del PR #1267

La titular autorizó merge automático y seguimiento. PR1267 se creó sin borrador
contra5a2ea0f6; árbol remoto verificado idéntico al local. El candidato inicial
27bfe553 pasó preflight, CodeQL y preview Cloudflare. CI40696772289 intento1
falló en Comercio crítico (job122846087039) por la medición del comienzo de una
tarjeta respecto de la altura externa del scroller, sin descontar padding/margen.
La prueba ahora recorre explícitamente sus dos extremos dentro del scroller.
El gesto táctil se comprueba en un caso independiente con viewport nativo y
contexto hasTouch; tres repeticiones aprobaron. No se eliminan verificaciones
ni se aumentan tolerancias. Se mantiene auto-merge protegido y un monitor horario
por sondeo; el resultado terminal del siguiente SHA debe verificarse por separado.

La restauración de scroll del controlador compartido se hace explícitamente
instantánea y no desplaza una superficie nueva si se abrió antes de su callback.
Esto evita heredar una animación de desplazamiento al liberar el modal. Se
renuevan su URL inmutable, bootstrap y plan protegido desde las autoridades.
Los8 escenarios de viewport aprobaron tras ese ajuste.

Verificación final de esta corrección:23/23 casos Chromium de búsqueda y18/18
Node de navegación;15/15 recorridos del controlador compartido aprobados.
Se preservan los reinicios de entrada, explícitos y bfcache, evitando únicamente
load/pageshow inicial tardío tras usar navegación. Consulta administrativa de
branch-protection403 por alcance del conector: no se modifican protecciones.
