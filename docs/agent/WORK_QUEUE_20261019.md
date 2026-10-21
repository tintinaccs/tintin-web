# Cola de trabajo autorizada — 19/10/2026

Registro histórico del trabajo del19/10 sobre ab6c972a (#1169). No es la cola vigente ni una autorización para repetir operaciones. Consultar `CURRENT_STATE.md` y main actual antes de actuar. En particular, el cierre posterior adoptó ocultación reversible de pedidos de prueba: no ejecutar las bajas o devoluciones de stock descritas abajo como si siguieran pendientes. Se conserva el texto como evidencia de aquella fecha, sin heredar PASS ni presumir que todo quedó cerrado. Fecha comercial: America/Asuncion.

## Reglas de integridad

- Conservar pedido real TINPED26 (Gs.205.000), ventas manuales reales y usuarios.
- Retirar pedidos web de prueba TINPED01–25 mediante Borrados recuperable. Excepción manual QA16 también autorizada expresamente.
- Devolver existencias efectivamente descontadas cuando corresponda; no sumar unidades de pedidos unreserved/released/canceled. Titular autoriza retirar TINPED10 sin reponer producto inexistente.
- No hacer compras nuevas, pagos, reembolsos, envíos de correos/push ni borrar definitivamente datos.
- Aplicar cada cambio a todas las superficies consumidoras correspondientes: web pública, panel, Firestore, Sheets, métricas e integraciones. Comparar identidades y valores, no sólo apariencia.
- No reactivar Shopify, recomprar dominio ni cambiar DNS, nameservers o Pages.

## Tareas y condiciones de cierre

1. **IN_PROGRESS: limpieza de pruebas y stock.** Retirar 01–25, conservar 26 y ventas manuales; conciliar reservas por variante, inventario y Borrados. Operaciones comprobadas: 25/OP000002 (1 unidad), 16/OP000003 (0), 22/OP000006 (0), 21/OP000007 (0), 20/OP000008 (0). TINPED10/OP000004 rechazado atómicamente por producto inexistente; retiro sin devolución autorizado, aún pendiente.
2. **IN_PROGRESS: facturación real.** Sólo Facturación con corte inicio 19/10 Paraguay aplicado por OP-20261019-000005. Estadísticas observado Gs.205.000. Pendiente comprobar Dashboard, rangos, gráficos, clientes, pedidos, exportaciones y Sheets; no confundir importe pagado con valor del pedido ni reemplazar ventas históricas manuales por 205.000.
3. **IN_PROGRESS: conciliación Sheets/Firestore completa.** Hoja canónica localizada por Drive (27 pestañas; locale es_PY, America/Asuncion). Historial sync confirma 21 usuarios y bajas de pedidos cada minuto; Pedidos web refleja las bajas. Falla HIGH reproducida: ComercioLocal.gs no retira líneas WEB_ ausentes del snapshot completo y Octubre conserva pruebas retiradas. Corrección local + regresión (FAIL antes/PASS después); 20 pruebas comercio local y 51 de paridad/productos/evidencia pasan. Pendiente publicación del motor y comprobación de hojas mensuales, stock, clientes y totales; conservar históricos/manuales. El total real 205.000 incluye 180.000 artículos y 25.000 envío, no implica cobro confirmado.
4. **PENDING: problemas capturas 23:17–23:18 UTC.** Filtros Productos poco legibles; borde/márgenes de Clientes que compraron, Ventas locales y Espejos de Sheets; demora/operaciones superpuestas al desactivar producto. Reproducir y corregir causas sin ocultar errores.
5. **PENDING: revisión de todos los PR.** Abiertos:1168,1167,1156,1154,1146,1134,1122,929. Comparar cambios con main vigente; recuperar arreglos ausentes y resolver duplicados por evidencia. No fusionar ramas antiguas indiscriminadamente. Verificar CI, comentarios/revisiones, conflictos y publicación del SHA final.
6. **PENDING: variantes/fotografías global.** Revisar forma/color/tamaño y cualquier atributo, correspondencia izquierda/centro/derecha y combinaciones en ficha, catálogo, carrito, checkout, favoritos, editor, pedidos y medios. #1169 publicado; comprobar catálogo real y no atribuir asociaciones ambiguas.
7. **PENDING: pedidos por etapas.** Nuevos, preparación, listos, enviados/en camino, entregados e incidencias: pasos, colores pastel diferenciados, semántica y transiciones, filtros, acciones, persistencia y sincronización. #1169 publicado, falta cierre global.
8. **PENDING: clientes por actividad.** Último registro/inicio de sesión primero para clientes normales; excluir equipo (Super Admin/Admin/Agente/Moderador/Viewer) de esa prioridad. Conservar filtros, datos y roles; comprobar actualización real.
9. **PENDING: responsive completo.** Todas las áreas públicas y administrativas en móvil, tablet vertical/horizontal, laptop y desktop; bordes, filtros, tablas, drawers, modales, navegación, foco, teclado, carga/errores y avisos.
10. **PENDING: auditoría global después de limpieza.** Inventariar todas las funciones/opciones; recorrer compra desde inicio/catálogo/variante/carrito/login/checkout/envío/pago/confirmación hasta perfil/admin/stock/Sheets. Pruebas aisladas sin nuevos pedidos reales. Informe paso por paso con CORRECT/CRITICAL/HIGH/MEDIUM/LOW/NOT APPLICABLE y pendientes no verificados explícitos.
11. **PENDING: inventario completo de páginas.** URL, título, finalidad, público/cliente/equipo, roles y subapartados de cada página, incluidos 26 módulos Maestro, páginas dinámicas, editor, Imágenes, mayorista, legales y rutas heredadas/redirecciones. Distinguir página, pestaña y modalidad.
12. **PENDING: cierre de publicación y evidencia.** Pruebas pertinentes, diff, artefactos canónicos, CI/merge/deploy autorizado y comprobación publicada. Registrar límites reales y entregar pruebas; no declarar todo correcto por informes históricos.

## Trabajos anteriores que no deben confundirse con esta cola

Transferencia del registro del dominio: solicitada/pagada; correo Tucows indica liberación automática 24/10/2026 14:30:23 UTC si no se cancela. Registrador/vencimiento/renovación final todavía requieren comprobación. La renovación del dominio y la desactivación del plan Shopify son independientes. Organización de Gmail anterior no es autorización para enviar mensajes.
