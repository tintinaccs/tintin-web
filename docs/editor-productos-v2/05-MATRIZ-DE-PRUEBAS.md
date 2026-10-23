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

## Ejecución fase2 — motor comercial, 2026-10-23

Base funcional6ac1fdf, rama codex/motor-comercial-variantes-v2; fuentes de esta fase en commits pequeños desde e0ea8e65f hasta1d3106ca8 y propagación de referencias posterior. Consultar el HEAD del PR para el conjunto final, no usar un SHA de fase1 como prueba del motor. Windows, Node24.19.0, Chromium headless local; CI usa Node22 y queda separada del PASS_LOCAL.

Todos los comandos de la tabla terminaron exit0. Las cantidades se solapan: **no sumarlas como pruebas únicas**. Logs en artifacts/ del worktree aislado; no contienen una compra ni datos productivos.

| Comando ejecutado | Resultado actual | Evidencia local |
| --- | --- | --- |
| `npm run test:commerce` |454/454 Node |variant-commerce-final.log |
| `node --test tests/import/*.test.mjs tests/sync/*.test.mjs tests/admin/maestro-productos*.test.mjs tests/catalog/*.test.mjs tests/profile/favorite-current-product.test.mjs` |406/406 Node |variant-compatibility-final.log |
| `npm run test:fast` | preflight1007 archivos/72 funciones,84/84 Node y1/1 Chromium de importación del servidor |variant-fast-final.log |
| `node --test tests/orders/order-admin-domain.test.mjs tests/orders/variant-inventory.test.mjs tests/import/inventory-reservation-review.test.mjs` |64/64; caso de cancelación120 unidades corregido |variant-multiquantity.log |
| `npx playwright test tests/cart/color-choice-browser.spec.js tests/ui-ux/product-shape-selection.spec.js --project=chromium --workers=1 --retries=0` |51/51 Chromium, sin reintentos |variant-browser-final.log |
| `npx playwright test tests/catalog/search-responsive.spec.js --project=chromium --workers=1 --retries=0 --grep "motor comercial v2"` |1/1 Chromium, sin reintentos |variant-search-browser-final.log |
| `npx firebase emulators:exec --only firestore --project demo-tintin-variant-v2 --config .firebase-variant-v2.json "node scripts/probar-firestore-critico.mjs && node --test tests/integration/commerce-firestore.test.mjs"` |213 ataques/controles de reglas y6 pruebas de integración incluidas subpruebas, exit0 |variant-emulator-final.log |

Navegador de fixtures: PLAYWRIGHT_BASE_URL=http://127.0.0.1:4295, host estático privado con rutas HTML limpias. Prueba visual v2 en390/1366 y regresiones de selección preexistentes320–1920/tablet/rotación. No se atribuyen pruebas físicas ni cobertura de toda la interfaz nueva a estos casos.

Emulador: reglas locales firestore.rules, Firestore127.0.0.1:18083/hub14403/logging14503, UI deshabilitada y singleProjectMode=false. JAVA_HOME/PATH sólo del proceso con Java21. Proyectos de prueba demo; identidades fixture, sin Firebase Auth productivo. El archivo temporal de configuración se retira al cerrar; emulador detenido por su propio CLI. La integración usa REST/CAS real del emulador, no simula el commit en memoria.

### Correspondencia de aceptación

- Producto simple/antiguo, una o varias opciones, sin SKU, override/fallback, descuentos/null/precio inválido: variant-commerce-v2, variant-inventory, precio-anterior y public-checkout-policy.
- Identidad al reordenar, valores superpuestos, foto específica/general/color, carrito antiguo y snapshot remoto con clave opcional: stock-variant-client, variant-image, variant-commerce-v2 y order-admin-domain.
- Stock0/null/mixto, varias combinaciones, cambios de precio antes de confirmar, selección válida sin422 espurio y rechazos reales antes de escribir: suites de checkout y fixtures Chromium de carrito/ficha/catálogo/búsqueda.
- Pedidos concurrentes sobre última unidad, CAS, reserva/confirmación sin doble descuento, cancelar/reintentar/reabrir y precio histórico: order-admin-domain y commerce-firestore. El caso nuevo60+60 reserva y devuelve120 una sola vez; el límite99 permanece por combinación, no por producto agregado.
- SDK/roles/cartKey, prohibición de degradar/eliminar productosv2, precio privado y reglas:213 controles reales en emulador. No se despliegan reglas.
- Sheets parcial preserva matriz/campos/fotos, cambios incompatibles409 sin escribir; GS antiguo rechaza v2; Shopify opt-in interno y pipeline antiguo intacto: suites sync/import/order-contract.

### Fallos detectados y corregidos durante el ciclo

1. Sheets leía el producto innecesariamente para actualizar sólo precio: restaurado el merge parcial existente.
2. Preflight Windows no lanzaba npm.cmd y dos negativos TTL no aplicaban por separadores: ejecución Windows y mutadores corregidos; auditores/umbrales intactos. No se quitaron pruebas.
3. Host estático inicial no resolvía /product: host privado corregido; pruebas finales no usaron ese fallo como PASS.
4. La tarjeta propia inline de Catálogo seguía cotizando el precio general: conectada al mismo resolvedor de búsqueda/ficha. Test nuevo de tarjeta/búsqueda reproduce y verifica el override.
5. La edición de un pedido legacy después de una conversión explícita de fixture y reordenación con valores superpuestos podía guardar una referencia distinta de la reserva: se conserva la referencia histórica también al editar; regresión RED/verde en order-admin-domain. No se hizo conversión real.
6. El gate de imports fijaba una versión Shopify antigua: ahora compara la URL exacta con el baseline canónico ya usado por ese test; dos negativos nuevos rechazan URL obsoleta o sin versión. Auditor intacto.
7. La cancelación rechazaba120 unidades de dos combinaciones válidas: prueba RED reproducida, autoridad agregada corregida para límite99 por combinación y revisión de reservas alineada;64 Node y emulador final6/6 verifican cancelación/replay.

No quedan fallos críticos observados en estas ejecuciones locales. CI del HEAD final, proveedor Sheets real, Apps Script desplegado, carrito multidispositivo autenticado, pagos, compras reales y producción comercial: **NOT_VERIFIED aquí**. El formato no se activa ni migra en datos reales. La habilitación exige escritor/editor compatible y aprobación independiente.

### Controles finales del repositorio

PASS_LOCAL adicionales: audit:architecture-contracts (autoridades/consumidores), test:architecture-gates36/36 incluidos negativos, audit:content y audit:phase6. Build:pages y verificadores canónicos de Pages/CSP/rutas/diagnóstico/caché ejecutados; cierre final de protección tras regenerar hashes desde main y diffcheck en bitácora. No se quitaron gates ni se relajaron permisos/umbrales.
