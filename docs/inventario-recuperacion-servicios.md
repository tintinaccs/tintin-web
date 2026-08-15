# Inventario de recuperación de servicios

Este documento registra qué debe recuperarse y dónde verificarlo. No debe contener secretos, contraseñas, tokens ni códigos de recuperación.

| Servicio | Activos críticos | Responsable | Método de recuperación | Copia externa | Última prueba | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| GitHub | Código, historial, ramas, tags, Releases, Actions y Pages | Propietaria de Tintin | Snapshot, Release y bundle verificado | Pendiente: segunda copia cifrada fuera de GitHub | 2026-08-06 | Código restaurable verificado; falta copia externa cifrada |
| Firebase | Proyecto, reglas, índices, Authentication y configuración | Propietaria de Tintin | Consola Firebase + configuración versionada; Firestore se recupera con los mecanismos detallados abajo | Parcial: configuración en GitHub; datos completos todavía dependen de Google | 2026-08-08 | Configuración versionada; recuperación de datos Firestore probada |
| Firestore | Productos, colecciones, usuarios, pedidos, configuración y auditoría | Propietaria de Tintin | PITR 7 días + backup diario 30 días + semanal 84 días + exportación administrada | **Pendiente fuera de Google**; el export actual vive en `gs://tintin-accesorios-respaldos` dentro de la misma cuenta | 2026-08-08 | **Restauración real verificada: 960/960 documentos** en base aislada; `DELETE_PROTECTION_ENABLED` |
| Cloudinary / imágenes | Originales, identificadores públicos, carpetas y URLs activas | Propietaria de Tintin | Exportación o copia de originales | Pendiente fuera de Cloudinary | Pendiente | Inventario lógico documentado; falta copia de originales y restauración de muestra |
| Cloudflare | DNS, reglas, Workers/Pages y acceso de cuenta | Propietaria de Tintin | Exportación de configuración y recuperación de cuenta | Pendiente | Pendiente | Requiere revisión manual |
| Correo | Cuenta, remitentes, plantillas y registros DNS | Propietaria de Tintin | Recuperación del proveedor y copia de configuración | Pendiente | Pendiente | Requiere revisión manual |
| Dominio | Registrador, DNS, renovación y contactos | Propietaria de Tintin | Recuperación del registrador y códigos de cuenta | Pendiente | Pendiente | Requiere revisión manual |

## Firestore: estado verificado y riesgo residual

La fuente de verdad operativa es `docs/recuperacion-firestore.md`. El 2026-08-08 se verificó contra el proyecto real:

- Point-in-Time Recovery habilitado con 7 días de retención.
- Backup programado diario con 30 días de retención.
- Backup programado semanal con 84 días de retención.
- Exportación completa de 960 documentos a `gs://tintin-accesorios-respaldos/2026-08-08`.
- Restauración aislada exitosa de 960/960 documentos en `restauracion-prueba`.
- Conteos comprobados: `products` 397, `orders` 10, `users` 11, `collections` 12 y `settings` 6.
- Protección contra borrado habilitada en la base productiva.

**Esto no cierra el riesgo de cuenta única.** PITR, backups programados y el bucket de exportación siguen bajo Google. El punto de recuperación externo solo se considera cerrado cuando exista al menos una copia completa, cifrada y restaurable bajo un proveedor/cuenta independiente de Google. No alcanza con copiar el export a otro bucket de la misma cuenta.

## Variables y credenciales

Registrar únicamente metadatos, nunca valores reales.

### Secretos reales

Los cinco secretos de producción viven exclusivamente en el runtime de
Cloudflare Pages. Ninguno se sirve al navegador: `scripts/auditar-imagenes-fase-5.js`
verifica que el API Secret de Cloudinary exista solo en Cloudflare, y el
`Repository audit` comprueba que no haya secretos de producción en el frontend.

| Nombre de variable | Servicio | Entorno | Ubicación segura | Responsable | Última rotación |
| --- | --- | --- | --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Sin fecha registrada — revisar antes del lanzamiento |
| `CLOUDINARY_API_KEY` | Cloudinary | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Sin fecha registrada — revisar antes del lanzamiento |
| `CLOUDINARY_API_SECRET` | Cloudinary | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Sin fecha registrada — revisar antes del lanzamiento |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Sin fecha registrada — revisar antes del lanzamiento |
| `RESEND_API_KEY` | Resend | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Sin fecha registrada — revisar antes del lanzamiento |
| `GITHUB_TOKEN` | GitHub Actions | CI | Generado automáticamente por cada run; no se almacena | GitHub | No aplica |

No hay ningún secreto declarado en `.github/workflows/**` más allá del
`GITHUB_TOKEN` automático.

### Identificadores públicos — no son secretos

