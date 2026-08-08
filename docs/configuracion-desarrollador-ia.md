# Desarrollador IA

Estado: **preparado y apagado por defecto**. No existe una simulación ni una llamada desde el navegador a OpenAI.

## Arquitectura

El panel crea un trabajo en `aiDeveloperJobs` mediante Cloudflare. El servidor valida token Firebase, correo verificado, UID exacto, rol `superadmin` y el permiso booleano `aiDeveloperEnabled`. Cloudflare despacha el workflow aislado; Codex modifica una rama nueva, ejecuta controles y abre un PR. El workflow informa hitos mediante un callback autenticado. Firestore niega acceso directo a toda la colección.

## Configuración manual obligatoria

1. Resolver la identidad: hoy el Super Admin canónico del repositorio es `tintinaccs@gmail.com`, mientras que la cuenta solicitada para IA es `teamdinas@gmail.com`. No asignar `superadmin` ni `aiDeveloperEnabled` hasta decidir y verificar el UID propietario.
2. Cloudflare: definir `AI_DEVELOPER_ENABLED=true`, `AI_DEVELOPER_ALLOWED_UID`, `AI_DEVELOPER_ALLOWED_EMAIL`, `AI_DEVELOPER_GITHUB_REPO`, `AI_DEVELOPER_GITHUB_TOKEN` y `AI_DEVELOPER_CALLBACK_SECRET`.
3. GitHub Actions: definir `OPENAI_API_KEY`, `AI_DEVELOPER_CALLBACK_URL` (URL `/api/ai-developer`) y el mismo `AI_DEVELOPER_CALLBACK_SECRET`.
4. El token GitHub debe limitarse al repositorio y solo permitir Actions/contents/PR necesarios. Rotar ambos secretos ante cualquier sospecha.
5. Desplegar reglas y Cloudflare; probar primero una tarea inocua. La fusión siempre requiere revisión humana y CI verde.

## Garantías y límites

- Fail-closed si falta una variable, permiso o identidad.
- Prompt de 12–6.000 caracteres, hallazgos acotados y delimitados como datos no confiables.
- Rama por trabajo, concurrencia idempotente, timeout de 45 minutos y PR sin auto-merge.
- El estado `pr_open` no significa terminado. `completed` solo debe asignarse después del merge mediante una automatización futura autenticada.
