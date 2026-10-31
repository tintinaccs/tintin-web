# Experiencia móvil del Super Admin — Tintin

Solicitud vigente: prompt maestro recibido el31/10/2026. Evolución del panel
existente, sin sustituir controladores ni cambiar datos, permisos o servicios.

## Fuentes y límites

Inventario canónico: `js/admin/maestro/registro-maestro.js` (26 superficies:
23 secciones base, Maestro y Bienvenida dinámicos, Imágenes externa).
Rutas: `/admin` / `admin.html`, `/admin-images` / `admin-images.html`.
Controladores: admin-app, workspace, comercio, tablero de pedidos y módulos
especializados existentes. No se introduce otra navegación ni otra autoridad.

Teléfono: hasta540px de ancho y orientación horizontal hasta1024px con altura
visible de500px como máximo. Tablet y escritorio mantienen la cascada anterior;
la ficha/visor de usuario son la excepción responsive solicitada en todos los
formatos. Los tamaños describen el espacio disponible, no marcas de teléfono.

## Sistema visual conservado

Montserrat local, tokens `--adm-*` y `--admin-color-*`, que a su vez toman el
esquema publicado `--color-*`. Superficie, texto, borde y acento originales;
estados success/warning/error existentes. Sin paleta nueva, dependencias,
iconos nuevos ni cambios globales del sitio. Radios12–16px ya presentes,
controles táctiles de44px y campos de16px en teléfono para evitar zoom automático.
No se añaden animaciones; se conserva prefers-reduced-motion del panel.

## Inventario y decisión por módulo

| Módulo real | Presentación móvil y conservación |
| --- | --- |
| Maestro | Matriz de capacidades como pares etiqueta/valor, acciones al final; misma matriz y permisos. |
| Inicio | Dashboard, estadísticas y accesos existentes; resumen de pedidos se adapta por registro. |
| Estadísticas | Indicadores y gráficos existentes, filtros y rangos; sin alterar cálculos. |
| Usuarios | Identidad compacta con foto/nombre/correo/estado; contacto, rol, compras y acciones debajo. Selección independiente de apertura. |
| Pedidos | Tablero y tarjetas operativas existentes, etapas, búsqueda, selección y papelera; tabla auxiliar adaptable, mismo editor. |
| Ventas locales | Registros y formularios especializados del libro existente; tablas auxiliares pasan a etiqueta/valor. |
| Clientes que compraron | Tarjetas locales existentes; identidad y contacto, misma separación de cuentas web. |
| Espejos Sheets | Pares de casillas/valores para tablas extensas; consulta sin nuevos escritores. |
| Mayoristas | Cotizaciones y detalle existentes; búsquedas, precios y acciones conservados. |
| Productos | Mosaico, filtros y editor especializado existentes; tabla de respaldo adaptable sin sustituir galería, variantes o inventario. |
| Reseñas | Moderación y contenido existentes; mismos estados y acciones protegidas. |
| Me gusta | Participación existente; sin fabricar actividad ni nuevas operaciones. |
| Colecciones | Tarjetas, asignaciones y formulario existentes; selección y orden conservados. |
| Páginas | Editor y bloques existentes; campos y acciones se ajustan al ancho disponible. |
| Import / Export | Flujo existente y previsualización tabular por registro; importación/validación intactas. |
| Imágenes | Grilla y controles de biblioteca existentes; misma identidad PWA y áreas seguras. |
| Mensajes | Integración de contacto existente; no se crea un chat ni datos de conversaciones. |
| Notificaciones push | Formularios existentes; tablas internas de dispositivos y eventos adaptadas. Sin envíos reales de prueba. |
| Auditoría | Registro histórico inmutable, etiquetas y valores completos; exportación existente. |
| Diagnóstico | Estado, evidencias y acciones existentes; no se dispara ningún workflow desde la auditoría visual. |
| Flujo de conexiones | Carriles, resumen y detalle verticales existentes; búsqueda y filtros conservados. |
| Correos | Pestañas envueltas en filas, sin carrusel; plantillas, estados e historial mantienen todos los campos/acciones. |
| Configuración | Grillas de formulario existentes, campos táctiles, pestañas de envío envueltas y acciones visibles. |
| Roles y Permisos | Matriz por etiqueta/valor en teléfono; permisos y validaciones sin cambios. |
| Apariencia y contenido | Controles originales del tema y editor; sin reemplazar el diseño del lienzo especializado. |
| Mensaje de bienvenida | Formulario dinámico existente; el workspace mejora controles tardíos sin duplicarlos. |

