# Matriz de pruebas y evidencia

## Ejecución de esta tarea

Inspección estática sobre 6ac1fdf2546fa859412399f88eccf207991880de. No se heredan resultados antiguos. Esta tarea documental no ejecuta CRUD, navegador, emuladores, compras, correos ni escrituras de catálogo. No certifica seguridad, runtime o producción del editor v2.

| Criterio | Evidencia existente a reutilizar / prueba prevista | Estado de esta tarea |
| --- | --- | --- |
| Decisiones completas | Conteo automático 43=33 SÍ+10 NO; 15 correspondencias 44–58 | PASS_LOCAL documental: comprobado 2026-10-23 |
| Enlaces y alcance del diff | Resolver links relativos; exigir sólo Markdown | PASS_LOCAL documental: comprobado 2026-10-23 |
| Maestro, duplicado y edición masiva | tests/admin/maestro-productos.test.mjs; maestro-productos-controlador.test.mjs | NOT_VERIFIED; no ejecutadas |
| Stock por selección y reservas | tests/orders/variant-inventory.test.mjs; tests/cart/stock-variant-client.test.mjs | NOT_VERIFIED; no ejecutadas |
| Fotos y precios | tests/cart/variant-image.test.mjs; tests/catalog/precio-anterior.test.mjs; tests/catalog/variant-presentation.test.mjs | NOT_VERIFIED; no ejecutadas |
| Sheets / paridad / fórmulas | tests/sync/productos-canonicos.test.mjs; apps-script-product-row-formulas.test.mjs; catalog-sheet-sync-queue.test.mjs | NOT_VERIFIED; no ejecutadas |
| Editor responsive | tests/ui-ux/products-master.spec.js; product-color-gallery.spec.js; product-small-controls.spec.js | NOT_VERIFIED; no ejecutadas |
| SEO y publicación | functions/product.js, sitemap; validar metadata/JSON-LD con datos aislados | NOT_VERIFIED |
| Permisos / privacidad | Reglas y suites existentes de roles/Firestore; emulador demo aislado | NOT_VERIFIED |
| Recuperación y conflictos | Carga fallida, doble guardar, edición concurrente, borrador preservado, venta entre lectura y guardado | Pruebas futuras, no afirmadas |
| Precio por variante / plantillas / estadísticas | Agregar casos al aclarar contratos de fases autorizadas | PENDING; aprobación funcional no basta |

## Cobertura requerida en fases funcionales

Para cada función SÍ y cada preservación 44–58: alta/lectura/edición aplicables, validación, permisos, persistencia, error, UI y consumidores. Probar stock cero/no controlado, opciones repetidas/reordenadas/eliminadas, selección agotada, precio cambiado antes de confirmar, idempotencia y concurrencia por última unidad. No inventar CRUD que la función no requiere.

Matriz visual: móvil 320/390 y horizontal, tablet 768×1024 y 1024×768, laptop 1366×768 y desktop 1920×1080; teclado/foco/lector, zoom, nombres largos, vacío, carga y error. Ejecutar según impacto, no declarar dispositivos físicos probados por emulación.

Registrar comando, SHA, entorno, fecha, exit code y ruta de evidencia. Las suites arriba son inventario de pruebas disponibles, no un PASS ni garantía de cobertura completa. CI y producción quedan pendientes hasta que realmente ocurran y se inspeccionen.
