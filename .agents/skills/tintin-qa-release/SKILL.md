---
name: tintin-qa-release
description: "Use for PR reviews, GitHub Actions status, CI failures and non-destructive release verification on Tintín."
---

# QA y seguimiento hasta estado final
1. Leer AGENTS.md, docs/agent/GITHUB_RESULTS.md y protocolo actual. Respetar permisos y protecciones.
2. Para cada PR comprobar cambios, checks, commit exacto, workflows y logs de fallos; no dar por terminado si CI está pendiente.
3. No ejecutar audit:final ni suite total por defecto; usar la matriz integral solamente bajo la condición contractual existente.
4. Verificar funcionamiento en los caminos críticos modificados, seguridad, accesibilidad, responsive y rendimiento según impacto.
5. Priorizar fallo raíz y pruebas de regresión, no forzar PASS.
6. El agente reporta número de PR, SHA, IDs de runs, estados finales y limitaciones; no simular que otro agente despertará automáticamente.
7. Prohibido forzar merge, saltarse checks o desplegar sin la autorización aplicable.
