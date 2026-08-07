# Inventario de recuperación de servicios

Este documento registra qué debe recuperarse y dónde verificarlo. No debe contener secretos, contraseñas, tokens ni códigos de recuperación.

| Servicio | Activos críticos | Responsable | Método de recuperación | Copia externa | Última prueba | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| GitHub | Código, historial, ramas, tags, Releases, Actions y Pages | Propietaria de Tintin | Snapshot, Release y bundle verificado | Pendiente | 2026-08-06 | Código restaurable verificado; falta copia externa |
| Firebase | Proyecto, reglas, índices, Authentication y configuración | Propietaria de Tintin | Consola Firebase y configuración versionada | Pendiente | Pendiente | Requiere revisión manual |
| Firestore | Productos, colecciones, usuarios, pedidos, configuración y auditoría | Propietaria de Tintin | Exportación administrada y restauración en entorno separado | Pendiente | Pendiente | Requiere configuración |
| Cloudinary / imágenes | Originales, identificadores públicos, carpetas y URLs activas | Propietaria de Tintin | Exportación o copia de originales | Pendiente | Pendiente | Requiere inventario |
| Cloudflare | DNS, reglas, Workers/Pages y acceso de cuenta | Propietaria de Tintin | Exportación de configuración y recuperación de cuenta | Pendiente | Pendiente | Requiere revisión manual |
| Correo | Cuenta, remitentes, plantillas y registros DNS | Propietaria de Tintin | Recuperación del proveedor y copia de configuración | Pendiente | Pendiente | Requiere revisión manual |
| Dominio | Registrador, DNS, renovación y contactos | Propietaria de Tintin | Recuperación del registrador y códigos de cuenta | Pendiente | Pendiente | Requiere revisión manual |

## Variables y credenciales

Registrar únicamente metadatos, nunca valores reales.

### Secretos reales

Los cinco secretos de producción viven exclusivamente en el runtime de
Cloudflare Pages. Ninguno se sirve al navegador: `scripts/auditar-imagenes-fase-5.js`
verifica que el API Secret de Cloudinary exista solo en Cloudflare, y el
`Repository audit` comprueba que no haya secretos de producción en el frontend.

| Nombre de variable | Servicio | Entorno | Ubicación segura | Responsable | Última rotación |
| --- | --- | --- | --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Pendiente |
| `CLOUDINARY_API_KEY` | Cloudinary | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Pendiente |
| `CLOUDINARY_API_SECRET` | Cloudinary | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Pendiente |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Pendiente |
| `RESEND_API_KEY` | Resend | Cloudflare Pages | Panel Cloudflare → Pages → Settings → Environment variables | Propietaria de Tintin | Pendiente |
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
| `EMAIL_WEBHOOK_URL` | `js/email/configuracion-correo.js` | URL de despliegue de Apps Script. La autorización la da la verificación del idToken en el servidor, no el secreto de la URL. |

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

## Registro de pruebas

| Fecha | Activo | Entorno de prueba | Resultado | Tiempo real | Evidencia | Responsable |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-06 | Código | Carpeta temporal aislada | Bundle verificado, restauración completada y `git fsck --full` aprobado | Automático en CI | Workflow `respaldo-repositorio.yml` y artefacto de respaldo | Propietaria de Tintin |
| Pendiente | Firestore | Proyecto o base no productiva | Pendiente | Pendiente | Conteos y muestra verificada | Propietaria de Tintin |
| Pendiente | Imágenes | Carpeta temporal | Pendiente | Pendiente | Muestra restaurada | Propietaria de Tintin |

## Regla de seguridad

Si una recuperación requiere copiar una clave, contraseña o token dentro de este archivo, el procedimiento es incorrecto. Solo debe anotarse el nombre de la credencial y la ubicación del gestor seguro donde está almacenada.
