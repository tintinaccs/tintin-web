# Fase09 — Reparación integral y aceptación final

Responsable: Codex /root. Inicio2026-11-02 America/Buenos_Aires. Rama codex/phase09-integral-acceptance, base inicial39744311216e525919a1f781a03fb854d92e45fd, conciliada con mainc25421dfe78d83f2dff744b7861c41f28f139641 (#1317). **No es certificación100% ni cierre productivo global.** Este informe registra el candidato; el resultado terminal de su PR/SHA y los pendientes explícitos determinan aceptación. No heredar PASS de informes anteriores.

## Estado verificado de00–08

[Recibo de revisión GitHub](evidence/phase09-20261102/history-verification.json): PR, head, merge y checks del commit integrado consultados nuevamente. Todos los merges están en la cadena de la base actual. Esto acredita integración histórica, no las modificaciones locales posteriores ni servicios remotos.

| Fase | Integración comprobada | Estado real y límites |
| --- | --- | --- |
|00|#1305/#1307,7dfe8c9f/085953dc|CI de base integrado. Fallo histórico Protected flows de1305 conservado y reparado por1307. Catálogo executor sigue vacío al consultar: activación nativa de Skills BLOCKED del host, fuera de la funcionalidad comercial.|
|01|#1308,5b694fe4|Mapa y hallazgos integrados; PASS documental no significa hallazgos cerrados. Se revisan los siete abajo.|
|02|#1309,344a2936|Correcciones visuales incluidas; se revalidan en09. Hardware/lector/WebKit no acreditados.|
|03|#1310,e3de73c1|Editor y compatibilidad incluidos, con cambios móviles anteriores preservados. No autoriza cambiar permisos.|
|04|#1311,b1107b3f|Catálogo/variantes/precios incluidos. Inventario real no se usa para probar.|
|05|#1313,001c4218|Checkout/pagos/entregas incluidos. Ruta pública Apps Script retirada en fuente; WebApp desplegado sin verificar.|
|06|#1314,1159edeb|Cuenta/notificaciones incluidas. No acredita entrega real ni dispositivos.|
|07|#1315,39744311|Rules reparadas y validadas en CI,258controles y17integraciones históricas. No se ejecutó publicación de Rules; F01 productivo sigue pendiente de autorización/verificación.|
|08|Cambios locales, sin PR independiente|No finalizada al recibir09. Se preserva y consolida aquí; [informe08](TINTIN_PHASE08_TRANSVERSAL.md), con mediciones y fallos/repeticiones explícitos.|

## Hallazgos y reparaciones del candidato

| Hallazgo | Estado de fuente / corrección | Cierre externo |
| --- | --- | --- |
|F01-RULES HIGH|Corrección07 incluida;09 reejecuta negativas/positivas y compatibilidad|BLOCKED: publicar Rules sólo con autorización explícita y verificar SHA. No se afirma protección desplegada.|
|F04-LEGACY HIGH|Retirado creador público en05;09 elimina branch/helper muerto del bridge y corrige autoridad documentada|BLOCKED: actualizar/verificar WebApp Apps Script real con acceso autorizado.|
|F02-STATS MEDIUM|Corrección concurrente #1317 incorporada sin sustituirla: UID/aliases, páginas300 y readTime común, deduplicación y commit CAS; conflicto obliga a recalcular. No recrear perfiles inexistentes ni publicar consulta incompleta|Sin backfill productivo. Regresión aislada305propios+5001ajenos y carrera30→10 impedida. Cuentas sobre presupuesto10000documentos únicos fallan explícitamente; no publicar sumas parciales. Se conserva la suite canónica de1317 y se añade integración en emulador, aún pendiente de CI.|
|F03-FALLBACK MEDIUM|Respaldo manual ahora informativo/autónomo: index/404, logo embebido, noindex y enlace al origen. No ofrece tienda/auth/checkout sin Pages Functions|No se desplegó fallback; requiere autorización manual. No es respaldo completo de operación comercial.|
|F05-DEPS MEDIUM|Firebase CLI15.34.2 compatible, sin force/downgrade. npm audit sigue14moderadas,0HIGH/CRITICAL; cadenas glob/minimatch de herramientas|BLOCKED por cadena compatible upstream: no imponer major overrides que rompan CLI. Revalidar advisories/engines y emulador antes de actualizar. No se declara npm audit limpio.|
|F06-CONTRACTS LOW|Comentarios/arquitectura y branch inalcanzable alineados: creación/stock en Cloudflare, espejos en Apps Script|Verificar consumidores reales externos antes de cualquier migración.|
|F08-CI-ENGINE MEDIUM|CI usaba Node22 por debajo del mínimo24.12 de Firebase instalado; workflows existentes ahora leen engines.node canónico, LTS24|Sin silenciar EBADENGINE ni bajar SDK; CI nuevo y entorno remoto deben acreditar su versión efectiva.|
|F07-INDEX LOW|Extractor canónico usa AST acorn y HTML parse5; sólo runtime, no código dentro de comentarios/strings/regex/JSON-LD ni scripts de auditoría|Se regenera manifiesto; acorn es dependencia exclusivamente de desarrollo para análisis, no runtime público.|

Se conservan las mejoras08: SDK diferido fuera del grafo público de colecciones, defaults en su autoridad existente, normalización sin mutaciones repetidas, medición de beacons separada sin ocultar bytes/requests ni duplicados reales. No reescritura, nueva fuente de datos ni cambios de paleta.

## Matriz integral de aceptación

Cada fila de ACCEPTANCE_MATRIX se valida sobre el candidato09 mediante focalizadas, audit:final y stages canónicos de CI. **IN_PROGRESS hasta recibos terminales propios**; no inferir resultados de base.

- Build/estructura/contratos: build:pages, verificadores canónicos, preflight, generación reproducible y diff de derivados.
- Home/shell/catálogo/producto: navegación, loaders, estados vacío/error, multimedia, variantes, disponibilidad y canónicos; pruebas runtime y fixtures.
- Carrito/checkout/pedidos/stock/pagos: auditorías seguras, entrega por configuración, identidad/idempotencia, concurrencia, restauración y proveedor simulado; sin compras reales.
- Login/perfil/roles/App Check: aislamiento, bloqueo, restauración, perfil/direcciones, guardas, fallos recuperables y permisos; sin elevar privilegios para aprobar.
- Firestore/integraciones: Rules/emuladores, índices de consultas reales, colas, acuses, CAS, errores401/403/404/409/429/5xx aplicables; no entrega externa real.
- CSP/headers/rutas/caché/diagnóstico: generadores y verificadores, aliases, smoke, ausencia de bytes distintos bajo URL inmutable. Avisos sólo para recurso abierto cambiado semánticamente; carrito/sesión/drafts preservados.
- Responsive/a11y/performance/SEO: viewports canónicos, teclado/foco/formularios/zoom/reduced-motion, budgets, metadata/robots/sitemap y producto inválido; límites manuales y de campo del informe08.
- Correos/push/observabilidad/recuperación: pruebas aisladas y dry-run, backup y restauración documentados; no emails/push/transacciones/export/import reales.
- Producción/Diagnóstico Maestro: sólo comprobaciones autorizadas/no destructivas y recibos existentes. Sesión Super Admin real, secretos remotos, restauración real y entrega a terceros no se acreditan con fixtures.

## Evidencia inicial y restricciones

Focalizadas de reparación:10PASS routing/identidad/estadísticas;5PASS paginador REST/CAS; extractor3PASS; fallback1PASS. Estos conteos se solapan con suites posteriores. Los informes de08 detallan su barrido local. No sumar conteos como pruebas únicas.

Emulador local BLOCKED por descarga del JAR oficial desde storage.googleapis.com; se mantiene gate real de CI y no se sustituye por producción. npm audit original y posterior conservan14moderadas. Las pruebas fallidas o interrumpidas se registran, se inspeccionan y no se presentan como PASS. Repetición final y recibos CI deben citar SHA/run/attempt.

## Pendientes y siguiente paso exacto

1. Propietaria: autorizar y ejecutar workflow existente PUBLICAR_REGLAS sobre SHA integrado, revisar environment production-rules y verificar versión desplegada. No ejecutado aquí.
2. Propietaria con acceso Apps Script: actualizar WebApp con dispatcher que rechaza createOrder y confirmar versión/consumidores. Sin mensajes/pruebas comerciales reales.
3. Mantenimiento: esperar/evaluar releases compatibles de Firebase CLI/glob/minimatch, correr audit y emuladores; nunca audit fix --force por defecto.
4. Acceso autorizado: contrastar índices/configuración/proveedores desplegados, sesión real por rol y Diagnóstico Maestro; no afirmar índice ausente sólo por faltar manifiesto local.
5. QA manual: Safari/WebKit/Firefox si forman parte del soporte, iOS/Android físicos, lector, contraste dinámico y CWV de campo. Fixtures no los reemplazan.
6. Recuperación: ensayo aprobado de backup restaurado a base separada, nunca sobre producción por probar. El fallback informativo no restaura backend ni datos.

La aceptación global queda condicionada por estos puntos. Un agente siguiente debe leer CURRENT_STATE, este informe, el recibo GitHub de la PR y el SHA actual antes de reanudar; no retomar desde un PASS fechado sin contrastarlo.

## Conciliación y verificaciones posteriores

El 2026-11-03 origin/main avanzó a c25421df (#1317) con la reparación F02-STATS. Se incorporó por fast-forward antes de reaplicar08/09. Se descartó únicamente nuestra implementación local duplicada (conservada en stash de respaldo); permanecen la paginación/snapshot/CAS y regresiones ya integradas. Revalidación focalizada15/15PASS, sin skips. Audit:final pasó su prefijo por dominios hasta login/perfil; allí test:critical-runtime quedó BLOCKED por la descarga del JAR. La continuación canónica desde hero-background-controls hasta cache-versioning terminó con exit0. No se acredita audit:final completo: el gate de emulador/runtime debe ejecutarse en CI, sin quitarlo ni simular PASS. Logs locales artifacts/phase09/audit-final-3.log, audit-continuation.log y audit-tail.log.

Se instaló gh-fix-ci oficial para ambos agentes y se habilitó una tarea horaria de vigilancia por pedido del titular; [alcance y límites](GITHUB_RESULTS.md). La creación está confirmada, su primer despertar no. Run41442885247/1 pertenece a Dependabot #1316, SHAba96c3a1: preflight/build aprobados, drift de package.json/package-lock.json en diagnóstico y revision causó el rechazo de artefactos. Los controles siguientes se omitieron por dependencia; no fueron fallos independientes. Se reprodujo el mismo diff tras incorporar main en un worktree aislado y el build quedó estable en segunda ejecución. Esta rama incluye Firebase15.34.2 y sus derivados canónicos, por lo que1316 quedará supersedida sólo al verificar integración de este cambio. No se reescribe el historial del fallo ni se elude la política de autores del controlador.

Revalidación final09 tras conciliar1317: **685pruebas de dominios PASS,0FAIL/0SKIP**; **107/107Chromium de rendimiento PASS sin reintentos** (3min, ambos orígenes locales). El primer barrido08 de106/1FLAKY se conserva como histórico; esta ejecución nueva no hereda su resultado. Skills46por agente validados; --help del script oficial PASS. [Evidencia local](evidence/phase09-20261102/local-validation.json). Build/CI del candidato y limitaciones productivas se registran por separado.


Control previo a PR: ci:preflight completo PASS_LOCAL; preflight de imports repetido tras retirar restos muertos del bridge (1194fuentes/72funciones), routing7/7. Build canónico repetido:7derivados idénticos; protección78registros/544archivos intacta. Recibo CI/fusión actual: [PR por rama](https://github.com/tintinaccs/tintin-web/pulls?q=head%3Acodex%2Fphase09-integral-acceptance). Su descripción registra SHA/run/intento terminal sin commits dedicados sólo a anunciar CI. Las limitaciones productivas siguen abiertas.


Conciliación posterior de #1318: main1c673584b0b8e69e9610c6d4721210d86bd4f55c incorpora efectivo al retirar y textos reales de delivery. Se preservan política server-side, contratos, pruebas y contenido de ese cambio. Las URLs de13módulos realmente alterados se renuevan a tintin-20261103-acceptance-1;22módulos del grafo concurrente conservan sus URLs publicadas. Nuevas regresiones/generadores/CI se validan sobre la conciliación, sin heredar el PASS del anterior75fa91e9. PR1319 es la entrega vigente.


Advertencia CI demostrada: Firebase13/@firebase/rules-unit-testing6 exige Node>=24.12.0, pero los workflows usaban22 (EBADENGINE en job125671971836 del run41560504080/1). Se centraliza la selección en engines.node de package.json (>=24.12.0 <25, LTS24) y actions/setup-node node-version-file, soportado oficialmente; sin duplicar archivo de versión ni bajar SDK. Los nueve workflows existentes conservan triggers, permisos, cobertura y protecciones; npm ci --engine-strict convierte una futura incompatibilidad de engines en fallo explícito. No se disparan despliegues manuales. npm install --package-lock-only --ignore-scripts --engine-strict PASS con Node24.19.0 y180contratos de CI/operaciones/arquitectura PASS. CI del nuevo SHA debe repetirse. Configuración Node explícita del panel Cloudflare sigue sin verificarse.

## Integración y recibos verificados

PR1319 MERGED: head df692c4b48ccf0fa120d2f4ebe1bf82d834180e8, main9b1b88f8abee27d395d6690f4b68843cb1374d3f. CI41562231283/1, CodeQL41562227482/1, Cloudflare e integridad/mantenimiento protegidos SUCCESS. En CI:107rendimiento,144/144viewports y220/220geometría al primer intento,528runtime aislado,258controles Rules y18integraciones reales. El monitor41565292553/1 verificó artefacto del commit,17respuestas y headers; PASS_PRODUCTION limitado a esas lecturas. CI de main41565290324/1 se sigue por separado, pendiente al escribir este recibo. #1316 cerrada por actualización ya incorporada.

La vigilancia horaria registró su primer disparo2026-11-03T02:24:49Z y el prompt llegó a este hilo; se acredita activación/continuación, sin prometer webhooks ni invocación nativa en otro host. La única PR abierta restante1306 se recupera por merge normal con9b1b88f8 y actualiza enrutamiento de46Skills/gh-fix-ci. Es una reparación de operación de agentes, sin nuevo código comercial. Los pendientes productivos y de negocio siguen explícitos; no se declara cierre100%. Aviso LOW adicional: actions/cache@v4 aún declara Node20 forzado a24 por GitHub; evaluar actualización en mantenimiento, sin ocultar la anotación.
