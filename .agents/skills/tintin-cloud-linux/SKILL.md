---
name: tintin-cloud-linux
description: "Use when preparing cloud-only Linux Codex and Claude Code tasks or checking cloud Skills without installing anything on the user's PC."
---

# Skills en Linux nube — sin PC local
1. En Codex Cloud leer el repositorio por .agents/skills; en Claude Code Cloud por .claude/skills.
2. Ejecutar opcionalmente bash scripts/check-cloud-skills-linux.sh --check para revisar disponibilidad de carpetas y SKILL.md.
3. Solo si la sesión Linux requiere Skills a nivel de usuario, usar bash scripts/check-cloud-skills-linux.sh --install-user; crea enlaces simbólicos idempotentes sin sudo y sin sobrescribir Skills ya existentes.
4. Nunca instalar vía apt, curl|bash, npm global o pip global por defecto. No instalar herramientas del servidor de producción.
5. Los Skills se versionan en GitHub; el Linux efímero los obtiene por checkout. No confundir esto con instalar Skills en claude.ai o ChatGPT web.
6. No asumir red, Node, Python, Playwright ni privilegios: comprobarlos antes de pedirlos.
7. No ejecutar scripts auxiliares externos sin revisar seguridad y dependencias.
