# Inventario de recuperación de servicios

Este documento registra qué debe recuperarse y dónde verificarlo. No debe contener secretos, contraseñas, tokens ni códigos de recuperación.

| Servicio | Activos críticos | Responsable | Método de recuperación | Copia externa | Última prueba | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| GitHub | Código, historial, ramas, tags, Releases, Actions y Pages | Propietaria de Tintin | Snapshot, Release y bundle verificado | Pendiente | 2026-08-06 | Código restaurable verificado; falta copia cifrada fuera de GitHub |
| Firebase | Proyecto, reglas, índices, Authentication y configuración | Propietaria de Tintin | Consola Firebase y configuración versionada | Pendiente | 2026-08-08 | Firestore verificado; Authentication y recuperación de cuenta requieren revisión manual |
| Firestore | Productos, colecciones, usuarios, pedidos, configuración y auditoría | Propietaria de Tintin | PITR + backups programados + exportación administrada + restauración aislada | Pendiente fuera de Google | 2026-08-08 | PITR 7 días; diario 30; semanal 84; restauración 960/960 verificada |
| Cloudinary / imágenes | Originales, identificadores públicos, carpetas y URLs activas | Propietaria de Tintin | Exportación o copia de originales | Pendiente | Pendiente | Requiere copia independiente de originales |
| Cloudflare | DNS, reglas, Functions/Pages y acceso de cuenta | Propietaria de Tintin | Configuración versionada + recuperación de cuenta | Pendiente | Producción monitoreada | Requiere revisión manual de cuenta y alertas |
| Correo | Cuenta, remitentes, plantillas y registros DNS | Propietaria de Tintin | Recuperación del proveedor y copia de configuración | Pendiente | Pendiente | Requiere revisión manual |
| Dominio | Registrador, DNS, renovación y contactos | Propietaria de Tintin | Recuperación del registrador y códigos de cuenta | Pendiente | Pendiente | Requiere revisión manual; preservar MX/SPF/DKIM/DMARC en el cutover |

## Variables y credenciales

Registrar únicamente metadatos, nunca valores reales.

### Secretos reales

Los secretos de producción viven exclusivamente en el runtime de Cloudflare Pages. Ninguno debe servirse al navegador ni almacenarse en Git.

| Nombre de variable | Servicio | Entorno | Ubicación segura | Responsable | Última rotación |
| --- | --- | --- | --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Pendiente |
| `CLOUDINARY_API_KEY` | Cloudinary | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Pendiente |
| `CLOUDINARY_API_SECRET` | Cloudinary | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Pendiente |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Pendiente |
| `RESEND_API_KEY` | Resend | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Pendiente |
| `GITHUB_TOKEN` | GitHub Actions | CI | Generado automáticamente por cada run; no se almacena | GitHub | No aplica |

No hay que copiar valores reales de estas variables a este archivo. El endpoint `/api/health` solo valida presencia/configuración y conectividad mínima; nunca devuelve valores.

### Identificadores públicos — no son secretos

| Identificador | Dónde | Por qué es público |
| --- | --- | --- |
| `firebaseConfig.apiKey` | `js/core/firebase/firebase.js` | Identificador de Firebase Web; la autorización real depende de Rules y App Check |
| Clave de sitio de reCAPTCHA Enterprise | `js/core/firebase/firebase.js` | Clave pública de App Check; la parte secreta vive en Google |
| `EMAIL_WEBHOOK_URL` | `js/email/configuracion-correo.js` | Integración heredada; la autorización se valida del lado servidor |

## Cloudinary — esquema de identificadores

- Los public ID siguen el patrón `tintin_media_{mediaId}_{variant}`.
- No se depende de carpetas para la autorización de borrado.
- El borrado solo admite identificadores pertenecientes a Tintin.
- El inventario real de originales vive en Cloudinary y en Firestore; para una recuperación independiente debe exportarse una copia de originales fuera de Cloudinary.

## Revisión manual de cuentas

- [ ] GitHub: 2FA o passkey activa.
- [ ] GitHub: códigos de recuperación guardados fuera del equipo principal.
- [ ] GitHub: Apps, webhooks, secretos, rulesets/branch protection y permisos revisados.
- [ ] GitHub: secret scanning y push protection confirmados.
- [ ] Google/Firebase: 2FA o passkey activa y métodos de recuperación actualizados.
- [ ] Cloudflare: 2FA o passkey activa y códigos de recuperación guardados.
- [ ] Cloudflare: alertas de fallo de Pages/Functions habilitadas.
- [ ] Cloudinary: alertas/cuotas revisadas y copia independiente de originales.
- [ ] Resend: cuota, alertas y remitentes revisados.
- [ ] Correo principal: 2FA y correo/teléfono de recuperación actualizados.
- [ ] Registrador del dominio: 2FA, renovación automática y contacto vigente.

## Registro de pruebas

| Fecha | Activo | Entorno de prueba | Resultado | Tiempo real | Evidencia | Responsable |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-06 | Código | Carpeta temporal aislada | Bundle verificado, restauración completada y `git fsck --full` aprobado | Automático en CI | Workflow `respaldo-repositorio.yml` | Propietaria de Tintin |
| 2026-08-08 | Firestore | Base `restauracion-prueba` | Exportación 960 docs; importación 960/960; conteos principales iguales; operación `SUCCESSFUL` | Verificado | `docs/recuperacion-firestore.md` | Propietaria de Tintin |
| Pendiente | Copia Firestore externa | Proveedor/cuenta fuera del mismo dominio de fallo de Google | Pendiente | Pendiente | Checksum + inventario | Propietaria de Tintin |
| Pendiente | Imágenes | Segunda ubicación independiente | Pendiente | Pendiente | Muestra restaurada y URL visible | Propietaria de Tintin |

## Regla de seguridad

Si una recuperación requiere copiar una clave, contraseña o token dentro de este archivo, el procedimiento es incorrecto. Solo debe anotarse el nombre de la credencial y la ubicación del gestor seguro donde está almacenada.
