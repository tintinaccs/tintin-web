# Auditoría fase5 — NO APTO para publicación

Fecha2026-10-23. Revisión nueva de fuentes y ejecución de pruebas; no se heredan PASS de fase2. **Informe entregado; fase5 NO aprobada**: persisten bloqueos funcionales. No desplegar ni presentar este informe como certificación global de seguridad.

## Conjunto realmente auditado

- Base funcional de main6ac1fdf2546fa859412399f88eccf207991880de. Candidato fase2:85d5061d69ab503b4ae536425f5cac568ca8eab7, PR1217 OPEN/draft, sin integración ni auto-merge al consultar.
- PR1216 contiene documentación previa. El historial de fase2 fue leído: motor e0ea8e65f, servidor040564e3a, consumidores14cfc963f, referencias históricas1d3106ca8 y corrección de identidad965cd1f07, entre los commits preservados de su rama. No se reescribe ese historial.
- En este conjunto no existe el editor compatible de fase3 ni la integración de fase4. Los pedidos posteriores de esas fases no constituyen evidencia de implementación. El relevo anterior lo confirma y la prueba de guardado v2 lo reproduce.
- Rama de auditoría codex/auditoria-editor-v2-fase5, basada en85d5061d6. Correcciones pequeñas revisables; el PR de auditoría debe apuntar a la rama de fase2 para mostrar sólo su delta, sin duplicar1217 ni integrar a main.
- Checkout principal sucio y tema de PR1213 intactos. Sin nuevas dependencias, CSS, workflows, datos reales ni funciones rechazadas.

## Bloqueos y riesgos pendientes

| ID / severidad | Ubicación y evidencia | Impacto | Corrección o siguiente paso mínimo |
| --- | --- | --- | --- |
| B01 BLOQUEANTE | admin-app.js:6142 prodGuardar rechaza variantCommerceVersion2; prueba E1 devuelvefalse, muestra editor compatible y no escribe. Reglas products mantienen la protección. | No se puede certificar creación/edición/duplicación/lote del editor nuevo sobre el motor real. | Cerrar/revisar fase2 e implementar el editor/escritor compatible en la fase autorizada3. No retirar la guardia para simular cumplimiento. |
| B02 BLOQUEANTE | Matriz12, filas31/32/41/42; active booleano, metadata automática, product.html fijo y ranking general existentes. No hay ciclo editorial completo, SEO editable, selector de plantillas aprobadas ni ficha estadística completa. | No están completadas las33 funciones del nuevo editor. | Completar fase4 después de sus dependencias; definir plantillas, «No listado» y métricas netas antes de construir semánticas nuevas. No incorporar funciones NO. |
| B03 BLOQUEANTE de validación | CI40040433474 de85d5061d6 falla en audit:level2; admin/calidad/browser/reglas quedaron SKIPPED. CodeQL/preview/preflight verdes de ese SHA no sustituyen Repository audit. | No existe aprobación remota completa del candidato fase2. | Revisar e integrar las correcciones acotadas en la base acordada y exigir CI del SHA resultante. No autoriza publicación. |
| M01 MEDIA | admin-app.js:6361: products transaccional, luego productInventory, Sheets y auditoría por etapas. E1 comprueba fallo posterior, ID retenido y reintento. | Un error puede ocurrir después de persistir parte del producto; no hay atomicidad distribuida. | En el escritor compatible, diseñar atomicidad local según roles y estados/reintentos externos explícitos. No reemplazar toda la persistencia durante una auditoría. |
| M02 MEDIA / decisión pendiente | statisticsOrderIsValid:1457 excluye cancelado/rechazado; reinicios por métrica en modelo-reinicios. No hay contrato completo para reembolsos/devoluciones parciales, pedidos de prueba históricos o ventas netas por variante. Falta ID en algunos formatos legados posibles. | No presentar el ranking actual como ficha exacta de ventas netas ni inventar atribución histórica. | Aprobar definiciones y usar datos persistidos disponibles; marcar información incompleta. Mantener permisos/reinicios, sin borrar historia. |

No se identificó una vulnerabilidad CRITICAL nueva en los límites revisados. Esto no convierte funcionalidades ausentes, pruebas omitidas o producción no inspeccionada en PASS.

## Correcciones realizadas y pruebas antes/después

