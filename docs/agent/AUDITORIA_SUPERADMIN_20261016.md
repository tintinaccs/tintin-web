# Super Admin: revisión funcional y sincronización — 2026-10-16

Base reconciliada: 280dc3710233825732339203a84a24486ebf47f5. Alcance solicitado: módulos, operaciones locales, campanas, nuevo pedido, aviso de actualización y dispositivos. No se certifican escrituras comerciales reales ni todos los dispositivos físicos. El registro Maestro contiene **26 superficies**, no 27 módulos: Operaciones es una herramienta adicional de la cabecera. Sus 27 comprobaciones son contratos, no un conteo de módulos.

## Problemas confirmados y correcciones

| Prioridad | Problema y evidencia | Corrección y regresión |
|---|---|---|
| Alta | vigilancia-version sólo comparaba recursos HTML: guardar datos administrativos no cambiaba su versión. | Revisión pública mínima settings/siteRevision, escrita tras confirmación del cambio. Escrituras frontend y APIs autenticadas notifican sin repetir el negocio ni convertir un fallo del aviso en un fallo del pedido. Se reutiliza el aviso Actualizar/Más tarde; primera lectura establece base, siguientes revisiones se deduplican. Reintentos acotados y recuperación online/visibilidad. tests/admin/cambios-confirmados y revision-reconexion. |
| Alta | UID/email podían entregar snapshots desordenados y la fusión del perfil elegía el último recibido, aunque fuese antiguo. | Mayor inventoryRevision y fecha confirmada ganan independientemente del orden de llegada. tests/profile/estado-canonico-perfil. |
| Alta | Una edición de artículos, importes, entrega o contacto sin cambiar estado no generaba aviso a la clienta. | Aviso order_updated en el mismo commit atómico del pedido, inventario y auditoría. Sin avisos por notas internas ni duplicados por replay. tests/orders/order-admin-domain. |
| Alta | Usuarios limitados a 250, productos a 1000 y colecciones a 200: estadísticas/listas podían quedar parciales. | Paginación completa para el titular, páginas limitadas con cursores estables, listeners y loading hasta completar; conserva límites de otros roles. Se reutiliza la fuente paginada de pedidos. Pruebas de 600 usuarios (100 sin createdAt), 1201 productos, 251 colecciones y actualización de páginas posteriores. El selector CSV también usa la fuente paginada:251 colecciones para el titular,200 para otros roles, con edición remota y cierre de ambas páginas probados. |
| Media | La escucha de pedidos de la campana podía abrirse después de cerrar sesión si App Check terminaba tarde. | Generación y UID validados después del await y en callbacks. tests/admin/notificaciones-sesion. |
| Media | Ventas locales esperaba el siguiente sondeo para mostrar cambios remotos. | Recibe la señal confirmada y refresca de inmediato si no hay edición; conserva el borrador abierto y refresca al cerrar. Se mantiene respaldo de 30 s. tests/operations/ventas-locales-vivo en 390/768/1366. Sheets depende además de su webhook/reconciliación externa; no se promete latencia cero antes de recibirlo. |
| Media | Páginas invocaba window.logAudit opcional, pero admin-app no lo exponía. | Se conecta a la función de auditoría canónica existente; conserva actor, rol y permisos actuales. |
| Media | El aviso podía superponerse a la navegación móvil administrativa. | Se incorpora adm-mobile-tabs al cálculo de posición y objetivos táctiles de 44 px. tests/operations/cambios-tienda en 320/390/768/1024/1366/1920, sin overflow ni pérdida de formulario/carrito. |

| Alta | Cambiar el slug de una página borraba la original antes de confirmar la nueva: un rechazo posterior podía dejarla sin guardar. | Alta y baja se confirman en un único WriteBatch; ante rechazo conserva original y borrador. tests/admin/paginas-atomicas. |

| Media | La carga de contactos/historial y los snapshots de pedidos reconstruían el drawer: el foco de botones/enlaces se perdía fuera del diálogo. CI38946997090 lo detectó; tres regresiones provocadas fallaron antes de corregir. | Se restaura el control por atributo estable y la selección del texto pendiente; si desaparece, el foco vuelve a Cerrar. Doce casos (tres repeticiones, móvil/tablet/escritorio y teclado original) PASS_LOCAL. tests/ui-ux/orders-board. |

| Media | El aviso añadió herramientas administrativas a la lectura pública de imágenes: Nosotros llegó a130 solicitudes propias, sobre el presupuesto127; comparación main126. | Escritor de imágenes bajo demanda y observador reutilizado desde vigilancia-version. Se mantiene el presupuesto127; regresiones de revisión/reconexión y rendimiento Contacto/Nosotros pasan. |

## Cobertura de superficies

Continuación posterior a la publicación del PR1143: el monitor38978101077 detectó un problema adicional en Login/Perfil. La espera recuperable de App Check generaba avisos de error y reiniciaba repetidamente la misma promesa vencida. Se conserva el wrapper pendiente, que abre una única escucha cuando llega el token; los rechazos reales de Firestore mantienen su aviso y reconexión acotada. El monitor no cambia y no se relajan App Check ni Rules. La regresión con el wrapper real falla antes de la corrección y pasa después, incluyendo token tardío, no duplicación, denegación real y cierre de la página. Este es el duodécimo hallazgo.

La tabla identifica el contrato inspeccionado. Las auditorías estáticas prueban conexión; los tests de dominio/emulador comprueban comportamiento y autorización; los fixtures de navegador prueban interacción sin datos reales. Ninguna de esas evidencias equivale a haber ejecutado todas las operaciones de producción con la cuenta del titular.

