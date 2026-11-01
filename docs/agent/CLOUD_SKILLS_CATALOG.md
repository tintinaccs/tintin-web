# Skills compartidos de Tintín — Codex Cloud y Claude Code Cloud

## Objetivo y funcionamiento
Los Skills versionados en este repositorio se descubren en sesiones **nuevas** que carguen la rama/commit correspondiente: `.agents/skills/<nombre>/SKILL.md` (Codex) y `.claude/skills/<nombre>/SKILL.md` (Claude Code). No dependen de una instalación en la PC de la propietaria. En sesiones ya abiertas podría hacer falta reiniciar o refrescar el entorno. Estos archivos NO se importan al bundle público del e-commerce.

**Importante:** descubrir un Skill no significa ejecutarlo para cada tarea; se selecciona por coincidencia de tarea o por solicitud explícita. Los Skills externos no reemplazan `AGENTS.md`, `.claude/CLAUDE.md`, `DESIGN.md`, la identidad aprobada ni la arquitectura y reglas comerciales.

## Skills de terceros incorporados
| Skill visible | Proyecto de origen | Archivo de origen | Uso |
|---|---|---|---|
| `design-taste-frontend` | https://github.com/Leonxlnx/taste-skill | `skills/taste-skill/SKILL.md` | Dirección artística y evitar diseños genéricos |
| `ui-ux-pro-max` | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | `.claude/skills/ui-ux-pro-max/SKILL.md` | UX, accesibilidad, responsive y patrones UI |
| `ponytail` | https://github.com/DietrichGebert/ponytail | `skills/ponytail/SKILL.md` | Minimalismo de ingeniería, opcional |
| `caveman` | https://github.com/JuliusBrussee/caveman | `skills/caveman/SKILL.md` | Modo de respuesta conciso, solo por pedido |
| `code-review` | https://github.com/mattpocock/skills | `skills/engineering/code-review/SKILL.md` | Revisión de cambios |
| `handoff` | https://github.com/mattpocock/skills | `skills/productivity/handoff/SKILL.md` | Transferencia de contexto |
| `systematic-debugging` | https://github.com/obra/superpowers | `skills/systematic-debugging/SKILL.md` | Diagnóstico de bugs |
| `verification-before-completion` | https://github.com/obra/superpowers | `skills/verification-before-completion/SKILL.md` | Evidencia y verificación |
| `frontend-design` | https://github.com/anthropics/skills | `skills/frontend-design/SKILL.md` | Diseño frontend distintivo |

Los Skill originals están almacenados en el repositorio, no invocados por descarga dinámica. Los avisos de licencia están en `docs/agent/vendor-licenses/`. Para reproducibilidad, los objetos Git de los SKILL.md conservan su SHA de contenido. Verificar las herramientas externas opcionales indicadas por cada Skill antes de usarlas.

## Qué no es un Skill instalable directamente
- **Agent Skills** es la especificación/formato, no una habilidad única para instalar.
- **Graphify-Labs/graphify** es una herramienta de análisis de código; no se debe declarar su CLI instalada simplemente por poner un SKILL.md en el repositorio. Requiere integración/entorno compatible separado.
- **Chat Party Skills** no ha podido identificarse con una URL de origen inequívoca; no instalar paquetes homónimos al azar.
- **Anthropic Skills** y **Superpowers** son colecciones grandes; se han seleccionado Skills directamente pertinentes, no sus catálogos completos.

## Política técnica
1. Antes de alterar UI, leer `DESIGN.md` y el documento de identidad oficial; no introducir paletas, fuentes ni componentes genéricos.
2. Antes de alterar funciones, respetar `AGENTS.md`, `.claude/CLAUDE.md` y la documentación `docs/agent/`.
3. Las bibliotecas de datos, scripts y comandos auxiliares que un Skill referencie solo pueden usarse si realmente están presentes y han sido revisados. No ejecutar scripts de terceros de forma automática.
4. Documentar el origen de cada Skill, revisar actualizaciones y licencias. Las actualizaciones NO son automáticas.
5. Usar pruebas no destructivas, PRs y protección de rama para cualquier cambio.
6. No asegurar funcionamiento en todos los agentes o clientes web: cada plataforma tiene un mecanismo de descubrimiento distinto.

## Prueba de descubrimiento sugerida
Abrir una **nueva** tarea de Codex Cloud / Claude Code Cloud en el commit donde estos archivos estén integrados. Pedir: "Enumerá los Skills de diseño disponibles en el repositorio y mostrá sus rutas, sin modificar nada". Deben aparecer, por ejemplo, `design-taste-frontend`, `ui-ux-pro-max`, `frontend-design`. Verificar ejecución real con una tarea de lectura; no asumir que la mera existencia de archivos demuestra activación.

