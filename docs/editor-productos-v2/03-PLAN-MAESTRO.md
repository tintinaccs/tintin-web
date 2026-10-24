## Continuación autorizada — candidato integrado (23/10/2026)

La instrucción actual de la titular autoriza recuperar, corregir y continuar las fases pendientes. Se recuperó #1218 sobre #1217 en codex/completar-editor-v2-20261024. Ahora existe editor/escritor compatible, estados/SEO, plantillas acotadas y estadísticas con límites explícitos. El resultado NO APTO de fase5 describe el candidato anterior; no certifica ni rechaza automáticamente el nuevo. Ver [14-CONTINUIDAD-Y-CANDIDATO](14-CONTINUIDAD-Y-CANDIDATO.md). Estado de pruebas/CI/publicación: consultar el relevo actual, sin heredar PASS. No se migran productos reales.

# Plan maestro — fase1 auditada; fases2–6 propuestas

Fase0 documental preparada en ed438c660/f5a905dc1. La titular autorizó posteriormente la **fase1 de auditoría y plan**, ahora realizada con límites registrados. No se inicia fase2 por esta entrega. Las decisiones43 se mantienen33SÍ/10NO; se amplía la propuesta inicial de fases sin borrar su justificación histórica en el registro D003.

## Fase2 — editor y borrador seguro

Objetivo: integrar el diseño Tintin sobre el formulario/maestro existentes, manteniendo guardado y contratos comerciales v1. No habilitar todavía precios nuevos por combinación.

Trabajo propuesto: dividir interfaz en información, medios, variantes e inventario privado; reutilizar controles/vista previa y guardia de cambios no guardados; representar borrador normalizado sin reimplementar sincronización; diseñar mensajes de guardado parcial. Fijar contratos/fixtures v1/v2 aprobados antes de escribir esquema. Resolver orden de fotos explícito sin reasignar fotos existentes.

Aceptación: funciones1–15 y44–58 conservadas; teclado y táctil; guardar/cancelar/duplicar reproducibles; falla de upload bloquea guardado sin perder borrador; no exposición de costo/notas; ninguna escritura comercial real de QA. Vista previa coincide con datos del borrador. Pruebas dirigidas de editor/maestro/medios y diff limitado. Propuesta visual abajo aprobada por la titular.

## Fase3 — identidad, precio y stock de combinación

Objetivo: resolver H1–H4 en la autoridad compartida existente, con compatibilidad legada. No desplegar activación comercial parcial.

Trabajo: IDs estables y orden separado; extensión de variantInventory/resolvedor, precio efectivo, stock finito/no controlado y disponibilidad; fotos apuntan a misma identidad; adaptación de todos los lectores/escritores, carrito local/remoto y validación de reglas. Conservar claves y huellas de reservas/pedidos históricos. Resolver H2 antes de permitir reordenación visual.

Aceptación: los seis órdenes de LARTRA siguen válidos; variantes con valores repetidos/ambigüedad rechazan o resuelven sin adivinar; reorder conserva ID/precio/cantidad/foto; precio override/fallback idéntico en ficha/carrito/servidor; agregado correcto con0/null/matriz mixta; última unidad concurrente no se duplica; cancelar/reabrir restaura sólo la reserva correspondiente. H3: fixture de plateado no cambia a foto dorada al ordenar. H4: misma combinación equivale a misma línea y migración conserva intención/cantidad. Nuevos formatos no habilitados hasta superar también integración de fase5.

## Fase4 — gestión editorial y funciones adicionales aprobadas

Objetivo: completar edición de varias variantes, estados, SEO, plantillas y estadísticas sin funciones NO nuevas.

Trabajo: acciones de lote por IDs con vista previa y validación por fila; confirmar semántica de draft/active/archived y compatibilidad con active; SEO opcional con fallback actual; plantilla de presentación por producto dentro del renderer existente, sin HTML/JS arbitrario; estadísticas por ID desde pedidos/contadores existentes, preservando snapshot histórico. Costos y permisos privados permanecen.

Aceptación: lote con conflicto no pisa cambios ajenos; desactivar conserva stock/reservas; borrador no aparece en catálogo ni sitemap; metadata/JSON-LD coincide con precio/disponibilidad; plantilla inválida cae a presentación estándar; ranking de dos productos homónimos no se mezcla (H6). Definir por aprobación qué métricas y qué plantillas se entregarán; no inferir constructor libre ni nueva plataforma analítica.

## Fase5 — integración completa y regresión

Objetivo: impedir formatos incompatibles entre editor, Sheets/importador, catálogo, carrito, checkout, pedidos y reglas.

Trabajo: ida/vuelta Sheets con máscaras y409, importación incremental con campos antiguos/nuevos; pruebas de reserva/edición/cancelación/devolución/archivo-restauración con proyecto demo; validar API pública, metadatos y cachés; probar permisos por rol, conflictos y reintentos. Completar H5 con transacción local de datos y reintento explícito para sistemas externos, sin prometer atomicidad distribuida.

Aceptación: matriz de pruebas del SHA final aprobada en entornos aislados; roundtrip no elimina precios/fotos/IDs nuevos; vieja importación no pisa v2; no precio ni total confiado al navegador; no lectura de costo/notas públicas; pedido histórico permanece idéntico tras editar producto. Responsive móvil/tablet ambos sentidos/laptop/desktop, zoom y navegación por teclado sin controles ocultos. Cualquier BLOCKED se documenta como impedimento real, no se declara PASS.