| Superficie registrada | Contrato revisado / evidencia |
|---|---|
| Maestro | Registro, arranque, enlaces y estados; auditoría Maestro 27/27 y responsive. |
| Dashboard | Fuentes canónicas de pedidos/usuarios/productos; estadísticas y carga completa. |
| Estadísticas | Agregación real, fechas, estados y exportación; tests/analytics y auditoría analytics-audit. |
| Usuarios | Paginación, perfiles sin fecha, roles y permisos; usuarios-paginados y usuarios-roles. |
| Pedidos | CRUD, inventario atómico, historial, idempotencia, validación y notificación; tests/orders y Rules. |
| Ventas locales | Lectura/API, edición, borrador, refresco remoto; fixtures commerce y ventas-locales-vivo. |
| Clientes que compraron | Datos derivados de pedidos, consulta y conexión; contratos Maestro/analytics. |
| Espejos Sheets | Integración API/webhook y conciliación; tests de operaciones/comercio local. |
| Mayoristas | Identidad, cotizaciones y permisos actuales; tests/wholesale y Rules. |
| Productos | Catálogo, variantes, stock y CRUD; paginación y tests de catálogo/pedidos. |
| Reseñas | Moderación, datos públicos y mutación autorizada; participación y Rules. |
| Me gusta | Agregación y participación; contratos de participación y Rules. |
| Colecciones | Lista completa, orden y unificación Pulseras; catalogo-paginado y tests/sync. |
| Páginas | CRUD y publicación; auditoría contenido/apariencia, conexión de logAudit y renombrado atómico. |
| Importar | Validación, preview, aplicación transaccional y replay; 12 contratos admin-import-job. |
| Imágenes | Biblioteca externa admin-images; originales, referencia y borrado; helpers canónicos e integración. |
| Mensajes | Integración WhatsApp/configuración, no bandeja de chats privados; auditoría email-messaging. |
| Notificaciones push | Gestión API y permisos; tests/push, filtro de acciones de sólo lectura y Rules. |
| Auditoría | Lectura/exportación, registro inmutable; analytics-audit y Rules. No requiere edición/borrado. |
| Diagnóstico | Inspección de sólo lectura, estados y enlaces; Maestro/diagnóstico. |
| Flujo de conexiones | Vista de sólo lectura y enlaces; auditoría conexiones 25/25. |
| Correos | Configuración y contratos del transporte; auditoría email-messaging. Sin enviar correos reales. |
| Configuración | Tienda, pagos, cupones, sincronización; escritura confirmada y Rules. |
| Permisos | Exclusividad del titular, rechazo de escalada; usuarios-roles y emulador. |
| Apariencia | Contenido, editor visual publicado y welcome; tests/visual-builder y auditorías. Borradores no publican aviso. |
| Welcome | Control dinámico y publicación confirmada; contenido/apariencia y Maestro. |
| Operaciones (cabecera) | Historial/progreso del núcleo existente; tests/operations/nucleo-operaciones y central-loader-ui. |
| Campanas admin/clienta | Streams en vivo, ciclo de sesión, aviso atómico del pedido y dedupe; pruebas citadas. |
| Nuevo pedido (cabecera) | El manejador capture ya abría el editor manual autorizado. Se conserva y prueba con orders editor; no era un enlace roto. |

## Evidencia y límites de publicación

- 560 contratos Node de administración, pedidos, perfil, sync, operaciones, visual, mayoristas, push, estadísticas e importación: PASS_LOCAL. Incluye reconexión y renombrado atómico. Un listener SDK anónimo recibe en vivo el cambio confirmado por otro SDK del titular, sin recargar ni getDoc adicional.
- Firestore crítico: 200 controles/ataques y prueba REST de límite compartido: PASS_LOCAL en emulador. El nonce sólo permite lectura puntual pública, sin listar settings; exclusivamente el titular puede escribir dos campos y timestamp del servidor. No publica identidad ni pedido.
- Maestro responsive: cinco tamaños; sidebar/aviso: 17 casos; edición de pedidos: tres casos; ventas locales en vivo: tres casos PASS_LOCAL. Las pruebas generales previas con fixtures detectaron dependencias nuevas ausentes en el harness: se añadieron stubs que rechazan escrituras y se repitieron los casos afectados, conservando aserciones.
- Auditorías base, sincronización (28), conexiones (25), usuarios/roles (25), contenido/apariencia (21), correos/mensajería (22), estadísticas/auditoría (31): PASS_LOCAL.
- PR1143 está integrado en06e80adcda2339d2b7f39db450ba25fa8f2f110d. CI38965700570 del candidato62faa992 y CI38974205592 de main: SUCCESS. El mantenimiento38968350615 y Pages también aprobaron. Estas ejecuciones confirman el build y las suites del candidato publicado; las cifras locales anteriores describen las pruebas de ese trabajo, no nuevas ejecuciones de esta continuación.
- Rules publicadas desde main06e80adc: workflow38974257566 SUCCESS, incluido el paso «Publish only Firestore rules». La revisión production-rules fue aprobada por el titular; esta continuación no necesita cambiar permisos ni volver a publicar reglas.
- Pendiente de la continuación: CI del nuevo SHA, revisión humana de mantenimiento, publicación y recuperación del monitor real. No se atribuye un PASS de salud global: las ejecuciones38974205727 y38978101077 fallaron por los avisos derivados de App Check descritos arriba, aunque las otras etapas operativas aprobaron.
