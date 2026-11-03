# Tintín — seguimiento global permanente, fases 00 a 09

Actualizado: 2026-11-03 America/Buenos_Aires. Responsable: Codex /root, GPT-6.
Este plan global reemplaza la numeración de la tarea particular de Skills/CI;
aquella evidencia se conserva en [TINTIN_SKILLS_CI_20261101.md](TINTIN_SKILLS_CI_20261101.md).
La titular solicitó explícitamente que 01 corresponda a auditoría global y arquitectura.

## Cambio de secuencia solicitado

La secuencia vigente responde a las instrucciones particulares:02 visual pública,
03 editor/admin,04 catálogo,05 comercio,06 clientes/backoffice,07 backend,
08 optimización transversal y09 reparación integral/aceptación. Las dependencias
productivas de seguridad03A se conservan separadas: integrar una corrección de
Rules o Apps Script no equivale a desplegarla. Los informes históricos conservan
sus alcances originales; [el cierre09](TINTIN_PHASE09_ACCEPTANCE.md) los concilia.

## Base y estados

- Publicación estable de01: **5b694fe4adaa9e356f3c2f8e74d2de5ca0f5adde**,
  PR [#1308](https://github.com/tintinaccs/tintin-web/pull/1308) MERGED.
  CI41370328636/1, CodeQL41370329571/1 y salud41370330002/1 SUCCESS.
- Base de la reparación02: ese SHA5b694fe4; rama aislada
  `fix/phase02-public-responsive-20261102`. Recibo terminal en la PR de esa rama.
- Base estable auditada: **085953dc0b700e91f95fc8c84dd8e17f4627a70c**.
- #1307 MERGED; head cdb464c04c7bd85d0be7b78bee9b5253f3804d90. CI de main
  [41361909966/1](https://github.com/tintinaccs/tintin-web/actions/runs/41361909966),
  CodeQL41361910183/1 y comprobación de producción41361911653/1 SUCCESS.
- #1305 MERGED en7dfe8c9f, CI final41355599089/1 SUCCESS. El fallo post-merge
  de protección41357878092/1 fue corregido por #1307; no se borra su historial.
- #1306: recuperación en curso desde976601a9, con merge normal de main9b1b88f8 y derivados canónicos; se preserva la retirada del job de escritura de1307. CI41358865966/1 es FAILURE histórico de runner, con log no recuperable; no se hereda como fallo del nuevo candidato ni se inventa su causa funcional. Recibos actuales en PR1306.
- Los PASS se refieren al criterio y SHA citados. Un informe terminado no prueba
  que sus hallazgos estén corregidos ni certifica todas las operaciones reales.
- La observación nativa de Skills sigue BLOCKED; catálogo executor vacío
  consultado de nuevo en02. Sus instrucciones se leen como referencia. La titular
  autorizó esta reparación visual; no se declara resuelto el bloqueo del host.

## Fases y dependencias

| Fase | Alcance | Estado / evidencia | SHA / PR | Pendiente y siguiente fase |
| --- | --- | --- | --- | --- |
| 00 | Baseline y estabilidad Skills/CI | PASS_CI del circuito del repositorio; BLOCKED de activación nativa | 085953dc / #1305 y #1307 | 46 Skills por ruta y4compat válidos; enrutamiento1306 en verificación; catálogo executor vacío. Nueva sesión con catálogo/invocación observables. Diagnóstico01 autorizado sin cambio funcional |
| 01 | Auditoría global y arquitectura real | PASS_CI de publicación diagnóstica; siete hallazgos abiertos | Auditoría085953dc; publicación5b694fe4 / #1308 | Informe y reproducciones completos. Siguiente:02 visual por nueva instrucción |
| 02 | Reparación visual pública, responsive, scroll y foco | PASS_CI; #1309 MERGED | 344a2936 / [#1309](https://github.com/tintinaccs/tintin-web/pull/1309); CI41375418525/1 SUCCESS del head29e8685c | Comprobación de main y producción separada por sus runs. Continúa03 editor por instrucción actual; seguridad03A abierta |
| 03 | Administración y editor de productos | Integrado #1310; checks históricos de merge verificados; revalidación09 en curso | e3de73c1 | Fotografías/opciones/stock y móvil incluidos; no heredar PASS del candidato09 |
| 03A/03B | Autoridades de escritura e integridad comercial | Correcciones de fuente05/07 integradas; cierre productivo BLOCKED | #1313/#1315 | Publicación Rules y WebApp requieren autorización/verificación separada |
| 04 | Catálogo comercial integral | Integrado #1311; checks históricos verificados; revalidación09 en curso | b1107b3f | [Informe04](TINTIN_PHASE04_CATALOG.md); inventario real no usado para probar |
| 05 | Flujo comercial completo | Integrado #1313,CI/CodeQL históricos aprobados; revalidación09 en curso | 001c4218 | [Informe05](TINTIN_PHASE05_COMMERCE.md); WebApp sin verificar |
| 06 | Clientes, administración, permisos y notificaciones | Integrado #1314,checks históricos aprobados; revalidación09 en curso | 1159edeb | [Informe06](TINTIN_PHASE06_ACCOUNTS_ADMIN.md); hardware y entrega real no acreditados |
| 07 | Backend, datos, APIs y servicios | Integrado #1315; Rules aisladas PASS_CI histórico; deployment BLOCKED | 39744311 | [Informe07](TINTIN_PHASE07_BACKEND_SECURITY.md); no se publicó Firestore Rules |
| 08 | Optimización transversal de rendimiento, UX, accesibilidad y SEO | Integrada y PASS_CI en1319; producción de artefacto/salud aprobada | 9b1b88f8 / #1319 | [Informe08](TINTIN_PHASE08_TRANSVERSAL.md); mediciones y límites explícitos |
| 09 | Reparación integral, aceptación y cierre | Código integrado con PASS_CI; CI de main en curso; aceptación productiva integral BLOCKED | 9b1b88f8 / #1319 | [Informe09](TINTIN_PHASE09_ACCEPTANCE.md); matriz completa y recibos actuales obligatorios |

## Entregables de la Fase 01

- [Informe completo](PHASE01_GLOBAL_ARCHITECTURE_AUDIT.md): inventario de páginas,
  arquitectura, fuentes de verdad, siete hallazgos, clasificación, evidencia,
  impacto, solución mínima, riesgos y matriz entre fases.
- [Inventario y grafo](evidence/phase01-20261101/inventory.json): 19HTML, 58API,
  446módulos de ejecución y961aristas estáticas/literales. No declarar un archivo
  muerto sólo por no aparecer como alcanzable en este grafo.
- [Validación](evidence/phase01-20261101/validation.json): ocho gates seleccionados,
  642pruebas de dominios, 38de arquitectura, 3operativas, 18rutas smoke,
  144combinaciones de geometría y5pruebas del helper de accesibilidad. Conteos
  solapados; no sumarlos como cobertura única.
- [Reproducciones](evidence/phase01-20261101/README.md): Rules en emulador demo,
  resumen truncado/carrera, fallback incompleto y creador legado con variante agotada.
- No se aplicaron reparaciones funcionales. Un probe que termina0 porque confirmó
  una vulnerabilidad no significa que el criterio de seguridad haya aprobado.

## Entregables de la Fase 02

- [Informe y alcance visual](PHASE02_PUBLIC_VISUAL_REPAIR.md): defectos de scroll,
  foco, autoridades, superficies/dispositivos, evidencia y límites.
- [PR de la rama visual](https://github.com/tintinaccs/tintin-web/pulls?q=is%3Apr+head%3Afix%2Fphase02-public-responsive-20261102):
  recibo por head/run/intento, fusión y verificaciones posteriores. Se registra
  allí el resultado terminal sin commits dedicados sólo a anunciar CI.
- Casos nuevos en la suite canónica de UI/UX; scroll cubierto por el gate de
  shell. Sin dependencias ni workflows nuevos; derivados por constructores.

## Prioridad de continuación

1. Consultar main y el recibo terminal de02; no iniciar03 con pruebas pendientes.
2. Empezar03A por F01-RULES: un agente sin permiso de pedidos no debe poder
   alterar inventoryState/inventoryRevision saltándose dominio y auditoría.
3. Verificar deployment/callers Apps Script para resolver F04 sin retirar el espejo.
4. Seguir03B/04: integridad comercial y proyecciones antes de nuevos cambios estéticos.
5. Mantener generadores, protección, publicación por PR y seguimiento terminal.
   Esta reparación visual no autoriza Rules deploy, datos, compras, correos/push
   reales ni migraciones/destrucción de datos comerciales.

## Continuación solicitada: administración y editor (03)

La mejora del editor se aplica sobre la fase02 visual fusionada en344a2936.
Conserva matrices V1/V2, autorización, escritores y datos; no sustituye las
reparaciones pendientes03A/03B. El informe específico registra el alcance,
reproducciones, pruebas, límites y estado. No migrar datos de producción.

## Continuación solicitada: catálogo comercial (04)

La instrucción actual prioriza el catálogo público/administrativo y sus variantes,
precios, imágenes y stock sobre la base fusionada e3de73c1 (#1310). Se registra
el resultado por candidato, sin heredar PASS de03. La revisión inicial detectó
un checkout local atrasado y se concilió antes de entregar. El nuevo alcance no
cierra por inferencia F01-RULES/F04-LEGACY de03A/03B; F02-STATS (resumen de
cuentas/pedidos) permanece pendiente fuera de esta reparación de catálogo.
No se modifican datos productivos ni se autorizan migraciones destructivas.

## Continuación09 y vigilancia de CI (2026-11-03)

Base conciliada con #1317/c25421df, que resuelve F02-STATS en fuente mediante páginas/snapshot/CAS;09 preserva esa autoridad y añade integración real aislada. Tramos de audit:final ejecutados con fallos inspeccionados: auditorías obsoletas alineadas con contratos reales, runtime/emulador local BLOCKED por descarga oficial, continuación final exit0. Se requieren recibos del candidato para PASS_CI.

Se incorporó gh-fix-ci oficial a Codex/Claude (46Skills por ruta) y se habilitó vigilancia horaria externa para fallos/advertencias accionables, sin receiver de eventos ni primer despertar acreditado. Run41442885247/1 de #1316 falla por artefactos generados desactualizados ante bump Firebase15.34.2;09 incluye ese bump con regeneración canónica. [Operación y límites](GITHUB_RESULTS.md). No se declara instalación global del host ni vigilancia instantánea.


Conciliación posterior de #1318: main1c673584b0b8e69e9610c6d4721210d86bd4f55c incorpora efectivo al retirar y textos reales de delivery. Se preservan política server-side, contratos, pruebas y contenido de ese cambio. Las URLs de13módulos realmente alterados se renuevan a tintin-20261103-acceptance-1;22módulos del grafo concurrente conservan sus URLs publicadas. Nuevas regresiones/generadores/CI se validan sobre la conciliación, sin heredar el PASS del anterior75fa91e9. PR1319 es la entrega vigente.


Advertencia CI demostrada: Firebase13/@firebase/rules-unit-testing6 exige Node>=24.12.0, pero los workflows usaban22 (EBADENGINE en job125671971836 del run41560504080/1). Se centraliza la selección en engines.node de package.json (>=24.12.0 <25, LTS24) y actions/setup-node node-version-file, soportado oficialmente; sin duplicar archivo de versión ni bajar SDK. Los nueve workflows existentes conservan triggers, permisos, cobertura y protecciones; npm ci --engine-strict convierte una futura incompatibilidad de engines en fallo explícito. No se disparan despliegues manuales. npm install --package-lock-only --ignore-scripts --engine-strict PASS con Node24.19.0 y180contratos de CI/operaciones/arquitectura PASS. CI del nuevo SHA debe repetirse. Configuración Node explícita del panel Cloudflare sigue sin verificarse.

## Recibo de integración09 y primer despertar

PR1319 MERGED en9b1b88f8, head df692c4b. CI41562231283/1, CodeQL41562227482/1 e integridad/mantenimiento protegidos SUCCESS. Monitor41565292553/1 SUCCESS del artefacto publicado; auditoría posterior41565290324/1 todavía en curso al registrar. No equivale a Rules publicadas ni a pruebas monetarias/autenticadas reales. Primer disparo de vigilancia horaria registrado2026-11-03T02:24:49Z, con prompt recibido y seguimiento retomado. PR1306 se recupera preservando esta base y configura selección de Skills, sin modificar comercio ni controles.