| ID / severidad inicial | Evidencia reproducida | Cambio mínimo / commit | Verificación posterior |
| --- | --- | --- | --- |
| F01 MEDIA, compatibilidad de gate | audit:level2 fallaba porque exige la propiedad literal legacy de identidad; no se demostró una colisión real de líneas. | e6785ee69 conserva un objeto de identidad legacy y otro con variantKey; sin modificar el auditor ni la lógica de precios. | level2 e integral PASS;7 pruebas de identidad, v1/v2 y regresión Chromium. |
| F02 MEDIA, SEO | JSON-LD anunciaba OutOfStock para v2 con matriz disponible y agregado stock0 desactualizado;2 casos RED. | cb63a5ca7 usa productStockTotal compartido para metadata v2; mantiene el comportamiento legacy. |5 casos de metadata PASS, incluidos agotado legacy, finito, sin control e inactivo. |
| F03 MEDIA, ranking | Dos IDs con igual nombre se mezclaban; renombrar separaba el mismo producto. Prueba RED sobre renderer real. |553d225f9 agrupa por ID estable; nombre histórico como etiqueta. Legado sin ID mantiene fallback, sin afirmar atribución exacta. | Prueba de homónimos/renombrado/reinicio PASS. |
| F04 ALTA, ranking | Productos de pedidos cancelados/rechazados sumaban en ranking aunque la política existente los excluye de pedidos válidos. Prueba RED. |29693dcd6 reutiliza statisticsOrderIsValid; no inventa una política de reembolsos ni altera pedidos/importes. |5 pruebas estadísticas PASS, incluido control de origen/sesión del endpoint y reinicios. |
| F05 BAJA, expectativa de prueba obsoleta | Chromium inicial143PASS/1FAIL: esperaba eliminar Dorado al llegar a0; el contrato fase2 protege referencias potencialmente históricas aun con0. |7c3b620aa alinea la prueba con la protección vigente y exige conservar opción, cantidad y baseline. No modifica contrato, motor ni umbrales. |144/144 Chromium finales, sin reintentos. |

Durante la propagación de URLs, el primer chequeo de seguridad detectó hashes CSP anteriores en tres documentos. Se regeneraron por build:pages, sin permisos ni excepciones nuevas; seguridad y preflight finales aprobaron. Se conservan tanto salidas RED como verdes en los logs privados.

## Evidencia nueva y límites de cada suite

Los conteos **se solapan**, no sumarlos como pruebas únicas. Todos los resultados finales siguientes son PASS_LOCAL/exit0, no PASS_PRODUCTION.

