# Tintín — seguimiento global permanente, fases 00 a 09

Actualizado: 2026-11-01 America/Buenos_Aires. Responsable: Codex /root, GPT-6.
Este plan global reemplaza la numeración de la tarea particular de Skills/CI;
aquella evidencia se conserva en [TINTIN_SKILLS_CI_20261101.md](TINTIN_SKILLS_CI_20261101.md).
La titular solicitó explícitamente que 01 corresponda a auditoría global y arquitectura.

## Cambio de secuencia solicitado

La titular solicitó explícitamente que la fase 02 sea reparación visual pública
y que la fase 03 audite y mejore administración y editor de productos.
El alcance pendiente de seguridad conserva su identificador **03A**, antes del comercio
**03B**. No se cierran ni se omiten los HIGH de la auditoría 01. La fase 06
conserva integración de estado/UI y administración; la 07, medición y validación
manual de accesibilidad/rendimiento. No son una repetición de la reparación02.

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
- #1306 OPEN, head976601a99772e5390448b8da2edda79d9d6c1429, CI41358865966/1
  FAILURE: pérdida de comunicación del runner125006122914, logsBlobNotFound/404.
  Además necesita conciliar el main actual y regenerar plan/derivados, preservando
  la eliminación del job de escritura de #1307. Su rama no se modificó.
- Los PASS se refieren al criterio y SHA citados. Un informe terminado no prueba
  que sus hallazgos estén corregidos ni certifica todas las operaciones reales.
- La observación nativa de Skills sigue BLOCKED; catálogo executor vacío
  consultado de nuevo en02. Sus instrucciones se leen como referencia. La titular
  autorizó esta reparación visual; no se declara resuelto el bloqueo del host.

## Fases y dependencias

| Fase | Alcance | Estado / evidencia | SHA / PR | Pendiente y siguiente fase |
| --- | --- | --- | --- | --- |
| 00 | Baseline y estabilidad Skills/CI | PASS_CI del circuito del repositorio; BLOCKED de activación nativa | 085953dc / #1305 y #1307 | 45 Skills por ruta y4compat válidos; catálogo executor vacío. Nueva sesión con catálogo/invocación observables. Diagnóstico01 autorizado sin cambio funcional |
| 01 | Auditoría global y arquitectura real | PASS_CI de publicación diagnóstica; siete hallazgos abiertos | Auditoría085953dc; publicación5b694fe4 / #1308 | Informe y reproducciones completos. Siguiente:02 visual por nueva instrucción |
| 02 | Reparación visual pública, responsive, scroll y foco | PASS_CI; #1309 MERGED | 344a2936 / [#1309](https://github.com/tintinaccs/tintin-web/pull/1309); CI41375418525/1 SUCCESS del head29e8685c | Comprobación de main y producción separada por sus runs. Continúa03 editor por instrucción actual; seguridad03A abierta |
| 03 | Administración y editor de productos: fotografías, opciones, inventario, UX y compatibilidad | PASS_LOCAL; 130 pruebas navegador,110 de dominio y13 específicas tras conciliar02 (conteos solapados) | Base344a2936; rama codex/phase03-product-editor | [Informe](PHASE03_ADMIN_PRODUCT_EDITOR.md). No acredita cierre de seguridad/comercio |
| 03A/03B | Seguridad y autoridades de escritura; integridad comercial | PENDING; HIGH F01-RULES/F04-LEGACY siguen abiertos | Base de hallazgos085953dc; sin PR de reparación | Primero autorización de inventory* y exposición/delegación Apps Script; después V1/V2, precios, stock, carrito, checkout y pagos. Depende01; conciliar02 |
| 04 | Catálogo comercial integral: publicación, variantes, precios, imágenes, stock, relaciones, consultas y caché (instrucción actual) | IN_PROGRESS; reparaciones y pruebas de catálogo documentadas | Base e3de73c1 (#1310); rama codex/phase04-catalog-commercial | [Informe04](TINTIN_PHASE04_CATALOG.md). F01/F04 HIGH y F02-STATS siguen pendientes; no declarar cierre global |
| 05 | Administración, notificaciones, correos y procesamiento | PENDING; fuentes/colas mapeadas, ciclo de imports documentado como riesgo | Base085953dc; sin PR funcional | Ver permisos, estados, recuperación y side effects sin duplicados. Depende03A/03B/04 |
| 06 | Integración de UI/estado y administración | PENDING; reparación pública visual separada en02 | Base085953dc; sin PR de esta fase | Estados con datos reales por rol, drafts y sincronización tras reparar dominios. Depende03A/03B/04 |
| 07 | Responsive, accesibilidad, rendimiento y SEO medidos | PENDING; 5tests del helper a11y PASS, cobertura manual/campo pendiente | Base085953dc; sin PR funcional | Matriz real, teclado/lector, hardware, WebKit y CWV de campo. Depende05/06 |
| 08 | Build, publicación, Actions, dependencias, monitoreo y mantenimiento | PENDING; F03-FALLBACK/F05-DEPS MEDIUM y F06-CONTRACTS/F07-INDEX LOW | Base085953dc; sin PR funcional | Artefacto fallback completo, toolchain, contratos y extractor. Preparación puede avanzar tras01/02; cierre revalida03–07 |
| 09 | Aceptación global y entrega | BLOCKED por HIGH abiertos y verificaciones externas enumeradas | Sin release de cierre | Requiere02–08 y evidencia aplicable; no declarar terminado con pruebas pendientes |

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