No se reemplazan todos los módulos por la misma tarjeta: Usuarios tiene una
composición de identidad; Productos, Colecciones, Pedidos y comercio local
conservan sus representaciones especializadas. El patrón etiqueta/valor es el
respaldo compartido para tablas de información extensa, históricos y matrices.

## Hallazgos y correcciones

- Usuarios forzaba1260px de tabla y correo nowrap; en teléfono se reorganiza el
  mismo registro, sin ocultar columnas o acciones. Tocar fila/miniatura abre ficha.
- Ficha sin foto/visor: ahora muestra identidad, rol y estado reales; imagen
  contain en dialog nativo e iniciales si falta o falla. X, fondo, Escape y foco.
  La ficha reutiliza `setupAdminOverlayA11y`; cargas anteriores no pisan otra ficha.
- Tablas internas de dispositivos, eventos, Maestro y productos no compartían
  wrapper. Se descubren todas las tablas dentro del workspace, también tardías.
- Correos/Envíos/Usuarios imponían nowrap y scroll horizontal en sus pestañas.
  En teléfono pasan a varias filas, conservando cada opción y su controlador.
- Algunos campos conservaban40px o letra11px en horizontal. Se ajustan sólo en
  teléfono a44px/16px; valores, IDs, formularios y validación permanecen intactos.
- Los modales largos perdían el cierre al desplazarse. Sus encabezados son
  sticky y los controles de cierre tienen44px; contenido sigue siendo desplazable.
- Navegación reemplazaba siempre el hash. Las acciones aceptadas en teléfono
  agregan historial de sección; Atrás/Adelante recuperan la sección, incluidos
  enlaces con query. Cancelar por borrador restaura la ruta sin perder campos.
  Escritorio conserva replaceState; permisos se comprueban por switchSection.
- Una regla compartida revelaba acciones masivas con selección vacía. En
  teléfono se respeta de nuevo la clase show del controlador; las acciones
  siguen disponibles al seleccionar, con distribución compacta.
- Faltaba viewport-fit=cover y la ruta Imágenes no declaraba el manifest del admin.
  Se conserva el manifest existente y su identidad; se completan ambas entradas.

## PWA y privacidad

`admin-manifest.json`: standalone, orientación any, start_url privada con source=pwa,
iconos192/512 y maskable512, scope existente. Apple touch icon y metadatos en ambas
rutas. Worker de notificaciones sin manejador fetch, Cache Storage o IndexedDB;
no se añade caché offline administrativa. Guardias de autenticación y retorno
siguen siendo las existentes. Actualizaciones semánticas por la autoridad actual;
ninguna recarga forzada ni borrado de sesión, carrito o borradores.

## Verificación y límites

Pruebas aisladas sobre HTML/CSS/controladores reales, con datos ficticios:
listas pobladas y largas; campos/pestañas en las23 secciones; tablas tardías;
modales extensos y viewport reducido; ficha/foto; historial y rechazo por borrador;
comparación de cascada tablet/escritorio y regresiones de operaciones existentes.
142 pruebas de panel y repaso final24/24;18 contratos de PWA/versiones y
paginación. Evidencia y estado del SHA: `CURRENT_STATE.md` y recibo del PR1294.

No se crean cuentas, pedidos, envíos, correos ni notificaciones de producción.
La reducción de viewport simula el espacio del teclado; no acredita un teclado
real de iOS/Android. Instalación física, Safari iOS, Android físico y pinch-zoom
se mantienen como NOT_VERIFIED sin esos dispositivos y sesión confirmada. El
modo standalone no promete equivalencia completa con una aplicación nativa.
