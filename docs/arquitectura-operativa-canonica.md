# Arquitectura operativa canónica — Tintin Web

Este documento define una sola autoridad por responsabilidad. Si un servicio contradice esta matriz, prevalece esta arquitectura y el contrato `scripts/auditar-integraciones-canonicas.mjs` debe fallar.

## Autoridades

| Dominio | Autoridad | Rol | Responsable | Estado verificado |
| --- | --- | --- | --- | --- |
| Código y revisiones | GitHub `tintinaccs/tintin-web` | Fuente del código, PR y CI | Propietaria de Tintin (repo) | 🟢 Verificado — `main` y rama de trabajo sincronizadas, gate de PR activo |
| Gate de PR | `.github/workflows/auditar-tintin.yml` | Único workflow GitHub disparado por PR; mantiene el check requerido `Repository audit` | CI (automatizado) | 🟢 Verificado — `npm run audit:final` en verde, 0 fallas |
| Web y `/api/*` | Cloudflare Pages + Pages Functions | Entrega web y backend edge canónico | Propietaria de Tintin (panel Cloudflare) | 🟢 Verificado en producción — `curl` directo a `https://tintinaccesorios.pages.dev/` confirma CSP con hashes `sha256-` por script, HSTS, COOP, `X-Tintin-CSP: edge-runtime`; assets versionados idénticos a la rama local |
| Origen público | `config/public-site.json` | Host público, Auth domain y cutover | Propietaria de Tintin | 🟢 Verificado |
| Firebase | proyecto `tintin-accesorios` | Auth, Firestore, App Check y FCM; no Hosting ni Functions activos | Propietaria de Tintin (consola Firebase) | 🟢 Verificado en producción — `GET /api/health` confirma `FIREBASE_SERVICE_ACCOUNT_KEY` presente y runtime admin operativo; código de persistencia/perfil/onboarding revisado. Flujo interactivo de login (Google/email-password) no ejecutable desde este entorno (ver limitación abajo) |
| Reglas Firestore | `firestore.rules` + `firebase.json` | Autorización de datos | Propietaria de Tintin | 🟢 Verificado — respaldo probado (PITR 7 días + diario 30 días + semanal 84 días; restauración validada 2026-08-08) |
| Sheets / Apps Script | `cloudflare/sheets-sync-config.js` | Espejo/sincronización operativa; nunca autoridad del storefront | Propietaria de Tintin (Cloudflare env vars) | 🟡 Código preparado: sin `SHEETS_ENGAGEMENT_SECRET` responde `deferred:true` (no falsea éxito) y encola reintento con backoff. La comparación `sameSecret()` falla igual (cerrado) con secreto ausente o incorrecto, por lo que su presencia real en Cloudflare no es distinguible desde fuera sin el valor real |
| Correo | Resend desde backend | Envío server-side; secretos fuera del frontend | Propietaria de Tintin (Cloudflare env vars) | 🟢 Verificado en producción — `GET /api/health` confirma `RESEND_API_KEY` presente y funcional; código valida error explícito 500 y cola `orderEmailQueue` para fallos parciales |
| Multimedia | Cloudinary mediante endpoints firmados | Almacenamiento/media; secretos server-side | Propietaria de Tintin (Cloudflare env vars) | 🟢 Verificado en producción — `GET /api/health` confirma `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` presentes y funcionales; firma de subida/borrado restringida por prefijo en el código |
| Pagos | PayPal mediante Pages Functions | Creación/captura server-side | Propietaria de Tintin (Cloudflare env vars + cuenta PayPal) | 🟢 Verificado en producción — `GET /api/paypal-config` responde `enabled:true`, entorno sandbox, `unavailableReasons` vacío y tasa de cambio actualizada; nunca expone el client secret |
| Analítica (GA4) | `settings/general.ga4MeasurementId` (Firestore) vía `js/analytics/analitica.js` | Carga condicionada a consentimiento y App Check | Propietaria de Tintin (Firestore) | 🟡 Código verificado — el measurement ID no está hardcodeado en el HTML/JS público (se lee de Firestore recién tras consentimiento + App Check listo); lectura en vivo del valor de `settings/general` no ejecutable desde este entorno sin credenciales/App Check |
| Backups Firestore | `backup-firestore.yml` | Export programado y restauración explícita | CI (automatizado) + Propietaria de Tintin | 🟢 Verificado — 960/960 documentos restaurados en prueba aislada `restauracion-prueba` (2026-08-08); copia externa cifrada en proveedor independiente pendiente |