## Snapshot de origen (commit fijado)
- Taste Skill: `Leonxlnx/taste-skill@12af471f627f866411b4bd785b19646d3672784c`
- UI UX Pro Max: `nextlevelbuilder/ui-ux-pro-max-skill@3a13158ff1f32156cbe144108de48eda2ecaed9a`
- Ponytail: `DietrichGebert/ponytail@96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`
- Caveman: `JuliusBrussee/caveman@9b68f7ed12b05e7efaff18e65c5a3fc2849fd0a4`
- Matt Pocock: `mattpocock/skills@4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`
- Superpowers: `obra/superpowers@2ce8aa15d05bd57213e6f746f953aafb7ded7a8b`
- Anthropic: `anthropics/skills@ca45fc496a3436251f191354091d557da31c15b5`

Se incluyen archivos SKILL.md reales y recursos auxiliares pertinentes: biblioteca, referencias y scripts de Taste Skill; datos, referencias y scripts de UI UX Pro Max; recursos de depuración de Superpowers; metadatos opcionales de Matt Pocock y licencias de redistribución. No se incluyen pruebas/evaluaciones del proyecto de origen que no son necesarias para invocar estas habilidades, ni imágenes binarias adicionales.

Además, los cuatro Skills de Codex que ya estaban en `.codex/skills/` se exponen SIN ELIMINARLOS también en la ruta oficialmente detectable `.agents/skills/`, para que nuevas sesiones puedan encontrarlos.

## Ampliación A-Z: especialistas externos y Skills propios de Tintín

### Especialistas externos adicionales
- `webapp-testing` — `anthropics/skills@ca45fc496a3436251f191354091d557da31c15b5`, con `scripts/with_server.py` y licencia; Playwright es una capacidad del entorno, no una dependencia que se instala sin permiso.
- `test-driven-development` — `obra/superpowers@2ce8aa15d05bd57213e6f746f953aafb7ded7a8b`; uso selectivo, respetando la estructura de pruebas existente.
- `writing-plans` — mismo origen; planes para tareas amplias, sin imponerse sobre pedidos de implementación directa.
- `requesting-code-review` y `receiving-code-review` — mismo origen; revisión y tratamiento técnico del feedback.
- `writing-for-agents` — `mattpocock/skills@4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`, junto a `SKILL-MECHANICS.md`; mejora instrucciones y transferencia de contexto.

### Skills internos nuevos para todo el ciclo de la web
| Skill | Área |
|---|---|
| `tintin-agent-efficiency` | Tokens, búsquedas dirigidas, cambios mínimos y pruebas selectivas |
| `tintin-brand-copy` | Textos reales, identidad editorial y eliminación de clichés de IA |
| `tintin-design-engineering` | Componentes y estilos, tokens, estado visual |
| `tintin-responsive-a11y` | Responsive y accesibilidad |
| `tintin-performance-loading` | Rendimiento, loaders, imágenes y Core Web Vitals |
| `tintin-security-privacy` | Seguridad, autorización, secretos y privacidad |
| `tintin-commerce-integrity` | Carrito, pedidos, precios, inventario y checkout |
| `tintin-data-index-sync` | Datos, búsqueda, índices y sincronización |
| `tintin-seo-discoverability` | SEO, rastreo y metadatos |
| `tintin-architecture-integrations` | Arquitectura, Firebase/Cloudflare e integraciones |
| `tintin-cloud-linux` | Linux de nube y descubrimiento de Skills |
| `tintin-qa-release` | PRs, CI, seguimiento y release |
| `tintin-observability-recovery` | Errores, diagnósticos e incidentes |

Todos los Skills propios remiten a `AGENTS.md`, `.claude/CLAUDE.md`, `DESIGN.md` y contratos de Tintín, no inventan subsistemas ni prescriben nuevas dependencias.

### Linux de nube
Script: `scripts/check-cloud-skills-linux.sh`.
- `bash scripts/check-cloud-skills-linux.sh --check`: verifica estructura de todos los Skills y recursos clave, **sin instalar nada**.
- `bash scripts/check-cloud-skills-linux.sh --install-user`: realiza la verificación y crea enlaces simbólicos en `$HOME/.agents/skills` y `$HOME/.claude/skills` del **Linux donde se ejecuta**; si ya hay un archivo o Skill de usuario con el mismo nombre, lo conserva. No usa sudo, npm, pip, apt, curl ni descargas.
- Workflow `.github/workflows/cloud-skills-linux.yml`: comprueba en runner efímero Ubuntu y ejercita el modo de instalación de usuario; esos enlaces se eliminan cuando termina el runner. Un nuevo checkout en Codex Cloud / Claude Code Cloud ve Skills del repositorio sin ese paso adicional.
- No se han instalado Skills permanentemente en una cuenta claude.ai, ChatGPT web ni en un servidor Linux externo. Esas superficies no comparten automáticamente el filesystem del checkout.
- Los scripts originales se incluyen como material de Skill, **no se ejecutan automáticamente**; sus dependencias deben verificarse antes de su uso.

### Por qué no instalar literalmente todos los Skills de internet
Miles de Skills implican más metadatos para examinar, superposición de instrucciones, riesgos de cadenas de suministro y más código innecesario. Se incluyen especialistas por función y se activan bajo demanda. La prioridad de seguridad y negocio prevalece sobre cualquier Skill externo. Nuevas incorporaciones requieren procedencia, necesidad concreta y compatibilidad revisada.
