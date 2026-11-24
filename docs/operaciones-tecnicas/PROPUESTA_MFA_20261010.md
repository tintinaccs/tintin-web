# Propuesta revisable de MFA obligatorio para administración

Estado: BLOCKED para activación productiva; no se ha cambiado configuración, Rules ni acceso administrativo. Base auditada: #1082 y código de administración actual.

## Requisito y compatibilidad real

La verificación criptográfica de Firebase y los permisos actuales no prueban una segunda autenticación. El SDK modular 10.14.1 admite TOTP. La documentación oficial exige Firebase Authentication con Identity Platform y excluye Custom Auth Tokens de MFA: https://firebase.google.com/docs/auth/web/totp-mfa .

El correo OTP actual crea custom tokens: no permite exigir TOTP nativo sobre ese primer factor. La propietaria ya accede exclusivamente con Google. Para otras cuentas administrativas se debe vincular Google a la misma cuenta autenticada y UID, con prueba de propiedad y sin crear duplicados. Los clientes pueden conservar el correo OTP actual.

## Migración concreta por etapas

1. Leer la configuración de Identity Platform, proveedores y cuotas con acceso administrativo seguro. Confirmar la actualización del servicio y sus posibles costos antes de activarla. No solicitar secretos en chat.
2. Ensayar en proyecto aislado Google como primer factor, TOTP oficial, recuperación, pérdida de dispositivo y token renovado. Incorporar `getMultiFactorResolver` al error `auth/multi-factor-auth-required`, resolver con `TotpMultiFactorGenerator.assertionForSignIn` y conservar perfil/UID/retorno durante el proceso.
3. Preparar inscripción con reautenticación reciente, `multiFactor(user).getSession()`, `generateSecret`, QR y confirmación `assertionForEnrollment`; no persistir semillas en Firestore, logs ni código. Registrar sólo el estado mínimo de inscripción y auditoría autorizada.
4. Confirmar inscripción y recuperación ensayadas para cada administración, incluyendo propietaria, antes de exigir el factor. No dar a una cuenta sin factor una excepción silenciosa de Super Admin. Dejar la activación detrás de una migración explícita revisada; no habilitar enforcement antes de terminar este paso.
5. En el commit de activación, requerir la claim oficial `firebase.sign_in_second_factor` en la autorización de cada API administrativa y en Rules administrativas, manteniendo el token criptográficamente verificado, roles y bloqueos actuales. El navegador sólo explica/reintenta; no determina permisos. Resolver con MFA los accesos Google y rechazar el correo custom-token para administración.
6. Probar token sin factor, con factor, expirado, usuario bloqueado, UID ajeno, acceso directo a API y Firestore, recuperación, pérdida de red, cambio de cuenta y revocación. Probar todos los tamaños de la matriz de login, CI y mantenimiento protegido del SHA exacto. Activar con la propietaria disponible y reversión versionada/revisada que conserve los demás permisos.

## Prerrequisitos para revisar la activación

Configuración administrativa válida de Firebase/Identity Platform mediante entorno seguro; un proyecto aislado apropiado; autorización del cambio remoto y costo si corresponde; propietaria y administradores disponibles para inscripción/recuperación. La presencia de un archivo de credenciales vacío no cumple el acceso administrativo. Ninguna evidencia local de OTP ni el 2FA de Google sustituye estas comprobaciones.

Esta propuesta hace revisable la operación pendiente; no declara MFA implementado ni habilitado.
