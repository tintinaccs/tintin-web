# Checkpoint — cuentas y sincronización TINTIN

Fecha: 2026-08-21. Rama: `feat/cuentas-sync-fase-a`.

## Alcance cerrado

Se completó una Fase A coherente: contrato de identidad, roles, seguridad de
campos base, migración progresiva, acceso passwordless compatible y ciclo de
eliminación/reactivación. No se inició una segunda arquitectura ni se duplicó
el módulo de usuarios: `admin-app.js` y `gestion-usuarios-admin.js` comparten el
mismo endpoint protegido mientras se prepara su consolidación.

## Auditoría realizada

- Firestore es fuente operativa; Firebase Auth es identidad y Rules es la
  autorización. Sheets es espejo operativo, no autoridad de acceso.
- Existían allowlists repetidas en navegador, Cloudflare, Rules y UI; el Apps
  Script desplegado no puede verificarse desde el repositorio.
- El PIN rechazaba cuentas creadas con Google y el perfil rechazaba el segundo
  método, aunque Firebase puede reutilizar el mismo UID.
- La sesión vencía 30 minutos desde login, no por inactividad, y Super Admin
  estaba exento indefinidamente.
- Había dos rutas de eliminación: una borraba solo Firestore y otra eliminaba
  Auth, perfil, carrito y favoritos. Ambas destruían continuidad histórica.
- `auditLog` ya era inmutable en Rules y se reutilizó; no se creó otro log.
- Usuarios aún no tienen username/DOB/documentos/facturación en producción. No
  se inventaron valores para cuentas existentes.
- La sincronización versionada cubre productos. La sincronización completa de
  usuarios/pedidos/auditoría con `TINTIN INVENTARIO 2026` requiere la Fase F y
  publicar manualmente Apps Script.

## Decisiones y modelo

- Firebase UID continúa como clave de autenticación.
- `customerId = CUS_<Firebase UID>` es la clave comercial: estable, sin PII,
  inmutable y no editable. Evita una tabla aleatoria adicional sin perder la
  separación semántica entre Auth y comercio.
- Estados de perfil: `legacy`, `incomplete`, `active`, `deleted`.
- Perfiles nuevos reciben `incomplete`; perfiles anteriores reciben `legacy`
  en el siguiente login, sin username/DOB falsos.
- Google y PIN son métodos de la misma identidad. `provider` conserva el origen
  y `authMethods`/`lastAuthMethod` registran accesos compatibles.
- Eliminar es soft delete: deshabilita Auth, conserva documento e historia,
  libera teléfono y agrega auditoría. Reactivar reutiliza UID.
- Clientes conservan sesión Firebase razonable. Staff vence tras 30 minutos de
  inactividad y Super Admin tras 2 horas; la actividad renueva el reloj.

## Archivos principales

- Contrato: `config/account-contract.json`.
- Generados: `js/core/auth/contrato-cuentas-generado.js`,
  `cloudflare/contrato-cuentas-generado.js`, `apps-script/ContratoCuentas.gs`.
- Generador/auditor: `scripts/sincronizar-contrato-cuentas.mjs`,
  `scripts/auditar-contrato-cuentas.mjs`.
- Identidad/login: `js/core/store/perfil-usuario.js`, `login.html`,
  `functions/api/email-otp-send.js`.
- Sesiones: `js/core/auth/proteccion-sesion.js`.
- Tombstone/reactivación: `functions/api/admin-delete-user.js`,
  `cloudflare/firebase-admin-ligero.js` y los dos consumidores Admin existentes.
- Seguridad: `firestore.rules` y pruebas/auditorías asociadas.

## Migración

La migración es lazy e idempotente: en el próximo login de un perfil sin
`customerId`, solo agrega `customerId`, `identityVersion`, `profileStatus`,
`authMethods` y timestamps. Rules exige el `CUS_<uid>` exacto y permite ese
bootstrap una sola vez. No se ejecutó ninguna escritura sobre producción.

Antes de una migración masiva futura se debe respaldar Firestore y comparar
emails históricos; no crear identidades nuevas para completar datos.

## Verificación completada

- `npm run audit:account-contract`
- `npm run test:accounts`
- `npm run audit:users-roles`
- `npm run audit:security`
- `npm run audit:login-isolation`
- `npm run audit:login-profile`
- `npm run audit:postphase`
- `npm run audit:emails`
- `npm run audit:email-messaging`
- `npm run audit:final` (cierre integral completo en verde)
- `npm run audit:cache-versioning` (40 bumps legítimos de dependencias)
- `npm run build:diagnostics && npm run verify:diagnostics` (18 páginas)
- `npm run build:csp && npm run verify:csp`
- `node --check` sobre funciones/módulos modificados y `git diff --check`.

Las pruebas del emulador Firestore no pudieron ejecutarse localmente porque el
equipo no tiene Java. Quedan cableadas en CI; `scripts/probar-firestore-critico.mjs`
incluye customerId inmutable, bootstrap único y prohibición de borrado cliente.

## Riesgos y pasos manuales

1. Fusionar solo con CI verde, especialmente el emulador Firestore.
2. Desplegar `firestore.rules` después del merge mediante el flujo aprobado.
3. Copiar/publicar `apps-script/ContratoCuentas.gs` en el proyecto oficial
   `TINTIN INVENTARIO 2026`; GitHub no despliega ese Apps Script.
4. No probar una eliminación real sin cuenta canary y backup.
5. Desactivar Auth y confirmar Firestore son dos servicios; el reintento es
   seguro, pero Fase G debe registrar también intentos fallidos.

## Siguiente fase exacta

Fase B, apoyada en este contrato:

1. Reservas de username normalizado con historia (`active/reserved/retired`).
2. DOB y validación 16/120, sin edad persistida.
3. Onboarding mínimo nombre + username + teléfono + DOB.
4. Login por `@username` con email enmascarado y sin enumeración.
5. Política server-side de correos temporales configurable/allowlist.
6. Pruebas de duplicados, edad y Google→PIN sobre emulador/preview.

Después continúan C–I en el orden del encargo. CI/documentos, facturación,
checkout snapshots y sync bidireccional no deben adelantarse antes de cerrar B.
