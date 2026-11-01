# Tintín — seguimiento permanente de fases 00 a 09

Actualizado: 2026-11-01. Agente: Codex /root, GPT-6, Linux Cloud.
Este seguimiento corresponde a estabilización de Skills/CI. No acredita fases
funcionales de otros planes ni una auditoría integral del comercio.

Base verificada: `7dfe8c9f306168994e324c34135230d8a5da3f71` (main al iniciar).
PR #1305: MERGED, 2026-11-01 19:35:12 America/Asuncion; head
`e0465aa57547620c3dfedfe3b21c8f230bf9ee2c`, merge igual a la base.
Su CI `41355599089`, intento 1, SUCCESS; CodeQL `41355595342`, SUCCESS.
El cuerpo histórico de la PR todavía menciona fallos anteriores: no representa
el resultado final. CI post-merge `41357878092`, intento 1: Protected flows FAIL;
el resto se consulta por separado, no se hereda SUCCESS del head.

| Fase | Alcance | Resultado y evidencia | Pendiente / siguiente |
| --- | --- | --- | --- |
| 00 | Estado real, políticas y alcance | Base y merge #1305 confirmados por API; documentos normativos leídos | Mantener evidencia por SHA |
| 01 | Inventario y compatibilidad de Skills | PASS_LOCAL: 45 `.agents`, 45 `.claude`, 4 `.codex`; nombres únicos y metadatos; copia Linux; enlaces Markdown locales de SKILL.md sin destinos ausentes | Activación depende de 02 |
| 02 | Disponibilidad efectiva en Codex Cloud | BLOCKED: `skills.list` de autoridad executor devuelve `skills: []`; lectura de archivos funciona, pero no prueba descubrimiento nativo | Sesión nueva de Codex/Claude con catálogo e invocación nativa observables; este host no expone control de reindexación |
| 03 | Primer fallo y causalidad | Primer run #1305 `41350410392`: preflight/audit:typography auditó recursos de Skills (142 observaciones); corrección ya integrada. Suites posteriores omitidas no fueron fallos propios | Logs históricos conservados por GitHub; no reintentos para ocultarlos |
| 04 | Workflows y protecciones | PASS_LOCAL: Workflows=12; PR=1. Ruleset 18212422 Protect main activo: PR, squash, historial lineal, resolución de conversaciones, sin borrado/force-push | Endpoint clásico de branch protection 403; no se afirma haber leído esa configuración |
| 05 | Artefactos y SHA inmutable | Se retira job que hacía commit/pull/push sobre rama de Skills; CI conserva build y rechazo de drift. Generador único de ambos JSON sin fecha/HEAD variable | Ver CI del candidato |
| 06 | Baseline protegida | FAIL reproducido en main: workflow, admin.html, AGENTS.md y cache-version-baseline. Renovación con preparar-mantenimiento-flujos.mjs: 4 archivos, 4 registros; 78 registros/544 archivos conservados | Revisión y CI protegidas del candidato |
| 07 | Validación local | PASS_LOCAL: preflight completa, 189/189 pruebas de operaciones/protección/diagnóstico, integraciones canónicas, validadores y copia Linux | Build final y drift se registran abajo |
| 08 | Integración protegida | PENDING: rama codex/verify-skills-stability-20261101; candidato sólo CI/documentación/metadatos | PR propia y resultados terminales; #1306 se conserva ajena |
| 09 | Cierre y siguiente fase | BLOCKED por descubrimiento nativo no observable (02); no se declara integración plenamente verificada | Terminar 08 y verificar host antes de nuevas modificaciones funcionales |

## Disponibilidad y recursos

El nombre en frontmatter es la identidad del Skill, no siempre su carpeta:
`design-taste-frontend` → taste-frontend, `code-review` → matt-code-review,
`handoff` → matt-handoff. El catálogo y CLOUD_SKILLS_LOCK.json fijan procedencia,
revisiones y licencias. No se ejecutaron scripts de terceros ni instalaron paquetes
en Windows. Las dependencias opcionales de esos recursos no quedan instaladas
por copiar archivos. Graphify CLI y Chat Party siguen sin instalación confirmada.

Las variantes originales audit-tintin/fix-bug/release-check/security-audit difieren
por cliente y se preservan deliberadamente. CLOUD-CHECKS.md de agent-efficiency
tiene una frase adicional en Codex; no contradice las políticas. No se exige
paridad byte a byte de variantes históricas ni se confunde con ejecución nativa.

Nombres presentes en cada ruta principal:

- `audit-tintin`
- `caveman`
- `fix-bug`
- `frontend-design`
- `code-review`
- `handoff`
- `ponytail`
- `receiving-code-review`
- `release-check`
- `requesting-code-review`
- `security-audit`
- `systematic-debugging`
- `design-taste-frontend`
- `test-driven-development`
- `tintin-accessibility`
- `tintin-agent-efficiency`
- `tintin-architecture-integrations`
- `tintin-brand-copy`
- `tintin-cloud-linux`
- `tintin-code-index`
- `tintin-commerce-integrity`
- `tintin-data-index-sync`
- `tintin-design-engineering`
- `tintin-design-quality`
- `tintin-ecommerce-flows`
- `tintin-firebase-integrity`
- `tintin-integrations`
- `tintin-maintainability`
- `tintin-observability`
- `tintin-observability-recovery`
- `tintin-performance-budgets`
- `tintin-performance-loading`
- `tintin-qa-release`
- `tintin-release-operations`
- `tintin-responsive-a11y`
- `tintin-search-seo`
- `tintin-security-hardening`
- `tintin-security-privacy`
- `tintin-seo-discoverability`
- `tintin-tests-evidence`
- `ui-ux-pro-max`
- `verification-before-completion`
- `webapp-testing`
- `writing-for-agents`
- `writing-plans`

## Generación reproducible y seguridad

`scripts/construir-manifiesto-diagnostico.js` es la autoridad de ambos JSON.
Excluye sus propios derivados, directorios de herramientas y resultados de tests;
hashea las fuentes ordenadas y fija generatedAt a una fecha constante. site-version
proyecta revisiones semánticas de documentos/recursos. Documentación versionada
sí cambia el inventario; debe generarse después del texto y plan definitivos.
`npm run build:pages` aplica los generadores canónicos y sus verificaciones.
CI no debe escribir commits para corregir el checkout que está validando.

El controlador existente exige Repository audit, Analyze (actions), Analyze
(javascript-typescript) de GitHub app 15368 y Cloudflare Pages: tintinaccesorios
(app 85455), por SHA/evento/workflow; no se alteran estos requisitos. Su mecanismo
de mantenimiento autoriza renovar huellas con un plan real, conservando registros
y metadatos; una huella renovada no certifica producción ni sustituye CI.

PR #1306 abierta al consultar: head `976601a99772e5390448b8da2edda79d9d6c1429`,
run `41358865966` intento 1 en curso; `41358793234` action_required y `41358735640`
cancelled pertenecen a heads anteriores. No se modificó ni reintentó esa rama.
No hay cambios funcionales, datos reales ni dispatch de despliegues en esta tarea.

Validación final local: build:pages PASS; segunda ejecución sin diferencias SHA256
en diagnostic-manifest.json/site-version.json; protección78registros/544archivos
PASS; git diff --check limpio. Plan candidato validado por inspectMaintenance
con base main exacta. Node local24.19.0; CI fija Node22 y debe acreditar ese runtime.
