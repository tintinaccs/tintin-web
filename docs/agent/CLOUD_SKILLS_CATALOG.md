# Biblioteca de Skills de Tintín — agentes en la nube

## Alcance
Repositorio: `tintinaccs/tintin-web`. Fecha de integración: 2026-11-01.
Los Skills del proyecto viven en `.agents/skills/<folder>/SKILL.md` para Codex y `.claude/skills/<folder>/SKILL.md` para Claude Code. `.codex/skills/` se conserva para compatibilidad; los cuatro Skills preexistentes de Codex se copiaron también a `.agents/skills/` para favorecer su descubrimiento en sesiones nuevas.

**No se instala nada en la computadora local de la propietaria.** Al clonar el repo en un cloud agent Linux, los Skills quedan disponibles como archivos del workspace. Los agentes pueden activarlos automáticamente por descripción o explícitamente, según compatibilidad de su entorno. No se activan necesariamente todos ni se comparten mágicamente con chats web que no monten este repositorio.

## Skills externos incorporados (copia versionada y procedencia)
| Colección / Skill | Origen, revisión fijada | Nombre en SKILL.md | Carpeta local |
|---|---|---|---|
| Taste Skill | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/tree/12af471f627f866411b4bd785b19646d3672784c) · `12af471f627f` | `design-taste-frontend` | `taste-frontend` |
| UI UX Pro Max | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/3a13158ff1f32156cbe144108de48eda2ecaed9a) · `3a13158ff1f3` | `ui-ux-pro-max` | `ui-ux-pro-max` |
| Ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail/tree/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846) · `96608e078b2d` | `ponytail` | `ponytail` |
| Caveman | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman/tree/9b68f7ed12b05e7efaff18e65c5a3fc2849fd0a4) · `9b68f7ed12b0` | `caveman` | `caveman` |
| Matt Pocock code-review | [mattpocock/skills](https://github.com/mattpocock/skills/tree/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d) · `4ae2317ddb22` | `code-review` | `matt-code-review` |
| Matt Pocock handoff | [mattpocock/skills](https://github.com/mattpocock/skills/tree/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d) · `4ae2317ddb22` | `handoff` | `matt-handoff` |
| Superpowers debugging | [obra/superpowers](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b) · `2ce8aa15d05b` | `systematic-debugging` | `systematic-debugging` |
| Superpowers verification | [obra/superpowers](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b) · `2ce8aa15d05b` | `verification-before-completion` | `verification-before-completion` |
| Anthropic frontend-design | [anthropics/skills](https://github.com/anthropics/skills/tree/ca45fc496a3436251f191354091d557da31c15b5) · `ca45fc496a34` | `frontend-design` | `frontend-design` |
| Anthropic webapp-testing | [anthropics/skills](https://github.com/anthropics/skills/tree/ca45fc496a3436251f191354091d557da31c15b5) · `ca45fc496a34` | `webapp-testing` | `webapp-testing` |

Archivos de apoyo: para Taste Skill se incluyen scripts, bibliotecas y referencias seleccionadas; para UI UX Pro Max se incluyen los datos, scripts de consulta y referencias; para Webapp Testing se incluyen ejemplos y script de servidor; para debugging se incluyen referencias y algunas herramientas. **No todos los ejemplos/evaluadores y recursos opcionales de los repositorios externos están incluidos.** Algunas funciones requieren navegadores, Node, Python, Playwright u otras dependencias disponibles en el agente; sin ellas deben declarar limitaciones. No ejecutar scripts externos automáticamente.

Licencias y atribuciones: `LICENSE.txt` en cada Skill importado (o licencia original de `frontend-design` y `webapp-testing`) y copias de referencia en `docs/agent/vendor-licenses/`. No se deben redistribuir módulos opcionales fuera de su licencia.

## Skills propios (adaptados a las rutas y reglas de Tintín)
- `tintin-brand-copy`
- `tintin-design-quality`
- `tintin-performance-budgets`
- `tintin-accessibility`
- `tintin-ecommerce-flows`
- `tintin-firebase-integrity`
- `tintin-security-hardening`
- `tintin-search-seo`
- `tintin-integrations`
- `tintin-cloud-linux`
- `tintin-tests-evidence`
- `tintin-agent-efficiency`
- `tintin-maintainability`
- `tintin-observability`
- `tintin-code-index`
- `tintin-release-operations`
Estos 16 Skills son instrucciones ligeras de trabajo enfocadas en tareas reales; NO agregan librerías ni hacen cambios automáticos en la web.

## Skills propios existentes conservados
`audit-tintin`, `fix-bug`, `release-check` y `security-audit`. Se preservaron las variantes de Claude y Codex anteriores. No sustituir sus políticas existentes.

## Usar en Codex Cloud / Claude Code Cloud
1. Abrir una nueva tarea con `tintinaccs/tintin-web` sobre una versión que incluya los cambios; si la sesión estaba abierta antes, actualizar/reiniciar su workspace para verlos.
2. Ejemplo de pedido: "Auditá el responsive de ficha de producto. Usá tintin-design-quality, tintin-accessibility y, solo si aporta, frontend-design. Respetá DESIGN.md. No modifiques código hasta informar hallazgos".
3. Para errores: usar `fix-bug` y, si corresponde, `systematic-debugging`, `tintin-tests-evidence`.
4. Para ahorrar tokens: usar `tintin-agent-efficiency`, lectura por alcance y verificación focalizada; no activar todos los Skills para cada tarea.
5. Un Skill encontrado en el disco **no prueba** que el host lo haya descubierto: confirmar desde una sesión nueva y documentar el resultado.

## Linux cloud (sin instalar en Windows)
- Verificación de metadatos y archivos sin dependencias externas: `python3 scripts/agent/check-cloud-skills.py`.
- Instalación opcional en directorio efímero de un agente Linux (no en tu PC):
  `bash scripts/agent/bootstrap-cloud-linux.sh --prefix "$RUNNER_TEMP/tintin-agent-skills"`
- El workflow `.github/workflows/cloud-agent-skills-linux.yml` valida y copia los Skills en un runner temporal de GitHub Actions con permisos mínimos, sin ejecutar los scripts de terceros.
- El runner Linux de Actions desaparece al acabar el trabajo. Para agentes Codex/Claude Cloud el checkout del repositorio ofrece los Skills del proyecto sin instalación global.
- Sin permisos para configurar los servidores reales del proveedor, no se puede afirmar instalación permanente en toda la infraestructura Linux ni ejecución real del skill desde cada host.

## Cobertura y exclusiones
Diseño e identidad, contenido, responsive, accesibilidad, rendimiento, seguridad, autenticación, Firestore, integraciones, SEO, indexación, catálogo, checkout, inventario, testing, observabilidad, GitHub CI/CD, release, mantenimiento, mapas de código y ahorro de tokens.

- `Agent Skills`: estándar de empaquetado, no Skill independiente para instalar.
- `Graphify`: aplicación externa para analizar repositorios, no instalada como CLI. `tintin-code-index` cubre trazado básico sin dependencia. Cualquier instalación futura de Graphify necesita evaluación y entorno compatible.
- `Chat Party Skills`: nombre sin repositorio verificado, por seguridad no se instaló uno desconocido.
- Los catálogos Anthropic, Matt Pocock y Superpowers incluyen muchas habilidades no aplicables al stack; se seleccionaron las pertinentes. No se presupone que más Skills mejoren el proyecto.

## Precedencia y seguridad
`AGENTS.md`, `.claude/CLAUDE.md`, `DESIGN.md`, `docs/identidad-visual-tintin.md` y las reglas de producción prevalecen. Un Skill externo no puede autorizar instalar paquetes no aprobados, ejecutar scripts remotos, cambiar producción, acceder a secretos ni eludir protecciones de rama. El trabajo de este PR solo instala documentación/Skills y un validador de Linux; no altera código de clientes, checkout, Firestore ni despliegue.

## Validación y mantenimiento
La revisión está fijada en `docs/agent/CLOUD_SKILLS_LOCK.json` y en la tabla anterior. No hay actualizaciones automáticas de terceros. Antes de actualizarlos, revisar diferencias, licencias, instrucciones y posibles riesgos. El workflow Linux comprueba estructura y copia de archivos; el test de activación requiere ejecutar una tarea en los clientes de Codex/Claude de forma explícita.

## Skills adicionales conservados durante la integración
Se detectaron en la misma rama de trabajo y se preservaron, además de los 26 nuevos y los cuatro existentes:
`receiving-code-review`, `requesting-code-review`, `test-driven-development`, `writing-for-agents`, `writing-plans`, `tintin-architecture-integrations`, `tintin-commerce-integrity`, `tintin-data-index-sync`, `tintin-design-engineering`, `tintin-observability-recovery`, `tintin-performance-loading`, `tintin-qa-release`, `tintin-responsive-a11y`, `tintin-security-privacy` y `tintin-seo-discoverability`. En total quedan 45 carpetas de Skills por agente en esta rama.

**Presupuesto de contexto:** tener 45 Skills no significa activar los 45. Algunos hosts pueden resumir o truncar metadatos cuando hay muchos; es preferible llamar explícitamente al Skill apropiado y consultar este catálogo. Los Skills de enfoque superpuesto son alternativas, no pasos obligatorios acumulativos. Evitar ejecutar suites de pruebas redundantes.

El script complementario `scripts/check-cloud-skills-linux.sh` fue conservado para el caso opcional de enlazar los Skills a un HOME Linux efímero. El workflow de Linux principal es `.github/workflows/cloud-agent-skills-linux.yml`, que hace una única verificación automática y una copia aislada; no se ejecutan dos workflows redundantes.
