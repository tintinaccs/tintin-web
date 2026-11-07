# Seguimiento obligatorio de GitHub

Todo agente debe seguir la regla de `AGENTS.md` al crear/modificar PRs o iniciar
Actions: esperar su resultado terminal, revisar fallos y verificar el SHA actual.
Registrar PR, SHA, run, intento, conclusión y enlace en el cierre. Nunca informar
SUCCESS de un SHA anterior tras un push ni tratar auto-merge como merge realizado.

GitHub emite un recibo por workflow terminado e intento mediante
el job `notify` de `auditoria-dependencias.yml`; incluye success, failure, cancelled, timed_out y
cualquier otra conclusión, con enlace al run. Los PR cerrados emiten merged o
closed_without_merge. Los runs sin PR se registran en un issue central. Los
comentarios son deduplicados por run/intento y el workflow de mantenimiento se excluye a sí mismo para evitar recursión. Las comprobaciones y logs de sus jobs de dependencias/merge se siguen consultando directamente; el cierre de PR sí emite su recibo. Se conserva el presupuesto de12 workflows.
No ejecuta código de PRs ni descarga artefactos con permisos de escritura.

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

## Vigilancia configurada el 2026-11-03

Por pedido explícito de la titular se habilitó **Atender fallos de CI de Tintín**, una automatización externa horaria para main y PR abiertas de este repositorio. Investiga X/failure, errores, timeouts, action_required y advertencias accionables; clasifica skipped por `if`/`needs`, sin convertir un skip previsto en fallo ni reintentar controles indiscriminadamente. Deduplica por SHA/run/intento y conserva las reparaciones activas de otros agentes. Sigue reparaciones y merge sólo dentro de las autorizaciones vigentes; no autoriza operaciones comerciales reales, despliegues manuales, secretos ni bypass.

La API confirmó creación/habilitación. Primer disparo registrado2026-11-03T02:24:49Z; se recibió el prompt en este hilo y se retomó la inspección real de main/PR. Esto acredita activación programada, sin prometer recepción inmediata de eventos ni invocación nativa de Skills en otro host. Esta sesión no expone `discover_webhook_schema` ni parámetros de triggers; por ello se informó expresamente que es sondeo horario, no recepción instantánea de eventos. La tarea depende de disponibilidad y acceso del producto; los recibos de GitHub siguen siendo autoridad. Un agente futuro debe verificar que continúe habilitada y leer su última ejecución antes de afirmar vigilancia efectiva. No agregar un workflow paralelo ni prometer que un comentario despierte Codex.

## Integridad protegida antes de integrar — incidente1331

La protección clásica exige cuatro checks, pero al2026-11-04 no exige `Protected flow maintenance` ni `Protected flow integrity`. El ruleset18212422 no añade estos checks. Repository audit aprobado en una PR no sustituye la validación de hashes/plan del mantenedor confiable; su job Protected flows se ejecuta en main/dispatch. Antes de cualquier merge manual, comprobar ambos controles del SHA vigente, además de los cuatro checks actuales y las demás reglas. Si faltan o fallan, corregir el plan/base, seguir la ejecución canónica y esperar; no anticipar éxito ni integrar por tener únicamente la CI funcional verde.

La propuesta administrativa para exigir ambos en GitHub está en [REQUIRED_CHECKS_20261104.md](REQUIRED_CHECKS_20261104.md). Está documentada como NO APLICADA hasta verificar configuración remota; no inventar permiso de administración ni cambiar credenciales. Esta instrucción conserva el mantenedor existente y no introduce otro flujo de publicación.
