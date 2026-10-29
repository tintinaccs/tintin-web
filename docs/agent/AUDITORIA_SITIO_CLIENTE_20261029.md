# Auditoría por sitio de cliente: Tintin

Registro: **29 de octubre de 2026**. Estado: **INCOMPLETA; ejecución interactiva bloqueada**. Páginas completamente verificadas: **0**.

Se inventarían todas las superficies identificadas en el código y snapshot público indicados abajo. No es una auditoría funcional terminada: no se heredan aprobados históricos ni se extrapola desde muestras. Cada ruta de producto/alias y cada marca estática de control conserva su fila; el DOM generado, las configuraciones privadas y los estados de sesión permanecen pendientes.

La [matriz JSON](./MATRIZ_SITIO_CLIENTE_20261029.json) contiene atributos, opciones de selectores, variantes/medios de producto, evidencias y estados individuales. Este documento presenta las filas principales en formato legible.

## Procedencia y alcance por cliente

Único cliente/sitio identificado: **Tintin Accesorios & Relojes**. `tintinaccs.com`, `www.tintinaccs.com` y `tintinaccesorios.pages.dev` corresponden a configuraciones del mismo sitio; no se contabilizan como tres clientes. La equivalencia de redirecciones/SSL entre hosts sigue pendiente. El árbol contiene19 HTML raíz, sin HTML anidado ni directorios clients/clientes/sites/tenants/apps; esto no descarta sitios configurados externamente sin acceso.