## Fase6 — preparación de entrega y publicación separada

Objetivo: entregar candidato revisable, trazable y recuperable. La aprobación de este plan no implica merge/deploy.

Trabajo: revisión de diff; ejecutar gates existentes proporcionales más CI obligatoria; generar derivados desde herramientas canónicas; actualizar manual/relevo y recibos; ensayo de reversión con fixtures. Evitar conflictos con #1213 u otros PR vigentes mediante inventario remoto.

Aceptación: CI/CodeQL/Cloudflare y controles protegidos del SHA exacto aprobados; no comparar bytes HTML transformados como falso bloqueo; no publicar mientras un escritor sea incompatible. Sólo tras autorización de publicación: confirmar deployment SUCCESS del SHA integrado antes de comprobar referencias/bytes/revisión/health. Verificación comercial real no se infiere de health ni requiere crear pedidos reales sin aprobación.

## Propuesta visual — pendiente de aprobación

Una única interfaz Tintin, Montserrat, rosa #F8AACA, ciruela #713C53, marfil/blanco, reutilizando tokens y componentes actuales. No copiar marca ni servicios de Shopify. No cambiar el tema global desde el editor.

Desktop/laptop: cabecera compacta con nombre, estado y acciones Guardar/Cancelar; columna principal con Información → Fotos y galería → Variantes; lateral con vista previa, Publicación, Colecciones/etiquetas y SEO plegable. Inventario privado sólo visible con permiso. Vista previa lateral no debe reducir el formulario a un ancho inutilizable.

Tablet: dos columnas sólo si el contenido cabe; en vertical vista previa plegable en el flujo. Móvil: una columna, secciones claras y acciones accesibles sin cubrir campos/teclado/safe-area; sin scroll horizontal obligatorio. Menú de acciones para duplicar/operaciones secundarias, con el componente de navegación vigente.

Cada variante muestra foto, selección por atributo, precio efectivo (indicador «hereda precio»), cantidad o «sin control» y disponibilidad. Selección múltiple con barra de acciones contextual; reordenar con botones accesibles además de arrastre. Plateado antes de dorado cuando corresponda a la política existente, sin ordenar por índice comercial. Atributos y combinaciones no se mezclan con datos descriptivos como material fijo.

Mensajes específicos: «Revisá esta combinación», «El producto cambió en otra sesión», «Producto guardado; falta sincronizar», «No se pudo subir la foto». Cada mensaje corresponde a un resultado real; no simular éxito. Evitar títulos promocionales genéricos; encabezados concretos: Producto, Fotos, Variantes, Precio y stock.

## Decisiones de la titular antes de implementación

Aprobar fases2–6, diseño y contrato propuesto; confirmar estados editoriales y qué plantillas/estadísticas comprende su SÍ; aprobar política de stock mixto y precios heredados/rangos. Cualquier migración de datos reales, modificación de infraestructura o publicación requiere autorización específica aparte. No se solicitan credenciales. No se inicia fase2 automáticamente.

## Reversión propuesta

Antes de activar v2: fixtures y copia/export autorizado con prueba de recuperación; identificar SHA anterior compatible, sin crear respaldos reales en esta fase. Desactivar edición/activación nueva si falla el gate y mantener lectores compatibles. Revertir presentación puede ser un commit normal; **no volver a un servidor que cobre sólo precio base si ya hay overrides v2**. Volver atrás requiere versión comercial compatible o transformación explícita revisada y aprobada; nunca borrar campos para hacer compatible un rollback. Conservar pedidos/reservas/auditoría y tratar Sheets como espejo, no restaurarlo sobre Firestore. No force-push ni restauración productiva automática.


## Revisión autorizada por la titular: fase2 comercial

El pedido posterior «FASE2: MOTOR COMERCIAL Y COMPATIBILIDAD» aprueba la continuación y reemplaza el alcance de fase2 visual propuesto anteriormente. Se implementa el motor de precios/stock/referencias y sus consumidores con activación protegida, no un rediseño completo. El resto del plan se conserva como propuesta histórica; su numeración no autoriza ejecutar fase3.

Cierre de esta entrega: código y pruebas en rama separada, commits revisables y PR en borrador, contrato actualizado y evidencia local; no hay merge/deploy, activación de datos reales ni inicio de fase3. Antes de activar v2 faltan aprobación/publicación separadas y editor/escritor compatible. Los controles completos de CI del nuevo SHA deben revisarse cuando existan; la CI de6ac1 no se hereda.

## Pedidos posteriores y estado real al auditar fase5

La titular pidió fase3 NUEVO EDITOR VISUAL y fase4 FUNCIONES ADICIONALES. Se verificaron sus condiciones:1217 seguía draft/no integrado, editor compatible ausente y plantillas sin diseños aprobados. No se iniciaron esas implementaciones. Su solicitud no es evidencia de aprobación técnica/CI ni de código inexistente. El pedido fase5 autoriza ahora auditoría, matrices y correcciones pequeñas dentro del contrato, no inventar el resultado de fases3/4 ni completarlas silenciosamente. Evaluación actual NO APTO en11; código/matrices/pruebas nuevas en11–13. No despliegue ni incorporación de funciones NO.
