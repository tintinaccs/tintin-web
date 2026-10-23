# Editor de productos v2 — entrada para agentes

Fecha: 2026-10-23. Fase autorizada: **0, documentación**. No iniciar implementación, migración ni publicación.

Esta carpeta conserva las decisiones de la titular del «PROMPT 0». No reemplaza las autoridades técnicas existentes ni certifica funcionalidades por estar aprobadas.

1. [Decisiones y alcance](01-DECISIONES-Y-ALCANCE.md).
2. [Arquitectura inspeccionada](02-ARQUITECTURA-ACTUAL.md).
3. [Plan de seis fases propuesto](03-PLAN-MAESTRO.md).
4. [Contratos y compatibilidad](04-CONTRATOS-Y-COMPATIBILIDAD.md).
5. [Pruebas y evidencias](05-MATRIZ-DE-PRUEBAS.md).
6. [Registro de decisiones](06-REGISTRO-DE-DECISIONES.md).
7. [Bitácora de agentes](07-BITACORA-DE-AGENTES.md).
8. [Estado y relevo](08-ESTADO-Y-RELEVO.md).

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