- Código congelado: [`bad42062290b4b780ba490abbb5f44bf685516a9`](https://github.com/tintinaccs/tintin-web/commit/bad42062290b4b780ba490abbb5f44bf685516a9); árbol `d6e6adfcde216060b0e5bdcb0ff8e79d8aff8612`.
- Checkpoint local anterior: `c031635b9d421ece436b878119247c34bcf93f2a`; su diff es inaccesible y las siete correcciones descritas **no están integradas en este main congelado**.
- Fuente:19 HTML completos y72 archivos JS bajo functions, inventario estático de marcado/tokens y revisión específica de controladores. No se afirma inspección profunda de cada dependencia transitiva.
- Lectura pública: TinyFish `fetch_content` de URL exactas, sólo extracción; sin clics, formularios, autenticación, compras ni mensajes. No aporta estados HTTP comprobados ni rendimiento de usuario.
- Snapshot: [279 productos](https://tintinaccs.com/api/public-catalog?resource=products) y [12 colecciones](https://tintinaccs.com/api/public-catalog?resource=collections). No demuestra que producción ejecute el SHA fuente congelado.
- Checkpoint documental en rama aislada; sin solicitud de PR, merge, despliegue productivo ni dispatch de workflows.

## Cobertura y significado de los estados

| Superficie | Cobertura registrada | Pendiente |
| --- | --- | --- |
| Páginas | 19 HTML;18 rutas limpias leídas;202 marcas de sección/encabezado | 0 páginas completamente verificadas |
| Controles | 524 marcas estáticas;incluida1 entrada hidden | DOM generado y acciones sin probar |
| Formularios | 1 etiqueta form en contacto | Otros grupos funcionales en login/perfil/checkout/Admin sin etiqueta form |
| Productos | 279/279 títulos esperados y canonical coincidentes;1 reintento | Galería, variantes, cantidad, compra, reseñas y favoritos sin probar |
| Datos | 44 productos stock0;93 con variants | Combinaciones válidas/incorrectas/extremas sin probar |
| Colecciones | 12 rutas con cat leídas | Filtrado real sin probar |
| Alias incorporados | 35/35 destinos esperados | Override custom, historial y query/hash sin probar |
| Alias de producto | 274 intentados;273 resueltos dentro del inventario;1 timeout tras2 intentos | 5 colisiones de nombre;interacciones sin probar |
| Enlaces fuente | 45 destinos internos HTTP;7 externos HTTP;34 acciones no HTTP | Clics, apps nativas y enlaces generados sin probar |
| Anclas legales | 19 IDs presentes en HTML | Scroll/foco/clic sin probar |
| Admin | 23 módulos y admin-images | Permisos, datos y controles generados desconocidos |
| Servidor | 58 API;72 JS functions incluyendo helpers/middleware | Contratos HTTP/roles/efectos sin ejecutar |

**FUENTE** sólo demuestra una marca o token del archivo; **LECTURA** sólo título/canonical/destino del extractor. **NOT_EXECUTED/PENDIENTE** nunca equivale a aprobado. Un timeout del extractor no confirma un defecto del sitio.

Cada control, sección, producto, módulo y flujo conserva en JSON estados pendientes separados para datos normales, vacíos, incorrectos y extremos; móvil320/390px, tablet768px y escritorio1440px; adelante, atrás y recarga; consola y red. Son tamaños planificados, no pruebas realizadas. Roles pendientes: invitado/client/viewer/agent/admin/superadmin, más token ausente/vencido, correo sin verificar, usuario deshabilitado/borrado, perfil legacy/incompleto y cambio de UID. Los permisos efectivos deben consultarse en QA.

Los perfiles normalizados en JSON definen estas dimensiones para cada fila: no se ejecutó el producto cartesiano ni se presume un N/A. Cada exclusión futura requerirá razón y evidencia.

## Árbol de navegación

```text
Tintin /
├── /catalogo y /collections
│   ├── 12 categorías → /catalogo?cat=:slug [&q=...&sort=...&stock=1]
│   └── 279 fichas → /product?id=:id [&color=:opción]
│       ├── galería/lightbox, características, opciones, reseñas, favoritos
│       └── carrito → login si corresponde → checkout → ticket
├── /login [?from=...&blocked=...]
│   └── Google o correo→OTP→perfil obligatorio→retorno autorizado
├── /perfil → resumen/datos/pedidos/favoritos/cuenta/ayuda
├── /about ← /nosotros; /contact
├── /envios /cambios-devoluciones /preguntas-frecuentes
├── /terminos /privacidad /404
├── /pages/:slug → legacy/custom borrador/publicada/no existente
├── /admin → 23 módulos; ?section/?tab y #sección por verificar
├── /admin-images → siete áreas y biblioteca/acciones múltiples
├── alias /pages/:slug /policies/:slug /collections/:handle /products/:handle
└── /__/auth/*, sitemaps y verificador Google: rutas técnicas
```

Los slugs privados, IDs de pedidos/tickets, filas administrativas, direcciones y permisos efectivos no son enumerables desde el catálogo público. Permanecen abiertos; también faltan comprobar variantes .html, hosts alias, tienda cerrada, offline y todos los parámetros combinados. Los parámetros min/max antiguos se eliminan en el runtime de catálogo; su detección no los convierte en filtros soportados.

## Matriz de páginas raíz

Todas las filas están incompletas. La fuente enlazada está fijada al SHA de referencia.

| Ruta | Fuente/evidencia | Secciones | Controles | Lectura pública | Estado funcional |
| --- | --- | --- | --- | --- | --- |
| /404 | [404.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/404.html) | 4 | 0 | Título extraído;final https://tintinaccs.com/404 | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /about | [about.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/about.html) | 11 | 0 | Título extraído;final https://tintinaccs.com/about | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /admin-images | [admin-images.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/admin-images.html) | 3 | 18 | Título extraído;final https://tintinaccs.com/admin-images | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /admin | [admin.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/admin.html) | 40 | 402 | Título extraído;final https://tintinaccs.com/admin | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /cambios-devoluciones | [cambios-devoluciones.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/cambios-devoluciones.html) | 11 | 0 | Título extraído;final https://tintinaccs.com/cambios-devoluciones | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /catalogo | [catalogo.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/catalogo.html) | 6 | 7 | Título extraído;final https://tintinaccs.com/catalogo | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /checkout | [checkout.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/checkout.html) | 9 | 40 | Título extraído;final https://tintinaccs.com/checkout | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /collections | [collections.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/collections.html) | 8 | 0 | Título extraído;final https://tintinaccs.com/collections | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /contact | [contact.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/contact.html) | 8 | 5 | Título extraído;final https://tintinaccs.com/contact | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /envios | [envios.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/envios.html) | 10 | 0 | Título extraído;final https://tintinaccs.com/envios | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /googlef396be0b943aa3d1.html | [googlef396be0b943aa3d1.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/googlef396be0b943aa3d1.html) | 0 | 0 | Sin lectura | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| / | [index.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/index.html) | 18 | 4 | Título extraído;final https://tintinaccs.com/ | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /login | [login.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/login.html) | 3 | 14 | Título extraído;final https://tintinaccs.com/login | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /nosotros | [nosotros.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/nosotros.html) | 1 | 0 | Título extraído;final https://tintinaccs.com/about | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /perfil | [perfil.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/perfil.html) | 14 | 22 | Título extraído;final https://tintinaccs.com/perfil | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /preguntas-frecuentes | [preguntas-frecuentes.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/preguntas-frecuentes.html) | 11 | 0 | Título extraído;final https://tintinaccs.com/preguntas-frecuentes | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /privacidad | [privacidad.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/privacidad.html) | 16 | 1 | Título extraído;final https://tintinaccs.com/privacidad | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /product | [product.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/product.html) | 12 | 11 | Título extraído;final https://tintinaccs.com/product | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |
| /terminos | [terminos.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/terminos.html) | 17 | 0 | Título extraído;final https://tintinaccs.com/terminos | NOT_EXECUTED:4 estados,3 dispositivos,roles,historial,consola,red |



<details>
<summary>202 marcas de sección, navegación y encabezado: todas las filas</summary>

### /404

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| h1 (sin id) | Esta página no existe | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [404.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/404.html), blob `6c84ecbf32f9bc19a8d29cc82439cee4570027dc`.

### /about

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | Conocenos ¡Hola Tintina! Te contamos nuestra historia con todo el amor que ponemos cada día en lo que hacemos. | NOT_EXECUTED |
| h1 (sin id) | ¡Hola Tintina! | NOT_EXECUTED |
| section historia | Conocé un poquito de Tintin ♡ Un espacio creado para las amantes de los detalles bonitos. Fundada el 8 de septiembre de 2024 Tintin Accesorios & Relojes nació el 8 de septiembre de | NOT_EXECUTED |
| h2 tt-about-story-title | Conocé un poquito de Tintin ♡ | NOT_EXECUTED |
| section origen | ¿Por qué Tintin se llama Tintin? 🎀 La historia de nuestro nombre comenzó mucho antes de que existiera esta tienda. Cuando era pequeña, amaba los vestidos y bailar al ritmo de una  | NOT_EXECUTED |
| h2 tt-about-mission-title | ¿Por qué Tintin se llama Tintin? 🎀 | NOT_EXECUTED |
| section (sin id) | Lo que nos mueve NUESTROS VALORES Elegidos con cuidado Elegimos accesorios que nos gustan y que queremos compartir con vos. Preparado con cariño Preparamos tu pedido con el mismo c | NOT_EXECUTED |
| h2 (sin id) | NUESTROS VALORES | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [about.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/about.html), blob `12101e219b7b9256fa3c8fa4a14e03c6a999d485`.

### /admin-images

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| h2 (sin id) | Acceso denegado | NOT_EXECUTED |
| nav adm-mobile-tabs | Hero Productos Editorial Íconos Nosotros Branding Biblioteca ◀ Panel | NOT_EXECUTED |
| h1 section-title | Inicio / Hero | NOT_EXECUTED |

Evidencia: [admin-images.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/admin-images.html), blob `566e463ac074f21bc9adff28d354bb3ba74846c8`.

### /admin

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| nav adm-nav | Navegación principal del panel | NOT_EXECUTED |
| nav adm-mobile-tabs | Navegación del panel (móvil) | NOT_EXECUTED |
| section adm-mobile-more-sheet | Panel completo Más opciones | NOT_EXECUTED |
| h2 adm-mobile-more-title | Más opciones | NOT_EXECUTED |
| section (sin id) | En línea ahora 0 activos Esperando actividad… | NOT_EXECUTED |
| h3 dashboard-online-title | En línea ahora | NOT_EXECUTED |
| section (sin id) | Ubicaciones de hoy 0 sesiones Todavía no hay sesiones registradas. | NOT_EXECUTED |
| h3 dashboard-today-title | Ubicaciones de hoy | NOT_EXECUTED |
| h1 (sin id) | Centro estadístico general | NOT_EXECUTED |
| section (sin id) | Rendimiento diario Pedidos, facturación y sesiones de los últimos siete días. Esperando datos… | NOT_EXECUTED |
| h2 (sin id) | Rendimiento diario | NOT_EXECUTED |
| section (sin id) | Estados de pedidos Distribución del período seleccionado. Esperando datos… | NOT_EXECUTED |
| h2 (sin id) | Estados de pedidos | NOT_EXECUTED |
| section (sin id) | Estados de pago Confirmados, pendientes y rechazados. Esperando datos… | NOT_EXECUTED |
| h2 (sin id) | Estados de pago | NOT_EXECUTED |
| section (sin id) | Productos más pedidos Unidades y facturación estimada. Esperando datos… | NOT_EXECUTED |
| h2 (sin id) | Productos más pedidos | NOT_EXECUTED |
| section (sin id) | Destinos de pedidos Ciudades y zonas de entrega principales. Esperando datos… | NOT_EXECUTED |
| h2 (sin id) | Destinos de pedidos | NOT_EXECUTED |
| section (sin id) | Origen de visitantes Ciudad y país aproximados de las sesiones permitidas. Esperando datos… | NOT_EXECUTED |
| h2 (sin id) | Origen de visitantes | NOT_EXECUTED |
| section (sin id) | Páginas de entrada Primeras páginas vistas durante el período. Esperando datos… | NOT_EXECUTED |
| h2 (sin id) | Páginas de entrada | NOT_EXECUTED |
| section (sin id) | Actividad actual por página Qué están viendo ahora los visitantes conectados. No hay actividad visible. | NOT_EXECUTED |
| h2 (sin id) | Actividad actual por página | NOT_EXECUTED |
| section section-ventas-locales | Ventas locales · hojas mensuales Ventas anteriores y nuevas registradas fuera de la tienda. Conservan su pedido original, fecha e importe. Cargando… Actualizar Nueva venta local Nu | NOT_EXECUTED |
| h2 (sin id) | Ventas locales · hojas mensuales | NOT_EXECUTED |
| section section-clientes-compraron | Clientes que compraron Cargando… Actualizar | NOT_EXECUTED |
| h2 (sin id) | Clientes que compraron | NOT_EXECUTED |
| section section-espejos-sheets | Casillas de Sheets y del panel Cargando… Actualizar | NOT_EXECUTED |
| h2 (sin id) | Casillas de Sheets y del panel | NOT_EXECUTED |
| h2 (sin id) | Notificaciones push | NOT_EXECUTED |
| h2 (sin id) | Apariencia y contenido | NOT_EXECUTED |
| section visual-editor | Editor visual seguro Armá la tienda con bloques y controles protegidos. No acepta código, CSS ni HTML. Deshacer Rehacer Guardar borrador Cancelar Revisar y publicar Cargando editor | NOT_EXECUTED |
| h2 visual-editor-title | Editor visual seguro | NOT_EXECUTED |
| section (sin id) | Propiedades | NOT_EXECUTED |
| h3 visual-properties-title | Propiedades | NOT_EXECUTED |
| section (sin id) | Página real Versión publicada: 0 Celular Tablet Escritorio | NOT_EXECUTED |
| h3 visual-preview-title | Página real | NOT_EXECUTED |
| details (sin id) | Historial y restauración | NOT_EXECUTED |

Evidencia: [admin.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/admin.html), blob `63504cfd6257da1de344193bb371ddc18d0522e8`.

### /cambios-devoluciones

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | Información Cambios y Devoluciones Tu satisfacción es nuestra prioridad. Si algo no está perfecto, lo resolvemos juntas. | NOT_EXECUTED |
| h1 (sin id) | Cambios y Devoluciones | NOT_EXECUTED |
| section (sin id) | ¿Cuándo puedo pedir un cambio? Aceptamos cambios dentro de los 7 días de recibido el pedido, siempre que el producto: No haya sido usado Esté en las mismas condiciones que llegó Te | NOT_EXECUTED |
| h2 (sin id) | ¿Cuándo puedo pedir un cambio? | NOT_EXECUTED |
| h2 (sin id) | ¿Cómo solicito un cambio? | NOT_EXECUTED |
| h2 (sin id) | Devoluciones | NOT_EXECUTED |
| h2 (sin id) | ¿Qué no tiene cambio? | NOT_EXECUTED |
| h2 (sin id) | Reembolsos | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [cambios-devoluciones.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/cambios-devoluciones.html), blob `c787a2770ba6563a43e850d86fa7df6e7d21c8f8`.

### /catalogo

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | Todo el catálogo Descubrí todos nuestros accesorios | NOT_EXECUTED |
| h1 cat-titulo | Todo el catálogo | NOT_EXECUTED |
| nav cat-tabs-mobile | Categorías del catálogo | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [catalogo.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/catalogo.html), blob `d384a6c54389db36aa3ed0c285fd928e96236184`.

### /checkout

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| h1 (sin id) | Finalizar compra en Tintin Accesorios | NOT_EXECUTED |
| h2 (sin id) | ¡Pedido confirmado! | NOT_EXECUTED |
| section tt-paypal-checkout | Pago seguro con PayPal Cargando el pago seguro… | NOT_EXECUTED |
| section (sin id) | Tu ticket Guardá una copia o compartila cuando la necesites. Guardar ticket Compartir ticket Imprimir / PDF Cómo compartir por WhatsApp Compartí la imagen y el mensaje juntos: eleg | NOT_EXECUTED |
| h2 ck-ticket-heading | Tu ticket | NOT_EXECUTED |
| details (sin id) | Cómo compartir por WhatsApp Compartí la imagen y el mensaje juntos: elegí WhatsApp y Tintin (0981 299331) en las opciones de tu dispositivo. | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [checkout.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/checkout.html), blob `80df600f1947b44463e542c0673005f7c8e293e9`.

### /collections

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | Toda nuestra selección NUESTRAS COLECCIONES Accesorios femeninos de acero inoxidable, bolsos, relojes y mucho más — elegidos con amor para que brillés cada día. | NOT_EXECUTED |
| h1 collections-title | NUESTRAS COLECCIONES | NOT_EXECUTED |
| section (sin id) | Cargando colecciones. | NOT_EXECUTED |
| section (sin id) | Lo más destacado PRODUCTOS DESTACADOS Una selección breve de productos disponibles para descubrir sin cargar todo el catálogo de una vez. Cargando productos destacados. Ver catálog | NOT_EXECUTED |
| h2 collections-featured-title | PRODUCTOS DESTACADOS | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [collections.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/collections.html), blob `3715c468529a052f42913b272de5402dd2ae4c0b`.

### /contact

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | Estamos para ayudarte ¿Dudas o consultas? Escríbenos y en Tintin te ayudamos con gusto. Tu satisfacción es lo más importante para nosotras. | NOT_EXECUTED |
| h1 (sin id) | ¿Dudas o consultas? | NOT_EXECUTED |
| section (sin id) | Envianos un mensaje Completá el formulario y te respondemos por WhatsApp a la brevedad. ¡Gracias por tu mensaje! Serás redirigida a WhatsApp para completar tu consulta. Tu navegado | NOT_EXECUTED |
| h2 (sin id) | Envianos un mensaje | NOT_EXECUTED |
| h3 (sin id) | ¿Preferís escribirnos directo? | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [contact.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/contact.html), blob `5210cec3e5fb5933b3c7171b906691b29fa2ccbc`.

### /envios

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | Información Política de Envíos Todo lo que necesitás saber sobre cómo te llegará tu pedido. | NOT_EXECUTED |
| h1 (sin id) | Política de Envíos | NOT_EXECUTED |
| section (sin id) | Delivery — Zona Central Realizamos delivery a domicilio en Asunción, Gran Asunción y zonas aledañas. Costo: según tu ciudad — mirá la lista de precios abajo. Tiempo: generalmente e | NOT_EXECUTED |
| h2 (sin id) | Delivery — Zona Central | NOT_EXECUTED |
| h2 (sin id) | Encomienda — Interior del País | NOT_EXECUTED |
| h2 (sin id) | Retiro en San Lorenzo — Gratis | NOT_EXECUTED |
| h2 (sin id) | Cuándo enviamos tu pedido | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [envios.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/envios.html), blob `ff8547f41d0d7dc45080a4c02f68e06c019f04db`.

### /googlef396be0b943aa3d1.html

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |


Evidencia: [googlef396be0b943aa3d1.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/googlef396be0b943aa3d1.html), blob `051f502ad2204b15741d6bece08332d335cf6fb0`.

### /

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section hero | ACCESORIOS & RELOJES UN DETALLE MUY VOS Joyitas únicas, como vos. Comprar ahora ¿Quiénes somos? → | NOT_EXECUTED |
| h1 (sin id) | UN DETALLE MUY VOS | NOT_EXECUTED |
| section (sin id) | Envío mismo día Pedidos antes de las 11 hs, Zona Central Materiales de calidad Distintos materiales para cada estilo Pago seguro Transferencia o efectivo Atención personalizada Te  | NOT_EXECUTED |
| section (sin id) | CATÁLOGO Descubrí todo lo que tenemos para vos Cargando colecciones… | NOT_EXECUTED |
| h2 tt-collection-carousel-title | CATÁLOGO | NOT_EXECUTED |
| section (sin id) | Elegidos por ustedes MÁS VENDIDOS Los favoritos que no pueden faltar en tu colección. Cargando selección… Ver todo el catálogo | NOT_EXECUTED |
| h2 tt-best-sellers-title | MÁS VENDIDOS | NOT_EXECUTED |
| section (sin id) | Nueva colección RELOJES TINTIN Relojes de acero inoxidable, elegantes y femeninos, para acompañarte del día a la noche. VER RELOJES → | NOT_EXECUTED |
| h2 (sin id) | RELOJES TINTIN | NOT_EXECUTED |
| section (sin id) | Lo que cuentan nuestras tintinas TINTINAS QUE YA NOS ELIGIERON Ver más reseñas | NOT_EXECUTED |
| h2 tt-reviews-title | TINTINAS QUE YA NOS ELIGIERON | NOT_EXECUTED |
| section instagram | Un poquito más de Tintin NOS VEMOS EN INSTAGRAM @tintinaccs Novedades, combinaciones y un poquito de nuestro día a día. Descubrí nuestros últimos videos. Ir a Instagram | NOT_EXECUTED |
| h2 tt-instagram-title | NOS VEMOS EN INSTAGRAM | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |
| dialog tt-reviews-dialog | Más tintinas que nos eligieron × | NOT_EXECUTED |
| h2 tt-reviews-dialog-title | Más tintinas que nos eligieron | NOT_EXECUTED |

Evidencia: [index.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/index.html), blob `6f115d1a904be34d3f0239008fa9527b127005a6`.

### /login

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | tintin Tu cuenta Tintin Qué lindo verte Ingresá de forma segura para continuar. G Continuar con Google Esta cuenta ya usa Google — entrá por acá o usá tu correo Correo electrónico  | NOT_EXECUTED |
| h1 login-heading | Qué lindo verte | NOT_EXECUTED |
| h2 login-exit-title | Te falta poco | NOT_EXECUTED |

Evidencia: [login.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/login.html), blob `e6d697bdaffdd93dbae81065ed022baac61ad3d3`.

### /nosotros

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| h1 (sin id) | Quiénes somos | NOT_EXECUTED |

Evidencia: [nosotros.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/nosotros.html), blob `9818b9504570884c42042bce45a64e4ed83dbcf5`.

### /perfil

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | Resumen de mi cuenta | NOT_EXECUTED |
| h1 perfil-nombre-display | Mi cuenta | NOT_EXECUTED |
| nav (sin id) | Secciones de mi perfil | NOT_EXECUTED |
| section profile-panel-resumen | Pedidos Cargando… Total comprado Cargando… Ubicación Cargando… | NOT_EXECUTED |
| section (sin id) | Pedidos Cargando… Total comprado Cargando… Ubicación Cargando… | NOT_EXECUTED |
| section profile-panel-datos | Mis datos Nombre Teléfono * Dirección de entrega (opcional) Nombre de usuario Mis direcciones guardadas (hasta 5) Agregar dirección Nueva dirección Buscá un lugar o marcá el punto  | NOT_EXECUTED |
| h3 (sin id) | Nueva dirección | NOT_EXECUTED |
| section profile-panel-pedidos | Mis pedidos Cargando pedidos… Compras:  \\|  Total gastado: | NOT_EXECUTED |
| section profile-panel-favoritos | Mis favoritos Cargando favoritos... | NOT_EXECUTED |
| section profile-panel-cuenta | Datos de la cuenta Acceso de esta sesión: Métodos vinculados: Miembro desde: Último ingreso: Mi rol Panel de administración Cerrar sesión | NOT_EXECUTED |
| section profile-panel-ayuda | ¿Necesitás ayuda? Contactar por WhatsApp Te respondemos en minutos — Lun a Sáb Accesos rápidos Ver catálogo Finalizar compra Inicio | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [perfil.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/perfil.html), blob `ba9212642c3e2cfd4a8f8f1c8faa2844a1c4a81d`.

### /preguntas-frecuentes

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | Ayuda Preguntas Frecuentes Encontrá respuestas rápidas a las dudas más comunes. | NOT_EXECUTED |
| h1 (sin id) | Preguntas Frecuentes | NOT_EXECUTED |
| section (sin id) | Compras ¿Cómo hago un pedido? Elegí los productos, agregalos al carrito y completá el checkout con tus datos. ¿Solo hay 1 unidad por modelo? La disponibilidad depende de cada model | NOT_EXECUTED |
| h2 (sin id) | Compras | NOT_EXECUTED |
| h2 (sin id) | Métodos de pago | NOT_EXECUTED |
| h2 (sin id) | Envíos | NOT_EXECUTED |
| h2 (sin id) | Productos | NOT_EXECUTED |
| h2 (sin id) | Contacto | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [preguntas-frecuentes.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/preguntas-frecuentes.html), blob `f1674102b1c26ffb231425d166c8ba84fed810a4`.

### /privacidad

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | Información Política de Privacidad Qué datos tuyos usamos, para qué, y cómo los cuidamos. | NOT_EXECUTED |
| h1 (sin id) | Política de Privacidad | NOT_EXECUTED |
| section (sin id) | Última actualización: agosto de 2026. Esta página describe las condiciones y prácticas publicadas por la tienda. Para una consulta específica sobre tu compra o tus datos, contactan | NOT_EXECUTED |
| nav tt-legal-nav | Índice de esta página | NOT_EXECUTED |
| h2 seccion-1-title | 1. Qué datos recopilamos | NOT_EXECUTED |
| h2 seccion-2-title | 2. Para qué los usamos | NOT_EXECUTED |
| h2 seccion-3-title | 3. Dónde se guardan | NOT_EXECUTED |
| h2 seccion-4-title | 4. Con quién los compartimos | NOT_EXECUTED |
| h2 seccion-5-title | 5. Tus derechos | NOT_EXECUTED |
| h2 seccion-6-title | 6. Cookies, almacenamiento y estadísticas | NOT_EXECUTED |
| h2 seccion-7-title | 7. Cuentas bloqueadas | NOT_EXECUTED |
| h2 seccion-8-title | 8. Cambios a esta política | NOT_EXECUTED |
| h2 seccion-9-title | 9. Contacto | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [privacidad.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/privacidad.html), blob `4a920fa340cbde42532e41351bd500cc60bbfdf2`.

### /product

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| nav (sin id) | Inicio › Colecciones › Producto | NOT_EXECUTED |
| section product-detail | Cargando producto… Producto no encontrado Este producto no existe o ya no está disponible. Volver a la tienda No pudimos cargar el producto Revisá tu conexión e intentá nuevamente. | NOT_EXECUTED |
| h2 (sin id) | Producto no encontrado | NOT_EXECUTED |
| h2 (sin id) | No pudimos cargar el producto | NOT_EXECUTED |
| h1 product-name | — | NOT_EXECUTED |
| h2 product-selection-title | Tu selección | NOT_EXECUTED |
| h2 (sin id) | Tu selección Tintin | NOT_EXECUTED |
| section (sin id) | También te puede gustar OTROS PRODUCTOS | NOT_EXECUTED |
| h2 (sin id) | OTROS PRODUCTOS | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [product.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/product.html), blob `25ad23f2f2773cb192e1e3d8d0bf9f121c0012d8`.

### /terminos

| Tag/ID | Texto fuente (puede estar oculto o reemplazado) | Estado |
| --- | --- | --- |
| section (sin id) | Información Términos y Condiciones Las reglas claras de cómo funciona tu compra en Tintin Accesorios & Relojes. | NOT_EXECUTED |
| h1 (sin id) | Términos y Condiciones | NOT_EXECUTED |
| section (sin id) | Última actualización: julio de 2026. Esta página describe las condiciones y prácticas publicadas por la tienda. Para una consulta específica sobre tu compra o tus datos, contactano | NOT_EXECUTED |
| nav tt-legal-nav | Índice de esta página | NOT_EXECUTED |
| h2 seccion-1-title | 1. Quiénes somos | NOT_EXECUTED |
| h2 seccion-2-title | 2. Cuenta y acceso | NOT_EXECUTED |
| h2 seccion-3-title | 3. Productos y precios | NOT_EXECUTED |
| h2 seccion-4-title | 4. Pedidos y pago | NOT_EXECUTED |
| h2 seccion-5-title | 5. Envíos y entregas | NOT_EXECUTED |
| h2 seccion-6-title | 6. Cambios y devoluciones | NOT_EXECUTED |
| h2 seccion-7-title | 7. Uso del sitio | NOT_EXECUTED |
| h2 seccion-8-title | 8. Privacidad | NOT_EXECUTED |
| h2 seccion-9-title | 9. Cambios a estos términos | NOT_EXECUTED |
| h2 seccion-10-title | 10. Contacto | NOT_EXECUTED |
| nav (sin id) | Tienda | NOT_EXECUTED |
| nav (sin id) | Más información | NOT_EXECUTED |
| nav (sin id) | Contacto | NOT_EXECUTED |

Evidencia: [terminos.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/terminos.html), blob `32f5fdf31b3b72f87e36ca6aded565bc5bfecb94`.


</details>



<details>
<summary>524 marcas estáticas de control: matriz por página y componente</summary>

### /admin-images

| Clave | Componente/tag | Etiqueta fuente | Resultado esperado / siguiente comprobación | Estados y evidencia |
| --- | --- | --- | --- | --- |
| admin-images.html:control:1 | adm-hamburger (button) | Menú | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:2 | button-2 (button) | Inicio / Hero | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:3 | button-3 (button) | Productos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:4 | button-4 (button) | Editorial / Colecciones | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:5 | button-5 (button) | Íconos / Trust | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:6 | button-6 (button) | Nosotros | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:7 | button-7 (button) | Branding / Logo | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:8 | button-8 (button) | Biblioteca multimedia | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:9 | button-9 (button) | Hero | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:10 | button-10 (button) | Productos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:11 | button-11 (button) | Editorial | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:12 | button-12 (button) | Íconos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:13 | button-13 (button) | Nosotros | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:14 | button-14 (button) | Branding | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:15 | button-15 (button) | Biblioteca | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:16 | btn-img-bulk-clear (button) | Quitar seleccionadas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:17 | btn-img-bulk-export (button) | Exportar URLs | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin-images.html:control:18 | btn-img-bulk-clear-sel (button) | Limpiar selección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |

Evidencia: [admin-images.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/admin-images.html), blob `566e463ac074f21bc9adff28d354bb3ba74846c8`. Atributos y opciones de selectores en JSON. Pendientes todos los dispositivos, roles, historial y DOM generado.

### /admin

| Clave | Componente/tag | Etiqueta fuente | Resultado esperado / siguiente comprobación | Estados y evidencia |
| --- | --- | --- | --- | --- |
| admin.html:control:1 | adm-sidebar-toggle (button) | Contraer barra lateral | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:2 | button-2 (button) | Buscar módulos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:3 | button-3 (button) | Inicio | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:4 | nav-estadisticas (button) | Estadísticas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:5 | nav-usuarios (button) | Usuarios | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:6 | button-6 (button) | Pedidos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:7 | button-7 (button) | ▤ Ventas locales | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:8 | button-8 (button) | ▤ Clientes que compraron | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:9 | button-9 (button) | ▤ Espejos de Sheets | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:10 | nav-mayoristas (button) | Pedidos mayoristas 0 | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:11 | button-11 (button) | Productos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:12 | nav-resenas (button) | Rese&ntilde;as 0 | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:13 | nav-me-gusta (button) | Me gusta 0 | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:14 | button-14 (button) | Colecciones | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:15 | nav-paginas (button) | Páginas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:16 | button-16 (button) | Import/Export | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:17 | button-17 (button) | Mensajes | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:18 | nav-notificaciones-push (button) | Notificaciones push | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:19 | nav-auditoria (button) | Auditoría | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:20 | nav-diagnostico (button) | Diagnóstico | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:21 | nav-flujo-conexiones (button) | Flujo de conexiones | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:22 | nav-correos (button) | Correos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:23 | nav-config (button) | Configuración | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:24 | nav-permisos (button) | Roles y Permisos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:25 | nav-apariencia (button) | Apariencia | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:26 | adm-logout (button) | Cerrar sesión | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:27 | button-27 (button) | Inicio | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:28 | mtab-estadisticas (button) | Stats | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:29 | mtab-usuarios (button) | Usuarios | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:30 | button-30 (button) | Pedidos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:31 | button-31 (button) | Ventas locales | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:32 | button-32 (button) | Clientes que compraron | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:33 | button-33 (button) | Espejos de Sheets | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:34 | mtab-mayoristas (button) | Mayoristas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:35 | button-35 (button) | Productos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:36 | button-36 (button) | Rese&ntilde;as | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:37 | button-37 (button) | Me gusta | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:38 | button-38 (button) | Colecciones | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:39 | mtab-paginas (button) | Páginas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:40 | button-40 (button) | Import | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:41 | button-41 (button) | Mensajes | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:42 | mtab-notificaciones-push (button) | Push | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:43 | mtab-auditoria (button) | Auditoría | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:44 | mtab-diagnostico (button) | Diagnóstico | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:45 | mtab-flujo-conexiones (button) | Flujo | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:46 | mtab-correos (button) | Correos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:47 | mtab-config (button) | Config | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:48 | mtab-permisos (button) | Permisos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:49 | mtab-apariencia (button) | Apariencia y contenido | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:50 | mtab-logout (button) | Salir | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:51 | adm-mobile-more-toggle (button) | ••• Más | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:52 | adm-mobile-more-close (button) | Cerrar más opciones | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:53 | adm-hamburger (button) | Abrir menú de módulos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:54 | button-54 (button) | Buscar módulos (Control o Comando K) | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:55 | button-55 (button) | Ver todos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:56 | statistics-range (select) | Hoy Últimos 7 días Últimos 30 días | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:57 | button-57 (button) | Usuarios | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:58 | button-58 (button) | Bloqueados | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:59 | user-search (input) | Buscar por nombre o email… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:60 | user-sort (select) | Ordenar: Actividad reciente de clientes Ordenar: Nombre (A-Z) Ordenar: Total gastado Orden | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:61 | users-bulk-role (select) | — Cambiar rol — Admin Agente (Modder) Viewer Cliente | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:62 | users-bulk-role-apply-btn (button) | Aplicar rol | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:63 | users-bulk-block-btn (button) | Bloquear | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:64 | users-bulk-restore-btn (button) | Desbloquear | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:65 | button-65 (button) | Exportar seleccionados a CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:66 | button-66 (button) | Limpiar selección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:67 | button-67 (button) | Exportar los usuarios que ves ahora a CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:68 | check-all-users (input) | Seleccionar todos | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:69 | button-69 (button) | Actualizar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:70 | button-70 (button) | Nueva venta local | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:71 | button-71 (button) | Nuevo gasto | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:72 | button-72 (button) | Nueva compra a proveedor | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:73 | button-73 (button) | Actualizar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:74 | button-74 (button) | Actualizar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:75 | btn-cleanup-stale-orders (button) | Borra pedidos que quedaron a medio empezar (la clienta cerró la pestaña antes de confirmar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:76 | order-search (input) | Buscar por cliente, teléfono, email… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:77 | filter-status (select) | Todos los estados Pendiente Confirmado En preparación Listo para retirar En camino Entrega | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:78 | filter-pay-status (select) | Todos los pagos Pago pendiente Pagado Rechazado Cancelado Reembolsado | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:79 | orders-bulk-status (select) | — Cambiar estado — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:80 | button-80 (button) | Aplicar estado | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:81 | orders-bulk-pay-status (select) | — Cambiar pago — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:82 | button-82 (button) | Aplicar pago | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:83 | orders-bulk-resend-btn (button) | Reenviar el correo de confirmación a todos los seleccionados | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:84 | orders-bulk-export-btn (button) | Exportar seleccionados a CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:85 | orders-bulk-delete-btn (button) | Eliminar definitivamente (Super Admin) | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:86 | button-86 (button) | Limpiar selección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:87 | orders-export-view-btn (button) | Exportar los pedidos que ves ahora (con los filtros aplicados) a CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:88 | check-all-orders (input) | Seleccionar todos | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:89 | prod-search (input) | Buscar por nombre o categoría… (o 'sin nombre' para ver productos rotos) | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:90 | prod-filter-cat (select) | Todas las categorías | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:91 | prod-export-all-btn (button) | Exportar todos los productos a CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:92 | prod-fix-legacy-numbers-btn (button) | Corrige productos viejos con precio, precio anterior o stock guardados como texto en vez d | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:93 | btn-nuevo-producto (button) | + Nuevo producto | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:94 | bulk-category-input (select) | — Asignar a colección — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:95 | button-95 (button) | Asignar la colección elegida a los productos seleccionados | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:96 | button-96 (button) | Quitar de su colección a los productos seleccionados | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:97 | button-97 (button) | Activar seleccionados | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:98 | button-98 (button) | Desactivar seleccionados | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:99 | bulk-delete-btn (button) | Eliminar definitivamente | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:100 | prod-bulk-export-btn (button) | Exportar seleccionados a CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:101 | bulk-delete-all-products-btn (button) | La eliminación masiva está limitada a 30 seleccionados | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:102 | button-102 (button) | ⋯ Más acciones | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:103 | bulk-stock-input (input) | Nuevo stock | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:104 | button-104 (button) | Aplicar stock | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:105 | bulk-price-input (input) | Nuevo precio (Gs.) | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:106 | button-106 (button) | Aplicar precio | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:107 | button-107 (button) | Aplicar oferta | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:108 | button-108 (button) | Quitar oferta | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:109 | button-109 (button) | Marcar como más vendido | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:110 | button-110 (button) | Quitar de más vendidos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:111 | button-111 (button) | Limpiar selección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:112 | check-all-prods (input) | Seleccionar todos | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:113 | button-113 (button) | ← Volver | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:114 | prod-id (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:115 | prod-name (input) | Ej.: Pulsera Fiorella | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:116 | prod-sku (input) | Ej.: PUL-FIO-01 · opcional | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:117 | prod-category (select) | — Seleccionar — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:118 | prod-collection (input) | Ej: anillos dorados, collares acero… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:119 | prod-price (input) | Ej.: 70000 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:120 | prod-stock (input) | Ej.: 10 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:121 | prod-badge (select) | Sin badge Nuevo Destacado Oferta Agotado | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:122 | prod-price-before (input) | Vacío si no aplica | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:123 | prod-imageUrl (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:124 | prod-description (textarea) | Contá cómo es: diseño, detalles y cómo se usa. | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:125 | prod-tags (input) | Ej.: pulsera, dorado, regalo | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:126 | prod-material (input) | Ej: acero inoxidable | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:127 | prod-measurements (input) | Ej: cadena de 45 cm | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:128 | prod-color-finish (input) | Ej: dorado pulido | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:129 | prod-care (input) | Ej.: Limpiar con un paño suave, si corresponde | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:130 | prod-water-resistance (input) | Ej: IPX4 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:131 | prod-warranty (input) | Indicá sólo la cobertura confirmada por el proveedor | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:132 | prod-size-fit (input) | Ej: ajustable | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:133 | prod-package-contents (input) | Ej.: pulsera y estuche · según lo que incluya | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:134 | prod-images-extra (textarea) | Una dirección de imagen por línea | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:135 | prod-cost-unit (input) | Ej.: 35000 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:136 | prod-purchased (input) | Ej.: 12 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:137 | prod-stock-minimum (input) | Ej.: 2 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:138 | prod-internal-notes (input) | Ej.: Revisar el cierre antes de entregar | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:139 | prod-variants-text (textarea) | Color: Rojo&#10;Color: Dorado&#10;Material: Acero inoxidable | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:140 | prod-active (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:141 | prod-oferta (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:142 | prod-destacado (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:143 | prod-save-btn (button) | Guardar producto | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:144 | button-144 (button) | Cancelar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:145 | coll-search (input) | Buscar colección… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:146 | btn-nueva-coleccion (button) | + Nueva colección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:147 | button-147 (button) | Activar (mostrar) | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:148 | button-148 (button) | Desactivar (ocultar) | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:149 | button-149 (button) | Exportar CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:150 | coll-bulk-delete-btn (button) | Eliminar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:151 | coll-bulk-delete-all-btn (button) | La eliminación masiva está limitada a 30 seleccionadas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:152 | button-152 (button) | Limpiar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:153 | button-153 (button) | ← Volver | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:154 | coll-original-slug (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:155 | coll-name (input) | Ej: Bags | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:156 | coll-slug (input) | bags | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:157 | coll-description (textarea) | Descripción breve de la colección… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:158 | coll-image (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:159 | coll-order (input) | 0 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:160 | coll-visible (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:161 | coll-save-btn (button) | Guardar colección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:162 | button-162 (button) | Cancelar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:163 | button-163 (button) | + Agregar productos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:164 | button-164 (button) | ← Volver a la colección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:165 | coll-picker-search (input) | Buscar producto por nombre… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:166 | coll-picker-select-all (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:167 | button-167 (button) | Agregar a la colección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:168 | button-168 (button) | Exportar CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:169 | button-169 (button) | Limpiar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:170 | check-all-audit (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:171 | btn-run-site-diagnostics (button) | Ejecutar diagnóstico | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:172 | site-diagnostic-mode (select) | Diagnóstico completo Por página Por módulo Visual, responsive y accesibilidad Funcional y  | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:173 | site-diagnostic-target (select) | — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:174 | site-diagnostic-role (select) | — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:175 | site-diagnostic-search (input) | Buscar problema, página, ruta, archivo o evidencia | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:176 | site-diagnostic-severity (select) | Filtrar por gravedad | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:177 | site-diagnostic-confirmation (select) | Filtrar por confirmación | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:178 | site-diagnostic-category (select) | Filtrar por categoría | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:179 | site-diagnostic-page (select) | Filtrar por página | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:180 | site-diagnostic-route (select) | Filtrar por ruta | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:181 | site-diagnostic-section (select) | Filtrar por sección | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:182 | site-diagnostic-component (select) | Filtrar por componente | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:183 | site-diagnostic-device (select) | Filtrar por dispositivo | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:184 | site-diagnostic-role-filter (select) | Filtrar por rol | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:185 | site-diagnostic-state (select) | Filtrar por recurrencia | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:186 | site-diagnostic-date (input) | Filtrar por fecha de detección | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:187 | btn-copy-site-diagnostics (button) | Copiar informe | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:188 | btn-export-site-diagnostics (button) | Exportar JSON | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:189 | button-189 (button) | Problemas activos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:190 | button-190 (button) | No revisados y pruebas fallidas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:191 | button-191 (button) | Historial y comparación | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:192 | button-192 (button) | Inicio | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:193 | button-193 (button) | Correos de pedidos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:194 | button-194 (button) | Correos de prueba | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:195 | button-195 (button) | Plantillas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:196 | button-196 (button) | Clientas registradas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:197 | button-197 (button) | Promociones | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:198 | button-198 (button) | Historial | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:199 | button-199 (button) | Configuración | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:200 | button-200 (button) | Activar seleccionados | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:201 | button-201 (button) | Desactivar seleccionados | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:202 | button-202 (button) | Limpiar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:203 | check-all-cop (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:204 | prueba-enabled-toggle (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:205 | button-205 (button) | Escribir email manual | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:206 | button-206 (button) | Elegir clienta registrada | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:207 | test-email-input (input) | cliente@email.com | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:208 | prueba-cliente-select (select) | Elegí una clienta… | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:209 | prueba-template-select (select) | — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:210 | btn-test-email (button) | Enviar prueba | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:211 | btn-test-preview (button) | Vista previa | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:212 | btn-tpl-nueva (button) | + Mensaje libre nuevo | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:213 | tpl-search (input) | Buscar plantilla… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:214 | tpl-filter-category (select) | Todas las categorías Pedidos Promociones Mensaje libre | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:215 | tpl-show-archived (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:216 | button-216 (button) | Archivar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:217 | button-217 (button) | Reactivar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:218 | button-218 (button) | Solo elimina las personalizadas — las de sistema solo se archivan | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:219 | button-219 (button) | Limpiar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:220 | check-all-tpl (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:221 | cli-search (input) | Buscar por nombre o email… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:222 | cli-filter (select) | Todas Activas Bloqueadas Con pedidos Sin pedidos | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:223 | cli-select-all (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:224 | cli-clear-selection (button) | Quitar seleccionadas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:225 | cli-use-in-promo (button) | Usar en Promociones → | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:226 | promo-enabled-toggle (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:227 | promo-template-select (select) | — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:228 | promo-add-email (input) | agregar@email.com | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:229 | promo-add-email-btn (button) | Agregar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:230 | promo-preview-btn (button) | Ver previsualización | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:231 | promo-open-confirm-btn (button) | Enviar promoción | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:232 | hist-search (input) | Buscar por email… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:233 | hist-filter-status (select) | Todos los estados Enviado Fallido Parcial Pendiente | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:234 | hist-filter-category (select) | Pedidos y pruebas (todo) Solo pedidos reales Solo pruebas Solo promociones | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:235 | hist-filter-type (select) | Todos los tipos | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:236 | hist-filter-from (input) | Desde | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:237 | hist-filter-to (input) | Hasta | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:238 | button-238 (button) | Reintentar los envíos fallidos de la selección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:239 | button-239 (button) | Exportar CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:240 | button-240 (button) | Limpiar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:241 | check-all-hist (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:242 | cec-order-enabled (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:243 | cec-internal-enabled (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:244 | cec-customer-enabled (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:245 | cec-test-enabled (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:246 | cec-promo-enabled (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:247 | cec-sender-name (input) | Tintin Accesorios | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:248 | cec-sender-email (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:249 | cec-internal-email (input) | tintinaccs@gmail.com | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:250 | cec-whatsapp (input) | 595981299331 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:251 | cec-signature (textarea) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:252 | cec-footer (textarea) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:253 | cec-test-limit (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:254 | cec-resend-limit (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:255 | cec-promo-limit (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:256 | btn-save-correos-config (button) | Guardar configuración de correos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:257 | cfg-store-open (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:258 | ma-admin (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:259 | ma-agent (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:260 | ma-viewer (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:261 | ma-support (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:262 | ma-client (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:263 | ma-guest (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:264 | cfg-header-desktop-tablet (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:265 | cfg-header-mobile (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:266 | cfg-wa-number (input) | 595981299331 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:267 | cfg-contact-email (input) | tintinaccs@gmail.com | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:268 | cfg-store-address (input) | San Lorenzo, Paraguay | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:269 | cfg-currency (select) | Guaraní (Gs.) | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:270 | cfg-wa-confirm-msg (textarea) | Hola! Te escribo por tu pedido realizado en nuestra página web... | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:271 | cfg-delivery-cost (input) | 15000 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:272 | cfg-encomienda-cost (input) | 25000 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:273 | ship-import-paraguay (button) | 🇵🇾 Cargar ciudades de Paraguay | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:274 | button-274 (button) | Delivery a domicilio | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:275 | button-275 (button) | Encomienda | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:276 | ship-delivery-name (input) | Nombre de la ciudad | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:277 | ship-delivery-departamento (select) | — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:278 | ship-delivery-price (input) | Gs. (opcional) | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:279 | ship-delivery-add (button) | Guardar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:280 | ship-delivery-cancel (button) | Cancelar edición | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:281 | button-281 (button) | Eliminar seleccionadas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:282 | button-282 (button) | Limpiar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:283 | ship-encomienda-name (input) | Nombre de la ciudad | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:284 | ship-encomienda-departamento (select) | — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:285 | ship-encomienda-price (input) | Gs. (opcional) | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:286 | ship-encomienda-add (button) | Guardar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:287 | ship-encomienda-cancel (button) | Cancelar edición | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:288 | button-288 (button) | Eliminar seleccionadas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:289 | button-289 (button) | Limpiar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:290 | cfg-instagram (input) | https://instagram.com/tintin... | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:291 | cfg-facebook (input) | https://facebook.com/tintin... | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:292 | cfg-tiktok (input) | https://tiktok.com/@tintin... | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:293 | cfg-ga4-id (input) | G-XXXXXXXXXX (dejalo vacío para no medir nada) | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:294 | cfg-pay-efectivo (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:295 | cfg-pay-transferencia (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:296 | cfg-bank-ueno (textarea) | Ej: CI 1.234.567 — Nombre Apellido | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:297 | cfg-bank-atlas (textarea) | Ej: CI 1.234.567 — Nombre Apellido | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:298 | push-device-label (input) | Ej: iPhone de Barbi | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:299 | btn-push-enable (button) | Activar notificaciones | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:300 | btn-push-test (button) | Enviar prueba a este dispositivo | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:301 | btn-push-disable (button) | Desactivar en este dispositivo | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:302 | btn-save-config (button) | Guardar toda la configuración | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:303 | push-master-enabled (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:304 | push-master-sound (select) | Sonido predeterminado Silencioso Sonido personalizado | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:305 | push-master-sound-url (input) | https://…/tono.mp3 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:306 | push-master-sound-file (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:307 | btn-push-master-upload (button) | Subir MP3 | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:308 | btn-push-master-save (button) | Guardar preferencias | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:309 | btn-push-master-test (button) | Enviar prueba a todos los dispositivos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:310 | btn-push-master-revoke-all (button) | Revocar todos los dispositivos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:311 | push-tone-order (select) | Predeterminado Silencioso Personalizado | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:312 | push-tone-order-url (input) | URL HTTPS del MP3 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:313 | push-tone-order-file (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:314 | button-314 (button) | Subir tono | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:315 | push-tone-review (select) | Predeterminado Silencioso Personalizado | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:316 | push-tone-review-url (input) | URL HTTPS del MP3 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:317 | push-tone-review-file (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:318 | button-318 (button) | Subir tono | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:319 | push-tone-like (select) | Predeterminado Silencioso Personalizado | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:320 | push-tone-like-url (input) | URL HTTPS del MP3 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:321 | push-tone-like-file (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:322 | button-322 (button) | Subir tono | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:323 | push-master-message-title (input) | Mensaje de Tintin | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:324 | push-master-message-body (input) | Escribí el aviso que querés enviar | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:325 | btn-push-master-message (button) | Enviar mensaje | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:326 | btn-perm-restore (button) | Restaurar valores por defecto | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:327 | btn-perm-save (button) | Guardar cambios | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:328 | perm-search (input) | Buscar permiso… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:329 | perm-filter-module (select) | Todos los módulos | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:330 | perm-filter-role (select) | Todos los roles Admin Agente / Modder Viewer | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:331 | button-331 (button) | Contenido y diseño | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:332 | button-332 (button) | Colores de la tienda | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:333 | visual-undo (button) | Deshacer | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:334 | visual-redo (button) | Rehacer | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:335 | visual-save (button) | Guardar borrador | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:336 | visual-cancel (button) | Cancelar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:337 | visual-publish (button) | Revisar y publicar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:338 | visual-page (select) | — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:339 | visual-new-block (select) | Tipo de bloque nuevo | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:340 | visual-add (button) | Agregar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:341 | button-341 (button) | Celular | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:342 | button-342 (button) | Tablet | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:343 | button-343 (button) | Escritorio | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:344 | summary-344 (summary) | Historial y restauración | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:345 | apar-search (input) | 🔍 Buscar configuración (fondo, texto, botón, hover, WhatsApp...) | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:346 | btn-exportar (button) | Descargar JSON | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:347 | btn-exportar-pedidos (button) | Descargar CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:348 | btn-exportar-usuarios (button) | Descargar CSV | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:349 | csv-file-input (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:350 | btn-csv-limpiar (button) | Limpiar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:351 | btn-csv-importar-seleccionados (button) | Importar seleccionados | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:352 | btn-csv-importar (button) | Importar todos a Firebase | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:353 | check-all-csv (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:354 | import-json (textarea) | [{"name":"Reloj Dorado","category":"relojes","price":85000,"imageUrl":"https://...","stock | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:355 | btn-importar (button) | Importar a Firestore | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:356 | btn-importar-sample (button) | Cargar ejemplo | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:357 | reviews-search (input) | Buscar por clienta, correo, producto o comentario | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:358 | reviews-filter (select) | Todas Visibles Ocultas Eliminadas | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:359 | review-quick-replies (textarea) | Una respuesta por l&iacute;nea | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:360 | save-review-quick-replies (button) | Guardar respuestas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:361 | likes-search (input) | Buscar por clienta, correo o producto | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:362 | unsaved-modal-save (button) | Guardar cambios | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:363 | unsaved-modal-discard (button) | Descartar cambios | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:364 | unsaved-modal-stay (button) | Seguir editando | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:365 | button-365 (button) | Cerrar editor de pedido | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:366 | oe-id (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:367 | oe-name (input) | Nombre | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:368 | oe-phone (input) | +595 981 000 000 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:369 | oe-email (input) | cliente@email.com | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:370 | oe-city (input) | Asunción | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:371 | oe-ship-method (select) | Delivery Encomienda Retiro en tienda | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:372 | oe-address (input) | Calle y número | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:373 | oe-referencia (input) | Cerca de… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:374 | oe-pay-method (select) | Efectivo Transferencia | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:375 | oe-pay-status (select) | Pago pendiente Pagado Rechazado Cancelado Reembolsado | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:376 | oe-status (select) | Pendiente Confirmado En preparación Listo para retirar En camino Entregado Cancelado Recha | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:377 | oe-notes (input) | Nota del admin… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:378 | button-378 (button) | Cancelar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:379 | oe-save-btn (button) | Guardar cambios | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:380 | button-380 (button) | Cerrar ficha de cliente | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:381 | button-381 (button) | Cerrar editor de plantilla | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:382 | tpl-edit-id (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:383 | tpl-edit-name-input (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:384 | tpl-edit-subject (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:385 | tpl-edit-greeting (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:386 | tpl-edit-intro (textarea) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:387 | tpl-edit-promo (textarea) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:388 | tpl-edit-closing (textarea) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:389 | tpl-edit-signature (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:390 | tpl-edit-button-text (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:391 | tpl-edit-button-url (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:392 | tpl-edit-brand (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:393 | tpl-edit-footer (textarea) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:394 | tpl-edit-active (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:395 | tpl-edit-restore-btn (button) | Restaurar original | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:396 | tpl-edit-preview-btn (button) | Vista previa | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:397 | button-397 (button) | Cancelar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:398 | tpl-edit-save-btn (button) | Guardar plantilla | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:399 | button-399 (button) | Cerrar vista previa | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:400 | promo-confirm-input (input) | CONFIRMAR | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:401 | button-401 (button) | Cancelar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| admin.html:control:402 | promo-confirm-send-btn (button) | Enviar promoción | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |

Evidencia: [admin.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/admin.html), blob `63504cfd6257da1de344193bb371ddc18d0522e8`. Atributos y opciones de selectores en JSON. Pendientes todos los dispositivos, roles, historial y DOM generado.

### /catalogo

| Clave | Componente/tag | Etiqueta fuente | Resultado esperado / siguiente comprobación | Estados y evidencia |
| --- | --- | --- | --- | --- |
| catalogo.html:control:1 | button-1 (button) | Todos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| catalogo.html:control:2 | filter-toggle (button) | Filtrar por categoría | Abrir/cerrar filtros accesibles en móvil/tablet; conservar selección al redimensionar. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| catalogo.html:control:3 | button-3 (button) | Todas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| catalogo.html:control:4 | filtro-stock (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| catalogo.html:control:5 | btn-limpiar-filtros (button) | Limpiar filtros | Limpiar categoría/búsqueda/stock/orden conforme al contrato y sincronizar URL/resultados. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| catalogo.html:control:6 | cat-search (input) | Buscar productos... | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| catalogo.html:control:7 | cat-sort (select) | Ordenar por Precio: menor a mayor Precio: mayor a menor Nombre A-Z Con stock primero | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |

Evidencia: [catalogo.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/catalogo.html), blob `d384a6c54389db36aa3ed0c285fd928e96236184`. Atributos y opciones de selectores en JSON. Pendientes todos los dispositivos, roles, historial y DOM generado.

### /checkout

| Clave | Componente/tag | Etiqueta fuente | Resultado esperado / siguiente comprobación | Estados y evidencia |
| --- | --- | --- | --- | --- |
| checkout.html:control:1 | btn-step1-next (button) | Elegir cómo lo recibo → | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:2 | ck-departamento (select) | — Elegí tu departamento — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:3 | ck-city (select) | — Primero elegí tu departamento — | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:4 | ck-enc-agencia (button) | Retiro en agencia Lo pasás a buscar por la transportadora | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:5 | ck-enc-puerta (button) | Entrega en puerta Te lo llevan a tu dirección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:6 | ck-address (input) | Ej: Av. España 1234, Barrio San José | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:7 | ck-referencia (input) | Ej: casa azul, frente al semáforo | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:8 | ck-saved-location-confirm (button) | Sí, es acá | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:9 | ck-saved-location-change (button) | Marcar otra | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:10 | ck-map-search (input) | Buscar local, calle o punto de referencia… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:11 | ck-map-locate (button) | Usar mi ubicación actual | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:12 | ck-location-name (input) | Ej: Mi casa, Local del trabajo, Casa de mi tía | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:13 | ck-save-location (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:14 | btn-step2-next (button) | Ir a mis datos → | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:15 | btn-step2-back (button) | ← Volver al carrito | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:16 | ck-edit-identity (button) | Editar datos para este pedido | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:17 | ck-name (input) | Tu nombre y apellido | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:18 | ck-phone-country (select) | Prefijo de Paraguay | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:19 | ck-phone-number (input) | 0912 345 678 o 912 345 678 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:20 | ck-email (input) | Ej: nombre@email.com | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:21 | ck-notes (textarea) | Ej: Entregar después de las 17hs, timbre no funciona… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:22 | ck-coupon (input) | Ej: ENVIOGRATIS | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:23 | ck-coupon-apply (button) | Aplicar | Validar cupón por servidor; mostrar aceptación/rechazo/caducidad sin perder borrador ni duplicar operación. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:24 | ck-ci (input) | Ej: 4123456 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:25 | ck-wants-invoice (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:26 | ck-taxpayer-type (select) | Elegí el tipo de contribuyente Persona física / empresa unipersonal Persona jurídica / emp | Verificar todas las opciones identificadas, selección, persistencia y cambios en datos dependientes. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:27 | ck-razon-social (input) | Nombre o razón social para la factura | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:28 | ck-ruc (input) | RUC con guion y dígito verificador | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:29 | ck-ruc-hyphen (button) | Agregar guion al RUC | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:30 | btn-step3-next (button) | Elegir forma de pago → | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:31 | btn-step3-back (button) | ← Volver al envío | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:32 | pay-efectivo (input) | ck-pay | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:33 | pay-transferencia (input) | ck-pay | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:34 | btn-step4-next (button) | Ver resumen del pedido → | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:35 | btn-step4-back (button) | ← Volver a tus datos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:36 | ck-confirm-btn (button) | Confirmar pedido | En entorno aislado: confirmar un único pedido con precios/stock del servidor; fallo conserva carrito y datos. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:37 | ck-save-receipt (button) | Guardar ticket | Descargar PNG del pedido confirmado sin crear otro pedido. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:38 | ck-share-receipt (button) | Compartir ticket | Compartir archivo/texto o fallback explícito; cancelar no genera otro pedido ni envío automático. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:39 | ck-print-receipt (button) | Imprimir / PDF | Abrir impresión/PDF del ticket restaurable sin reenviar el pedido. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| checkout.html:control:40 | summary-40 (summary) | Cómo compartir por WhatsApp | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |

Evidencia: [checkout.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/checkout.html), blob `80df600f1947b44463e542c0673005f7c8e293e9`. Atributos y opciones de selectores en JSON. Pendientes todos los dispositivos, roles, historial y DOM generado.

### /contact

| Clave | Componente/tag | Etiqueta fuente | Resultado esperado / siguiente comprobación | Estados y evidencia |
| --- | --- | --- | --- | --- |
| contact.html:control:1 | f-nombre (input) | Tu nombre | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| contact.html:control:2 | f-email (input) | tu@email.com | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| contact.html:control:3 | f-tel (input) | +595 9XX XXX XXX | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| contact.html:control:4 | f-msg (textarea) | ¿En qué podemos ayudarte? Consultá por disponibilidad, precios, envíos... | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| contact.html:control:5 | button-5 (button) | Enviar por WhatsApp | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |

Evidencia: [contact.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/contact.html), blob `5210cec3e5fb5933b3c7171b906691b29fa2ccbc`. Atributos y opciones de selectores en JSON. Pendientes todos los dispositivos, roles, historial y DOM generado.

### /

| Clave | Componente/tag | Etiqueta fuente | Resultado esperado / siguiente comprobación | Estados y evidencia |
| --- | --- | --- | --- | --- |
| index.html:control:1 | button-1 (button) | Ver colección anterior | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| index.html:control:2 | button-2 (button) | Ver colección siguiente | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| index.html:control:3 | tt-reviews-more (button) | Ver más reseñas | Abrir reseñas adicionales y cerrar devolviendo foco sin perder posición. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| index.html:control:4 | button-4 (button) | Cerrar reseñas | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |

Evidencia: [index.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/index.html), blob `6f115d1a904be34d3f0239008fa9527b127005a6`. Atributos y opciones de selectores en JSON. Pendientes todos los dispositivos, roles, historial y DOM generado.

### /login

| Clave | Componente/tag | Etiqueta fuente | Resultado esperado / siguiente comprobación | Estados y evidencia |
| --- | --- | --- | --- | --- |
| login.html:control:1 | btn-google (button) | G Continuar con Google | Abrir Google; conservar formulario al cancelar o fallar; conservar sesión al completar en QA. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:2 | login-email-input (input) | tu@email.com | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:3 | btn-send-otp (button) | Enviar código | Validar correo y solicitar OTP sólo en emulador/sandbox; mostrar loading, cooldown y errores sin duplicar envíos. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:4 | login-otp-input (input) | 000000 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:5 | btn-paste-otp (button) | Pegar código | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:6 | btn-verify-otp (button) | Confirmar código | Validar código y continuar a perfil/retorno autorizado; rechazar código erróneo/vencido sin perder correo. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:7 | btn-resend-otp (button) | Reenviar código | Respetar cooldown y cuota; un clic produce como máximo una solicitud de QA. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:8 | btn-change-email (button) | Cambiar correo | Volver al correo sin conservar un desafío de otra identidad. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:9 | login-profile-first-name (input) | Ej: María González | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:10 | login-profile-country (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:11 | login-profile-phone (input) | 0912 345 678 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:12 | btn-save-profile (button) | Continuar | Validar nombre/teléfono, guardar perfil y continuar sólo tras confirmación; conservar datos ante fallo. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:13 | btn-exit-continue (button) | Completar mis datos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| login.html:control:14 | btn-exit-logout (button) | Cerrar sesión y seguir mirando | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |

Evidencia: [login.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/login.html), blob `e6d697bdaffdd93dbae81065ed022baac61ad3d3`. Atributos y opciones de selectores en JSON. Pendientes todos los dispositivos, roles, historial y DOM generado.

### /perfil

| Clave | Componente/tag | Etiqueta fuente | Resultado esperado / siguiente comprobación | Estados y evidencia |
| --- | --- | --- | --- | --- |
| perfil.html:control:1 | btn-reintentar-perfil (button) | Volver a intentar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:2 | button-2 (button) | Cambiar foto | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:3 | perfil-photo-input (input) | — | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:4 | profile-tab-resumen (button) | Resumen | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:5 | profile-tab-datos (button) | Mis datos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:6 | profile-tab-pedidos (button) | Pedidos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:7 | profile-tab-favoritos (button) | Favoritos | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:8 | profile-tab-cuenta (button) | Cuenta y seguridad | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:9 | profile-tab-ayuda (button) | Ayuda | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:10 | perfil-nombre (input) | Tu nombre completo | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:11 | perfil-tel (input) | 0912 345 678 o 912 345 678 | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:12 | perfil-dir (input) | Ej: Av. España 1234, Asunción | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:13 | perfil-username (input) | minusculas_y_numeros | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:14 | btn-cambiar-ubicacion (button) | Agregar dirección | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:15 | perfil-location-search (input) | Calle, barrio o punto de referencia… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:16 | perfil-location-name (input) | Casa, trabajo… | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:17 | perfil-location-address (input) | Calle, número o referencia | Validar reglas del campo y límites; conservar valor tras fallo y verificar resultado del flujo que lo consume. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:18 | perfil-location-locate (button) | Usar mi ubicación actual | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:19 | btn-guardar-ubicacion (button) | Guardar dirección | Validar y guardar dirección de la cuenta vigente; cancelar/error conserva dirección previa. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:20 | btn-cancelar-ubicacion (button) | Cancelar | Cerrar ubicación sin aplicar cambios no confirmados y devolver foco. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:21 | btn-guardar-perfil (button) | Guardar cambios | Validar y confirmar guardado; conservar reservas/datos anteriores ante error o cambio de UID. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| perfil.html:control:22 | btn-logout (button) | Cerrar sesión | Cerrar sesión y listeners; conservar aislamiento entre cuenta anterior e invitado. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |

Evidencia: [perfil.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/perfil.html), blob `ba9212642c3e2cfd4a8f8f1c8faa2844a1c4a81d`. Atributos y opciones de selectores en JSON. Pendientes todos los dispositivos, roles, historial y DOM generado.

### /privacidad

| Clave | Componente/tag | Etiqueta fuente | Resultado esperado / siguiente comprobación | Estados y evidencia |
| --- | --- | --- | --- | --- |
| privacidad.html:control:1 | tt-open-privacy-settings (button) | Configurar cookies y privacidad | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |

Evidencia: [privacidad.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/privacidad.html), blob `4a920fa340cbde42532e41351bd500cc60bbfdf2`. Atributos y opciones de selectores en JSON. Pendientes todos los dispositivos, roles, historial y DOM generado.

### /product

| Clave | Componente/tag | Etiqueta fuente | Resultado esperado / siguiente comprobación | Estados y evidencia |
| --- | --- | --- | --- | --- |
| product.html:control:1 | btn-product-retry (button) | Reintentar | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| product.html:control:2 | gallery-main (button) | Ampliar imagen del producto | Abrir galería/lightbox accesible; cerrar con Escape y restaurar foco. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| product.html:control:3 | specs-trigger (button) | Características | Alternar características con aria-expanded y teclado; no perder selección. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| product.html:control:4 | btn-qty-minus (button) | Restar | Reducir cantidad hasta1 sin alterar variante ni carrito antes de agregar. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| product.html:control:5 | btn-qty-plus (button) | Sumar | Aumentar hasta stock aplicable; impedir sobreventa y mantener opciones/foto/precio. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| product.html:control:6 | btn-product-add-cart (button) | Agregar al carrito | Agregar una línea por ID/variante y cantidad; impedir doble clic y stock insuficiente; mantener selección. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| product.html:control:7 | btn-product-buy-now (button) | Comprar ahora → | Conservar selección y cantidad al encadenar carrito→checkout; exigir identidad cuando corresponda. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| product.html:control:8 | btn-product-wa (button) | ¿Tenés dudas? Consultanos por WhatsApp | Construir consulta correcta para la ficha/variante; verificar URL en sandbox sin enviar mensaje. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| product.html:control:9 | tinsel-cart-btn (button) | Ver mi carrito | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| product.html:control:10 | tinsel-checkout-btn (button) | Finalizar pedido | Verificar acción del handler, resultado observable, accesibilidad, error, repetición y encadenamiento; contrato detallado pendiente de ejecución. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |
| product.html:control:11 | related-refresh (button) | Mostrar otros productos | Cambiar relacionados válidos sin perder ficha, scroll ni carrito. | Normal/vacío/incorrecto/extremo:NOT_EXECUTED;fuente en blob de página |

Evidencia: [product.html](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/product.html), blob `25ad23f2f2773cb192e1e3d8d0bf9f121c0012d8`. Atributos y opciones de selectores en JSON. Pendientes todos los dispositivos, roles, historial y DOM generado.


</details>


## Componentes compartidos e instancias

| Plantilla fuente | Dispositivo | Tokens de control/enlace | Consumidores identificados | Estado |
| --- | --- | --- | --- | --- |
| [js/components/navigation/escritorio/encabezado-escritorio.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/js/components/navigation/escritorio/encabezado-escritorio.js) | desktop | 11 | 15 | Expandir bucles/condiciones y probar cada instancia |
| [js/components/navigation/tableta/encabezado-tableta.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/js/components/navigation/tableta/encabezado-tableta.js) | tablet | 16 | 15 | Expandir bucles/condiciones y probar cada instancia |
| [js/components/navigation/movil/encabezado-movil.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/js/components/navigation/movil/encabezado-movil.js) | mobile | 6 | 15 | Expandir bucles/condiciones y probar cada instancia |
| [js/components/navigation/compartido/panel-busqueda.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/js/components/navigation/compartido/panel-busqueda.js) | all | 3 | 15 | Expandir bucles/condiciones y probar cada instancia |
| [js/components/navigation/compartido/panel-carrito.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/js/components/navigation/compartido/panel-carrito.js) | all | 1 | 15 | Expandir bucles/condiciones y probar cada instancia |
| [js/components/navigation/compartido/panel-cuenta.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/js/components/navigation/compartido/panel-cuenta.js) | all | 1 | 15 | Expandir bucles/condiciones y probar cada instancia |
| [js/components/navigation/compartido/panel-colecciones.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/js/components/navigation/compartido/panel-colecciones.js) | all | 5 | 15 | Expandir bucles/condiciones y probar cada instancia |

Consumidores del bootstrap: `404.html`, `about.html`, `cambios-devoluciones.html`, `catalogo.html`, `checkout.html`, `collections.html`, `contact.html`, `envios.html`, `index.html`, `login.html`, `perfil.html`, `preguntas-frecuentes.html`, `privacidad.html`, `product.html`, `terminos.html`.

Un fallo de header/panel debe probarse en todos sus consumidores, viewports y estados; no se declara global ni resuelto por extrapolación. Tarjetas, opciones, mapas, carrito, cuenta, reseñas, favoritos, editor y modales privados requieren expansión DOM adicional. Los tokens de plantilla no son el total de instancias.

## Colecciones: todas las12 rutas

| Categoría | Productos del snapshot | URL leída | Estado |
| --- | --- | --- | --- |
| anillos | 29 | [https://tintinaccs.com/catalogo?cat=anillos](https://tintinaccs.com/catalogo?cat=anillos) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| armcuff | 4 | [https://tintinaccs.com/catalogo?cat=armcuff](https://tintinaccs.com/catalogo?cat=armcuff) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| aros | 53 | [https://tintinaccs.com/catalogo?cat=aros](https://tintinaccs.com/catalogo?cat=aros) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| bolsos | 44 | [https://tintinaccs.com/catalogo?cat=bolsos](https://tintinaccs.com/catalogo?cat=bolsos) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| collares | 60 | [https://tintinaccs.com/catalogo?cat=collares](https://tintinaccs.com/catalogo?cat=collares) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| earcuff | 9 | [https://tintinaccs.com/catalogo?cat=earcuff](https://tintinaccs.com/catalogo?cat=earcuff) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| gafas | 10 | [https://tintinaccs.com/catalogo?cat=gafas](https://tintinaccs.com/catalogo?cat=gafas) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| joyeros | 6 | [https://tintinaccs.com/catalogo?cat=joyeros](https://tintinaccs.com/catalogo?cat=joyeros) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| mochilas | 4 | [https://tintinaccs.com/catalogo?cat=mochilas](https://tintinaccs.com/catalogo?cat=mochilas) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| relojes | 36 | [https://tintinaccs.com/catalogo?cat=relojes](https://tintinaccs.com/catalogo?cat=relojes) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| tobilleras | 2 | [https://tintinaccs.com/catalogo?cat=tobilleras](https://tintinaccs.com/catalogo?cat=tobilleras) | Destino leído;filtrado/interacciones NOT_EXECUTED |
| pulseras | 22 | [https://tintinaccs.com/catalogo?cat=pulseras](https://tintinaccs.com/catalogo?cat=pulseras) | Destino leído;filtrado/interacciones NOT_EXECUTED |



<details>
<summary>279 fichas por ID: evidencia y estado individual</summary>

| Producto/ID | Categoría/stock | URL de evidencia | Metadatos | Interacciones |
| --- | --- | --- | --- | --- |
| COLLAR AMULET — 047838c1-7054-4f3d-b023-90fb462c82e9 | collares / 1 | [https://tintinaccs.com/product?id=047838c1-7054-4f3d-b023-90fb462c82e9](https://tintinaccs.com/product?id=047838c1-7054-4f3d-b023-90fb462c82e9) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ GIANNA — 07DtHPQJ7p4VH4xqFzsd | relojes / 1 | [https://tintinaccs.com/product?id=07DtHPQJ7p4VH4xqFzsd](https://tintinaccs.com/product?id=07DtHPQJ7p4VH4xqFzsd) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR ELIORA — 20fad7c1-3b98-45da-91c3-d6db6a96b0dd | collares / 1 | [https://tintinaccs.com/product?id=20fad7c1-3b98-45da-91c3-d6db6a96b0dd](https://tintinaccs.com/product?id=20fad7c1-3b98-45da-91c3-d6db6a96b0dd) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR MILENA — 394c2049-931f-45da-8f62-59a6f06243a3 | collares / 1 | [https://tintinaccs.com/product?id=394c2049-931f-45da-8f62-59a6f06243a3](https://tintinaccs.com/product?id=394c2049-931f-45da-8f62-59a6f06243a3) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR RENATA — 54a75b07-631e-41c7-91de-fb40ecde3f14 | collares / 1 | [https://tintinaccs.com/product?id=54a75b07-631e-41c7-91de-fb40ecde3f14](https://tintinaccs.com/product?id=54a75b07-631e-41c7-91de-fb40ecde3f14) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ AMELYS — 587d6b3a-481d-4f06-9c5e-9c95f40bdad3 | relojes / 1 | [https://tintinaccs.com/product?id=587d6b3a-481d-4f06-9c5e-9c95f40bdad3](https://tintinaccs.com/product?id=587d6b3a-481d-4f06-9c5e-9c95f40bdad3) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR CHERIE — 5fded493-578e-4897-bce2-07d8ab820bfb | collares / 1 | [https://tintinaccs.com/product?id=5fded493-578e-4897-bce2-07d8ab820bfb](https://tintinaccs.com/product?id=5fded493-578e-4897-bce2-07d8ab820bfb) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR CAROLINE — 66a6f5b0-9811-41fd-a223-cc312323ada2 | collares / 1 | [https://tintinaccs.com/product?id=66a6f5b0-9811-41fd-a223-cc312323ada2](https://tintinaccs.com/product?id=66a6f5b0-9811-41fd-a223-cc312323ada2) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| MOCHILA ALYSSIA — 67f5e565-1fc5-4c17-b63e-b2b4d68ad4cc | mochilas / 1 | [https://tintinaccs.com/product?id=67f5e565-1fc5-4c17-b63e-b2b4d68ad4cc](https://tintinaccs.com/product?id=67f5e565-1fc5-4c17-b63e-b2b4d68ad4cc) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR MIRELA — 720944b9-9602-4a37-8a46-403221433000 | collares / 1 | [https://tintinaccs.com/product?id=720944b9-9602-4a37-8a46-403221433000](https://tintinaccs.com/product?id=720944b9-9602-4a37-8a46-403221433000) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR ROSELA — 72e1b077-7b7b-46a0-a25d-0c4e996e135e | collares / 1 | [https://tintinaccs.com/product?id=72e1b077-7b7b-46a0-a25d-0c4e996e135e](https://tintinaccs.com/product?id=72e1b077-7b7b-46a0-a25d-0c4e996e135e) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR ESTELLE — 77bdcb85-564c-463b-83da-abca77b46b9f | collares / 1 | [https://tintinaccs.com/product?id=77bdcb85-564c-463b-83da-abca77b46b9f](https://tintinaccs.com/product?id=77bdcb85-564c-463b-83da-abca77b46b9f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| MOCHILA MELINA — 86917d1b-5700-4fa0-b249-ff9d7aa89a6b | mochilas / 1 | [https://tintinaccs.com/product?id=86917d1b-5700-4fa0-b249-ff9d7aa89a6b](https://tintinaccs.com/product?id=86917d1b-5700-4fa0-b249-ff9d7aa89a6b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO MELIZA — 88612a50-b4b0-4b17-82a0-4dad10aad4d3 | bolsos / 1 | [https://tintinaccs.com/product?id=88612a50-b4b0-4b17-82a0-4dad10aad4d3](https://tintinaccs.com/product?id=88612a50-b4b0-4b17-82a0-4dad10aad4d3) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| MOCHILA ZELINA — 89644b43-2cd3-495b-8127-7f4caa65f1b2 | mochilas / 1 | [https://tintinaccs.com/product?id=89644b43-2cd3-495b-8127-7f4caa65f1b2](https://tintinaccs.com/product?id=89644b43-2cd3-495b-8127-7f4caa65f1b2) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR AZURIA — 95b5232b-4d18-4d81-bd22-687f620a423c | collares / 1 | [https://tintinaccs.com/product?id=95b5232b-4d18-4d81-bd22-687f620a423c](https://tintinaccs.com/product?id=95b5232b-4d18-4d81-bd22-687f620a423c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ANTONELLA — 9IHrfKoH8Ij6jljPaZa8 | bolsos / 1 | [https://tintinaccs.com/product?id=9IHrfKoH8Ij6jljPaZa8](https://tintinaccs.com/product?id=9IHrfKoH8Ij6jljPaZa8) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO + BILLETERA ZINARA — 9d68a11f-a152-453d-88ca-33b28e9d9897 | bolsos / 1 | [https://tintinaccs.com/product?id=9d68a11f-a152-453d-88ca-33b28e9d9897](https://tintinaccs.com/product?id=9d68a11f-a152-453d-88ca-33b28e9d9897) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO MALENA — EOVWSpPbZbb7FM1EQc64 | bolsos / 1 | [https://tintinaccs.com/product?id=EOVWSpPbZbb7FM1EQc64](https://tintinaccs.com/product?id=EOVWSpPbZbb7FM1EQc64) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO GIULIANA — FuFQHQN8qtWcdrLLQioA | bolsos / 1 | [https://tintinaccs.com/product?id=FuFQHQN8qtWcdrLLQioA](https://tintinaccs.com/product?id=FuFQHQN8qtWcdrLLQioA) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO TIZZIANA — LgAD8oQA1FufZzMAkz17 | bolsos / 1 | [https://tintinaccs.com/product?id=LgAD8oQA1FufZzMAkz17](https://tintinaccs.com/product?id=LgAD8oQA1FufZzMAkz17) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO AURORA — LiftzPqagfI40UQW0nLd | bolsos / 3 | [https://tintinaccs.com/product?id=LiftzPqagfI40UQW0nLd](https://tintinaccs.com/product?id=LiftzPqagfI40UQW0nLd) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO NAYELI — M24NjYQOLpUt7sWcbn4A | bolsos / 1 | [https://tintinaccs.com/product?id=M24NjYQOLpUt7sWcbn4A](https://tintinaccs.com/product?id=M24NjYQOLpUt7sWcbn4A) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ODETTE — MQTxy46eY0vq4iXAGVgA | bolsos / 1 | [https://tintinaccs.com/product?id=MQTxy46eY0vq4iXAGVgA](https://tintinaccs.com/product?id=MQTxy46eY0vq4iXAGVgA) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO AZELIA — MViPfc5S268IG9m1Z0TB | bolsos / 3 | [https://tintinaccs.com/product?id=MViPfc5S268IG9m1Z0TB](https://tintinaccs.com/product?id=MViPfc5S268IG9m1Z0TB) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO MARCELA — MmJHQ8Y3GMAPwYEYQbOA | bolsos / 2 | [https://tintinaccs.com/product?id=MmJHQ8Y3GMAPwYEYQbOA](https://tintinaccs.com/product?id=MmJHQ8Y3GMAPwYEYQbOA) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ELIZABETH — MrtJ4lio2oUeKzBCcuUt | bolsos / 1 | [https://tintinaccs.com/product?id=MrtJ4lio2oUeKzBCcuUt](https://tintinaccs.com/product?id=MrtJ4lio2oUeKzBCcuUt) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO DALMA — N2hFLjJxa9gKoIljYUsW | bolsos / 1 | [https://tintinaccs.com/product?id=N2hFLjJxa9gKoIljYUsW](https://tintinaccs.com/product?id=N2hFLjJxa9gKoIljYUsW) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO NEREA — QSX4lNnk2Qek1VJpcipV | bolsos / 1 | [https://tintinaccs.com/product?id=QSX4lNnk2Qek1VJpcipV](https://tintinaccs.com/product?id=QSX4lNnk2Qek1VJpcipV) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO RENATA — RIQ7oJA3wWJZxpHyj08h | bolsos / 1 | [https://tintinaccs.com/product?id=RIQ7oJA3wWJZxpHyj08h](https://tintinaccs.com/product?id=RIQ7oJA3wWJZxpHyj08h) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO JULIETA — Tad2GmQ9c7ZCwx4PlCdK | bolsos / 1 | [https://tintinaccs.com/product?id=Tad2GmQ9c7ZCwx4PlCdK](https://tintinaccs.com/product?id=Tad2GmQ9c7ZCwx4PlCdK) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO CELESTE — UH6i2hmYu3KHasb4lLw5 | bolsos / 1 | [https://tintinaccs.com/product?id=UH6i2hmYu3KHasb4lLw5](https://tintinaccs.com/product?id=UH6i2hmYu3KHasb4lLw5) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ELOISE — Xp2mtu5OPfU8mKMZ0clW | relojes / 1 | [https://tintinaccs.com/product?id=Xp2mtu5OPfU8mKMZ0clW](https://tintinaccs.com/product?id=Xp2mtu5OPfU8mKMZ0clW) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ISABELLA — Y7d6ms8JV7ZMlNC3ORYR | bolsos / 1 | [https://tintinaccs.com/product?id=Y7d6ms8JV7ZMlNC3ORYR](https://tintinaccs.com/product?id=Y7d6ms8JV7ZMlNC3ORYR) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ALESSIA — YoB2slYAzOGMmnwWbHLM | relojes / 1 | [https://tintinaccs.com/product?id=YoB2slYAzOGMmnwWbHLM](https://tintinaccs.com/product?id=YoB2slYAzOGMmnwWbHLM) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| MOCHILA AZENIA — a1fefc5d-4076-4c82-92c4-d411f1c3ec96 | mochilas / 1 | [https://tintinaccs.com/product?id=a1fefc5d-4076-4c82-92c4-d411f1c3ec96](https://tintinaccs.com/product?id=a1fefc5d-4076-4c82-92c4-d411f1c3ec96) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ELIORA — a4609f9d-0b55-40a2-9849-7d490e5f20b1 | bolsos / 1 | [https://tintinaccs.com/product?id=a4609f9d-0b55-40a2-9849-7d490e5f20b1](https://tintinaccs.com/product?id=a4609f9d-0b55-40a2-9849-7d490e5f20b1) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR MARIELLE — a8ca457f-0724-4139-9add-6947f3bb404f | collares / 1 | [https://tintinaccs.com/product?id=a8ca457f-0724-4139-9add-6947f3bb404f](https://tintinaccs.com/product?id=a8ca457f-0724-4139-9add-6947f3bb404f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ CHARLOTTE — bM3sX0OrqLnT7nSK2xSp | relojes / 2 | [https://tintinaccs.com/product?id=bM3sX0OrqLnT7nSK2xSp](https://tintinaccs.com/product?id=bM3sX0OrqLnT7nSK2xSp) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ELISETTE — c8048933-d6d8-4d45-a1dc-e5feb88ee60c | bolsos / 1 | [https://tintinaccs.com/product?id=c8048933-d6d8-4d45-a1dc-e5feb88ee60c](https://tintinaccs.com/product?id=c8048933-d6d8-4d45-a1dc-e5feb88ee60c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ISADORA — cc0865a2-b415-49f5-84a6-94832425c4f7 | bolsos / 1 | [https://tintinaccs.com/product?id=cc0865a2-b415-49f5-84a6-94832425c4f7](https://tintinaccs.com/product?id=cc0865a2-b415-49f5-84a6-94832425c4f7) | Título/canonical coinciden;2 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO CATALINA — d4qEJZ6i2wk6gfTWRUjy | bolsos / 1 | [https://tintinaccs.com/product?id=d4qEJZ6i2wk6gfTWRUjy](https://tintinaccs.com/product?id=d4qEJZ6i2wk6gfTWRUjy) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR LUNA — defb9445-2291-443e-9381-8f81204029e1 | collares / 1 | [https://tintinaccs.com/product?id=defb9445-2291-443e-9381-8f81204029e1](https://tintinaccs.com/product?id=defb9445-2291-443e-9381-8f81204029e1) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ADELIA — e9JBhWG1JhbtR8yiRar1 | bolsos / 1 | [https://tintinaccs.com/product?id=e9JBhWG1JhbtR8yiRar1](https://tintinaccs.com/product?id=e9JBhWG1JhbtR8yiRar1) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO AURÉLIA — f7ce0765-951d-4c2b-99cc-e0db99a0eba7 | bolsos / 1 | [https://tintinaccs.com/product?id=f7ce0765-951d-4c2b-99cc-e0db99a0eba7](https://tintinaccs.com/product?id=f7ce0765-951d-4c2b-99cc-e0db99a0eba7) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ZARETH — f90b7a7b-74ea-4922-9ddc-4103e44c79e8 | bolsos / 1 | [https://tintinaccs.com/product?id=f90b7a7b-74ea-4922-9ddc-4103e44c79e8](https://tintinaccs.com/product?id=f90b7a7b-74ea-4922-9ddc-4103e44c79e8) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR NORA — f9c9cf4b-4dfd-4240-9d5f-d4c80e26e4d3 | collares / 1 | [https://tintinaccs.com/product?id=f9c9cf4b-4dfd-4240-9d5f-d4c80e26e4d3](https://tintinaccs.com/product?id=f9c9cf4b-4dfd-4240-9d5f-d4c80e26e4d3) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO AMIRA — faDpLH7sZ0K8ncgVE6zK | bolsos / 2 | [https://tintinaccs.com/product?id=faDpLH7sZ0K8ncgVE6zK](https://tintinaccs.com/product?id=faDpLH7sZ0K8ncgVE6zK) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ISALINE — fuXxO9PjE36OC76OgMjL | bolsos / 2 | [https://tintinaccs.com/product?id=fuXxO9PjE36OC76OgMjL](https://tintinaccs.com/product?id=fuXxO9PjE36OC76OgMjL) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ORIANA — hbSypmripIxb3UVcYlOn | bolsos / 1 | [https://tintinaccs.com/product?id=hbSypmripIxb3UVcYlOn](https://tintinaccs.com/product?id=hbSypmripIxb3UVcYlOn) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO SAMIRA — hgy4i2jB4TLkbQB5WczW | bolsos / 2 | [https://tintinaccs.com/product?id=hgy4i2jB4TLkbQB5WczW](https://tintinaccs.com/product?id=hgy4i2jB4TLkbQB5WczW) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ILIANA — iBJ8itV96bqKwrEcX3KO | bolsos / 0 | [https://tintinaccs.com/product?id=iBJ8itV96bqKwrEcX3KO](https://tintinaccs.com/product?id=iBJ8itV96bqKwrEcX3KO) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| GAFAS AURA — imp_02b8b31b7a16dae1 | gafas / 0 | [https://tintinaccs.com/product?id=imp_02b8b31b7a16dae1](https://tintinaccs.com/product?id=imp_02b8b31b7a16dae1) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS BRUMMA — imp_02bc8be78b8f6b05 | aros / 1 | [https://tintinaccs.com/product?id=imp_02bc8be78b8f6b05](https://tintinaccs.com/product?id=imp_02bc8be78b8f6b05) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS CORALITA — imp_052b9cc0c6db8f24 | aros / 1 | [https://tintinaccs.com/product?id=imp_052b9cc0c6db8f24](https://tintinaccs.com/product?id=imp_052b9cc0c6db8f24) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS ILIANA — imp_06fada093366f5c7 | aros / 1 | [https://tintinaccs.com/product?id=imp_06fada093366f5c7](https://tintinaccs.com/product?id=imp_06fada093366f5c7) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BRAZALETE LURELIA — imp_06fbe0c0fa7e3b24 | pulseras / 1 | [https://tintinaccs.com/product?id=imp_06fbe0c0fa7e3b24](https://tintinaccs.com/product?id=imp_06fbe0c0fa7e3b24) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA ISABELLA — imp_0770093910f9e077 | pulseras / 0 | [https://tintinaccs.com/product?id=imp_0770093910f9e077](https://tintinaccs.com/product?id=imp_0770093910f9e077) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO AMATISTA — imp_0788bbc97f7fa507 | anillos / 1 | [https://tintinaccs.com/product?id=imp_0788bbc97f7fa507](https://tintinaccs.com/product?id=imp_0788bbc97f7fa507) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| GAFAS GLAM — imp_0820f4f5af0d3a5b | gafas / 1 | [https://tintinaccs.com/product?id=imp_0820f4f5af0d3a5b](https://tintinaccs.com/product?id=imp_0820f4f5af0d3a5b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR OLYRA — imp_0a5e06ced9fa8ada | collares / 1 | [https://tintinaccs.com/product?id=imp_0a5e06ced9fa8ada](https://tintinaccs.com/product?id=imp_0a5e06ced9fa8ada) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ VALENTINA — imp_0b208e503fd9ecb4 | relojes / 1 | [https://tintinaccs.com/product?id=imp_0b208e503fd9ecb4](https://tintinaccs.com/product?id=imp_0b208e503fd9ecb4) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR CAROLINA — imp_0b4265cab90b0bce | collares / 0 | [https://tintinaccs.com/product?id=imp_0b4265cab90b0bce](https://tintinaccs.com/product?id=imp_0b4265cab90b0bce) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| EARCUFF BELLIE — imp_0c17ec05e6ff53eb | earcuff / 1 | [https://tintinaccs.com/product?id=imp_0c17ec05e6ff53eb](https://tintinaccs.com/product?id=imp_0c17ec05e6ff53eb) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS MELANIE — imp_0e3fdf7ec54d148a | aros / 1 | [https://tintinaccs.com/product?id=imp_0e3fdf7ec54d148a](https://tintinaccs.com/product?id=imp_0e3fdf7ec54d148a) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO VAELINA — imp_0e954b11c16c110f | anillos / 0 | [https://tintinaccs.com/product?id=imp_0e954b11c16c110f](https://tintinaccs.com/product?id=imp_0e954b11c16c110f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AURELIA GOLD — imp_0f0375fbf31f75c1 | aros / 1 | [https://tintinaccs.com/product?id=imp_0f0375fbf31f75c1](https://tintinaccs.com/product?id=imp_0f0375fbf31f75c1) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR DORA — imp_0fec2d2d01a9c8b3 | collares / 1 | [https://tintinaccs.com/product?id=imp_0fec2d2d01a9c8b3](https://tintinaccs.com/product?id=imp_0fec2d2d01a9c8b3) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| EARCUFF VALENTINA — imp_1131cbd8b82e359c | earcuff / 1 | [https://tintinaccs.com/product?id=imp_1131cbd8b82e359c](https://tintinaccs.com/product?id=imp_1131cbd8b82e359c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| EARCUFF CELINA — imp_125136dc4c799c78 | earcuff / 2 | [https://tintinaccs.com/product?id=imp_125136dc4c799c78](https://tintinaccs.com/product?id=imp_125136dc4c799c78) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ARMCUFF SAPHIRA — imp_12b164aa09eca6ae | armcuff / 0 | [https://tintinaccs.com/product?id=imp_12b164aa09eca6ae](https://tintinaccs.com/product?id=imp_12b164aa09eca6ae) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS BELINDA — imp_14b0fd5a6cfc35de | aros / 1 | [https://tintinaccs.com/product?id=imp_14b0fd5a6cfc35de](https://tintinaccs.com/product?id=imp_14b0fd5a6cfc35de) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ LUCIENNE — imp_14bb7149ecf19987 | relojes / 1 | [https://tintinaccs.com/product?id=imp_14bb7149ecf19987](https://tintinaccs.com/product?id=imp_14bb7149ecf19987) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ SERENA — imp_14cac7a053145804 | relojes / 0 | [https://tintinaccs.com/product?id=imp_14cac7a053145804](https://tintinaccs.com/product?id=imp_14cac7a053145804) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR HONGO — imp_14f4a212b56087d6 | collares / 1 | [https://tintinaccs.com/product?id=imp_14f4a212b56087d6](https://tintinaccs.com/product?id=imp_14f4a212b56087d6) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS EMERA — imp_155ca2691a809127 | aros / 1 | [https://tintinaccs.com/product?id=imp_155ca2691a809127](https://tintinaccs.com/product?id=imp_155ca2691a809127) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO CANELA — imp_15634b0787c3c125 | anillos / 0 | [https://tintinaccs.com/product?id=imp_15634b0787c3c125](https://tintinaccs.com/product?id=imp_15634b0787c3c125) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS DALICE — imp_166a1fbb192b1101 | aros / 1 | [https://tintinaccs.com/product?id=imp_166a1fbb192b1101](https://tintinaccs.com/product?id=imp_166a1fbb192b1101) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS MIMI GLOW — imp_167251dfe2de1cfd | aros / 1 | [https://tintinaccs.com/product?id=imp_167251dfe2de1cfd](https://tintinaccs.com/product?id=imp_167251dfe2de1cfd) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR AMARA — imp_17c4ad3d20dc1603 | collares / 1 | [https://tintinaccs.com/product?id=imp_17c4ad3d20dc1603](https://tintinaccs.com/product?id=imp_17c4ad3d20dc1603) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ DALMIE — imp_19aafe06d0d697f2 | relojes / 0 | [https://tintinaccs.com/product?id=imp_19aafe06d0d697f2](https://tintinaccs.com/product?id=imp_19aafe06d0d697f2) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS CATALINNA — imp_1a72e3aa59482bae | aros / 2 | [https://tintinaccs.com/product?id=imp_1a72e3aa59482bae](https://tintinaccs.com/product?id=imp_1a72e3aa59482bae) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR MARISOL — imp_1a9598f2ba9f5bb6 | collares / 1 | [https://tintinaccs.com/product?id=imp_1a9598f2ba9f5bb6](https://tintinaccs.com/product?id=imp_1a9598f2ba9f5bb6) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AURELIA — imp_1b7df87a3086757e | aros / 1 | [https://tintinaccs.com/product?id=imp_1b7df87a3086757e](https://tintinaccs.com/product?id=imp_1b7df87a3086757e) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA BELLA — imp_1d4e7cfc869e1a18 | pulseras / 1 | [https://tintinaccs.com/product?id=imp_1d4e7cfc869e1a18](https://tintinaccs.com/product?id=imp_1d4e7cfc869e1a18) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| SET JOLIE COLLAR + AROS — imp_1ffa73095dfdf8c7 | collares / 0 | [https://tintinaccs.com/product?id=imp_1ffa73095dfdf8c7](https://tintinaccs.com/product?id=imp_1ffa73095dfdf8c7) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ AMELINE — imp_2010e66fbd2483cd | relojes / 1 | [https://tintinaccs.com/product?id=imp_2010e66fbd2483cd](https://tintinaccs.com/product?id=imp_2010e66fbd2483cd) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA BELLA — imp_204e81b5601a819b | pulseras / 1 | [https://tintinaccs.com/product?id=imp_204e81b5601a819b](https://tintinaccs.com/product?id=imp_204e81b5601a819b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BRAZALETE LUCIENNE — imp_2053dcc12e540e3f | pulseras / 1 | [https://tintinaccs.com/product?id=imp_2053dcc12e540e3f](https://tintinaccs.com/product?id=imp_2053dcc12e540e3f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS DOLLY — imp_21ab39d9973bb617 | aros / 2 | [https://tintinaccs.com/product?id=imp_21ab39d9973bb617](https://tintinaccs.com/product?id=imp_21ab39d9973bb617) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR ABRAZO ETERNO — imp_21fb2b68f51e2fac | collares / 2 | [https://tintinaccs.com/product?id=imp_21fb2b68f51e2fac](https://tintinaccs.com/product?id=imp_21fb2b68f51e2fac) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO MELIORA — imp_25c890d41e712d70 | anillos / 1 | [https://tintinaccs.com/product?id=imp_25c890d41e712d70](https://tintinaccs.com/product?id=imp_25c890d41e712d70) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR SIENNA — imp_270696bd4de60683 | collares / 1 | [https://tintinaccs.com/product?id=imp_270696bd4de60683](https://tintinaccs.com/product?id=imp_270696bd4de60683) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BRAZALETE LUNELLE — imp_27626fd18920fe4f | pulseras / 1 | [https://tintinaccs.com/product?id=imp_27626fd18920fe4f](https://tintinaccs.com/product?id=imp_27626fd18920fe4f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR AVELIA — imp_288b84fbdbea2ac1 | collares / 1 | [https://tintinaccs.com/product?id=imp_288b84fbdbea2ac1](https://tintinaccs.com/product?id=imp_288b84fbdbea2ac1) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO ESMERALDA — imp_2a567d5db5e56d23 | anillos / 1 | [https://tintinaccs.com/product?id=imp_2a567d5db5e56d23](https://tintinaccs.com/product?id=imp_2a567d5db5e56d23) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS NUNA — imp_2f9fe7f5b6d97b5b | aros / 1 | [https://tintinaccs.com/product?id=imp_2f9fe7f5b6d97b5b](https://tintinaccs.com/product?id=imp_2f9fe7f5b6d97b5b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR REINA — imp_31ec815cd501a7f8 | collares / 1 | [https://tintinaccs.com/product?id=imp_31ec815cd501a7f8](https://tintinaccs.com/product?id=imp_31ec815cd501a7f8) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR ISARA — imp_325bb37bbc3dc241 | collares / 1 | [https://tintinaccs.com/product?id=imp_325bb37bbc3dc241](https://tintinaccs.com/product?id=imp_325bb37bbc3dc241) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BAG CHERRY — imp_337b9ec53fd2512b | bolsos / 1 | [https://tintinaccs.com/product?id=imp_337b9ec53fd2512b](https://tintinaccs.com/product?id=imp_337b9ec53fd2512b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS HYLIE — imp_3581660f8864356d | aros / 0 | [https://tintinaccs.com/product?id=imp_3581660f8864356d](https://tintinaccs.com/product?id=imp_3581660f8864356d) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BRAZALETE GIOVANNA — imp_35e851c30d38ebc9 | pulseras / 1 | [https://tintinaccs.com/product?id=imp_35e851c30d38ebc9](https://tintinaccs.com/product?id=imp_35e851c30d38ebc9) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR MELIZZA — imp_3618d9f13cb3c0ef | collares / 1 | [https://tintinaccs.com/product?id=imp_3618d9f13cb3c0ef](https://tintinaccs.com/product?id=imp_3618d9f13cb3c0ef) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO ZAFIRA — imp_36a0007c4e4c0898 | anillos / 1 | [https://tintinaccs.com/product?id=imp_36a0007c4e4c0898](https://tintinaccs.com/product?id=imp_36a0007c4e4c0898) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO ARLISSE — imp_36e52210bd0314f4 | anillos / 1 | [https://tintinaccs.com/product?id=imp_36e52210bd0314f4](https://tintinaccs.com/product?id=imp_36e52210bd0314f4) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR FLORENCIA — imp_38404ce6ab8587d2 | collares / 1 | [https://tintinaccs.com/product?id=imp_38404ce6ab8587d2](https://tintinaccs.com/product?id=imp_38404ce6ab8587d2) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO CORIELLE — imp_39243318fe03145c | anillos / 0 | [https://tintinaccs.com/product?id=imp_39243318fe03145c](https://tintinaccs.com/product?id=imp_39243318fe03145c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO AMORE — imp_392ba88d141f7093 | anillos / 7 | [https://tintinaccs.com/product?id=imp_392ba88d141f7093](https://tintinaccs.com/product?id=imp_392ba88d141f7093) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ CRYSTAL GLOW — imp_3a3ce9c4fcb81d20 | relojes / 0 | [https://tintinaccs.com/product?id=imp_3a3ce9c4fcb81d20](https://tintinaccs.com/product?id=imp_3a3ce9c4fcb81d20) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR PET LOVE — imp_3d65452cf76b0748 | collares / 1 | [https://tintinaccs.com/product?id=imp_3d65452cf76b0748](https://tintinaccs.com/product?id=imp_3d65452cf76b0748) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO AZELINNE — imp_3d80547d1f527ec3 | anillos / 0 | [https://tintinaccs.com/product?id=imp_3d80547d1f527ec3](https://tintinaccs.com/product?id=imp_3d80547d1f527ec3) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR MARIZZA — imp_407eb67f76437b1d | collares / 0 | [https://tintinaccs.com/product?id=imp_407eb67f76437b1d](https://tintinaccs.com/product?id=imp_407eb67f76437b1d) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ EVELIA — imp_4209f0f0c1efa6d4 | relojes / 1 | [https://tintinaccs.com/product?id=imp_4209f0f0c1efa6d4](https://tintinaccs.com/product?id=imp_4209f0f0c1efa6d4) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO ISMERAY — imp_42aeb8e1a7d5e8df | anillos / 1 | [https://tintinaccs.com/product?id=imp_42aeb8e1a7d5e8df](https://tintinaccs.com/product?id=imp_42aeb8e1a7d5e8df) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR AMORE — imp_44112fcf2bf43ead | collares / 1 | [https://tintinaccs.com/product?id=imp_44112fcf2bf43ead](https://tintinaccs.com/product?id=imp_44112fcf2bf43ead) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ROSSE — imp_458888a0637c9304 | relojes / 1 | [https://tintinaccs.com/product?id=imp_458888a0637c9304](https://tintinaccs.com/product?id=imp_458888a0637c9304) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ AURELIA — imp_4ccd03236fdec729 | relojes / 0 | [https://tintinaccs.com/product?id=imp_4ccd03236fdec729](https://tintinaccs.com/product?id=imp_4ccd03236fdec729) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS MIKA — imp_4dbb7f497b075387 | aros / 0 | [https://tintinaccs.com/product?id=imp_4dbb7f497b075387](https://tintinaccs.com/product?id=imp_4dbb7f497b075387) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ARMCUFF THAYANA — imp_4e00b191910f908f | armcuff / 1 | [https://tintinaccs.com/product?id=imp_4e00b191910f908f](https://tintinaccs.com/product?id=imp_4e00b191910f908f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS DALYA — imp_4e93898291065746 | aros / 1 | [https://tintinaccs.com/product?id=imp_4e93898291065746](https://tintinaccs.com/product?id=imp_4e93898291065746) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| EARCUFF NAOMI — imp_4ed38ef55182385b | earcuff / 1 | [https://tintinaccs.com/product?id=imp_4ed38ef55182385b](https://tintinaccs.com/product?id=imp_4ed38ef55182385b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ CRYSTHEL — imp_4f1a33c48a47ab20 | relojes / 2 | [https://tintinaccs.com/product?id=imp_4f1a33c48a47ab20](https://tintinaccs.com/product?id=imp_4f1a33c48a47ab20) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS MELINA — imp_4fc3e1ffbc37219d | aros / 1 | [https://tintinaccs.com/product?id=imp_4fc3e1ffbc37219d](https://tintinaccs.com/product?id=imp_4fc3e1ffbc37219d) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR MIREYA — imp_51fc82a2801755e6 | collares / 1 | [https://tintinaccs.com/product?id=imp_51fc82a2801755e6](https://tintinaccs.com/product?id=imp_51fc82a2801755e6) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS MILORI — imp_53996621ba9a1c9f | aros / 1 | [https://tintinaccs.com/product?id=imp_53996621ba9a1c9f](https://tintinaccs.com/product?id=imp_53996621ba9a1c9f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO NERISSE — imp_561ad58e1549a01a | anillos / 1 | [https://tintinaccs.com/product?id=imp_561ad58e1549a01a](https://tintinaccs.com/product?id=imp_561ad58e1549a01a) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ FIORELLA — imp_566b22325733ac76 | relojes / 2 | [https://tintinaccs.com/product?id=imp_566b22325733ac76](https://tintinaccs.com/product?id=imp_566b22325733ac76) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BRAZALETE SERENYA — imp_57a75413027c9d19 | pulseras / 1 | [https://tintinaccs.com/product?id=imp_57a75413027c9d19](https://tintinaccs.com/product?id=imp_57a75413027c9d19) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ AMELIE — imp_591512a1d35a3e1f | relojes / 1 | [https://tintinaccs.com/product?id=imp_591512a1d35a3e1f](https://tintinaccs.com/product?id=imp_591512a1d35a3e1f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ISADORA — imp_59184c87764639a5 | relojes / 1 | [https://tintinaccs.com/product?id=imp_59184c87764639a5](https://tintinaccs.com/product?id=imp_59184c87764639a5) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR EILENE — imp_5ad1cc9f7242bc3d | collares / 1 | [https://tintinaccs.com/product?id=imp_5ad1cc9f7242bc3d](https://tintinaccs.com/product?id=imp_5ad1cc9f7242bc3d) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AYLIN — imp_5b1c72d496e7c370 | aros / 1 | [https://tintinaccs.com/product?id=imp_5b1c72d496e7c370](https://tintinaccs.com/product?id=imp_5b1c72d496e7c370) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AYLEN — imp_5b256d307aa97994 | aros / 1 | [https://tintinaccs.com/product?id=imp_5b256d307aa97994](https://tintinaccs.com/product?id=imp_5b256d307aa97994) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS CECILIE — imp_5c62dab38d9a8439 | aros / 1 | [https://tintinaccs.com/product?id=imp_5c62dab38d9a8439](https://tintinaccs.com/product?id=imp_5c62dab38d9a8439) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS ZURI — imp_5cfc5b873744eea5 | aros / 0 | [https://tintinaccs.com/product?id=imp_5cfc5b873744eea5](https://tintinaccs.com/product?id=imp_5cfc5b873744eea5) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO ROSAVELLE — imp_5d59e4b285b25ff6 | anillos / 1 | [https://tintinaccs.com/product?id=imp_5d59e4b285b25ff6](https://tintinaccs.com/product?id=imp_5d59e4b285b25ff6) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR EVANIA — imp_5f57f98d53aedb93 | collares / 1 | [https://tintinaccs.com/product?id=imp_5f57f98d53aedb93](https://tintinaccs.com/product?id=imp_5f57f98d53aedb93) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS ELOWEN — imp_6156839779cd0ab5 | aros / 1 | [https://tintinaccs.com/product?id=imp_6156839779cd0ab5](https://tintinaccs.com/product?id=imp_6156839779cd0ab5) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BRAZALETE AVENYA — imp_631d58d6acf09542 | pulseras / 1 | [https://tintinaccs.com/product?id=imp_631d58d6acf09542](https://tintinaccs.com/product?id=imp_631d58d6acf09542) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| SET VAN CLEEF PREMIUM — imp_63bce17c9f78a398 | collares / 1 | [https://tintinaccs.com/product?id=imp_63bce17c9f78a398](https://tintinaccs.com/product?id=imp_63bce17c9f78a398) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BAG BELLA — imp_6405cab5e00b149b | bolsos / 1 | [https://tintinaccs.com/product?id=imp_6405cab5e00b149b](https://tintinaccs.com/product?id=imp_6405cab5e00b149b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO FLORAL — imp_67dc97aa009ba7ae | anillos / 1 | [https://tintinaccs.com/product?id=imp_67dc97aa009ba7ae](https://tintinaccs.com/product?id=imp_67dc97aa009ba7ae) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| GAFAS MORIA — imp_67f9deb460c60350 | gafas / 1 | [https://tintinaccs.com/product?id=imp_67f9deb460c60350](https://tintinaccs.com/product?id=imp_67f9deb460c60350) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| GAFAS LIA — imp_6a7a651ae719411e | gafas / 1 | [https://tintinaccs.com/product?id=imp_6a7a651ae719411e](https://tintinaccs.com/product?id=imp_6a7a651ae719411e) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR HELENA — imp_6b354f5e9b51feea | collares / 1 | [https://tintinaccs.com/product?id=imp_6b354f5e9b51feea](https://tintinaccs.com/product?id=imp_6b354f5e9b51feea) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS LIZIE — imp_6c7c11d04155db34 | aros / 1 | [https://tintinaccs.com/product?id=imp_6c7c11d04155db34](https://tintinaccs.com/product?id=imp_6c7c11d04155db34) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BRAZALETE AMARA — imp_6db599e01135e2c4 | pulseras / 2 | [https://tintinaccs.com/product?id=imp_6db599e01135e2c4](https://tintinaccs.com/product?id=imp_6db599e01135e2c4) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AURA — imp_6f71b26470aa9c40 | aros / 1 | [https://tintinaccs.com/product?id=imp_6f71b26470aa9c40](https://tintinaccs.com/product?id=imp_6f71b26470aa9c40) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ARMCUFF ORLENA — imp_6f74341f683036bd | armcuff / 1 | [https://tintinaccs.com/product?id=imp_6f74341f683036bd](https://tintinaccs.com/product?id=imp_6f74341f683036bd) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PORTA ANILLO — imp_711393b96698abf7 | joyeros / 1 | [https://tintinaccs.com/product?id=imp_711393b96698abf7](https://tintinaccs.com/product?id=imp_711393b96698abf7) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA SIRELY — imp_73f6150c5f03b2a8 | pulseras / 0 | [https://tintinaccs.com/product?id=imp_73f6150c5f03b2a8](https://tintinaccs.com/product?id=imp_73f6150c5f03b2a8) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ESCLAVA VENEZIA — imp_740b99a1ae949b1f | pulseras / 1 | [https://tintinaccs.com/product?id=imp_740b99a1ae949b1f](https://tintinaccs.com/product?id=imp_740b99a1ae949b1f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| GAFAS ROYAL — imp_74a75ef38478c8f9 | gafas / 1 | [https://tintinaccs.com/product?id=imp_74a75ef38478c8f9](https://tintinaccs.com/product?id=imp_74a75ef38478c8f9) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BAG BELLA + BANDOLERA — imp_77417a439cb1a149 | bolsos / 1 | [https://tintinaccs.com/product?id=imp_77417a439cb1a149](https://tintinaccs.com/product?id=imp_77417a439cb1a149) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR MAIA — imp_776ca103da036c89 | collares / 1 | [https://tintinaccs.com/product?id=imp_776ca103da036c89](https://tintinaccs.com/product?id=imp_776ca103da036c89) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO VALESKA — imp_78f7c370f9430a54 | anillos / 1 | [https://tintinaccs.com/product?id=imp_78f7c370f9430a54](https://tintinaccs.com/product?id=imp_78f7c370f9430a54) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| TOBILLERA KALENA — imp_79d8c8a2fc37f7e6 | tobilleras / 1 | [https://tintinaccs.com/product?id=imp_79d8c8a2fc37f7e6](https://tintinaccs.com/product?id=imp_79d8c8a2fc37f7e6) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ CAMILLE — imp_7a9560a55fc0e30b | relojes / 0 | [https://tintinaccs.com/product?id=imp_7a9560a55fc0e30b](https://tintinaccs.com/product?id=imp_7a9560a55fc0e30b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| EARCUFF ROSA — imp_7a9c16c1e9fcec3f | earcuff / 1 | [https://tintinaccs.com/product?id=imp_7a9c16c1e9fcec3f](https://tintinaccs.com/product?id=imp_7a9c16c1e9fcec3f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AVELIA — imp_7b7c93b74b892955 | aros / 1 | [https://tintinaccs.com/product?id=imp_7b7c93b74b892955](https://tintinaccs.com/product?id=imp_7b7c93b74b892955) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO CRISTAL — imp_7ca05231206a5caf | anillos / 2 | [https://tintinaccs.com/product?id=imp_7ca05231206a5caf](https://tintinaccs.com/product?id=imp_7ca05231206a5caf) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR BELINDA — imp_7eacbc1e5867f52a | collares / 1 | [https://tintinaccs.com/product?id=imp_7eacbc1e5867f52a](https://tintinaccs.com/product?id=imp_7eacbc1e5867f52a) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| JOYERO ROSIE — imp_80060738e18e8efc | joyeros / 1 | [https://tintinaccs.com/product?id=imp_80060738e18e8efc](https://tintinaccs.com/product?id=imp_80060738e18e8efc) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR OLIVIA — imp_80e45a618bf5415f | collares / 1 | [https://tintinaccs.com/product?id=imp_80e45a618bf5415f](https://tintinaccs.com/product?id=imp_80e45a618bf5415f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR ISMERA — imp_80fde1407d22b8a4 | collares / 0 | [https://tintinaccs.com/product?id=imp_80fde1407d22b8a4](https://tintinaccs.com/product?id=imp_80fde1407d22b8a4) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS MELLI — imp_833cacb039c6bc14 | aros / 1 | [https://tintinaccs.com/product?id=imp_833cacb039c6bc14](https://tintinaccs.com/product?id=imp_833cacb039c6bc14) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AMINA — imp_83a0325dd735e423 | aros / 1 | [https://tintinaccs.com/product?id=imp_83a0325dd735e423](https://tintinaccs.com/product?id=imp_83a0325dd735e423) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR EMMA — imp_8551248b8ba39011 | collares / 0 | [https://tintinaccs.com/product?id=imp_8551248b8ba39011](https://tintinaccs.com/product?id=imp_8551248b8ba39011) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO OLIVARA — imp_855f595d32a52123 | anillos / 1 | [https://tintinaccs.com/product?id=imp_855f595d32a52123](https://tintinaccs.com/product?id=imp_855f595d32a52123) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ARMCUFF ZEPHIRA — imp_8633a3c18f402b3f | armcuff / 0 | [https://tintinaccs.com/product?id=imp_8633a3c18f402b3f](https://tintinaccs.com/product?id=imp_8633a3c18f402b3f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO CLARISSE — imp_86440d19bd2687d7 | anillos / 1 | [https://tintinaccs.com/product?id=imp_86440d19bd2687d7](https://tintinaccs.com/product?id=imp_86440d19bd2687d7) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA BRIELLE — imp_8a19f945221b0cab | pulseras / 1 | [https://tintinaccs.com/product?id=imp_8a19f945221b0cab](https://tintinaccs.com/product?id=imp_8a19f945221b0cab) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| EARCUFF BELLE — imp_8d3941aec2de22ba | earcuff / 1 | [https://tintinaccs.com/product?id=imp_8d3941aec2de22ba](https://tintinaccs.com/product?id=imp_8d3941aec2de22ba) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA ELARIS — imp_8d520dfcc7394518 | pulseras / 0 | [https://tintinaccs.com/product?id=imp_8d520dfcc7394518](https://tintinaccs.com/product?id=imp_8d520dfcc7394518) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PORTA COLLAR — imp_8f535be7a62d5b05 | joyeros / 1 | [https://tintinaccs.com/product?id=imp_8f535be7a62d5b05](https://tintinaccs.com/product?id=imp_8f535be7a62d5b05) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS ORELIA — imp_8f8ac6e9995c5aa7 | aros / 2 | [https://tintinaccs.com/product?id=imp_8f8ac6e9995c5aa7](https://tintinaccs.com/product?id=imp_8f8ac6e9995c5aa7) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR AZARIA — imp_9153a34962229f87 | collares / 1 | [https://tintinaccs.com/product?id=imp_9153a34962229f87](https://tintinaccs.com/product?id=imp_9153a34962229f87) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR AURELIA — imp_925a9546707c76b2 | collares / 1 | [https://tintinaccs.com/product?id=imp_925a9546707c76b2](https://tintinaccs.com/product?id=imp_925a9546707c76b2) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO FIORENZA — imp_9307be33ec8792b9 | anillos / 1 | [https://tintinaccs.com/product?id=imp_9307be33ec8792b9](https://tintinaccs.com/product?id=imp_9307be33ec8792b9) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS LOLY — imp_9389f39968058757 | aros / 0 | [https://tintinaccs.com/product?id=imp_9389f39968058757](https://tintinaccs.com/product?id=imp_9389f39968058757) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ESTELLA — imp_93c696ba6400613e | relojes / 0 | [https://tintinaccs.com/product?id=imp_93c696ba6400613e](https://tintinaccs.com/product?id=imp_93c696ba6400613e) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS MAR — imp_94bdfbc5564f802b | aros / 1 | [https://tintinaccs.com/product?id=imp_94bdfbc5564f802b](https://tintinaccs.com/product?id=imp_94bdfbc5564f802b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA FLORENCE — imp_9944aba2ef9388e6 | pulseras / 2 | [https://tintinaccs.com/product?id=imp_9944aba2ef9388e6](https://tintinaccs.com/product?id=imp_9944aba2ef9388e6) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BAG NOIR — imp_9a3d82b1c176ea2f | bolsos / 0 | [https://tintinaccs.com/product?id=imp_9a3d82b1c176ea2f](https://tintinaccs.com/product?id=imp_9a3d82b1c176ea2f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| GAFAS LESLIE — imp_9aea174e63bcb85a | gafas / 0 | [https://tintinaccs.com/product?id=imp_9aea174e63bcb85a](https://tintinaccs.com/product?id=imp_9aea174e63bcb85a) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| GAFAS LUXE — imp_9b7ac63410dafdd0 | gafas / 0 | [https://tintinaccs.com/product?id=imp_9b7ac63410dafdd0](https://tintinaccs.com/product?id=imp_9b7ac63410dafdd0) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR NERINA — imp_9b9fef2e63643f3a | collares / 1 | [https://tintinaccs.com/product?id=imp_9b9fef2e63643f3a](https://tintinaccs.com/product?id=imp_9b9fef2e63643f3a) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR ISLA — imp_9e0bf8d82b44549c | collares / 1 | [https://tintinaccs.com/product?id=imp_9e0bf8d82b44549c](https://tintinaccs.com/product?id=imp_9e0bf8d82b44549c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PORTA ANILLO CORAZÓN — imp_a0c0478430920560 | joyeros / 1 | [https://tintinaccs.com/product?id=imp_a0c0478430920560](https://tintinaccs.com/product?id=imp_a0c0478430920560) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO ALISSEA — imp_a0e7d68f00c282ed | anillos / 1 | [https://tintinaccs.com/product?id=imp_a0e7d68f00c282ed](https://tintinaccs.com/product?id=imp_a0e7d68f00c282ed) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ DORELLE — imp_a136d69309979099 | relojes / 0 | [https://tintinaccs.com/product?id=imp_a136d69309979099](https://tintinaccs.com/product?id=imp_a136d69309979099) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ CLARISSE — imp_a208401450c73430 | relojes / 1 | [https://tintinaccs.com/product?id=imp_a208401450c73430](https://tintinaccs.com/product?id=imp_a208401450c73430) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| TOBILLERA SIRENA — imp_a3ad0bccf64155e8 | tobilleras / 1 | [https://tintinaccs.com/product?id=imp_a3ad0bccf64155e8](https://tintinaccs.com/product?id=imp_a3ad0bccf64155e8) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS EMMILIA — imp_a3c335c320c677c9 | aros / 1 | [https://tintinaccs.com/product?id=imp_a3c335c320c677c9](https://tintinaccs.com/product?id=imp_a3c335c320c677c9) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ESCLAVA AZZURA — imp_a759d57c560bdf98 | pulseras / 2 | [https://tintinaccs.com/product?id=imp_a759d57c560bdf98](https://tintinaccs.com/product?id=imp_a759d57c560bdf98) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR AMARIS — imp_a88930e222fb94a6 | collares / 1 | [https://tintinaccs.com/product?id=imp_a88930e222fb94a6](https://tintinaccs.com/product?id=imp_a88930e222fb94a6) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR ESME — imp_a89f24b520be529b | collares / 1 | [https://tintinaccs.com/product?id=imp_a89f24b520be529b](https://tintinaccs.com/product?id=imp_a89f24b520be529b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS MARIEL — imp_a8d2becd5c097e53 | aros / 1 | [https://tintinaccs.com/product?id=imp_a8d2becd5c097e53](https://tintinaccs.com/product?id=imp_a8d2becd5c097e53) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR PERLA ROSA — imp_aa1fe42f1865df0d | collares / 1 | [https://tintinaccs.com/product?id=imp_aa1fe42f1865df0d](https://tintinaccs.com/product?id=imp_aa1fe42f1865df0d) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ VITTORIA — imp_aa95a63605edaca2 | relojes / 0 | [https://tintinaccs.com/product?id=imp_aa95a63605edaca2](https://tintinaccs.com/product?id=imp_aa95a63605edaca2) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS NARELLA — imp_ab6020ae561ec7ba | aros / 2 | [https://tintinaccs.com/product?id=imp_ab6020ae561ec7ba](https://tintinaccs.com/product?id=imp_ab6020ae561ec7ba) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| SET TORTUGAS GOLD — imp_ac58f6468cc191b2 | collares / 1 | [https://tintinaccs.com/product?id=imp_ac58f6468cc191b2](https://tintinaccs.com/product?id=imp_ac58f6468cc191b2) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO FINYRA — imp_ac74f6082a17704c | anillos / 1 | [https://tintinaccs.com/product?id=imp_ac74f6082a17704c](https://tintinaccs.com/product?id=imp_ac74f6082a17704c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR SOLEIL — imp_b03bcadf3fe3bffd | collares / 1 | [https://tintinaccs.com/product?id=imp_b03bcadf3fe3bffd](https://tintinaccs.com/product?id=imp_b03bcadf3fe3bffd) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ CELESTIA — imp_b107d06673e57652 | relojes / 0 | [https://tintinaccs.com/product?id=imp_b107d06673e57652](https://tintinaccs.com/product?id=imp_b107d06673e57652) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AMORE — imp_b285330319929289 | aros / 0 | [https://tintinaccs.com/product?id=imp_b285330319929289](https://tintinaccs.com/product?id=imp_b285330319929289) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO PÉTALO — imp_b47bd85c3dcff4f8 | anillos / 1 | [https://tintinaccs.com/product?id=imp_b47bd85c3dcff4f8](https://tintinaccs.com/product?id=imp_b47bd85c3dcff4f8) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| GAFAS DELIA — imp_b4eb5477637f8e95 | gafas / 1 | [https://tintinaccs.com/product?id=imp_b4eb5477637f8e95](https://tintinaccs.com/product?id=imp_b4eb5477637f8e95) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS ANABELLA — imp_b5301d0a4e8e848e | aros / 1 | [https://tintinaccs.com/product?id=imp_b5301d0a4e8e848e](https://tintinaccs.com/product?id=imp_b5301d0a4e8e848e) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| JOYERITO LOVE — imp_b651a493c2e78a99 | joyeros / 1 | [https://tintinaccs.com/product?id=imp_b651a493c2e78a99](https://tintinaccs.com/product?id=imp_b651a493c2e78a99) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| EARCUFF LUMMA — imp_b7c72fa294faf4e6 | earcuff / 1 | [https://tintinaccs.com/product?id=imp_b7c72fa294faf4e6](https://tintinaccs.com/product?id=imp_b7c72fa294faf4e6) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO ESTRELLA — imp_b81d3565db79484b | anillos / 1 | [https://tintinaccs.com/product?id=imp_b81d3565db79484b](https://tintinaccs.com/product?id=imp_b81d3565db79484b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO AZALEA — imp_b8ae73d5f67c20bb | anillos / 2 | [https://tintinaccs.com/product?id=imp_b8ae73d5f67c20bb](https://tintinaccs.com/product?id=imp_b8ae73d5f67c20bb) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| EARCUFF ELIZ — imp_bb757aaa481638ae | earcuff / 1 | [https://tintinaccs.com/product?id=imp_bb757aaa481638ae](https://tintinaccs.com/product?id=imp_bb757aaa481638ae) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA ALESSIA — imp_bee898ca86530cce | pulseras / 0 | [https://tintinaccs.com/product?id=imp_bee898ca86530cce](https://tintinaccs.com/product?id=imp_bee898ca86530cce) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR CONCHA — imp_c02852015ceaabff | collares / 1 | [https://tintinaccs.com/product?id=imp_c02852015ceaabff](https://tintinaccs.com/product?id=imp_c02852015ceaabff) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS DORIS — imp_c0529660525f7444 | aros / 1 | [https://tintinaccs.com/product?id=imp_c0529660525f7444](https://tintinaccs.com/product?id=imp_c0529660525f7444) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| JOYERITOS ROSÉ — imp_c115eff355fcf3f9 | joyeros / 2 | [https://tintinaccs.com/product?id=imp_c115eff355fcf3f9](https://tintinaccs.com/product?id=imp_c115eff355fcf3f9) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| EARCUFF CRUZ — imp_c1d299b88e48327c | earcuff / 1 | [https://tintinaccs.com/product?id=imp_c1d299b88e48327c](https://tintinaccs.com/product?id=imp_c1d299b88e48327c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR ISABELLA — imp_c3d826a2856121e6 | collares / 1 | [https://tintinaccs.com/product?id=imp_c3d826a2856121e6](https://tintinaccs.com/product?id=imp_c3d826a2856121e6) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS SAMIRA — imp_c5f29d042325d9e0 | aros / 1 | [https://tintinaccs.com/product?id=imp_c5f29d042325d9e0](https://tintinaccs.com/product?id=imp_c5f29d042325d9e0) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS ZAFIRA — imp_c61ff9cab57b27ce | aros / 1 | [https://tintinaccs.com/product?id=imp_c61ff9cab57b27ce](https://tintinaccs.com/product?id=imp_c61ff9cab57b27ce) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS VELINE — imp_c7110d8827147acc | aros / 1 | [https://tintinaccs.com/product?id=imp_c7110d8827147acc](https://tintinaccs.com/product?id=imp_c7110d8827147acc) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ROSALIE — imp_c815ed33a553a7b9 | relojes / 1 | [https://tintinaccs.com/product?id=imp_c815ed33a553a7b9](https://tintinaccs.com/product?id=imp_c815ed33a553a7b9) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO OLIVIA — imp_c91045e322694769 | anillos / 0 | [https://tintinaccs.com/product?id=imp_c91045e322694769](https://tintinaccs.com/product?id=imp_c91045e322694769) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| GAFAS BEL — imp_c98acc77c2fa3695 | gafas / 1 | [https://tintinaccs.com/product?id=imp_c98acc77c2fa3695](https://tintinaccs.com/product?id=imp_c98acc77c2fa3695) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA KIARA — imp_cdf4b5ecfa84f088 | pulseras / 1 | [https://tintinaccs.com/product?id=imp_cdf4b5ecfa84f088](https://tintinaccs.com/product?id=imp_cdf4b5ecfa84f088) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ VALENTINA — imp_cea699760d541762 | relojes / 0 | [https://tintinaccs.com/product?id=imp_cea699760d541762](https://tintinaccs.com/product?id=imp_cea699760d541762) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA MAGNOLIA — imp_cf4b3ad4b8a5db70 | pulseras / 1 | [https://tintinaccs.com/product?id=imp_cf4b3ad4b8a5db70](https://tintinaccs.com/product?id=imp_cf4b3ad4b8a5db70) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS DIDI — imp_cf960fd7f2a42075 | aros / 0 | [https://tintinaccs.com/product?id=imp_cf960fd7f2a42075](https://tintinaccs.com/product?id=imp_cf960fd7f2a42075) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| SET TORTUGAS MARINAS — imp_cfd2c172daa41136 | collares / 1 | [https://tintinaccs.com/product?id=imp_cfd2c172daa41136](https://tintinaccs.com/product?id=imp_cfd2c172daa41136) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA ADRIELLE — imp_cfdff220789b0384 | pulseras / 2 | [https://tintinaccs.com/product?id=imp_cfdff220789b0384](https://tintinaccs.com/product?id=imp_cfdff220789b0384) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AURORA — imp_d035833057570b94 | aros / 1 | [https://tintinaccs.com/product?id=imp_d035833057570b94](https://tintinaccs.com/product?id=imp_d035833057570b94) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ANASTASIA — imp_d1bc58e77f096a05 | relojes / 0 | [https://tintinaccs.com/product?id=imp_d1bc58e77f096a05](https://tintinaccs.com/product?id=imp_d1bc58e77f096a05) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR LOLA — imp_d268a9051d14a2eb | collares / 1 | [https://tintinaccs.com/product?id=imp_d268a9051d14a2eb](https://tintinaccs.com/product?id=imp_d268a9051d14a2eb) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS NERINA — imp_d51b237af0139e7e | aros / 1 | [https://tintinaccs.com/product?id=imp_d51b237af0139e7e](https://tintinaccs.com/product?id=imp_d51b237af0139e7e) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ODETTE — imp_d63fd59d1209f6e3 | relojes / 1 | [https://tintinaccs.com/product?id=imp_d63fd59d1209f6e3](https://tintinaccs.com/product?id=imp_d63fd59d1209f6e3) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BRAZALETE MAYVANA — imp_d6fded4adc1ae64e | pulseras / 1 | [https://tintinaccs.com/product?id=imp_d6fded4adc1ae64e](https://tintinaccs.com/product?id=imp_d6fded4adc1ae64e) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO ELIANNE — imp_d8d82a198fcaf6d7 | anillos / 1 | [https://tintinaccs.com/product?id=imp_d8d82a198fcaf6d7](https://tintinaccs.com/product?id=imp_d8d82a198fcaf6d7) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AMELIE — imp_d9ae7de6d12b92d2 | aros / 1 | [https://tintinaccs.com/product?id=imp_d9ae7de6d12b92d2](https://tintinaccs.com/product?id=imp_d9ae7de6d12b92d2) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ISABELLA — imp_dae04c918300898f | relojes / 1 | [https://tintinaccs.com/product?id=imp_dae04c918300898f](https://tintinaccs.com/product?id=imp_dae04c918300898f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO ELINNE — imp_dbb3d7a2a263ace6 | anillos / 1 | [https://tintinaccs.com/product?id=imp_dbb3d7a2a263ace6](https://tintinaccs.com/product?id=imp_dbb3d7a2a263ace6) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| PULSERA MARIELLE — imp_dd300fa3bffa08a9 | pulseras / 0 | [https://tintinaccs.com/product?id=imp_dd300fa3bffa08a9](https://tintinaccs.com/product?id=imp_dd300fa3bffa08a9) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AMELIA — imp_ddae8432b77cc276 | aros / 1 | [https://tintinaccs.com/product?id=imp_ddae8432b77cc276](https://tintinaccs.com/product?id=imp_ddae8432b77cc276) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS VERÓNICA — imp_debf90d0b6276034 | aros / 1 | [https://tintinaccs.com/product?id=imp_debf90d0b6276034](https://tintinaccs.com/product?id=imp_debf90d0b6276034) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR KAELINA — imp_e1e3954c36a42668 | collares / 1 | [https://tintinaccs.com/product?id=imp_e1e3954c36a42668](https://tintinaccs.com/product?id=imp_e1e3954c36a42668) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS FIOBELLA — imp_e1ea499101b7988f | aros / 1 | [https://tintinaccs.com/product?id=imp_e1ea499101b7988f](https://tintinaccs.com/product?id=imp_e1ea499101b7988f) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AURELLE — imp_e370d45fabce107d | aros / 1 | [https://tintinaccs.com/product?id=imp_e370d45fabce107d](https://tintinaccs.com/product?id=imp_e370d45fabce107d) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ÉVORA LUX — imp_e4edfa2d9119c7b3 | relojes / 1 | [https://tintinaccs.com/product?id=imp_e4edfa2d9119c7b3](https://tintinaccs.com/product?id=imp_e4edfa2d9119c7b3) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR ISMERA — imp_e5697f52170f7f96 | collares / 1 | [https://tintinaccs.com/product?id=imp_e5697f52170f7f96](https://tintinaccs.com/product?id=imp_e5697f52170f7f96) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| Gafas Transparente — imp_e58b23f87010593c | gafas / 1 | [https://tintinaccs.com/product?id=imp_e58b23f87010593c](https://tintinaccs.com/product?id=imp_e58b23f87010593c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR MIREL — imp_e64e31c8eababa8c | collares / 1 | [https://tintinaccs.com/product?id=imp_e64e31c8eababa8c](https://tintinaccs.com/product?id=imp_e64e31c8eababa8c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ELODIE — imp_e74102ecc5006f88 | relojes / 0 | [https://tintinaccs.com/product?id=imp_e74102ecc5006f88](https://tintinaccs.com/product?id=imp_e74102ecc5006f88) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO MIRENZA — imp_e790dcc908540007 | anillos / 1 | [https://tintinaccs.com/product?id=imp_e790dcc908540007](https://tintinaccs.com/product?id=imp_e790dcc908540007) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| ANILLO SOLANA — imp_eb2467498c42cb87 | anillos / 0 | [https://tintinaccs.com/product?id=imp_eb2467498c42cb87](https://tintinaccs.com/product?id=imp_eb2467498c42cb87) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS MAIKA — imp_eb2b01247647d280 | aros / 1 | [https://tintinaccs.com/product?id=imp_eb2b01247647d280](https://tintinaccs.com/product?id=imp_eb2b01247647d280) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ GABRIELLE — imp_f04d5b65de568a4b | relojes / 0 | [https://tintinaccs.com/product?id=imp_f04d5b65de568a4b](https://tintinaccs.com/product?id=imp_f04d5b65de568a4b) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| SET COLLAR + AROS ROSAS — imp_f2f4924e5137515a | collares / 1 | [https://tintinaccs.com/product?id=imp_f2f4924e5137515a](https://tintinaccs.com/product?id=imp_f2f4924e5137515a) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR LIORA — imp_f6b6951801c12a5c | collares / 2 | [https://tintinaccs.com/product?id=imp_f6b6951801c12a5c](https://tintinaccs.com/product?id=imp_f6b6951801c12a5c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS FYO — imp_f7e64a1b630de7e1 | aros / 1 | [https://tintinaccs.com/product?id=imp_f7e64a1b630de7e1](https://tintinaccs.com/product?id=imp_f7e64a1b630de7e1) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| COLLAR FLORA — imp_f981fb9022765574 | collares / 1 | [https://tintinaccs.com/product?id=imp_f981fb9022765574](https://tintinaccs.com/product?id=imp_f981fb9022765574) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| SET AURA COLLAR + AROS — imp_f9b378b832e6d77c | collares / 1 | [https://tintinaccs.com/product?id=imp_f9b378b832e6d77c](https://tintinaccs.com/product?id=imp_f9b378b832e6d77c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| HOOPS AYLA — imp_f9f7aab891bbdd7c | aros / 1 | [https://tintinaccs.com/product?id=imp_f9f7aab891bbdd7c](https://tintinaccs.com/product?id=imp_f9f7aab891bbdd7c) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS NAYRA — imp_fbb19a64f2b31440 | aros / 1 | [https://tintinaccs.com/product?id=imp_fbb19a64f2b31440](https://tintinaccs.com/product?id=imp_fbb19a64f2b31440) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| AROS AZURE — imp_fdefdd066b813cf2 | aros / 1 | [https://tintinaccs.com/product?id=imp_fdefdd066b813cf2](https://tintinaccs.com/product?id=imp_fdefdd066b813cf2) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ ALESSIA — imp_fdf762845a4d7e60 | relojes / 0 | [https://tintinaccs.com/product?id=imp_fdf762845a4d7e60](https://tintinaccs.com/product?id=imp_fdf762845a4d7e60) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO SOLENNE — jxh2PLOflnarRrn0GekP | bolsos / 1 | [https://tintinaccs.com/product?id=jxh2PLOflnarRrn0GekP](https://tintinaccs.com/product?id=jxh2PLOflnarRrn0GekP) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO SOFÍA — k5f9IQ39hlksBTeXbgO2 | bolsos / 2 | [https://tintinaccs.com/product?id=k5f9IQ39hlksBTeXbgO2](https://tintinaccs.com/product?id=k5f9IQ39hlksBTeXbgO2) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO VICTORIA — lQ3U2a6NUBCv7txspJZb | bolsos / 3 | [https://tintinaccs.com/product?id=lQ3U2a6NUBCv7txspJZb](https://tintinaccs.com/product?id=lQ3U2a6NUBCv7txspJZb) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ LARTRA DORÉ — mNtMiiHXmxISMWURMtTy | relojes / 0 | [https://tintinaccs.com/product?id=mNtMiiHXmxISMWURMtTy](https://tintinaccs.com/product?id=mNtMiiHXmxISMWURMtTy) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO CAMILA — o6hrWjrwd2chRXudpB7u | bolsos / 1 | [https://tintinaccs.com/product?id=o6hrWjrwd2chRXudpB7u](https://tintinaccs.com/product?id=o6hrWjrwd2chRXudpB7u) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ VITTORIA — pEnPz9iorRZfp6DcfwS8 | relojes / 1 | [https://tintinaccs.com/product?id=pEnPz9iorRZfp6DcfwS8](https://tintinaccs.com/product?id=pEnPz9iorRZfp6DcfwS8) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO VALENTINA — rNRdJNZsszNQ59SDV2Zd | bolsos / 1 | [https://tintinaccs.com/product?id=rNRdJNZsszNQ59SDV2Zd](https://tintinaccs.com/product?id=rNRdJNZsszNQ59SDV2Zd) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| RELOJ REGINA — raqtnLvxHgpDZro36miR | relojes / 1 | [https://tintinaccs.com/product?id=raqtnLvxHgpDZro36miR](https://tintinaccs.com/product?id=raqtnLvxHgpDZro36miR) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ALONDRA — vC0ods3P0r0PAvQXyTWk | bolsos / 2 | [https://tintinaccs.com/product?id=vC0ods3P0r0PAvQXyTWk](https://tintinaccs.com/product?id=vC0ods3P0r0PAvQXyTWk) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO ELISA — vrbRpRwqHheashV9kKJy | bolsos / 2 | [https://tintinaccs.com/product?id=vrbRpRwqHheashV9kKJy](https://tintinaccs.com/product?id=vrbRpRwqHheashV9kKJy) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO LUCIANA — vvcr45DzrMXlwd7pblqS | bolsos / 4 | [https://tintinaccs.com/product?id=vvcr45DzrMXlwd7pblqS](https://tintinaccs.com/product?id=vvcr45DzrMXlwd7pblqS) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO AZALEA — wK1IED6FnA5xeRCzT0Ar | bolsos / 1 | [https://tintinaccs.com/product?id=wK1IED6FnA5xeRCzT0Ar](https://tintinaccs.com/product?id=wK1IED6FnA5xeRCzT0Ar) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |
| BOLSO VELISA — xKT8YwRpnXI8IeMYssEa | bolsos / 1 | [https://tintinaccs.com/product?id=xKT8YwRpnXI8IeMYssEa](https://tintinaccs.com/product?id=xKT8YwRpnXI8IeMYssEa) | Título/canonical coinciden;1 intento(s) | NOT_EXECUTED:opciones,galería,cantidad,carrito,compra,reseñas,favoritos,historial,dispositivos |

Los38 nombres ausentes de headings de primer nivel del árbol extraído mantienen títulos/canonical correctos. Esto no demuestra un fallo visible: el extractor omite contenido anidado/oculto. El JSON conserva cada observación, variantes y medios. BOLSO ISADORA requirió reintento tras timeout inicial.

</details>


## Alias no producto: las35 rutas

Los alias /pages son condicionales a que no haya override custom en Firestore. La lectura del destino actual no comprueba ese segundo estado ni historial/query/hash.

| Alias | Destino observado | Lectura | Interacciones |
| --- | --- | --- | --- |
| [https://tintinaccs.com/pages/contact](https://tintinaccs.com/pages/contact) | https://tintinaccs.com/contact | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/contacto](https://tintinaccs.com/pages/contacto) | https://tintinaccs.com/contact | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/about](https://tintinaccs.com/pages/about) | https://tintinaccs.com/about | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/nosotros](https://tintinaccs.com/pages/nosotros) | https://tintinaccs.com/about | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/quienes-somos](https://tintinaccs.com/pages/quienes-somos) | https://tintinaccs.com/about | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/envios](https://tintinaccs.com/pages/envios) | https://tintinaccs.com/envios | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/shipping](https://tintinaccs.com/pages/shipping) | https://tintinaccs.com/envios | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/shipping-policy](https://tintinaccs.com/pages/shipping-policy) | https://tintinaccs.com/envios | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/faq](https://tintinaccs.com/pages/faq) | https://tintinaccs.com/preguntas-frecuentes | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/preguntas-frecuentes](https://tintinaccs.com/pages/preguntas-frecuentes) | https://tintinaccs.com/preguntas-frecuentes | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/cambios-devoluciones](https://tintinaccs.com/pages/cambios-devoluciones) | https://tintinaccs.com/cambios-devoluciones | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/devoluciones](https://tintinaccs.com/pages/devoluciones) | https://tintinaccs.com/cambios-devoluciones | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/cambios](https://tintinaccs.com/pages/cambios) | https://tintinaccs.com/cambios-devoluciones | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/privacy](https://tintinaccs.com/pages/privacy) | https://tintinaccs.com/privacidad | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/privacidad](https://tintinaccs.com/pages/privacidad) | https://tintinaccs.com/privacidad | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/terms](https://tintinaccs.com/pages/terms) | https://tintinaccs.com/terminos | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/pages/terminos](https://tintinaccs.com/pages/terminos) | https://tintinaccs.com/terminos | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/policies/privacy-policy](https://tintinaccs.com/policies/privacy-policy) | https://tintinaccs.com/privacidad | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/policies/terms-of-service](https://tintinaccs.com/policies/terms-of-service) | https://tintinaccs.com/terminos | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/policies/refund-policy](https://tintinaccs.com/policies/refund-policy) | https://tintinaccs.com/cambios-devoluciones | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/policies/return-policy](https://tintinaccs.com/policies/return-policy) | https://tintinaccs.com/cambios-devoluciones | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/policies/shipping-policy](https://tintinaccs.com/policies/shipping-policy) | https://tintinaccs.com/envios | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/anillos](https://tintinaccs.com/collections/anillos) | https://tintinaccs.com/catalogo?cat=anillos | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/armcuff](https://tintinaccs.com/collections/armcuff) | https://tintinaccs.com/catalogo?cat=armcuff | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/aros](https://tintinaccs.com/collections/aros) | https://tintinaccs.com/catalogo?cat=aros | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/bolsos](https://tintinaccs.com/collections/bolsos) | https://tintinaccs.com/catalogo?cat=bolsos | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/collares](https://tintinaccs.com/collections/collares) | https://tintinaccs.com/catalogo?cat=collares | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/earcuff](https://tintinaccs.com/collections/earcuff) | https://tintinaccs.com/catalogo?cat=earcuff | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/gafas](https://tintinaccs.com/collections/gafas) | https://tintinaccs.com/catalogo?cat=gafas | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/joyeros](https://tintinaccs.com/collections/joyeros) | https://tintinaccs.com/catalogo?cat=joyeros | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/mochilas](https://tintinaccs.com/collections/mochilas) | https://tintinaccs.com/catalogo?cat=mochilas | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/relojes](https://tintinaccs.com/collections/relojes) | https://tintinaccs.com/catalogo?cat=relojes | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/tobilleras](https://tintinaccs.com/collections/tobilleras) | https://tintinaccs.com/catalogo?cat=tobilleras | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/pulseras](https://tintinaccs.com/collections/pulseras) | https://tintinaccs.com/catalogo?cat=pulseras | Coincide | NOT_EXECUTED |
| [https://tintinaccs.com/collections/all](https://tintinaccs.com/collections/all) | https://tintinaccs.com/catalogo | Coincide | NOT_EXECUTED |



<details>
<summary>274 alias de producto: todos los destinos y errores</summary>

El [resolvedor](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/products/[handle].js) acepta handle/Handle/slug/shopifyHandle, metadatos y nombres/títulos convertidos en slug. Los279 productos dieron **274 slugs únicos**. Se intentaron todos:226 lecturas iniciales y48 timeouts; un reintento por timeout recuperó47. Resultado:273 destinos dentro del inventario y1 pendiente.

| Alias | IDs publicados candidatos | Destino observado | Intentos | Estado |
| --- | --- | --- | --- | --- |
| [collar-amulet](https://tintinaccs.com/products/collar-amulet) | 047838c1-7054-4f3d-b023-90fb462c82e9 | https://tintinaccs.com/product?id=047838c1-7054-4f3d-b023-90fb462c82e9 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-gianna](https://tintinaccs.com/products/reloj-gianna) | 07DtHPQJ7p4VH4xqFzsd | https://tintinaccs.com/product?id=07DtHPQJ7p4VH4xqFzsd | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-eliora](https://tintinaccs.com/products/collar-eliora) | 20fad7c1-3b98-45da-91c3-d6db6a96b0dd | https://tintinaccs.com/product?id=20fad7c1-3b98-45da-91c3-d6db6a96b0dd | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-milena](https://tintinaccs.com/products/collar-milena) | 394c2049-931f-45da-8f62-59a6f06243a3 | https://tintinaccs.com/product?id=394c2049-931f-45da-8f62-59a6f06243a3 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-renata](https://tintinaccs.com/products/collar-renata) | 54a75b07-631e-41c7-91de-fb40ecde3f14 | https://tintinaccs.com/product?id=54a75b07-631e-41c7-91de-fb40ecde3f14 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-amelys](https://tintinaccs.com/products/reloj-amelys) | 587d6b3a-481d-4f06-9c5e-9c95f40bdad3 | https://tintinaccs.com/product?id=587d6b3a-481d-4f06-9c5e-9c95f40bdad3 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-cherie](https://tintinaccs.com/products/collar-cherie) | 5fded493-578e-4897-bce2-07d8ab820bfb | https://tintinaccs.com/product?id=5fded493-578e-4897-bce2-07d8ab820bfb | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-caroline](https://tintinaccs.com/products/collar-caroline) | 66a6f5b0-9811-41fd-a223-cc312323ada2 | https://tintinaccs.com/product?id=66a6f5b0-9811-41fd-a223-cc312323ada2 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [mochila-alyssia](https://tintinaccs.com/products/mochila-alyssia) | 67f5e565-1fc5-4c17-b63e-b2b4d68ad4cc | https://tintinaccs.com/product?id=67f5e565-1fc5-4c17-b63e-b2b4d68ad4cc | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-mirela](https://tintinaccs.com/products/collar-mirela) | 720944b9-9602-4a37-8a46-403221433000 | https://tintinaccs.com/product?id=720944b9-9602-4a37-8a46-403221433000 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-rosela](https://tintinaccs.com/products/collar-rosela) | 72e1b077-7b7b-46a0-a25d-0c4e996e135e | https://tintinaccs.com/product?id=72e1b077-7b7b-46a0-a25d-0c4e996e135e | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-estelle](https://tintinaccs.com/products/collar-estelle) | 77bdcb85-564c-463b-83da-abca77b46b9f | https://tintinaccs.com/product?id=77bdcb85-564c-463b-83da-abca77b46b9f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [mochila-melina](https://tintinaccs.com/products/mochila-melina) | 86917d1b-5700-4fa0-b249-ff9d7aa89a6b | Sin extracción | 2 | EXTRACTOR_TIMEOUT;interacción pendiente |
| [bolso-meliza](https://tintinaccs.com/products/bolso-meliza) | 88612a50-b4b0-4b17-82a0-4dad10aad4d3 | https://tintinaccs.com/product?id=88612a50-b4b0-4b17-82a0-4dad10aad4d3 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [mochila-zelina](https://tintinaccs.com/products/mochila-zelina) | 89644b43-2cd3-495b-8127-7f4caa65f1b2 | https://tintinaccs.com/product?id=89644b43-2cd3-495b-8127-7f4caa65f1b2 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-azuria](https://tintinaccs.com/products/collar-azuria) | 95b5232b-4d18-4d81-bd22-687f620a423c | https://tintinaccs.com/product?id=95b5232b-4d18-4d81-bd22-687f620a423c | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-antonella](https://tintinaccs.com/products/bolso-antonella) | 9IHrfKoH8Ij6jljPaZa8 | https://tintinaccs.com/product?id=9IHrfKoH8Ij6jljPaZa8 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-billetera-zinara](https://tintinaccs.com/products/bolso-billetera-zinara) | 9d68a11f-a152-453d-88ca-33b28e9d9897 | https://tintinaccs.com/product?id=9d68a11f-a152-453d-88ca-33b28e9d9897 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-malena](https://tintinaccs.com/products/bolso-malena) | EOVWSpPbZbb7FM1EQc64 | https://tintinaccs.com/product?id=EOVWSpPbZbb7FM1EQc64 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-giuliana](https://tintinaccs.com/products/bolso-giuliana) | FuFQHQN8qtWcdrLLQioA | https://tintinaccs.com/product?id=FuFQHQN8qtWcdrLLQioA | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-tizziana](https://tintinaccs.com/products/bolso-tizziana) | LgAD8oQA1FufZzMAkz17 | https://tintinaccs.com/product?id=LgAD8oQA1FufZzMAkz17 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-aurora](https://tintinaccs.com/products/bolso-aurora) | LiftzPqagfI40UQW0nLd | https://tintinaccs.com/product?id=LiftzPqagfI40UQW0nLd | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-nayeli](https://tintinaccs.com/products/bolso-nayeli) | M24NjYQOLpUt7sWcbn4A | https://tintinaccs.com/product?id=M24NjYQOLpUt7sWcbn4A | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-odette](https://tintinaccs.com/products/bolso-odette) | MQTxy46eY0vq4iXAGVgA | https://tintinaccs.com/product?id=MQTxy46eY0vq4iXAGVgA | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-azelia](https://tintinaccs.com/products/bolso-azelia) | MViPfc5S268IG9m1Z0TB | https://tintinaccs.com/product?id=MViPfc5S268IG9m1Z0TB | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-marcela](https://tintinaccs.com/products/bolso-marcela) | MmJHQ8Y3GMAPwYEYQbOA | https://tintinaccs.com/product?id=MmJHQ8Y3GMAPwYEYQbOA | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-elizabeth](https://tintinaccs.com/products/bolso-elizabeth) | MrtJ4lio2oUeKzBCcuUt | https://tintinaccs.com/product?id=MrtJ4lio2oUeKzBCcuUt | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-dalma](https://tintinaccs.com/products/bolso-dalma) | N2hFLjJxa9gKoIljYUsW | https://tintinaccs.com/product?id=N2hFLjJxa9gKoIljYUsW | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-nerea](https://tintinaccs.com/products/bolso-nerea) | QSX4lNnk2Qek1VJpcipV | https://tintinaccs.com/product?id=QSX4lNnk2Qek1VJpcipV | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-renata](https://tintinaccs.com/products/bolso-renata) | RIQ7oJA3wWJZxpHyj08h | https://tintinaccs.com/product?id=RIQ7oJA3wWJZxpHyj08h | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-julieta](https://tintinaccs.com/products/bolso-julieta) | Tad2GmQ9c7ZCwx4PlCdK | https://tintinaccs.com/product?id=Tad2GmQ9c7ZCwx4PlCdK | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-celeste](https://tintinaccs.com/products/bolso-celeste) | UH6i2hmYu3KHasb4lLw5 | https://tintinaccs.com/product?id=UH6i2hmYu3KHasb4lLw5 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-eloise](https://tintinaccs.com/products/reloj-eloise) | Xp2mtu5OPfU8mKMZ0clW | https://tintinaccs.com/product?id=Xp2mtu5OPfU8mKMZ0clW | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-isabella](https://tintinaccs.com/products/bolso-isabella) | Y7d6ms8JV7ZMlNC3ORYR | https://tintinaccs.com/product?id=Y7d6ms8JV7ZMlNC3ORYR | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-alessia](https://tintinaccs.com/products/reloj-alessia) | YoB2slYAzOGMmnwWbHLM, imp_fdf762845a4d7e60 | https://tintinaccs.com/product?id=imp_fdf762845a4d7e60 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [mochila-azenia](https://tintinaccs.com/products/mochila-azenia) | a1fefc5d-4076-4c82-92c4-d411f1c3ec96 | https://tintinaccs.com/product?id=a1fefc5d-4076-4c82-92c4-d411f1c3ec96 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-eliora](https://tintinaccs.com/products/bolso-eliora) | a4609f9d-0b55-40a2-9849-7d490e5f20b1 | https://tintinaccs.com/product?id=a4609f9d-0b55-40a2-9849-7d490e5f20b1 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-marielle](https://tintinaccs.com/products/collar-marielle) | a8ca457f-0724-4139-9add-6947f3bb404f | https://tintinaccs.com/product?id=a8ca457f-0724-4139-9add-6947f3bb404f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-charlotte](https://tintinaccs.com/products/reloj-charlotte) | bM3sX0OrqLnT7nSK2xSp | https://tintinaccs.com/product?id=bM3sX0OrqLnT7nSK2xSp | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-elisette](https://tintinaccs.com/products/bolso-elisette) | c8048933-d6d8-4d45-a1dc-e5feb88ee60c | https://tintinaccs.com/product?id=c8048933-d6d8-4d45-a1dc-e5feb88ee60c | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-isadora](https://tintinaccs.com/products/bolso-isadora) | cc0865a2-b415-49f5-84a6-94832425c4f7 | https://tintinaccs.com/product?id=cc0865a2-b415-49f5-84a6-94832425c4f7 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-catalina](https://tintinaccs.com/products/bolso-catalina) | d4qEJZ6i2wk6gfTWRUjy | https://tintinaccs.com/product?id=d4qEJZ6i2wk6gfTWRUjy | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-luna](https://tintinaccs.com/products/collar-luna) | defb9445-2291-443e-9381-8f81204029e1 | https://tintinaccs.com/product?id=defb9445-2291-443e-9381-8f81204029e1 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-adelia](https://tintinaccs.com/products/bolso-adelia) | e9JBhWG1JhbtR8yiRar1 | https://tintinaccs.com/product?id=e9JBhWG1JhbtR8yiRar1 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-aurelia](https://tintinaccs.com/products/bolso-aurelia) | f7ce0765-951d-4c2b-99cc-e0db99a0eba7 | https://tintinaccs.com/product?id=f7ce0765-951d-4c2b-99cc-e0db99a0eba7 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-zareth](https://tintinaccs.com/products/bolso-zareth) | f90b7a7b-74ea-4922-9ddc-4103e44c79e8 | https://tintinaccs.com/product?id=f90b7a7b-74ea-4922-9ddc-4103e44c79e8 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-nora](https://tintinaccs.com/products/collar-nora) | f9c9cf4b-4dfd-4240-9d5f-d4c80e26e4d3 | https://tintinaccs.com/product?id=f9c9cf4b-4dfd-4240-9d5f-d4c80e26e4d3 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-amira](https://tintinaccs.com/products/bolso-amira) | faDpLH7sZ0K8ncgVE6zK | https://tintinaccs.com/product?id=faDpLH7sZ0K8ncgVE6zK | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-isaline](https://tintinaccs.com/products/bolso-isaline) | fuXxO9PjE36OC76OgMjL | https://tintinaccs.com/product?id=fuXxO9PjE36OC76OgMjL | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-oriana](https://tintinaccs.com/products/bolso-oriana) | hbSypmripIxb3UVcYlOn | https://tintinaccs.com/product?id=hbSypmripIxb3UVcYlOn | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-samira](https://tintinaccs.com/products/bolso-samira) | hgy4i2jB4TLkbQB5WczW | https://tintinaccs.com/product?id=hgy4i2jB4TLkbQB5WczW | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-iliana](https://tintinaccs.com/products/bolso-iliana) | iBJ8itV96bqKwrEcX3KO | https://tintinaccs.com/product?id=iBJ8itV96bqKwrEcX3KO | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [gafas-aura](https://tintinaccs.com/products/gafas-aura) | imp_02b8b31b7a16dae1 | https://tintinaccs.com/product?id=imp_02b8b31b7a16dae1 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-brumma](https://tintinaccs.com/products/aros-brumma) | imp_02bc8be78b8f6b05 | https://tintinaccs.com/product?id=imp_02bc8be78b8f6b05 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-coralita](https://tintinaccs.com/products/aros-coralita) | imp_052b9cc0c6db8f24 | https://tintinaccs.com/product?id=imp_052b9cc0c6db8f24 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-iliana](https://tintinaccs.com/products/aros-iliana) | imp_06fada093366f5c7 | https://tintinaccs.com/product?id=imp_06fada093366f5c7 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [brazalete-lurelia](https://tintinaccs.com/products/brazalete-lurelia) | imp_06fbe0c0fa7e3b24 | https://tintinaccs.com/product?id=imp_06fbe0c0fa7e3b24 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-isabella](https://tintinaccs.com/products/pulsera-isabella) | imp_0770093910f9e077 | https://tintinaccs.com/product?id=imp_0770093910f9e077 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-amatista](https://tintinaccs.com/products/anillo-amatista) | imp_0788bbc97f7fa507 | https://tintinaccs.com/product?id=imp_0788bbc97f7fa507 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [gafas-glam](https://tintinaccs.com/products/gafas-glam) | imp_0820f4f5af0d3a5b | https://tintinaccs.com/product?id=imp_0820f4f5af0d3a5b | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-olyra](https://tintinaccs.com/products/collar-olyra) | imp_0a5e06ced9fa8ada | https://tintinaccs.com/product?id=imp_0a5e06ced9fa8ada | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-valentina](https://tintinaccs.com/products/reloj-valentina) | imp_0b208e503fd9ecb4, imp_cea699760d541762 | https://tintinaccs.com/product?id=imp_cea699760d541762 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-carolina](https://tintinaccs.com/products/collar-carolina) | imp_0b4265cab90b0bce | https://tintinaccs.com/product?id=imp_0b4265cab90b0bce | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [earcuff-bellie](https://tintinaccs.com/products/earcuff-bellie) | imp_0c17ec05e6ff53eb | https://tintinaccs.com/product?id=imp_0c17ec05e6ff53eb | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-melanie](https://tintinaccs.com/products/aros-melanie) | imp_0e3fdf7ec54d148a | https://tintinaccs.com/product?id=imp_0e3fdf7ec54d148a | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-vaelina](https://tintinaccs.com/products/anillo-vaelina) | imp_0e954b11c16c110f | https://tintinaccs.com/product?id=imp_0e954b11c16c110f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-aurelia-gold](https://tintinaccs.com/products/aros-aurelia-gold) | imp_0f0375fbf31f75c1 | https://tintinaccs.com/product?id=imp_0f0375fbf31f75c1 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-dora](https://tintinaccs.com/products/collar-dora) | imp_0fec2d2d01a9c8b3 | https://tintinaccs.com/product?id=imp_0fec2d2d01a9c8b3 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [earcuff-valentina](https://tintinaccs.com/products/earcuff-valentina) | imp_1131cbd8b82e359c | https://tintinaccs.com/product?id=imp_1131cbd8b82e359c | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [earcuff-celina](https://tintinaccs.com/products/earcuff-celina) | imp_125136dc4c799c78 | https://tintinaccs.com/product?id=imp_125136dc4c799c78 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [armcuff-saphira](https://tintinaccs.com/products/armcuff-saphira) | imp_12b164aa09eca6ae | https://tintinaccs.com/product?id=imp_12b164aa09eca6ae | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-belinda](https://tintinaccs.com/products/aros-belinda) | imp_14b0fd5a6cfc35de | https://tintinaccs.com/product?id=imp_14b0fd5a6cfc35de | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-lucienne](https://tintinaccs.com/products/reloj-lucienne) | imp_14bb7149ecf19987 | https://tintinaccs.com/product?id=imp_14bb7149ecf19987 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-serena](https://tintinaccs.com/products/reloj-serena) | imp_14cac7a053145804 | https://tintinaccs.com/product?id=imp_14cac7a053145804 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-hongo](https://tintinaccs.com/products/collar-hongo) | imp_14f4a212b56087d6 | https://tintinaccs.com/product?id=imp_14f4a212b56087d6 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-emera](https://tintinaccs.com/products/hoops-emera) | imp_155ca2691a809127 | https://tintinaccs.com/product?id=imp_155ca2691a809127 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-canela](https://tintinaccs.com/products/anillo-canela) | imp_15634b0787c3c125 | https://tintinaccs.com/product?id=imp_15634b0787c3c125 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-dalice](https://tintinaccs.com/products/aros-dalice) | imp_166a1fbb192b1101 | https://tintinaccs.com/product?id=imp_166a1fbb192b1101 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-mimi-glow](https://tintinaccs.com/products/hoops-mimi-glow) | imp_167251dfe2de1cfd | https://tintinaccs.com/product?id=imp_167251dfe2de1cfd | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-amara](https://tintinaccs.com/products/collar-amara) | imp_17c4ad3d20dc1603 | https://tintinaccs.com/product?id=imp_17c4ad3d20dc1603 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-dalmie](https://tintinaccs.com/products/reloj-dalmie) | imp_19aafe06d0d697f2 | https://tintinaccs.com/product?id=imp_19aafe06d0d697f2 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-catalinna](https://tintinaccs.com/products/aros-catalinna) | imp_1a72e3aa59482bae | https://tintinaccs.com/product?id=imp_1a72e3aa59482bae | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-marisol](https://tintinaccs.com/products/collar-marisol) | imp_1a9598f2ba9f5bb6 | https://tintinaccs.com/product?id=imp_1a9598f2ba9f5bb6 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-aurelia](https://tintinaccs.com/products/aros-aurelia) | imp_1b7df87a3086757e | https://tintinaccs.com/product?id=imp_1b7df87a3086757e | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-bella](https://tintinaccs.com/products/pulsera-bella) | imp_1d4e7cfc869e1a18, imp_204e81b5601a819b | https://tintinaccs.com/product?id=imp_1d4e7cfc869e1a18 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [set-jolie-collar-aros](https://tintinaccs.com/products/set-jolie-collar-aros) | imp_1ffa73095dfdf8c7 | https://tintinaccs.com/product?id=imp_1ffa73095dfdf8c7 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-ameline](https://tintinaccs.com/products/reloj-ameline) | imp_2010e66fbd2483cd | https://tintinaccs.com/product?id=imp_2010e66fbd2483cd | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [brazalete-lucienne](https://tintinaccs.com/products/brazalete-lucienne) | imp_2053dcc12e540e3f | https://tintinaccs.com/product?id=imp_2053dcc12e540e3f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-dolly](https://tintinaccs.com/products/aros-dolly) | imp_21ab39d9973bb617 | https://tintinaccs.com/product?id=imp_21ab39d9973bb617 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-abrazo-eterno](https://tintinaccs.com/products/collar-abrazo-eterno) | imp_21fb2b68f51e2fac | https://tintinaccs.com/product?id=imp_21fb2b68f51e2fac | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-meliora](https://tintinaccs.com/products/anillo-meliora) | imp_25c890d41e712d70 | https://tintinaccs.com/product?id=imp_25c890d41e712d70 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-sienna](https://tintinaccs.com/products/collar-sienna) | imp_270696bd4de60683 | https://tintinaccs.com/product?id=imp_270696bd4de60683 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [brazalete-lunelle](https://tintinaccs.com/products/brazalete-lunelle) | imp_27626fd18920fe4f | https://tintinaccs.com/product?id=imp_27626fd18920fe4f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-avelia](https://tintinaccs.com/products/collar-avelia) | imp_288b84fbdbea2ac1 | https://tintinaccs.com/product?id=imp_288b84fbdbea2ac1 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-esmeralda](https://tintinaccs.com/products/anillo-esmeralda) | imp_2a567d5db5e56d23 | https://tintinaccs.com/product?id=imp_2a567d5db5e56d23 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-nuna](https://tintinaccs.com/products/hoops-nuna) | imp_2f9fe7f5b6d97b5b | https://tintinaccs.com/product?id=imp_2f9fe7f5b6d97b5b | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-reina](https://tintinaccs.com/products/collar-reina) | imp_31ec815cd501a7f8 | https://tintinaccs.com/product?id=imp_31ec815cd501a7f8 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-isara](https://tintinaccs.com/products/collar-isara) | imp_325bb37bbc3dc241 | https://tintinaccs.com/product?id=imp_325bb37bbc3dc241 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bag-cherry](https://tintinaccs.com/products/bag-cherry) | imp_337b9ec53fd2512b | https://tintinaccs.com/product?id=imp_337b9ec53fd2512b | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-hylie](https://tintinaccs.com/products/hoops-hylie) | imp_3581660f8864356d | https://tintinaccs.com/product?id=imp_3581660f8864356d | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [brazalete-giovanna](https://tintinaccs.com/products/brazalete-giovanna) | imp_35e851c30d38ebc9 | https://tintinaccs.com/product?id=imp_35e851c30d38ebc9 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-melizza](https://tintinaccs.com/products/collar-melizza) | imp_3618d9f13cb3c0ef | https://tintinaccs.com/product?id=imp_3618d9f13cb3c0ef | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-zafira](https://tintinaccs.com/products/anillo-zafira) | imp_36a0007c4e4c0898 | https://tintinaccs.com/product?id=imp_36a0007c4e4c0898 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-arlisse](https://tintinaccs.com/products/anillo-arlisse) | imp_36e52210bd0314f4 | https://tintinaccs.com/product?id=imp_36e52210bd0314f4 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-florencia](https://tintinaccs.com/products/collar-florencia) | imp_38404ce6ab8587d2 | https://tintinaccs.com/product?id=imp_38404ce6ab8587d2 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-corielle](https://tintinaccs.com/products/anillo-corielle) | imp_39243318fe03145c | https://tintinaccs.com/product?id=imp_39243318fe03145c | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-amore](https://tintinaccs.com/products/anillo-amore) | imp_392ba88d141f7093 | https://tintinaccs.com/product?id=imp_392ba88d141f7093 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-crystal-glow](https://tintinaccs.com/products/reloj-crystal-glow) | imp_3a3ce9c4fcb81d20 | https://tintinaccs.com/product?id=imp_3a3ce9c4fcb81d20 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-pet-love](https://tintinaccs.com/products/collar-pet-love) | imp_3d65452cf76b0748 | https://tintinaccs.com/product?id=imp_3d65452cf76b0748 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-azelinne](https://tintinaccs.com/products/anillo-azelinne) | imp_3d80547d1f527ec3 | https://tintinaccs.com/product?id=imp_3d80547d1f527ec3 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-marizza](https://tintinaccs.com/products/collar-marizza) | imp_407eb67f76437b1d | https://tintinaccs.com/product?id=imp_407eb67f76437b1d | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-evelia](https://tintinaccs.com/products/reloj-evelia) | imp_4209f0f0c1efa6d4 | https://tintinaccs.com/product?id=imp_4209f0f0c1efa6d4 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-ismeray](https://tintinaccs.com/products/anillo-ismeray) | imp_42aeb8e1a7d5e8df | https://tintinaccs.com/product?id=imp_42aeb8e1a7d5e8df | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-amore](https://tintinaccs.com/products/collar-amore) | imp_44112fcf2bf43ead | https://tintinaccs.com/product?id=imp_44112fcf2bf43ead | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-rosse](https://tintinaccs.com/products/reloj-rosse) | imp_458888a0637c9304 | https://tintinaccs.com/product?id=imp_458888a0637c9304 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-aurelia](https://tintinaccs.com/products/reloj-aurelia) | imp_4ccd03236fdec729 | https://tintinaccs.com/product?id=imp_4ccd03236fdec729 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-mika](https://tintinaccs.com/products/aros-mika) | imp_4dbb7f497b075387 | https://tintinaccs.com/product?id=imp_4dbb7f497b075387 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [armcuff-thayana](https://tintinaccs.com/products/armcuff-thayana) | imp_4e00b191910f908f | https://tintinaccs.com/product?id=imp_4e00b191910f908f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-dalya](https://tintinaccs.com/products/hoops-dalya) | imp_4e93898291065746 | https://tintinaccs.com/product?id=imp_4e93898291065746 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [earcuff-naomi](https://tintinaccs.com/products/earcuff-naomi) | imp_4ed38ef55182385b | https://tintinaccs.com/product?id=imp_4ed38ef55182385b | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-crysthel](https://tintinaccs.com/products/reloj-crysthel) | imp_4f1a33c48a47ab20 | https://tintinaccs.com/product?id=imp_4f1a33c48a47ab20 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-melina](https://tintinaccs.com/products/aros-melina) | imp_4fc3e1ffbc37219d | https://tintinaccs.com/product?id=imp_4fc3e1ffbc37219d | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-mireya](https://tintinaccs.com/products/collar-mireya) | imp_51fc82a2801755e6 | https://tintinaccs.com/product?id=imp_51fc82a2801755e6 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-milori](https://tintinaccs.com/products/aros-milori) | imp_53996621ba9a1c9f | https://tintinaccs.com/product?id=imp_53996621ba9a1c9f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-nerisse](https://tintinaccs.com/products/anillo-nerisse) | imp_561ad58e1549a01a | https://tintinaccs.com/product?id=imp_561ad58e1549a01a | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-fiorella](https://tintinaccs.com/products/reloj-fiorella) | imp_566b22325733ac76 | https://tintinaccs.com/product?id=imp_566b22325733ac76 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [brazalete-serenya](https://tintinaccs.com/products/brazalete-serenya) | imp_57a75413027c9d19 | https://tintinaccs.com/product?id=imp_57a75413027c9d19 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-amelie](https://tintinaccs.com/products/reloj-amelie) | imp_591512a1d35a3e1f | https://tintinaccs.com/product?id=imp_591512a1d35a3e1f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-isadora](https://tintinaccs.com/products/reloj-isadora) | imp_59184c87764639a5 | https://tintinaccs.com/product?id=imp_59184c87764639a5 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-eilene](https://tintinaccs.com/products/collar-eilene) | imp_5ad1cc9f7242bc3d | https://tintinaccs.com/product?id=imp_5ad1cc9f7242bc3d | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-aylin](https://tintinaccs.com/products/aros-aylin) | imp_5b1c72d496e7c370 | https://tintinaccs.com/product?id=imp_5b1c72d496e7c370 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-aylen](https://tintinaccs.com/products/aros-aylen) | imp_5b256d307aa97994 | https://tintinaccs.com/product?id=imp_5b256d307aa97994 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-cecilie](https://tintinaccs.com/products/aros-cecilie) | imp_5c62dab38d9a8439 | https://tintinaccs.com/product?id=imp_5c62dab38d9a8439 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-zuri](https://tintinaccs.com/products/hoops-zuri) | imp_5cfc5b873744eea5 | https://tintinaccs.com/product?id=imp_5cfc5b873744eea5 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-rosavelle](https://tintinaccs.com/products/anillo-rosavelle) | imp_5d59e4b285b25ff6 | https://tintinaccs.com/product?id=imp_5d59e4b285b25ff6 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-evania](https://tintinaccs.com/products/collar-evania) | imp_5f57f98d53aedb93 | https://tintinaccs.com/product?id=imp_5f57f98d53aedb93 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-elowen](https://tintinaccs.com/products/aros-elowen) | imp_6156839779cd0ab5 | https://tintinaccs.com/product?id=imp_6156839779cd0ab5 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [brazalete-avenya](https://tintinaccs.com/products/brazalete-avenya) | imp_631d58d6acf09542 | https://tintinaccs.com/product?id=imp_631d58d6acf09542 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [set-van-cleef-premium](https://tintinaccs.com/products/set-van-cleef-premium) | imp_63bce17c9f78a398 | https://tintinaccs.com/product?id=imp_63bce17c9f78a398 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bag-bella](https://tintinaccs.com/products/bag-bella) | imp_6405cab5e00b149b | https://tintinaccs.com/product?id=imp_6405cab5e00b149b | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-floral](https://tintinaccs.com/products/anillo-floral) | imp_67dc97aa009ba7ae | https://tintinaccs.com/product?id=imp_67dc97aa009ba7ae | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [gafas-moria](https://tintinaccs.com/products/gafas-moria) | imp_67f9deb460c60350 | https://tintinaccs.com/product?id=imp_67f9deb460c60350 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [gafas-lia](https://tintinaccs.com/products/gafas-lia) | imp_6a7a651ae719411e | https://tintinaccs.com/product?id=imp_6a7a651ae719411e | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-helena](https://tintinaccs.com/products/collar-helena) | imp_6b354f5e9b51feea | https://tintinaccs.com/product?id=imp_6b354f5e9b51feea | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-lizie](https://tintinaccs.com/products/hoops-lizie) | imp_6c7c11d04155db34 | https://tintinaccs.com/product?id=imp_6c7c11d04155db34 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [brazalete-amara](https://tintinaccs.com/products/brazalete-amara) | imp_6db599e01135e2c4 | https://tintinaccs.com/product?id=imp_6db599e01135e2c4 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-aura](https://tintinaccs.com/products/aros-aura) | imp_6f71b26470aa9c40 | https://tintinaccs.com/product?id=imp_6f71b26470aa9c40 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [armcuff-orlena](https://tintinaccs.com/products/armcuff-orlena) | imp_6f74341f683036bd | https://tintinaccs.com/product?id=imp_6f74341f683036bd | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [porta-anillo](https://tintinaccs.com/products/porta-anillo) | imp_711393b96698abf7 | https://tintinaccs.com/product?id=imp_711393b96698abf7 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-sirely](https://tintinaccs.com/products/pulsera-sirely) | imp_73f6150c5f03b2a8 | https://tintinaccs.com/product?id=imp_73f6150c5f03b2a8 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [esclava-venezia](https://tintinaccs.com/products/esclava-venezia) | imp_740b99a1ae949b1f | https://tintinaccs.com/product?id=imp_740b99a1ae949b1f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [gafas-royal](https://tintinaccs.com/products/gafas-royal) | imp_74a75ef38478c8f9 | https://tintinaccs.com/product?id=imp_74a75ef38478c8f9 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bag-bella-bandolera](https://tintinaccs.com/products/bag-bella-bandolera) | imp_77417a439cb1a149 | https://tintinaccs.com/product?id=imp_77417a439cb1a149 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-maia](https://tintinaccs.com/products/collar-maia) | imp_776ca103da036c89 | https://tintinaccs.com/product?id=imp_776ca103da036c89 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-valeska](https://tintinaccs.com/products/anillo-valeska) | imp_78f7c370f9430a54 | https://tintinaccs.com/product?id=imp_78f7c370f9430a54 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [tobillera-kalena](https://tintinaccs.com/products/tobillera-kalena) | imp_79d8c8a2fc37f7e6 | https://tintinaccs.com/product?id=imp_79d8c8a2fc37f7e6 | 2 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-camille](https://tintinaccs.com/products/reloj-camille) | imp_7a9560a55fc0e30b | https://tintinaccs.com/product?id=imp_7a9560a55fc0e30b | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [earcuff-rosa](https://tintinaccs.com/products/earcuff-rosa) | imp_7a9c16c1e9fcec3f | https://tintinaccs.com/product?id=imp_7a9c16c1e9fcec3f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-avelia](https://tintinaccs.com/products/aros-avelia) | imp_7b7c93b74b892955 | https://tintinaccs.com/product?id=imp_7b7c93b74b892955 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-cristal](https://tintinaccs.com/products/anillo-cristal) | imp_7ca05231206a5caf | https://tintinaccs.com/product?id=imp_7ca05231206a5caf | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-belinda](https://tintinaccs.com/products/collar-belinda) | imp_7eacbc1e5867f52a | https://tintinaccs.com/product?id=imp_7eacbc1e5867f52a | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [joyero-rosie](https://tintinaccs.com/products/joyero-rosie) | imp_80060738e18e8efc | https://tintinaccs.com/product?id=imp_80060738e18e8efc | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-olivia](https://tintinaccs.com/products/collar-olivia) | imp_80e45a618bf5415f | https://tintinaccs.com/product?id=imp_80e45a618bf5415f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-ismera](https://tintinaccs.com/products/collar-ismera) | imp_80fde1407d22b8a4, imp_e5697f52170f7f96 | https://tintinaccs.com/product?id=imp_80fde1407d22b8a4 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-melli](https://tintinaccs.com/products/hoops-melli) | imp_833cacb039c6bc14 | https://tintinaccs.com/product?id=imp_833cacb039c6bc14 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-amina](https://tintinaccs.com/products/aros-amina) | imp_83a0325dd735e423 | https://tintinaccs.com/product?id=imp_83a0325dd735e423 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-emma](https://tintinaccs.com/products/collar-emma) | imp_8551248b8ba39011 | https://tintinaccs.com/product?id=imp_8551248b8ba39011 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-olivara](https://tintinaccs.com/products/anillo-olivara) | imp_855f595d32a52123 | https://tintinaccs.com/product?id=imp_855f595d32a52123 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [armcuff-zephira](https://tintinaccs.com/products/armcuff-zephira) | imp_8633a3c18f402b3f | https://tintinaccs.com/product?id=imp_8633a3c18f402b3f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-clarisse](https://tintinaccs.com/products/anillo-clarisse) | imp_86440d19bd2687d7 | https://tintinaccs.com/product?id=imp_86440d19bd2687d7 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-brielle](https://tintinaccs.com/products/pulsera-brielle) | imp_8a19f945221b0cab | https://tintinaccs.com/product?id=imp_8a19f945221b0cab | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [earcuff-belle](https://tintinaccs.com/products/earcuff-belle) | imp_8d3941aec2de22ba | https://tintinaccs.com/product?id=imp_8d3941aec2de22ba | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-elaris](https://tintinaccs.com/products/pulsera-elaris) | imp_8d520dfcc7394518 | https://tintinaccs.com/product?id=imp_8d520dfcc7394518 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [porta-collar](https://tintinaccs.com/products/porta-collar) | imp_8f535be7a62d5b05 | https://tintinaccs.com/product?id=imp_8f535be7a62d5b05 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-orelia](https://tintinaccs.com/products/aros-orelia) | imp_8f8ac6e9995c5aa7 | https://tintinaccs.com/product?id=imp_8f8ac6e9995c5aa7 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-azaria](https://tintinaccs.com/products/collar-azaria) | imp_9153a34962229f87 | https://tintinaccs.com/product?id=imp_9153a34962229f87 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-aurelia](https://tintinaccs.com/products/collar-aurelia) | imp_925a9546707c76b2 | https://tintinaccs.com/product?id=imp_925a9546707c76b2 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-fiorenza](https://tintinaccs.com/products/anillo-fiorenza) | imp_9307be33ec8792b9 | https://tintinaccs.com/product?id=imp_9307be33ec8792b9 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-loly](https://tintinaccs.com/products/aros-loly) | imp_9389f39968058757 | https://tintinaccs.com/product?id=imp_9389f39968058757 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-estella](https://tintinaccs.com/products/reloj-estella) | imp_93c696ba6400613e | https://tintinaccs.com/product?id=imp_93c696ba6400613e | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-mar](https://tintinaccs.com/products/aros-mar) | imp_94bdfbc5564f802b | https://tintinaccs.com/product?id=imp_94bdfbc5564f802b | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-florence](https://tintinaccs.com/products/pulsera-florence) | imp_9944aba2ef9388e6 | https://tintinaccs.com/product?id=imp_9944aba2ef9388e6 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bag-noir](https://tintinaccs.com/products/bag-noir) | imp_9a3d82b1c176ea2f | https://tintinaccs.com/product?id=imp_9a3d82b1c176ea2f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [gafas-leslie](https://tintinaccs.com/products/gafas-leslie) | imp_9aea174e63bcb85a | https://tintinaccs.com/product?id=imp_9aea174e63bcb85a | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [gafas-luxe](https://tintinaccs.com/products/gafas-luxe) | imp_9b7ac63410dafdd0 | https://tintinaccs.com/product?id=imp_9b7ac63410dafdd0 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-nerina](https://tintinaccs.com/products/collar-nerina) | imp_9b9fef2e63643f3a | https://tintinaccs.com/product?id=imp_9b9fef2e63643f3a | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-isla](https://tintinaccs.com/products/collar-isla) | imp_9e0bf8d82b44549c | https://tintinaccs.com/product?id=imp_9e0bf8d82b44549c | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [porta-anillo-corazon](https://tintinaccs.com/products/porta-anillo-corazon) | imp_a0c0478430920560 | https://tintinaccs.com/product?id=imp_a0c0478430920560 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-alissea](https://tintinaccs.com/products/anillo-alissea) | imp_a0e7d68f00c282ed | https://tintinaccs.com/product?id=imp_a0e7d68f00c282ed | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-dorelle](https://tintinaccs.com/products/reloj-dorelle) | imp_a136d69309979099 | https://tintinaccs.com/product?id=imp_a136d69309979099 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-clarisse](https://tintinaccs.com/products/reloj-clarisse) | imp_a208401450c73430 | https://tintinaccs.com/product?id=imp_a208401450c73430 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [tobillera-sirena](https://tintinaccs.com/products/tobillera-sirena) | imp_a3ad0bccf64155e8 | https://tintinaccs.com/product?id=imp_a3ad0bccf64155e8 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-emmilia](https://tintinaccs.com/products/aros-emmilia) | imp_a3c335c320c677c9 | https://tintinaccs.com/product?id=imp_a3c335c320c677c9 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [esclava-azzura](https://tintinaccs.com/products/esclava-azzura) | imp_a759d57c560bdf98 | https://tintinaccs.com/product?id=imp_a759d57c560bdf98 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-amaris](https://tintinaccs.com/products/collar-amaris) | imp_a88930e222fb94a6 | https://tintinaccs.com/product?id=imp_a88930e222fb94a6 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-esme](https://tintinaccs.com/products/collar-esme) | imp_a89f24b520be529b | https://tintinaccs.com/product?id=imp_a89f24b520be529b | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-mariel](https://tintinaccs.com/products/aros-mariel) | imp_a8d2becd5c097e53 | https://tintinaccs.com/product?id=imp_a8d2becd5c097e53 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-perla-rosa](https://tintinaccs.com/products/collar-perla-rosa) | imp_aa1fe42f1865df0d | https://tintinaccs.com/product?id=imp_aa1fe42f1865df0d | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-vittoria](https://tintinaccs.com/products/reloj-vittoria) | imp_aa95a63605edaca2, pEnPz9iorRZfp6DcfwS8 | https://tintinaccs.com/product?id=imp_aa95a63605edaca2 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-narella](https://tintinaccs.com/products/aros-narella) | imp_ab6020ae561ec7ba | https://tintinaccs.com/product?id=imp_ab6020ae561ec7ba | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [set-tortugas-gold](https://tintinaccs.com/products/set-tortugas-gold) | imp_ac58f6468cc191b2 | https://tintinaccs.com/product?id=imp_ac58f6468cc191b2 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-finyra](https://tintinaccs.com/products/anillo-finyra) | imp_ac74f6082a17704c | https://tintinaccs.com/product?id=imp_ac74f6082a17704c | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-soleil](https://tintinaccs.com/products/collar-soleil) | imp_b03bcadf3fe3bffd | https://tintinaccs.com/product?id=imp_b03bcadf3fe3bffd | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-celestia](https://tintinaccs.com/products/reloj-celestia) | imp_b107d06673e57652 | https://tintinaccs.com/product?id=imp_b107d06673e57652 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-amore](https://tintinaccs.com/products/aros-amore) | imp_b285330319929289 | https://tintinaccs.com/product?id=imp_b285330319929289 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-petalo](https://tintinaccs.com/products/anillo-petalo) | imp_b47bd85c3dcff4f8 | https://tintinaccs.com/product?id=imp_b47bd85c3dcff4f8 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [gafas-delia](https://tintinaccs.com/products/gafas-delia) | imp_b4eb5477637f8e95 | https://tintinaccs.com/product?id=imp_b4eb5477637f8e95 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-anabella](https://tintinaccs.com/products/hoops-anabella) | imp_b5301d0a4e8e848e | https://tintinaccs.com/product?id=imp_b5301d0a4e8e848e | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [joyerito-love](https://tintinaccs.com/products/joyerito-love) | imp_b651a493c2e78a99 | https://tintinaccs.com/product?id=imp_b651a493c2e78a99 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [earcuff-lumma](https://tintinaccs.com/products/earcuff-lumma) | imp_b7c72fa294faf4e6 | https://tintinaccs.com/product?id=imp_b7c72fa294faf4e6 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-estrella](https://tintinaccs.com/products/anillo-estrella) | imp_b81d3565db79484b | https://tintinaccs.com/product?id=imp_b81d3565db79484b | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-azalea](https://tintinaccs.com/products/anillo-azalea) | imp_b8ae73d5f67c20bb | https://tintinaccs.com/product?id=imp_b8ae73d5f67c20bb | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [earcuff-eliz](https://tintinaccs.com/products/earcuff-eliz) | imp_bb757aaa481638ae | https://tintinaccs.com/product?id=imp_bb757aaa481638ae | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-alessia](https://tintinaccs.com/products/pulsera-alessia) | imp_bee898ca86530cce | https://tintinaccs.com/product?id=imp_bee898ca86530cce | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-concha](https://tintinaccs.com/products/collar-concha) | imp_c02852015ceaabff | https://tintinaccs.com/product?id=imp_c02852015ceaabff | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-doris](https://tintinaccs.com/products/aros-doris) | imp_c0529660525f7444 | https://tintinaccs.com/product?id=imp_c0529660525f7444 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [joyeritos-rose](https://tintinaccs.com/products/joyeritos-rose) | imp_c115eff355fcf3f9 | https://tintinaccs.com/product?id=imp_c115eff355fcf3f9 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [earcuff-cruz](https://tintinaccs.com/products/earcuff-cruz) | imp_c1d299b88e48327c | https://tintinaccs.com/product?id=imp_c1d299b88e48327c | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-isabella](https://tintinaccs.com/products/collar-isabella) | imp_c3d826a2856121e6 | https://tintinaccs.com/product?id=imp_c3d826a2856121e6 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-samira](https://tintinaccs.com/products/aros-samira) | imp_c5f29d042325d9e0 | https://tintinaccs.com/product?id=imp_c5f29d042325d9e0 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-zafira](https://tintinaccs.com/products/aros-zafira) | imp_c61ff9cab57b27ce | https://tintinaccs.com/product?id=imp_c61ff9cab57b27ce | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-veline](https://tintinaccs.com/products/aros-veline) | imp_c7110d8827147acc | https://tintinaccs.com/product?id=imp_c7110d8827147acc | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-rosalie](https://tintinaccs.com/products/reloj-rosalie) | imp_c815ed33a553a7b9 | https://tintinaccs.com/product?id=imp_c815ed33a553a7b9 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-olivia](https://tintinaccs.com/products/anillo-olivia) | imp_c91045e322694769 | https://tintinaccs.com/product?id=imp_c91045e322694769 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [gafas-bel](https://tintinaccs.com/products/gafas-bel) | imp_c98acc77c2fa3695 | https://tintinaccs.com/product?id=imp_c98acc77c2fa3695 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-kiara](https://tintinaccs.com/products/pulsera-kiara) | imp_cdf4b5ecfa84f088 | https://tintinaccs.com/product?id=imp_cdf4b5ecfa84f088 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-magnolia](https://tintinaccs.com/products/pulsera-magnolia) | imp_cf4b3ad4b8a5db70 | https://tintinaccs.com/product?id=imp_cf4b3ad4b8a5db70 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-didi](https://tintinaccs.com/products/hoops-didi) | imp_cf960fd7f2a42075 | https://tintinaccs.com/product?id=imp_cf960fd7f2a42075 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [set-tortugas-marinas](https://tintinaccs.com/products/set-tortugas-marinas) | imp_cfd2c172daa41136 | https://tintinaccs.com/product?id=imp_cfd2c172daa41136 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-adrielle](https://tintinaccs.com/products/pulsera-adrielle) | imp_cfdff220789b0384 | https://tintinaccs.com/product?id=imp_cfdff220789b0384 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-aurora](https://tintinaccs.com/products/aros-aurora) | imp_d035833057570b94 | https://tintinaccs.com/product?id=imp_d035833057570b94 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-anastasia](https://tintinaccs.com/products/reloj-anastasia) | imp_d1bc58e77f096a05 | https://tintinaccs.com/product?id=imp_d1bc58e77f096a05 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-lola](https://tintinaccs.com/products/collar-lola) | imp_d268a9051d14a2eb | https://tintinaccs.com/product?id=imp_d268a9051d14a2eb | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-nerina](https://tintinaccs.com/products/aros-nerina) | imp_d51b237af0139e7e | https://tintinaccs.com/product?id=imp_d51b237af0139e7e | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-odette](https://tintinaccs.com/products/reloj-odette) | imp_d63fd59d1209f6e3 | https://tintinaccs.com/product?id=imp_d63fd59d1209f6e3 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [brazalete-mayvana](https://tintinaccs.com/products/brazalete-mayvana) | imp_d6fded4adc1ae64e | https://tintinaccs.com/product?id=imp_d6fded4adc1ae64e | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-elianne](https://tintinaccs.com/products/anillo-elianne) | imp_d8d82a198fcaf6d7 | https://tintinaccs.com/product?id=imp_d8d82a198fcaf6d7 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-amelie](https://tintinaccs.com/products/aros-amelie) | imp_d9ae7de6d12b92d2 | https://tintinaccs.com/product?id=imp_d9ae7de6d12b92d2 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-isabella](https://tintinaccs.com/products/reloj-isabella) | imp_dae04c918300898f | https://tintinaccs.com/product?id=imp_dae04c918300898f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-elinne](https://tintinaccs.com/products/anillo-elinne) | imp_dbb3d7a2a263ace6 | https://tintinaccs.com/product?id=imp_dbb3d7a2a263ace6 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [pulsera-marielle](https://tintinaccs.com/products/pulsera-marielle) | imp_dd300fa3bffa08a9 | https://tintinaccs.com/product?id=imp_dd300fa3bffa08a9 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-amelia](https://tintinaccs.com/products/aros-amelia) | imp_ddae8432b77cc276 | https://tintinaccs.com/product?id=imp_ddae8432b77cc276 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-veronica](https://tintinaccs.com/products/aros-veronica) | imp_debf90d0b6276034 | https://tintinaccs.com/product?id=imp_debf90d0b6276034 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-kaelina](https://tintinaccs.com/products/collar-kaelina) | imp_e1e3954c36a42668 | https://tintinaccs.com/product?id=imp_e1e3954c36a42668 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-fiobella](https://tintinaccs.com/products/aros-fiobella) | imp_e1ea499101b7988f | https://tintinaccs.com/product?id=imp_e1ea499101b7988f | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-aurelle](https://tintinaccs.com/products/aros-aurelle) | imp_e370d45fabce107d | https://tintinaccs.com/product?id=imp_e370d45fabce107d | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-evora-lux](https://tintinaccs.com/products/reloj-evora-lux) | imp_e4edfa2d9119c7b3 | https://tintinaccs.com/product?id=imp_e4edfa2d9119c7b3 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [gafas-transparente](https://tintinaccs.com/products/gafas-transparente) | imp_e58b23f87010593c | https://tintinaccs.com/product?id=imp_e58b23f87010593c | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-mirel](https://tintinaccs.com/products/collar-mirel) | imp_e64e31c8eababa8c | https://tintinaccs.com/product?id=imp_e64e31c8eababa8c | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-elodie](https://tintinaccs.com/products/reloj-elodie) | imp_e74102ecc5006f88 | https://tintinaccs.com/product?id=imp_e74102ecc5006f88 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-mirenza](https://tintinaccs.com/products/anillo-mirenza) | imp_e790dcc908540007 | https://tintinaccs.com/product?id=imp_e790dcc908540007 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [anillo-solana](https://tintinaccs.com/products/anillo-solana) | imp_eb2467498c42cb87 | https://tintinaccs.com/product?id=imp_eb2467498c42cb87 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-maika](https://tintinaccs.com/products/aros-maika) | imp_eb2b01247647d280 | https://tintinaccs.com/product?id=imp_eb2b01247647d280 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-gabrielle](https://tintinaccs.com/products/reloj-gabrielle) | imp_f04d5b65de568a4b | https://tintinaccs.com/product?id=imp_f04d5b65de568a4b | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [set-collar-aros-rosas](https://tintinaccs.com/products/set-collar-aros-rosas) | imp_f2f4924e5137515a | https://tintinaccs.com/product?id=imp_f2f4924e5137515a | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-liora](https://tintinaccs.com/products/collar-liora) | imp_f6b6951801c12a5c | https://tintinaccs.com/product?id=imp_f6b6951801c12a5c | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-fyo](https://tintinaccs.com/products/hoops-fyo) | imp_f7e64a1b630de7e1 | https://tintinaccs.com/product?id=imp_f7e64a1b630de7e1 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [collar-flora](https://tintinaccs.com/products/collar-flora) | imp_f981fb9022765574 | https://tintinaccs.com/product?id=imp_f981fb9022765574 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [set-aura-collar-aros](https://tintinaccs.com/products/set-aura-collar-aros) | imp_f9b378b832e6d77c | https://tintinaccs.com/product?id=imp_f9b378b832e6d77c | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [hoops-ayla](https://tintinaccs.com/products/hoops-ayla) | imp_f9f7aab891bbdd7c | https://tintinaccs.com/product?id=imp_f9f7aab891bbdd7c | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-nayra](https://tintinaccs.com/products/aros-nayra) | imp_fbb19a64f2b31440 | https://tintinaccs.com/product?id=imp_fbb19a64f2b31440 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [aros-azure](https://tintinaccs.com/products/aros-azure) | imp_fdefdd066b813cf2 | https://tintinaccs.com/product?id=imp_fdefdd066b813cf2 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-solenne](https://tintinaccs.com/products/bolso-solenne) | jxh2PLOflnarRrn0GekP | https://tintinaccs.com/product?id=jxh2PLOflnarRrn0GekP | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-sofia](https://tintinaccs.com/products/bolso-sofia) | k5f9IQ39hlksBTeXbgO2 | https://tintinaccs.com/product?id=k5f9IQ39hlksBTeXbgO2 | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-victoria](https://tintinaccs.com/products/bolso-victoria) | lQ3U2a6NUBCv7txspJZb | https://tintinaccs.com/product?id=lQ3U2a6NUBCv7txspJZb | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-lartra-dore](https://tintinaccs.com/products/reloj-lartra-dore) | mNtMiiHXmxISMWURMtTy | https://tintinaccs.com/product?id=mNtMiiHXmxISMWURMtTy | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-camila](https://tintinaccs.com/products/bolso-camila) | o6hrWjrwd2chRXudpB7u | https://tintinaccs.com/product?id=o6hrWjrwd2chRXudpB7u | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-valentina](https://tintinaccs.com/products/bolso-valentina) | rNRdJNZsszNQ59SDV2Zd | https://tintinaccs.com/product?id=rNRdJNZsszNQ59SDV2Zd | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [reloj-regina](https://tintinaccs.com/products/reloj-regina) | raqtnLvxHgpDZro36miR | https://tintinaccs.com/product?id=raqtnLvxHgpDZro36miR | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-alondra](https://tintinaccs.com/products/bolso-alondra) | vC0ods3P0r0PAvQXyTWk | https://tintinaccs.com/product?id=vC0ods3P0r0PAvQXyTWk | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-elisa](https://tintinaccs.com/products/bolso-elisa) | vrbRpRwqHheashV9kKJy | https://tintinaccs.com/product?id=vrbRpRwqHheashV9kKJy | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-luciana](https://tintinaccs.com/products/bolso-luciana) | vvcr45DzrMXlwd7pblqS | https://tintinaccs.com/product?id=vvcr45DzrMXlwd7pblqS | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-azalea](https://tintinaccs.com/products/bolso-azalea) | wK1IED6FnA5xeRCzT0Ar | https://tintinaccs.com/product?id=wK1IED6FnA5xeRCzT0Ar | 1 | Destino en inventario;interacción NOT_EXECUTED |
| [bolso-velisa](https://tintinaccs.com/products/bolso-velisa) | xKT8YwRpnXI8IeMYssEa | https://tintinaccs.com/product?id=xKT8YwRpnXI8IeMYssEa | 1 | Destino en inventario;interacción NOT_EXECUTED |

Las cinco colisiones son reloj-alessia, reloj-valentina, pulsera-bella, collar-ismera y reloj-vittoria. El mapa del resolvedor toma el primer resultado; falta contrato/metadatos históricos para decidir si hay defecto y corregirlo sin romper enlaces. Los datos privados/históricos pueden contener más alias y no son accesibles.

</details>


## Enlaces externos: los7 destinos HTTP estáticos

| Destino | Documentos consumidores | Destino final del extractor | Límite |
| --- | --- | --- | --- |
| [https://wa.me/595981299331](https://wa.me/595981299331) | 404.html, about.html, admin.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | https://api.whatsapp.com/send/?phone=595981299331&text&type=phone_number&app_absent=0 | Sólo landing;sin clic/apertura nativa/envío |
| [https://instagram.com/tintinaccs](https://instagram.com/tintinaccs) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | https://www.instagram.com/tintinaccs | Sólo landing;sin clic/apertura nativa/envío |
| [https://www.instagram.com/reel/DekE_RMBPjv/](https://www.instagram.com/reel/DekE_RMBPjv/) | about.html | https://www.instagram.com/reel/DekE_RMBPjv/ | Sólo landing;sin clic/apertura nativa/envío |
| [https://wa.me/595981299331?text=¡Hola%20Tintin!%20💕%20Quiero%20hacer%20una%20consulta.](https://wa.me/595981299331?text=¡Hola%20Tintin!%20💕%20Quiero%20hacer%20una%20consulta.) | contact.html | https://api.whatsapp.com/send/?phone=595981299331&text=%C2%A1Hola+Tintin%21+%EF%BF%BD+Quiero+hacer+una+consulta.&type=phone_number&app_absent=0 | Sólo landing;sin clic/apertura nativa/envío |
| [https://www.instagram.com/tintinaccs/](https://www.instagram.com/tintinaccs/) | index.html | https://www.instagram.com/tintinaccs/ | Sólo landing;sin clic/apertura nativa/envío |
| [https://wa.me/595981299331?text=Hola%2C%20mi%20n%C3%BAmero%20ya%20figura%20en%20otra%20cuenta%20y%20no%20puedo%20completar%20mi%20registro.](https://wa.me/595981299331?text=Hola%2C%20mi%20n%C3%BAmero%20ya%20figura%20en%20otra%20cuenta%20y%20no%20puedo%20completar%20mi%20registro.) | login.html | https://api.whatsapp.com/send/?phone=595981299331&text=Hola%2C+mi+n%C3%BAmero+ya+figura+en+otra+cuenta+y+no+puedo+completar+mi+registro.&type=phone_number&app_absent=0 | Sólo landing;sin clic/apertura nativa/envío |
| [https://wa.me/595981299331?text=Hola%21+Necesito+ayuda+con+mi+pedido+%F0%9F%8C%B8](https://wa.me/595981299331?text=Hola%21+Necesito+ayuda+con+mi+pedido+%F0%9F%8C%B8) | perfil.html | https://api.whatsapp.com/send/?phone=595981299331&text=Hola%21+Necesito+ayuda+con+mi+pedido+%EF%BF%BD&type=phone_number&app_absent=0 | Sólo landing;sin clic/apertura nativa/envío |

Las34 acciones no HTTP conservan filas en JSON (incluyen tel/mailto y disparadores que no navegan). La sintaxis teléfono/correo se revisó en fuente; no se abrieron aplicaciones nativas. Los enlaces generados por tarjetas, opciones, consultas WhatsApp individuales, editor y filas privadas siguen pendientes de inventario. El reemplazo Unicode observado en algunos final_url de WhatsApp puede pertenecer al extractor/proveedor: verificar en navegador antes de atribuir un fallo al sitio.


<details>
<summary>45 destinos HTTP internos y19 anclas legales: todas las filas</summary>

| Destino | Documentos | Evidencia de lectura | Resultado del clic |
| --- | --- | --- | --- |
| [https://tintinaccs.com/](https://tintinaccs.com/) | 404.html, about.html, admin.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, login.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo](https://tintinaccs.com/catalogo) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=relojes](https://tintinaccs.com/catalogo?cat=relojes) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=aros](https://tintinaccs.com/catalogo?cat=aros) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=collares](https://tintinaccs.com/catalogo?cat=collares) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=bolsos](https://tintinaccs.com/catalogo?cat=bolsos) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=pulseras](https://tintinaccs.com/catalogo?cat=pulseras) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=anillos](https://tintinaccs.com/catalogo?cat=anillos) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=earcuff](https://tintinaccs.com/catalogo?cat=earcuff) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=gafas](https://tintinaccs.com/catalogo?cat=gafas) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=armcuff](https://tintinaccs.com/catalogo?cat=armcuff) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=joyeros](https://tintinaccs.com/catalogo?cat=joyeros) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/catalogo?cat=tobilleras](https://tintinaccs.com/catalogo?cat=tobilleras) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/about](https://tintinaccs.com/about) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, nosotros.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/envios](https://tintinaccs.com/envios) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/cambios-devoluciones](https://tintinaccs.com/cambios-devoluciones) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/preguntas-frecuentes](https://tintinaccs.com/preguntas-frecuentes) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/terminos](https://tintinaccs.com/terminos) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/privacidad](https://tintinaccs.com/privacidad) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/contact](https://tintinaccs.com/contact) | 404.html, about.html, cambios-devoluciones.html, catalogo.html, checkout.html, collections.html, contact.html, envios.html, index.html, perfil.html, preguntas-frecuentes.html, privacidad.html, product.html, terminos.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/login](https://tintinaccs.com/login) | admin-images.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/admin](https://tintinaccs.com/admin) | admin-images.html, perfil.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/admin-images](https://tintinaccs.com/admin-images) | admin.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/checkout](https://tintinaccs.com/checkout) | admin.html, perfil.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/perfil#pedidos](https://tintinaccs.com/perfil#pedidos) | checkout.html | Sólo padre leído;ancla pendiente | NOT_EXECUTED |
| [https://tintinaccs.com/privacidad.html#seccion-1](https://tintinaccs.com/privacidad.html#seccion-1) | privacidad.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/privacidad.html#seccion-2](https://tintinaccs.com/privacidad.html#seccion-2) | privacidad.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/privacidad.html#seccion-3](https://tintinaccs.com/privacidad.html#seccion-3) | privacidad.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/privacidad.html#seccion-4](https://tintinaccs.com/privacidad.html#seccion-4) | privacidad.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/privacidad.html#seccion-5](https://tintinaccs.com/privacidad.html#seccion-5) | privacidad.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/privacidad.html#seccion-6](https://tintinaccs.com/privacidad.html#seccion-6) | privacidad.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/privacidad.html#seccion-7](https://tintinaccs.com/privacidad.html#seccion-7) | privacidad.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/privacidad.html#seccion-8](https://tintinaccs.com/privacidad.html#seccion-8) | privacidad.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/privacidad.html#seccion-9](https://tintinaccs.com/privacidad.html#seccion-9) | privacidad.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/collections](https://tintinaccs.com/collections) | product.html | URL exacta leída | NOT_EXECUTED |
| [https://tintinaccs.com/terminos.html#seccion-1](https://tintinaccs.com/terminos.html#seccion-1) | terminos.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/terminos.html#seccion-2](https://tintinaccs.com/terminos.html#seccion-2) | terminos.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/terminos.html#seccion-3](https://tintinaccs.com/terminos.html#seccion-3) | terminos.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/terminos.html#seccion-4](https://tintinaccs.com/terminos.html#seccion-4) | terminos.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/terminos.html#seccion-5](https://tintinaccs.com/terminos.html#seccion-5) | terminos.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/terminos.html#seccion-6](https://tintinaccs.com/terminos.html#seccion-6) | terminos.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/terminos.html#seccion-7](https://tintinaccs.com/terminos.html#seccion-7) | terminos.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/terminos.html#seccion-8](https://tintinaccs.com/terminos.html#seccion-8) | terminos.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/terminos.html#seccion-9](https://tintinaccs.com/terminos.html#seccion-9) | terminos.html | Sólo fuente | NOT_EXECUTED |
| [https://tintinaccs.com/terminos.html#seccion-10](https://tintinaccs.com/terminos.html#seccion-10) | terminos.html | Sólo fuente | NOT_EXECUTED |

| Página | ID ancla | Evidencia | Navegador |
| --- | --- | --- | --- |
| privacidad.html | seccion-1 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| privacidad.html | seccion-2 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| privacidad.html | seccion-3 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| privacidad.html | seccion-4 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| privacidad.html | seccion-5 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| privacidad.html | seccion-6 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| privacidad.html | seccion-7 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| privacidad.html | seccion-8 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| privacidad.html | seccion-9 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| terminos.html | seccion-1 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| terminos.html | seccion-2 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| terminos.html | seccion-3 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| terminos.html | seccion-4 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| terminos.html | seccion-5 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| terminos.html | seccion-6 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| terminos.html | seccion-7 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| terminos.html | seccion-8 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| terminos.html | seccion-9 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |
| terminos.html | seccion-10 | ID presente en HTML | Clic/scroll/foco NOT_EXECUTED |


</details>


## Administración por módulo y rol

Los enlaces #sección representan navegación declarada, no prueba de acceso. section/tab existen en el controlador pero falta comprobar precedencia y semántica. En cada módulo faltan las filas, filtros, menús, modales, selectores, paginación y subflujos del DOM generado; tablas vacías, datos normales/incorrectos/extremos, sesión vencida y errores. Los intentos permitidos y denegados deben probar UI y backend en QA. No se presume acceso total por llamarse admin.

| Módulo | Ruta | Roles | Evidencia | Estado |
| --- | --- | --- | --- | --- |
| dashboard | /admin#dashboard | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| estadisticas | /admin#estadisticas | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| usuarios | /admin#usuarios | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| pedidos | /admin#pedidos | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| ventas-locales | /admin#ventas-locales | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| clientes-compraron | /admin#clientes-compraron | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| espejos-sheets | /admin#espejos-sheets | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| mayoristas | /admin#mayoristas | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| productos | /admin#productos | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| resenas | /admin#resenas | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| me-gusta | /admin#me-gusta | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| colecciones | /admin#colecciones | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| paginas | /admin#paginas | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| importar | /admin#importar | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| mensajes | /admin#mensajes | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| notificaciones-push | /admin#notificaciones-push | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| auditoria | /admin#auditoria | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| diagnostico | /admin#diagnostico | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| flujo-conexiones | /admin#flujo-conexiones | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| correos | /admin#correos | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| configuracion | /admin#configuracion | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| permisos | /admin#permisos | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |
| apariencia | /admin#apariencia | invitado/client/viewer/agent/admin/superadmin | admin.html:data-section y controladores | NOT_EXECUTED;permisos efectivos desconocidos |

/admin-images incluye Hero, Productos, Editorial/Colecciones, Íconos/Trust, Nosotros, Branding/Logo y Biblioteca multimedia; acciones múltiples de quitar, exportar URLs y limpiar selección. Sus18 controles estáticos están registrados; carga de archivos, biblioteca/filas y edición privada no están probadas.


<details>
<summary>58 API: métodos, parámetros y guardas detectados en fuente</summary>

Estos tokens **no especifican por sí solos métodos permitidos ni garantizan autorización**; seguir imports, wrappers y permisos reales antes de definir contrato. No se invocaron mutaciones productivas.

| Patrón | Fuente fijada | Métodos literales / handlers | Query tokens | Guardas llamadas detectadas | Ejecución |
| --- | --- | --- | --- | --- | --- |
| /api/admin-backfill-canonical-identity | [functions/api/admin-backfill-canonical-identity.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/admin-backfill-canonical-identity.js) | OPTIONS,POST; onRequest | pageSize,orderBy,pageToken | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/admin-catalog-delete | [functions/api/admin-catalog-delete.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/admin-catalog-delete.js) | OPTIONS,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/admin-commerce-controls | [functions/api/admin-commerce-controls.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/admin-commerce-controls.js) | GET,OPTIONS,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/admin-engagement | [functions/api/admin-engagement.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/admin-engagement.js) | OPTIONS,GET,POST; onRequest | action,status,search | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/admin-import-job | [functions/api/admin-import-job.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/admin-import-job.js) | OPTIONS,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/admin-import-media | [functions/api/admin-import-media.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/admin-import-media.js) | GET,POST,OPTIONS; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/admin-order-mutation | [functions/api/admin-order-mutation.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/admin-order-mutation.js) | GET,OPTIONS,POST; onRequest | orderId | requireSuperAdmin,requireOrderStaff | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/admin-runtime-health | [functions/api/admin-runtime-health.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/admin-runtime-health.js) | OPTIONS,GET; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/admin-wholesale | [functions/api/admin-wholesale.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/admin-wholesale.js) | OPTIONS,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/apps-script-bridge | [functions/api/apps-script-bridge.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/apps-script-bridge.js) | OPTIONS,POST; onRequest | — | verifyFirebaseIdToken | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/catalog-sheet-sync-drain | [functions/api/catalog-sheet-sync-drain.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/catalog-sheet-sync-drain.js) | POST; onRequestPost,onRequest | — | verifyGitHubActionsOidc | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/claim-commerce-history | [functions/api/claim-commerce-history.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/claim-commerce-history.js) | OPTIONS,POST; onRequest | — | requireFirebaseUser | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/cloudinary-delete | [functions/api/cloudinary-delete.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/cloudinary-delete.js) | POST,OPTIONS; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/cloudinary-sign-audio-upload | [functions/api/cloudinary-sign-audio-upload.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/cloudinary-sign-audio-upload.js) | OPTIONS,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/cloudinary-sign-upload | [functions/api/cloudinary-sign-upload.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/cloudinary-sign-upload.js) | OPTIONS,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/coupon-validate | [functions/api/coupon-validate.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/coupon-validate.js) | OPTIONS,POST; onRequest | — | requireFirebaseUser | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/email-otp-send | [functions/api/email-otp-send.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/email-otp-send.js) | POST,OPTIONS; onRequest | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/email-otp-verify | [functions/api/email-otp-verify.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/email-otp-verify.js) | OPTIONS,POST; onRequest | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/engagement | [functions/api/engagement.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/engagement.js) | OPTIONS,GET,POST; onRequest | action,productId | requireFirebaseUser | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/geo-search | [functions/api/geo-search.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/geo-search.js) | OPTIONS,GET; onRequest | q | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/health | [functions/api/health.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/health.js) | GET,HEAD; onRequest | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/instagram-feed | [functions/api/instagram-feed.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/instagram-feed.js) | onRequestGet | fields,limit | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/local-commerce-webhook | [functions/api/local-commerce-webhook.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/local-commerce-webhook.js) | onRequestPost | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/local-commerce | [functions/api/local-commerce.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/local-commerce.js) | OPTIONS,GET,POST; onRequest | view,includeTestOrders | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/location-search | [functions/api/location-search.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/location-search.js) | Wrapper:seguir implementación | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/master-diagnostics | [functions/api/master-diagnostics.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/master-diagnostics.js) | GET,POST,OPTIONS; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/notifications | [functions/api/notifications.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/notifications.js) | OPTIONS,GET,POST; onRequest | action | requireFirebaseUser,requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/order-email-drain | [functions/api/order-email-drain.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/order-email-drain.js) | POST; onRequestPost,onRequest | — | verifyGitHubActionsOidc | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/order-email | [functions/api/order-email.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/order-email.js) | POST,OPTIONS; onRequest | — | verifyFirebaseUser | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/paypal-capture-order | [functions/api/paypal-capture-order.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/paypal-capture-order.js) | OPTIONS,POST; onRequest | — | requireFirebaseUser | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/paypal-config | [functions/api/paypal-config.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/paypal-config.js) | GET; onRequest | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/paypal-create-order | [functions/api/paypal-create-order.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/paypal-create-order.js) | OPTIONS,POST; onRequest | — | requireFirebaseUser | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/paypal-rate-refresh | [functions/api/paypal-rate-refresh.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/paypal-rate-refresh.js) | POST; onRequestPost,onRequest | — | verifyGitHubActionsOidc | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/paypal-webhook | [functions/api/paypal-webhook.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/paypal-webhook.js) | POST; onRequest | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/phone-availability | [functions/api/phone-availability.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/phone-availability.js) | OPTIONS,POST; onRequest | — | requireUser | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/profile-avatar-upload | [functions/api/profile-avatar-upload.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/profile-avatar-upload.js) | OPTIONS,POST; onRequest | — | requireUser | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/public-catalog | [functions/api/public-catalog.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/public-catalog.js) | GET; onRequest | resource,id,schema | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/push-admin | [functions/api/push-admin.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/push-admin.js) | OPTIONS,GET,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/push-config | [functions/api/push-config.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/push-config.js) | OPTIONS,GET; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/push-order-event | [functions/api/push-order-event.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/push-order-event.js) | POST; onRequest | — | verifyWebhookSignature | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/push-subscription | [functions/api/push-subscription.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/push-subscription.js) | OPTIONS,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/push-test | [functions/api/push-test.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/push-test.js) | OPTIONS,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/sheets-admin-webhook | [functions/api/sheets-admin-webhook.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/sheets-admin-webhook.js) | onRequestPost | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/sheets-engagement-webhook | [functions/api/sheets-engagement-webhook.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/sheets-engagement-webhook.js) | onRequestPost | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/sheets-product-sync | [functions/api/sheets-product-sync.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/sheets-product-sync.js) | OPTIONS,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/sheets-products-webhook | [functions/api/sheets-products-webhook.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/sheets-products-webhook.js) | onRequestGet,onRequestPost | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/sheets-sync-snapshot | [functions/api/sheets-sync-snapshot.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/sheets-sync-snapshot.js) | onRequestPost | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/site-activity | [functions/api/site-activity.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/site-activity.js) | OPTIONS,POST; onRequest | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/system-health | [functions/api/system-health.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/system-health.js) | OPTIONS,GET; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/telemetry | [functions/api/telemetry.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/telemetry.js) | POST; onRequestPost,onRequestGet | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/test-email | [functions/api/test-email.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/test-email.js) | POST,OPTIONS; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/username-availability | [functions/api/username-availability.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/username-availability.js) | OPTIONS,POST; onRequest | — | requireFirebaseUser | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/visitor-geo | [functions/api/visitor-geo.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/visitor-geo.js) | OPTIONS,GET; onRequest | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/visual-builder-public | [functions/api/visual-builder-public.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/visual-builder-public.js) | GET; onRequest | page | requireVisualPageId | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/visual-builder | [functions/api/visual-builder.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/visual-builder.js) | OPTIONS,GET,POST; onRequest | page | requireSuperAdmin,requireVisualPageId | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/visual-studio-global-public | [functions/api/visual-studio-global-public.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/visual-studio-global-public.js) | OPTIONS,GET; onRequest | — | Seguir imports;no inferir ausencia de auth | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/visual-studio-global | [functions/api/visual-studio-global.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/visual-studio-global.js) | OPTIONS,GET,POST; onRequest | — | requireSuperAdmin | NOT_EXECUTED:datos/roles/respuesta/efectos/red |
| /api/wholesale-quote | [functions/api/wholesale-quote.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/api/wholesale-quote.js) | OPTIONS,POST; onRequest | — | requireFirebaseUser | NOT_EXECUTED:datos/roles/respuesta/efectos/red |


</details>



<details>
<summary>Otros manejadores functions, middleware y bibliotecas</summary>

| Fuente | Tipo | Patrón (no URL literal) | Estado |
| --- | --- | --- | --- |
| [functions/[page].js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/[page].js) | CLOUDFLARE_ROUTE_PATTERN | /[page] | Fuente inventariada;NOT_EXECUTED |
| [functions/__/auth/[[path]].js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/__/auth/[[path]].js) | CLOUDFLARE_ROUTE_PATTERN | /__/auth/[[path]] | Fuente inventariada;NOT_EXECUTED |
| [functions/_middleware.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/_middleware.js) | MIDDLEWARE_NOT_PUBLIC_ROUTE | No es ruta pública | Fuente inventariada;NOT_EXECUTED |
| [functions/admin-images.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/admin-images.js) | CLOUDFLARE_ROUTE_PATTERN | /admin-images | Fuente inventariada;NOT_EXECUTED |
| [functions/admin.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/admin.js) | CLOUDFLARE_ROUTE_PATTERN | /admin | Fuente inventariada;NOT_EXECUTED |
| [functions/collections/[handle].js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/collections/[handle].js) | CLOUDFLARE_ROUTE_PATTERN | /collections/[handle] | Fuente inventariada;NOT_EXECUTED |
| [functions/lib/github-actions-oidc.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/lib/github-actions-oidc.js) | LIBRARY_NOT_PUBLIC_ROUTE | No es ruta pública | Fuente inventariada;NOT_EXECUTED |
| [functions/lib/operational-guard.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/lib/operational-guard.js) | LIBRARY_NOT_PUBLIC_ROUTE | No es ruta pública | Fuente inventariada;NOT_EXECUTED |
| [functions/pages/[slug].js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/pages/[slug].js) | CLOUDFLARE_ROUTE_PATTERN | /pages/[slug] | Fuente inventariada;NOT_EXECUTED |
| [functions/policies/[slug].js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/policies/[slug].js) | CLOUDFLARE_ROUTE_PATTERN | /policies/[slug] | Fuente inventariada;NOT_EXECUTED |
| [functions/product.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/product.js) | CLOUDFLARE_ROUTE_PATTERN | /product | Fuente inventariada;NOT_EXECUTED |
| [functions/products/[handle].js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/products/[handle].js) | CLOUDFLARE_ROUTE_PATTERN | /products/[handle] | Fuente inventariada;NOT_EXECUTED |
| [functions/sitemap-collections.xml.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/sitemap-collections.xml.js) | CLOUDFLARE_ROUTE_PATTERN | /sitemap-collections.xml | Fuente inventariada;NOT_EXECUTED |
| [functions/sitemap-products.xml.js](https://github.com/tintinaccs/tintin-web/blob/bad42062290b4b780ba490abbb5f44bf685516a9/functions/sitemap-products.xml.js) | CLOUDFLARE_ROUTE_PATTERN | /sitemap-products.xml | Fuente inventariada;NOT_EXECUTED |


</details>


## Flujos completos y encadenados: planes individuales

Cada paso debe aportar resultado observable y evidencia, incluida la primera, segunda, tercera acción y el estado final. Son **planes sin ejecutar**. No deben generarse pedidos, pagos, correos, push, escrituras Sheets ni mensajes reales para probarlos.

### FLOW-01 — Catálogo→ficha→variante→carrito→checkout→ticket

1. Abrir cada categoría y producto con stock en QA.
2. Elegir todas las opciones aplicables y cantidad dentro del stock.
3. Agregar y comprobar identidad/variante/cantidad/precio/foto de línea.
4. Cambiar cantidad y volver a ficha; iniciar checkout.
5. Completar envío, identidad, cupón/factura y pago de sandbox.
6. Confirmar una única orden en emulador; comprobar stock, vaciado y ticket; recargar ticket sin duplicar.

Resultado esperado: Mismos datos entre pasos y cálculo autoritativo; idempotencia, sin pérdida ni sobreventa.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-02 — Búsqueda/filtros/orden e historial

1. Aplicar cat, q, sort y stock en todas sus opciones.
2. Combinar filtros y comprobar las tarjetas contra el snapshot.
3. Usar limpiar, adelante, atrás y recarga directa de URL combinada.
4. Repetir vacío, caracteres Unicode, categoría inexistente y resultados cero.

Resultado esperado: URL, controles y resultados se mantienen coherentes; cero resultados y fallo tienen salida recuperable.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-03 — Stock cero y extremos de cantidad

1. Abrir las 44 fichas con stock cero y cada variante.
2. Intentar compra; cambiar entre opciones agotadas y disponibles.
3. Probar 0, -1, fracciones, texto, cantidad mayor al stock y doble clic mediante fixtures.

Resultado esperado: Acciones y servidor impiden líneas inválidas, sobreventa y duplicación; UI informa causa.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-04 — Acceso por OTP y retorno

1. En emulador/sandbox ingresar correo válido e inválido.
2. Solicitar OTP, pegar, cambiar correo, reenviar tras cooldown.
3. Probar código vacío, incorrecto, vencido, reutilizado, cuota y proveedor indisponible.
4. Completar perfil obligatorio; comprobar from interno seguro y recarga.
5. Cerrar sesión y entrar con otro UID; revisar borradores/listeners.

Resultado esperado: Sólo la identidad validada avanza; retorno autorizado y datos aislados. No enviar correos reales.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-05 — Google y perfil incompleto

1. Usar cuenta de QA, cancelar popup y provocar fallo/expiración.
2. Completar perfil pendiente; intentar salir por ambas opciones del modal.
3. Revisar estados legacy/incomplete/active/deleted, invitado y token expirado.

Resultado esperado: No pérdida de datos ni acceso indebido; cierre de sesión elimina estado de cuenta anterior.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-06 — Perfil completo

1. Recorrer resumen, datos, pedidos, favoritos, cuenta y ayuda.
2. Guardar nombre/teléfono/usuario; probar disponibilidad, errores y cambio de UID.
3. Crear/editar/cancelar direcciones hasta el límite de cinco y excederlo en QA.
4. Probar mapa/búsqueda y geolocalización permitida/denegada.
5. Subir avatar válido, vacío, grande, inválido y error de proveedor.
6. Ver historial vacío/con datos y favoritos agregados/eliminados.

Resultado esperado: Cada pestaña conserva datos correctos por usuario; validación y recuperación explícitas.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-07 — Checkout envío y ubicación

1. Recorrer todos los departamentos/ciudades y modos agencia/puerta que ofrezca la UI.
2. Cambiar ubicación guardada, mapa, dirección y referencia.
3. Volver entre cada paso, recargar, cambiar cuenta y recuperar borrador.
4. Probar sin ciudad, sin dirección, coordenadas inválidas y red caída.

Resultado esperado: Costo y requisitos corresponden a la selección vigente; no dirección de otra cuenta.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-08 — Cupón, factura y pagos

1. Aplicar cupón válido, inválido, vencido, agotado, vacío y repetido en QA.
2. Activar/desactivar factura y cada tipo de contribuyente; CI/RUC válidos e inválidos.
3. Recorrer efectivo, transferencia y PayPal cuando esté configurado en sandbox.
4. Cancelar/reintentar pago y simular captura/webhook duplicado.

Resultado esperado: Totales del servidor; factura consistente, ninguna orden/captura doble; fallo conserva borrador.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-09 — Ticket y persistencia

1. En QA confirmar orden y abrir cada acción guardar/compartir/imprimir.
2. Cancelar compartir, simular API no soportada y bloqueo de descarga.
3. Recargar y navegar atrás/adelante; verificar ausencia de nuevo pedido.

Resultado esperado: Ticket de la misma orden; fallback utilizable y ninguna transacción adicional.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-10 — Paneles compartidos en todas las instancias

1. Por cada consumidor y dispositivo abrir búsqueda, carrito, cuenta y colecciones.
2. Abrir otro panel, cerrar por botón/Escape/fondo y navegar desde enlace.
3. Revisar foco, Tab/Shift+Tab, aria-expanded/hidden y bloqueo de scroll.
4. Redimensionar y rotar con panel abierto; conservar carrito/consulta.

Resultado esperado: Un panel activo, foco restaurado y scroll recuperado en toda instancia; si falla, propagar caso a todos los consumidores.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-11 — Galería, reseñas, favoritos y relacionados

1. En las 279 fichas recorrer imagen principal, miniaturas, lightbox y cierre.
2. Recorrer cada opción de variante y actualización de imagen/datos.
3. Abrir reseñas, cargar más y repetir con datos vacíos/error.
4. Alternar favorito, cambiar sesión y refrescar relacionados.

Resultado esperado: Ficha y selección correctas; sin datos de otra cuenta, foco/scroll preservados y estados vacíos recuperables.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-12 — Contacto y vínculos externos

1. Validar todos los campos y opciones del formulario de contacto en sandbox.
2. Probar vacío, correo incorrecto, límites, Unicode, error y doble envío.
3. Abrir cada destino WhatsApp/Instagram y enlaces por producto/variante sin enviar.
4. Verificar tel/mailto y texto Unicode en navegadores reales.

Resultado esperado: El formulario de contacto identificado prepara una consulta por WhatsApp: comprobar validación, destino y texto sin enviar. No asumir persistencia ni envío por backend sin evidencia.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-13 — Administración por rol

1. Para cada una de las 23 secciones y admin-images, entrar como invitado, client, viewer, agent, admin y superadmin de QA.
2. Registrar permisos efectivos antes de establecer qué acción debe permitirse.
3. Por sección inventariar todas las filas, filtros, opciones, modales, formularios, selecciones y paginación.
4. Ejecutar cada operación permitida y su intento denegado directo por API/Firestore.
5. Repetir con tabla vacía, payload incorrecto/extremo, sesión vencida y error; encadenar alta→edición→consulta→baja sólo en emulador.

Resultado esperado: UI y backend aplican la misma política vigente; ningún cambio productivo ni elevación.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-14 — Páginas custom, publicación y SEO

1. Crear página de QA desde Admin, guardar borrador e intentar abrir /pages/:slug por cada rol.
2. Publicar, abrir directamente, editar sólo SEO, editar contenido y despublicar.
3. Probar alias incorporado con/sin override custom; slug vacío/incorrecto/no existente.
4. Probar títulos/textos/URLs largos, pre/table y viewport320; comprobar fuente y aviso de revisión.

Resultado esperado: Borradores privados; publicación/SEO/aviso correctos, sin desbordamiento. La lista privada de slugs no está disponible.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-15 — Rutas heredadas y errores

1. Abrir todos los alias inventariados /pages, /policies, /collections y /products.
2. Comprobar final, query/hash, recarga y atrás/adelante.
3. Resolver los cinco slugs de producto ambiguos con metadatos históricos antes de proponer cambio.
4. Probar IDs/handles/slugs ausentes, inválidos, codificados y no publicados en QA.

Resultado esperado: Destino canónico correcto según contrato; errores y borradores no revelan datos privados.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-16 — Tienda cerrada, offline y recuperación

1. En entorno QA alternar cierre/apertura y publicación con cada rol.
2. Cargar caché, desconectar/red lenta, provocar API/SDK/CDN fallidos y reintentar.
3. Recargar en diferentes pasos y con service worker previo; comprobar actualización de versión.

Resultado esperado: Gate de tienda y datos publicados consistentes; recuperación sin cargas permanentes o datos indebidos.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.

### FLOW-17 — Integraciones de administración

1. En QA recorrer correos, push, Sheets, importaciones, mayoristas, ventas locales, diagnóstico y apariencia.
2. Usar proveedores sandbox/fakes y payloads válidos/vacíos/incorrectos/extremos.
3. Simular permisos denegados, timeout, webhook repetido y reintento.
4. Verificar efectos encadenados en panel, catálogo/pedido y auditoría.

Resultado esperado: Idempotencia, trazabilidad y aislamiento; no correos, push, escrituras Sheets ni compras reales.

Estado: **NOT_EXECUTED**. Evidencia de ejecución en esta continuación: ninguna.


## Siete correcciones históricas: preservar sin atribuir aprobación actual

Son cambios locales descritos por el checkpoint anterior, **sin acceso actual al diff ni integración en el main congelado**. Sus resultados pertenecen a ese árbol local. No se garantiza que el almacenamiento fallido conserve los parches hasta recuperarlo; este registro preserva qué se corrigió, qué se había probado y qué falta repetir.

| ID/severidad | Problema/componente | Cambio local descrito | Evidencia histórica limitada | Siguiente verificación |
| --- | --- | --- | --- | --- |
| PREV-01 HIGH | Firestore site_content/{pageId}: Lectura pública de borradores custom no publicados. | Restringir GET sin romper legacy/documento ausente; superadmin verificado permite lectura. | 47 casos de privacidad y ci:rules reportados correctos en Node24. | Recuperar diff, comparar con main actual y repetir emulador por roles y publicación. |
| PREV-02 MEDIUM | functions/pages/[slug].js layout: Desbordamiento de páginas custom con texto/pre/table extremos en320px. | min-width:0, wrapping y contención horizontal para pre/table; tabla mantiene overflow-wrap normal. | Suites Chromium/WebKit de custom informadas en checkpoint previo. | Recuperar parche y repetir viewport320/tablet/desktop con contenido extremo. |
| PREV-03 LOW | Custom page SEO/revisión: metaTitle guardado pero no utilizado. | Separar title SEO de H1 y excluir title de la revisión visual. | 7 casos Node custom/guard y suites custom en checkpoint. | Recuperar diff y repetir actualización SEO sola y de contenido. |
| PREV-04 LOW | Tipografía custom: Montserrat declarada sin carga del stylesheet canónico. | Incluir /css/core/montserrat.css con versión canónica. | Chromium51 y WebKit21 casos de suites indicadas después del cambio; no toda la auditoría. | Comprobar archivo/font real y visual actual en los tres dispositivos. |
| PREV-05 MEDIUM | package-lock.json: @hono/node-server2.1.0, GHSA-rmxm-3fg6-px4f. | Actualizar dependencia transitiva a2.1.5. | npm audit0 en instalación local previa. | Recuperar lock y repetir instalación/audit con Node requerido. |
| PREV-06 MEDIUM | Node/CI: Node22 incompatible con Firebase13/rules-unit-testing6 que requieren&gt;=24.12. | engines&gt;=24.12.0; Node24 y npm ci --engine-strict en nueve workflows. | YAML comparado; rechazo esperado Node22; npm ci estricto Node24 y preflight previo. | Recuperar diff y repetir preflight final/build/manifiestos; el preflight anterior precede a los últimos cambios. |
| PREV-07 MEDIUM | /api/order-email: Errores de autenticación devueltos como400 genérico. | Mapear401/403/503 según identidad/verificación/proveedor conservando400 de dominio. | 183 pruebas Node seguridad/pedidos reportadas después de corrección; sin correos reales. | Recuperar diff y repetir contrato de endpoint y dependencias con revisión actual. |

El preflight de39 comandos se había completado antes de las últimas ediciones de correo/fuente y no era validación final. Las suites largas admin/browser/quality interrumpidas no cuentan como aprobadas. Las últimas dos pruebas de comercio por color fallaron por SDK gstatic503: resolver/distinguir el bloqueo del harness antes de concluir sobre producto. Faltan regeneradores canónicos, preflight/build final y diff contra la revisión actual. Esta continuación no añade correcciones de código validadas ni ejecuta nuevas regresiones.

## Observaciones que no deben convertirse en falsos defectos

- **OBS-01 / READ_ONLY_METADATA_MATCH**: 279/279 títulos esperados y canonical coinciden; una ficha requirió reintento. No prueba visibilidad ni interacciones.
- **OBS-02 / EXTRACTOR_LIMITATION**: 38 nombres ausentes de headings de primer nivel del árbol extraído; metadatos correctos. No es prueba de fallo visible.
- **OBS-03 / UNCONFIRMED**: Reemplazo Unicode en algunos final_url WhatsApp del extractor/proveedor. Comprobar mensaje exacto en navegador real; no corregir a ciegas.
- **OBS-04 / NOT_CONFIRMED_DEFECT**: MOCHILAS está en12 colecciones públicas pero no en fallback estático. El controlador carga categorías visibles dinámicamente; falta verificar DOM final.
- **OBS-05 / AMBIGUITY_REQUIRES_HISTORICAL_MAPPING**: Cinco slugs derivados de nombres corresponden a dos IDs públicos cada uno. El resolvedor elige primer resultado del mapa. Confirmar contrato y enlaces históricos antes de alterar rutas.
- **OBS-06 / EXTRACTOR_TIMEOUT**: /products/mochila-melina no devolvió extracción en dos intentos; ficha canónica por ID sí tiene metadatos correctos. No hay diagnóstico de causa ni estado HTTP.
- **OBS-07 / NO_NEW_CODE_FIXES_VALIDATED**: Esta continuación añadió inventario/evidencia de lectura; las siete correcciones previas siguen como checkpoint local sin acceso. No se ejecutaron regresiones actuales.

## Bloqueos, continuidad y criterio de cierre

- **ENV-01**: Entorno ccarenv_b64_Y2NhcmVudl81MmUzMGJmOWFmNDg4MTkxYWJkMzY4Yzk2Y2YyYzM4Zg falló: executor configuration capabilities / relay Noise handshake reset; último exec_command pwd: No usable execution environment is available.
- **BROWSER-01**: No hay pestañas ni herramienta interactiva de navegador conectado disponibles. fetch_content sólo aporta lectura estructurada.
- **ACCESS-01**: No se dispone de sesiones QA de cada rol ni listado privado de slugs, pedidos, datos de prueba y permisos efectivos.
- **PRODUCTION-01**: No ejecutar compras, pedidos, correos, push, webhooks de escritura o cambios destructivos reales para obtener evidencia; usar QA/emuladores.

El ejecutor volvió a rechazar incluso pwd con `No usable execution environment is available`. No se pudieron ejecutar checkout/diff local, pruebas, emulador, Playwright, build, preflight ni manifiestos. No hay herramienta interactiva de navegador conectado disponible; la extracción pública no sustituye esa capacidad. No hay sesiones QA ni permisos/datos privados suficientes para enumerar estados autenticados.

La consistencia de esta entrega se comprueba por conteos, identidad de filas y estados pendientes; no es una suite de regresión del sitio. Antes de cerrar Tintin:

1. Recuperar el árbol local y reconciliar sus siete correcciones con los cambios actuales de main.
2. Disponer de QA aislado con datos/sesiones por rol y proveedores sandbox/fakes; obtener slugs privados y permisos efectivos.
3. Expandir todo DOM generado por página, estado y dispositivo; asociar cada acción con un caso y evidencia.
4. Ejecutar cada fila aplicable con normales/vacíos/incorrectos/extremos, historial, recarga, consola y red; justificar cada N/A.
5. Corregir defectos reproducidos, repetir regresiones y comprobar todas las instancias si el componente es compartido.
6. Regenerar planes/manifiestos con scripts canónicos y completar preflight/build reproducible final.

**No cerrar una página con interacciones pendientes.** El checkpoint documental no declara aptitud de merge; no se solicitó PR, merge, despliegue productivo ni dispatch de workflows.