Estos valores están en el código del frontend a propósito. Documentarlos evita
que se confundan con una filtración y que se intente «rotarlos» sin necesidad.

| Identificador | Dónde | Por qué es público |
| --- | --- | --- |
| `firebaseConfig.apiKey` | `js/core/firebase/firebase.js` | Identificador de proyecto de Firebase Web, no una credencial de acceso. La seguridad la dan las reglas de Firestore y App Check. |
| Clave de sitio de reCAPTCHA Enterprise | `js/core/firebase/firebase.js` | Clave *de sitio* de App Check, pensada para el cliente. La clave secreta vive en Google. |
| `EMAIL_WEBHOOK_URL` | `js/email/configuracion-correo.js` | Integración heredada para pruebas/promociones del panel; los pedidos usan Cloudflare + Resend con `pedidos@tintinaccs.com`. La autorización la da la verificación del idToken en el servidor, no el secreto de la URL. |

Si alguna vez se decide que la URL de Apps Script no debería ser pública, hay
que rediseñar la autorización de ese endpoint, no solo ocultar la URL.

### Cloudinary — esquema de identificadores

Necesario para el inventario de imágenes del punto 8 de #340.

- Los public ID siguen el patrón `tintin_media_{mediaId}_{variant}`, definido
  en `functions/api/cloudinary-sign-upload.js`.
- **No se usan carpetas**: el public ID es plano a propósito, para no depender
  del permiso de creación de carpetas ni del Dynamic Folder Mode.
- El borrado solo admite public ID que empiecen con el prefijo de Tintin
  (verificado por `audit:images`).
- El listado real de originales vive en Cloudinary y en la configuración de
  Firestore, no en el repositorio: para inventariarlos hay que exportarlos
  desde el panel de Cloudinary (Media Library → Usage/Assets).

## Revisión manual de cuentas

Una casilla solo se marca después de comprobarla en el proveedor. La existencia de código seguro o de un método de recuperación **no demuestra** que 2FA/recovery codes estén configurados.

- [ ] GitHub: 2FA o passkey activa.
- [ ] GitHub: códigos de recuperación guardados fuera del equipo principal.
- [ ] GitHub: Apps, webhooks, secretos y permisos revisados.
- [ ] GitHub: secret scanning y push protection confirmados.
- [ ] Google/Firebase: 2FA o passkey activa.
- [ ] Google/Firebase: métodos de recuperación actualizados.
- [ ] Cloudflare: 2FA o passkey activa.
- [ ] Cloudflare: códigos de recuperación guardados de forma segura.
- [ ] Correo principal: 2FA y correo/teléfono de recuperación actualizados.
- [ ] Registrador del dominio: 2FA, renovación automática y contacto vigente.

## Alertas de cuotas y fallos

No confundir monitoreo técnico con alertas de consumo. El monitor horario de producción detecta disponibilidad/contratos, pero las siguientes alertas de proveedor deben comprobarse externamente antes del lanzamiento:

- [ ] Google Cloud Billing / Firestore: presupuesto y alertas de consumo.
- [ ] Firebase Authentication: alertas/cuotas aplicables revisadas.
- [ ] Cloudflare Pages/Functions: notificación de fallo de deployment/runtime que no dependa de mirar el dashboard.
- [ ] Cloudinary: límites/uso y notificaciones configuradas.
- [ ] Resend: límites/uso y notificaciones configuradas.
- [ ] Apps Script: cuotas relevantes documentadas y revisadas.
- [ ] GitHub Actions: uso/alertas de Actions revisados.

## Registro de pruebas

| Fecha | Activo | Entorno de prueba | Resultado | Tiempo real | Evidencia | Responsable |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-06 | Código | Carpeta temporal aislada | Bundle verificado, restauración completada y `git fsck --full` aprobado | Automático en CI | Workflow `respaldo-repositorio.yml` y artefacto de respaldo | Propietaria de Tintin |
| 2026-08-08 | Firestore | Base aislada `restauracion-prueba` | Exportación completa 960 docs; importación 960/960 `SUCCESSFUL`; conteos de colecciones verificados | Prueba real | `docs/recuperacion-firestore.md` + operación de Google Cloud registrada | Propietaria de Tintin |
| Pendiente | Firestore fuera de Google | Proveedor/cuenta independiente | Debe restaurarse una muestra desde la copia externa cifrada | Pendiente | Archivo + checksum + registro de restauración | Propietaria de Tintin |
| Pendiente | Imágenes | Carpeta temporal fuera de Cloudinary | Pendiente | Pendiente | Muestra restaurada desde originales | Propietaria de Tintin |

## Regla de seguridad

Si una recuperación requiere copiar una clave, contraseña o token dentro de este archivo, el procedimiento es incorrecto. Solo debe anotarse el nombre de la credencial y la ubicación del gestor seguro donde está almacenada.