Esta columna se actualiza en cada auditoría integral (última: 2026-09-11, con verificación directa contra `https://tintinaccesorios.pages.dev`). Leyenda: 🟢 verde = funciona en producción con evidencia directa (respuesta HTTP real, código leído y consistente); 🟡 amarillo = código preparado y seguro pero un dato externo (secreto, configuración, sesión interactiva) no es verificable desde este entorno; 🔴 rojo = falla reproducible. Ningún estado se basa solo en auditorías locales o suposiciones.

## GitHub Actions desfragmentado

Los scripts `scripts/auditar-*` se conservan como unidades reutilizables, pero no necesitan un workflow individual. Un PR normal ejecuta un único workflow (`Repository audit`). Las tareas que dependen del tiempo o de un operador permanecen separadas: salud de producción, auditoría visual programada, backups, sincronización de Sheets, mantenimiento de ramas, dependencias y Diagnóstico Maestro manual.

GitHub Pages queda únicamente como fallback manual. No se publica en cada push porque duplicar Cloudflare y GitHub Pages como hosts activos crea dos estados de producción distintos.

## Firebase y Google Cloud

`firebase.json` solo registra las reglas de Firestore. El directorio `firebase-cloud-functions-inactive/` es histórico y no forma parte del runtime. No debe existir un workflow que despliegue Firebase Functions.

La cuenta de servicio Firebase permanece en el backend Cloudflare, donde ya se necesita para las operaciones administrativas. El scheduler de GitHub no debe duplicar esa clave privada en Actions: para tareas server-to-server se usa identidad federada OIDC de GitHub y el backend valida repositorio, rama, workflow, evento, audiencia, vigencia y firma antes de ejecutar.

## Sheets

La URL de Apps Script vive del lado servidor en `cloudflare/sheets-sync-config.js`. El navegador no debe llamar directamente al deployment de Apps Script.

La cola `catalogSheetSyncQueue` se drena cada 15 minutos desde `.github/workflows/drenar-cola-sync-catalogo.yml`, pero GitHub actúa únicamente como reloj. El workflow obtiene un token OIDC efímero y llama a `/api/catalog-sheet-sync-drain`; Cloudflare verifica la identidad de GitHub y ejecuta el drenaje con sus propias credenciales Firebase y `SHEETS_ENGAGEMENT_SECRET`.

Esto evita mantener una segunda copia de `FIREBASE_SERVICE_ACCOUNT_JSON`/`FIREBASE_SERVICE_ACCOUNT_KEY` en GitHub Actions y elimina los fallos programados causados por secretos Firebase ausentes en GitHub.

## Correos

`/api/order-email` envía la confirmación de pedido de forma síncrona a la solicitud del cliente. Si un canal (admin o cliente) falla, el intento fallido se encola en `orderEmailQueue` sin bloquear ni romper la respuesta al cliente.

La cola `orderEmailQueue` se drena cada 15 minutos desde `.github/workflows/drenar-cola-correo-pedidos.yml`, con el mismo patrón que `catalogSheetSyncQueue`: GitHub actúa únicamente como reloj, obtiene un token OIDC efímero y llama a `/api/order-email-drain`; Cloudflare verifica la identidad de GitHub (repositorio, rama, workflow, audiencia `tintin-order-email-retry`) y ejecuta el drenaje con sus propias credenciales Firebase y `RESEND_API_KEY`.

Cada tarea de la cola se reclama con bloqueo optimista sobre `updateTime` para evitar reenvíos duplicados en paralelo, reintenta con backoff creciente y pasa a `dead_letter` (con alerta idempotente al admin) tras 8 intentos. El reintento llama a `sendOrderEmails` con `isResend:false`, reutilizando el mismo sufijo de idempotencia del intento original para que Resend no duplique un envío que en realidad sí llegó a salir.

## Regla de cambio

No crear un workflow nuevo para una auditoría que pueda agregarse al gate central o al Diagnóstico Maestro. Un workflow nuevo solo se justifica si tiene una cadencia/permiso/efecto operativo distinto. El contrato canónico limita la cantidad total de workflows y exige que solo `auditar-tintin.yml` responda a `pull_request`.

Las tareas programadas que necesiten privilegios del backend deben preferir OIDC o una identidad federada de corta duración antes que duplicar claves privadas estáticas entre plataformas.
