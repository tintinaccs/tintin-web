# Continuidad del editor v2 — candidato integrado

Fecha local: 23/10/2026, America/Asuncion. Agente: Codex /root.

La titular pidió recuperar el chat, corregir y continuar hasta terminar, con autorización general para las fases restantes. Esa instrucción reemplaza las pausas históricas de alcance de los documentos 00–13. No convierte los resultados históricos en evidencia actual ni autoriza inventar verificaciones. Se conserva el alcance 33 SÍ / 10 NO y las funciones 44–58.

## Recuperación comprobada

Base main: 6ac1fdf2546fa859412399f88eccf207991880de. #1216 contiene el plan; #1217 el motor comercial (85d5061d6), todavía en borrador y con CI roja de identidad legacy; #1218 contiene las correcciones efectivas de carrito, SEO y ranking (b06e95f2). Se recuperó la cabeza de #1218 en una rama nueva que reúne ese trabajo sin reescribir las ramas anteriores. #1213, de tema global, permanece separado. No se heredan sus cambios ni se afirma que las fases 3/4 existieran antes de esta continuación.

## Implementación de continuación

- El formulario y `prodGuardar` siguen siendo la autoridad de edición. La matriz añade precio/anterior, stock nullable, disponibilidad, selección múltiple, lote y reordenación, paginada de 25 en 25 para no montar 1.000 filas simultáneas.
- `commercialDraft`/`commercialPatch` reutilizan inventario-variantes: referencias existentes inmutables; nuevas combinaciones con identificador opaco, independiente de su posición. Guardado valida precios/stock/atributos con el motor compartido.
- `saveProductEditor` usa el commit administrativo CAS existente para producto, inventario privado y auditoría juntos. `expected` detecta cambios al formulario y updateTime protege la carrera posterior a la lectura. El ID de alta permanece en el formulario y changeId permite repetir una respuesta perdida sin duplicar producto/auditoría.
- Transporte: acciones `saveProduct` y `bulkProducts` de `/api/admin-order-mutation`, con origen, Firebase Auth, límites y validación de permisos del servidor. No se añade una ruta 101 ni se amplía el middleware. Las reglas SDK continúan bloqueando escritores v2 incompatibles; no se relajan.
- Edición masiva de campos compatibles para lotes v1/v2: fuente `applyProductBulkTransaction`, lecturas/validación completas antes de un commit con precondiciones. El stock distribuido se edita por combinación, no repartiendo un total arbitrario. Duplicar v2 conserva precios/fotos/atributos, con copia inactiva y cantidades cero.
- Publicación: `publicationStatus = active | draft | archived`, compatible con active. Estado y stock son independientes en el editor nuevo. No se incorpora «No listado», cuya semántica no estaba definida. Catálogo/API, ficha/sitemap y servidor de pedidos comparten la política de publicación.
- SEO opcional: seoTitle (70) y seoDescription (220), vacío hereda los valores actuales. Metadata, Open Graph y JSON-LD conservan canonical y precio/stock comerciales. Sin edición de URL personalizada.
- Plantillas acotadas a Actual/default y Galería ampliada/gallery, retomando la propuesta del chat con autorización actual para completarla. Cambian proporciones de galería; comparten todo el renderer y la compra. Un valor desconocido cae en default.
- Estadísticas por ID: unidades, importes históricos brutos de líneas pagadas, pedidos, variantes y meses (America/Asuncion), desde el reinicio existente de Productos vendidos. Excluye pruebas, cancelados/rechazados y reembolsos completos. No son ingresos netos: se informa que no se distribuyen descuentos generales ni devoluciones parciales. Se muestran sólo con permisos y fuente de pedidos lista; información disponible en sesión, no una reconstrucción histórica inventada.
- Fotos, cargas pendientes, guardia de borrador, permisos y campos técnicos/privados siguen en sus componentes originales. La vista previa resuelve precio y stock de selección v2 con el mismo motor.

## Compatibilidad conservadora

No se convierten productos reales automáticamente. Un producto antiguo con stock agregado puede seguir editándose en v1. Su conversión a matriz desde el servidor se bloquea hasta revisar sus reservas históricas: no es seguro inventar la distribución de devoluciones agregadas. Las matrices legacy conservan referencias y el modo de control existente; las filas históricas no se borran ni se convierten de finitas a ilimitadas. Los productos nuevos admiten cero/no controlado. Una migración de datos reales queda fuera de esta publicación de código.

Sheets mantiene el espejo y su cola durable; el formulario conserva el reintento externo si la sincronización falla después del commit. Los escritores antiguos de Sheets/GS conservan el rechazo de cambios incompatibles de matriz y el merge parcial. El checkout canónico es el servidor de Cloudflare, no el creador GS legacy. No se introdujo otro resolvedor comercial.

## Evidencia local de esta continuación

Las cifras son de suites solapadas, no se suman como casos únicos. Los registros locales están en `/tmp/tintin-*.log`; las capturas en `artifacts/editor-v2/`.

- `npm run test:commerce`: 457 aprobadas.
- `npm run test:products-sync`: 221 aprobadas.
- `node --test tests/admin/*.test.mjs`: controlador real, escritor, permisos, campos privados y lote; ver el recibo final de ejecución, no heredar un conteo anterior.
- `npm run test:architecture-gates`: 36 aprobadas.
- Firestore emulado demo/loopback: 213 ataques/controles de reglas y pruebas REST/CAS reales de pedido, última unidad, cancelación, guardado v2 y lote mixto. No es Auth ni Firestore productivo.
- Chromium: seis viewports v2 (320/390/844/768/1024/1440), más regresiones del editor canónico. Se conserva el fallo inicial de integración de controles y el de pruebas que importaban una segunda URL de la vista previa; fueron corregidos sin suprimir las comprobaciones.
- Build, preflight, CI remota y estado de publicación se registran en el relevo después de ejecutarlos. Esta sección por sí sola no los acredita.

## Reversión y límites

Antes de integrar: CI completa del SHA final, CodeQL y preview. No usar la ausencia de checks obligatorios en el ruleset como sustituto de pruebas.

Si todavía no existen productos v2, puede revertirse la presentación mediante un commit normal. Si ya se guardaron productos v2, conservar lectores comerciales y servidor de reservas; bloquear nuevas ediciones/activaciones si fuera necesario. No volver a un servidor que cobre sólo el precio base, ni borrar matrices, pedidos, reservas o columnas para hacer compatible una reversión. No se realizó ninguna migración, compra, correo, pago ni escritura de productos reales durante QA.

Producción autenticada, dispositivos físicos y proveedores reales requieren comprobación adicional y no se infieren de las pruebas locales. La auditoría de esta continuación es revisión propia con pruebas automatizadas, no una revisión humana independiente.