| Ref | Comando / pruebas | Resultado | Evidencia local artifacts/phase5/ |
| --- | --- | --- | --- |
| E1 | node --test tests/admin/maestro-productos-controlador.test.mjs |26 pruebas; creación/edición/duplicado v1, conflictos, cargas, campos privados, reintentos y guardia v2 |preservation.log |
| E2 | node --test tests/import/*.test.mjs tests/sync/*.test.mjs tests/admin/maestro-productos*.test.mjs tests/catalog/*.test.mjs tests/profile/favorite-current-product.test.mjs |408 pruebas |compatibility-final.log |
| E3 | npx playwright test tests/ui-ux/products-responsive-phase-one.spec.js tests/ui-ux/products-master.spec.js tests/ui-ux/product-color-gallery.spec.js tests/cart/color-choice-browser.spec.js --project=chromium --workers=2 --retries=0 |144 pruebas, sin reintentos |editor-browser-final.log |
| E4 | npm run test:commerce |457 pruebas |commerce-final.log |
| E5 | npx firebase emulators:exec --only firestore --project demo-tintin-editor-audit --config .firebase-editor-audit.json "node scripts/probar-firestore-critico.mjs && node --test tests/integration/commerce-firestore.test.mjs" |213 ataques/controles de reglas;6 pruebas REST/CAS incluidas subpruebas |firestore.log |
| E6 | npx playwright test tests/ci/server-import.spec.js --project=chromium --workers=1 --retries=0 |5 pruebas del servidor en Node mediante Playwright; **no navegador ni HTTP SSR completo** |seo-after.log |
| E7 | node --test tests/orders/statistics-reset-render.test.mjs |5 pruebas, renderer real y endpoint con dependencias aisladas |statistics-after.log |
| E8 | npm run ci:preflight; npm run test:architecture-gates; seis auditorías commerce existentes |39 comandos preflight, incluidos85 Node+5 metadata en test:fast;36 arquitectura y6 auditorías comerciales PASS |preflight-final.log, architecture-tests.log, commerce-gates.json |

También ejecutados: audit:architecture-contracts y audit:phase6 finales, build:pages, verificadores canónicos de caché/CSP/rutas/diagnóstico y protección de flujos. Las huellas, comandos y resultados se conservan en evidencias-fase5.json y recibo privado; la actualización documental no autoriza producción.

### Entornos seguros

- Windows/Node24.19.0; CI del repositorio usa Node22. No se atribuye ejecución remota nueva a estos resultados locales.
- Chromium headless y servidor estático privado127.0.0.1:4296. SDK/Auth/uploads de interfaz usan fixtures. Las pruebas de UI que reemplazan prodGuardar por callback prueban navegación/borrador, **no guardado real completo**; E1 ejecuta prodGuardar real con almacén simulado y E5 prueba transacciones reales del dominio en emulador. No se confunden.
- Emulador Firestore127.0.0.1:18084, websocket18184, hub14404/logging14504, UIoff, proyectos demo, Java21 sólo del proceso. Detenido por su CLI y configuración temporal retirada. PERMISSION_DENIED de pruebas negativas es esperado, no una escritura en producción.
- Visual:320–1920px, móvil horizontal/vertical, tabletas y escritorio; teclado, foco, Escape, scroll, overlays, carga/fallo de fotos y formularios extensos. Capturas editor-mobile.png y editor-desktop.png revisadas: son del **editor existente**, no de un editorv2 implementado.

## Seguridad y auditoría comercial

CORRECT en el conjunto probado: servidor relee producto y precio por combinación, expectedTotal exige revisar cotizaciones, selección inválida/agotada mantiene422 y la válida no lo recibe por orden de atributos; requestId/changeId y CAS evitan doble reserva/liberación. Última unidad concurrente y cancelación60+60/replay se ejecutaron en emulador. Precio histórico no se recalcula al editar catálogo.

CORRECT: campos costo/compras/mínimo/notas permanecen privados; reglas/API no se amplían. Se comprueba rechazo a cliente/admin/SDK sobre v2 y downgrade, carrito con clave opcional validada, sesiones/orígenes indebidos, conflictos y errores de carga. No se desactiva seguridad para habilitar el editor faltante.

CORRECT/limitado: Sheets parcial conserva campos y bloquea reemplazo incompatible de matriz; GS legacy rechaza v2; importación opt-in no está expuesta. Pruebas de proveedores son fixtures, **no paridad con Apps Script/Sheets desplegados**.

NOT_VERIFIED/NO DISPONIBLE: nuevo editor v2 y su tabla de muchas combinaciones, estados/plantillas/SEO editables, estadísticas completas de fase4, escritor v2 autenticado, carrito entre dispositivos reales, Cloudinary real, lector de pantalla/dispositivos físicos, SSR completo bajo el despliegue, pagos y producción. No se crearon compras, correos, cuentas ni datos reales. No se implementaron funciones NO.

## Evaluación y siguiente paso

**NO APTO para publicación; fase5 no aprobada.** Hay correcciones locales verificadas, pero los bloqueos B01–B03 permanecen. Revisar el delta de auditoría, completar/integrar las fases previas en una base acordada sin despliegue, aprobar definiciones pendientes y repetir aceptación sobre ese conjunto. Mantener habilitación v2 bloqueada hasta tener escritor y lectores compatibles. No merge a main, despliegue ni operaciones comerciales reales por este informe.

Matrices completas:12-MATRIZ-43-FASE-5.md y13-PRESERVACION-FASE-5.md. No borrar evidencia de fallos anteriores ni convertir estas limitaciones en PASS por inferencia.

CI remota: el workflow auditar-tintin.yml sólo atiende pull_request hacia main/pushmain (además de dispatch). El PR dependiente de auditoría hacia la rama fase2 no ejecuta por sí mismo ese contrato completo. No cambiar el target a main para duplicar1217 ni modificar triggers para simular aprobación. Exigir los checks del conjunto cuando se integre/revise en su base autorizada.
