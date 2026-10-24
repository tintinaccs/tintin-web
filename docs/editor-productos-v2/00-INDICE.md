# Estado vigente — 24/10/2026

Ver [cierre por fases y publicación](19-CIERRE-Y-PUBLICACION-20261024.md): #1219/#1221/#1222/#1226 integrados; producción verificada en main0f253a41. #1228 sigue en borrador y necesita conciliar #1227, validar el nuevo SHA y obtener autorización de publicación. El 502 de correo sigue separado y sin causa exacta acreditada. Los estados de auditoría de 23/10 que siguen son históricos.

[Rediseño visual del editor](16-REDISENO-VISUAL.md).

[Matriz actual del candidato](15-MATRIZ-CANDIDATO.md) · [Recibo local](evidencias-continuidad.json).

## Continuación autorizada — candidato integrado (23/10/2026)

La instrucción actual de la titular autoriza recuperar, corregir y continuar las fases pendientes. Se recuperó #1218 sobre #1217 en codex/completar-editor-v2-20261024. Ahora existe editor/escritor compatible, estados/SEO, plantillas acotadas y estadísticas con límites explícitos. El resultado NO APTO de fase5 describe el candidato anterior; no certifica ni rechaza automáticamente el nuevo. Ver [14-CONTINUIDAD-Y-CANDIDATO](14-CONTINUIDAD-Y-CANDIDATO.md). Estado de pruebas/CI/publicación: consultar el relevo actual, sin heredar PASS. No se migran productos reales.

# Editor de productos v2 — entrada para agentes

Fotografía histórica del23/10/2026: fase5 de auditoría. Resultado entonces NO APTO; no equivale a fases2–4 aprobadas/integradas. No publicar ni migrar datos reales. La numeración de los pedidos expresos de la titular prevalece sobre propuestas históricas del plan.

Esta carpeta conserva las decisiones de la titular del «PROMPT 0». No reemplaza las autoridades técnicas existentes ni certifica funcionalidades por estar aprobadas.

1. [Decisiones y alcance](01-DECISIONES-Y-ALCANCE.md).
2. [Arquitectura inspeccionada](02-ARQUITECTURA-ACTUAL.md).
3. [Plan de seis fases propuesto](03-PLAN-MAESTRO.md).
4. [Contratos y compatibilidad](04-CONTRATOS-Y-COMPATIBILIDAD.md).
5. [Pruebas y evidencias](05-MATRIZ-DE-PRUEBAS.md).
6. [Registro de decisiones](06-REGISTRO-DE-DECISIONES.md).
7. [Bitácora de agentes](07-BITACORA-DE-AGENTES.md).
8. [Estado y relevo](08-ESTADO-Y-RELEVO.md).
9. [Hallazgos, reproducción e historial 422](09-AUDITORIA-FASE-1.md).
10. [Motor comercial implementado y activación protegida](10-MOTOR-COMERCIAL-FASE-2.md).
11. [Auditoría fase5 y evaluación NO APTO](11-AUDITORIA-FASE-5.md).
12. [Matriz43 actual](12-MATRIZ-43-FASE-5.md).
13. [Preservación44–58](13-PRESERVACION-FASE-5.md).
14. [Recibo estructurado de evidencia](evidencias-fase5.json).

## Antes de cada tarea

Leer [AGENTS.md](../../AGENTS.md), [protocolo](../agent/README.md), alcance, plan y relevo. Comprobar Git, base, ramas y PR abiertos. Identificar la fase expresamente autorizada. Contrastar las afirmaciones con el código de ese commit. No heredar PASS históricos.

## Al terminar

Registrar agente, fecha, archivos/funciones afectados, comandos realmente ejecutados, resultado, pruebas omitidas, riesgos, commit y PR. Actualizar bitácora y relevo; persistir también el resumen en [CURRENT_STATE](../agent/CURRENT_STATE.md). Conservar información válida de otros agentes. No colocar datos de clientes ni secretos en documentación.

## Autoridades que se reutilizan

- [Arquitectura operativa](../arquitectura-operativa-canonica.md) y [técnica](../arquitectura-tecnica.md).
- [Lógica de tienda](../contrato-logica-tienda.md) y [contratos comerciales](../contratos-comercio.md).
- [Productos y Sheets](../sincronizacion-productos-canonica.md), [autoridades de sincronización](../autoridades-sincronizacion.md).
- [Versiones canónicas](../arquitectura-versiones-canonicas.md), [CI](../contratos-arquitectura-ci.md), [calidad](../contratos-calidad.md).

Una discrepancia entre esta fotografía documental y el código futuro exige investigar y registrar la resolución; no implementar una segunda autoridad.
