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


## Ejecución fase1 — evidencia nueva

Base funcional6ac1fdf2546fa859412399f88eccf207991880de; Node v24.19.0 local (CI usa Node22). Comando ejecutado con exit0:

```powershell
node --test --test-reporter=dot tests/checkout/public-checkout-policy.test.mjs tests/orders/variant-inventory.test.mjs tests/orders/order-admin-domain.test.mjs tests/admin/maestro-productos.test.mjs tests/cart/variant-image.test.mjs tests/import/shopify-import-core.test.mjs tests/sync/productos-canonicos.test.mjs tests/catalog/precio-anterior.test.mjs
```

Ocho suites seleccionadas PASS_LOCAL, sin cambiar tests ni funcionalidades. Pruebas de servidor usan dependencias/almacenes ficticios; **no se hizo una compra ni importación real**. La primera tabla de esta página conserva los resultados no ejecutados de fase0; esta entrada la actualiza sólo para las suites explícitamente enumeradas. No se ejecutó maestro-productos-controlador, appscript-formulas, browser ni emuladores en fase1.

Reproducciones H2/H3/H4 por stdin con funciones reales y fixtures sintéticos: [detalle y salidas](09-AUDITORIA-FASE-1.md). Reproducción aislada no equivale a E2E de navegador.

GitHub leído: candidato de #1214 y run main40015443643 SUCCESS del código auditado; no se hereda a commits documentales o futuros cambios funcionales. Health40031674729 SUCCESS sólo acredita su propio chequeo. Producción comercial y reglas desplegadas NOT_VERIFIED en esta fase.

## Pruebas de aceptación pendientes por riesgo

| Riesgo / fase | Casos obligatorios antes de aprobar | Reversión / evidencia |
| --- | --- | --- |
| H1 /3+5 | override/fallback/null/0 inválido, precio anterior por combo, cambio de precio mientras carrito abierto, catálogo «Desde», SEO, reintento checkout | Mismo precio en todos los consumidores; no activar sin servidor compatible; snapshot de pedido conserva precio viejo. |
| H2 /3 | reordenar atributos/opciones, renombrar sin cambiar IDs, valores iguales en varios atributos, eliminación con reservas | Igualdad de IDs, stock y fotos antes/después; no vaciar inventario como precondición. |
| H3 /2+3 | galería antigua sin asociación; combinación más específica; fallback ambiguo; plateado/dorado; upload fallido | Comparar URL por identidad; conservar galería original y borrador cancelable. |
| H4 /3+5 | carrito invitado/auth, fusión inicial, dos dispositivos, escritura pendiente, dos cadenas misma combinación, cantidad >99 al fusionar | Persistencia idéntica tras recarga y cambio de cuenta; no mezclar cuentas ni resucitar líneas borradas. |
| Stock /3+5 | null,0,matriz finita/mixta/inválida; competencia última unidad; edición y cancelación concurrentes; devolver dos veces | Emulador demo/loopback; CAS y contadores agregados; no datos reales ni órdenes reales. |
| H5 /2+5 | fallo tras guardar products, fallo productInventory, sync retrasada, auditoría/reintento/alta duplicada | Estados de cada etapa claros; recuperar sin duplicar ni repetir stock. |
| Sheets/import /5 | roundtrip parcial, snapshot antiguo, job repetido, combinación desconocida, campo nuevo preservado, cambio de nombre | Máscara/updateTime;409 compatible; ningún reemplazo ciego de v2. |
| Roles /5 | superadmin/admin/agent/viewer/cliente; rechazo de precio inválido en frontera; lectura pública de campos privados | Reglas emuladas y endpoint; sin debilitar gates. |
| Estados/SEO/plantillas /4+5 | invisible/borrador/archivo con carrito previo, template inválida, metadata precio/rango, etiquetas sanitizadas | Fallback estándar; no servir código arbitrario desde datos. |
| H6 /4 | dos IDs con mismo nombre, nombre nuevo con mismo ID, cancelados/reembolsados y rango temporal | Definiciones aprobadas; totales reproducibles desde pedidos históricos. |

Pruebas de navegador posteriores deben usar las suites existentes y MCP Playwright con extensión si se inspecciona la sesión Chrome de la titular. No usar TinyFish ni modificar su Perfil/dirección pendiente. Dispositivos físicos, pago real y recepción física de notificaciones quedan fuera de esta fase.
