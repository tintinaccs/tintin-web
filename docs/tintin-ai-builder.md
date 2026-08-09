# TINTÍN AI Builder — guía breve

## Uso para la dueña

1. Iniciá sesión con la cuenta Super Admin `tintinaccs@gmail.com`.
2. Abrí **TINTÍN AI Builder** en el Super Panel Admin.
3. Escribí el cambio en lenguaje natural y elegí **Preparar propuesta**.
4. Revisá la clasificación y la vista previa en celular, tablet y escritorio.
5. Elegí **Aprobar y publicar**, **Pedir modificación** o **Cancelar**.
6. Para volver atrás, usá **Restaurar** en una versión del historial. La restauración crea una versión nueva y conserva la auditoría.

Nada se publica al preparar una propuesta. La publicación siempre requiere una acción explícita de la cuenta Super Admin.

## Arquitectura

- `functions/api/ai-builder.js`: API privada, validación Firebase server-side, límites, propuestas, publicación, historial y rollback.
- `cloudflare/ai-builder-core.js`: política, clasificación, bloques permitidos y sanitización.
- `cloudflare/ai-provider.js`: adaptador desacoplado. Usa OpenAI Responses API si existe el secreto; sin él usa el planificador determinístico seguro.
- `functions/api/ai-builder-public.js`: lectura pública cacheada de la versión aprobada.
- `js/admin/ai-builder-admin.js`: conversación, aprobación, preview y restauración.
- `js/ai-builder-public.js`: render seguro en la home debajo del banner.

Los datos se almacenan vía credencial de servicio en `aiBuilder/state`, `aiBuilderProposals`, `aiBuilderHistory` y `aiBuilderUsage`. No se cambian Firestore Rules ni se concede acceso directo del navegador a esas colecciones.

## Secretos de Cloudflare

Configurar como secretos cifrados, nunca como variables públicas ni archivos:

- `OPENAI_API_KEY`: habilita el proveedor de IA. Es el único secreto pendiente para el modo IA; sin él la versión sigue funcionando con clasificación y bloques determinísticos seguros.
- `GITHUB_TOKEN`: token mínimo con acceso al repositorio para crear ramas y PR en cambios complejos.

Variables no secretas opcionales: `OPENAI_MODEL` (por defecto `gpt-5.6-luna`), `GITHUB_REPOSITORY` (por defecto `tintinaccs/tintin-web`), `GITHUB_BASE_BRANCH` (por defecto `main`) y `CLOUDFLARE_PAGES_PROJECT`.

El sitio ya requiere `FIREBASE_SERVICE_ACCOUNT_KEY` para Pages Functions existentes. No duplicar ni exponer esa credencial.

## Seguridad y límites

- Cuenta elevada comprobada por email verificado en Firebase tanto en UI como en servidor.
- Solicitud máxima: 1.200 caracteres; body máximo: 12 KB.
- Máximo: 10 propuestas/hora y una cada 8 segundos.
- Timeout del proveedor: 12 segundos; salida limitada y vuelta a esquema seguro.
- Bloqueo previo de prompt injection y solicitudes sobre pagos, precios, pedidos, usuarios, credenciales, Firestore Rules, producción y `main`.
- Sólo se renderizan siete tipos de bloque con URLs internas y colores validados.
- Los cambios complejos crean rama y PR borrador; nunca modifican `main` ni publican contenido directamente.
- Restaurar solo acepta entradas de historial de tipo `publish` o `restore` con una versión publicada real (`isRestorableHistoryEntry` en `cloudflare/ai-builder-core.js`): una entrada de propuesta, modificación, cancelación o PR técnico nunca puede sobrescribir el contenido publicado.
