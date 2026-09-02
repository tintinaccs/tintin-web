# Arquitectura operativa canónica — Tintin Web

Este documento define una sola autoridad por responsabilidad. Si un servicio contradice esta matriz, prevalece esta arquitectura y el contrato `scripts/auditar-integraciones-canonicas.mjs` debe fallar.

## Autoridades

| Dominio | Autoridad | Rol |
| --- | --- | --- |
| Código y revisiones | GitHub `tintinaccs/tintin-web` | Fuente del código, PR y CI |
| Gate de PR | `.github/workflows/auditar-tintin.yml` | Único workflow GitHub disparado por PR; mantiene el check requerido `Repository audit` |
| Web y `/api/*` | Cloudflare Pages + Pages Functions | Entrega web y backend edge canónico |
| Origen público | `config/public-site.json` | Host público, Auth domain y cutover |
| Firebase | proyecto `tintin-accesorios` | Auth, Firestore, App Check y FCM; no Hosting ni Functions activos |
| Reglas Firestore | `firestore.rules` + `firebase.json` | Autorización de datos |
| Sheets / Apps Script | `cloudflare/sheets-sync-config.js` | Espejo/sincronización operativa; nunca autoridad del storefront |
| Correo | Resend desde backend | Envío server-side; secretos fuera del frontend |
| Multimedia | Cloudinary mediante endpoints firmados | Almacenamiento/media; secretos server-side |
| Pagos | PayPal mediante Pages Functions | Creación/captura server-side |
| Backups Firestore | `backup-firestore.yml` | Export programado y restauración explícita |

## GitHub Actions desfragmentado

Los scripts `scripts/auditar-*` se conservan como unidades reutilizables, pero no necesitan un workflow individual. Un PR normal ejecuta un único workflow (`Repository audit`). Las tareas que dependen del tiempo o de un operador permanecen separadas: salud de producción, auditoría visual programada, backups, sincronización de Sheets, mantenimiento de ramas, dependencias y Diagnóstico Maestro manual.

GitHub Pages queda únicamente como fallback manual. No se publica en cada push porque duplicar Cloudflare y GitHub Pages como hosts activos crea dos estados de producción distintos.

## Firebase y Google Cloud

`firebase.json` solo registra las reglas de Firestore. El directorio `firebase-cloud-functions-inactive/` es histórico y no forma parte del runtime. No debe existir un workflow que despliegue Firebase Functions. Las credenciales de servicio se inyectan como secretos de GitHub/Cloudflare y nunca se versionan.

## Sheets

La URL de Apps Script vive del lado servidor en `cloudflare/sheets-sync-config.js`. El navegador no debe llamar directamente al deployment de Apps Script. La cola `catalogSheetSyncQueue` se drena mediante el workflow operativo programado y acepta temporalmente ambos nombres de credencial Firebase (`FIREBASE_SERVICE_ACCOUNT_JSON` y el alias heredado `FIREBASE_SERVICE_ACCOUNT_KEY`) durante la transición.

## Regla de cambio

No crear un workflow nuevo para una auditoría que pueda agregarse al gate central o al Diagnóstico Maestro. Un workflow nuevo solo se justifica si tiene una cadencia/permiso/efecto operativo distinto. El contrato canónico limita la cantidad total de workflows y exige que solo `auditar-tintin.yml` responda a `pull_request`.
