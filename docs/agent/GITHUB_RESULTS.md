# Seguimiento obligatorio de GitHub

Todo agente debe seguir la regla de `AGENTS.md` al crear/modificar PRs o iniciar
Actions: esperar su resultado terminal, revisar fallos y verificar el SHA actual.
Registrar PR, SHA, run, intento, conclusión y enlace en el cierre. Nunca informar
SUCCESS de un SHA anterior tras un push ni tratar auto-merge como merge realizado.

GitHub emite un recibo por workflow terminado e intento mediante
`notificar-resultados.yml`; incluye success, failure, cancelled, timed_out y
cualquier otra conclusión, con enlace al run. Los PR cerrados emiten merged o
closed_without_merge. Los runs sin PR se registran en un issue central. Los
comentarios son deduplicados por run/intento y el workflow se excluye a sí mismo.
No ejecuta código de PRs ni descarga artefactos con permisos de escritura.
Este receptor tiene una excepción nominativa al presupuesto de workflows: los
otros workflows operativos siguen limitados a 12 y se conserva un único
pipeline de PR. El auditor comprueba su checkout de la rama confiable y prohíbe
permisos de escritura de código, administración de Actions y OIDC.

Para recibir avisos personales, suscribirse al PR y al issue de resultados y
habilitar las notificaciones web/email deseadas en la cuenta GitHub. Esas
preferencias personales no se pueden imponer mediante branch protection.

Un comentario de GitHub no despierta un agente dormido de Codex. Durante la
sesión, usar `gh pr checks NUMERO --watch --fail-fast` y
`gh run watch RUN_ID --exit-status`, luego verificar intentos/SHA y logs por API.
Fuera de la sesión se requiere un receptor webhook soportado por el producto,
con alcance de repositorio y eventos de finalización. Si las herramientas no
exponen dicho receptor, declarar ese bloqueo concreto; no inventar una URL de
callback, no prometer notificaciones en Codex ni sustituir eventos por sondeo
sin explicarlo. GitHub conserva los recibos para la próxima sesión de cualquier
agente y el estado real sigue estando en los checks/runs.
