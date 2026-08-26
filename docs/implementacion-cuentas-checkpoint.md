# Checkpoint — cuentas y sincronización TINTIN

Fecha: 2026-08-22. Rama: `claude/tintin-final-audit-6o9qy2`.

## Fase B — cierre (2026-08-22)

Se completó el resto de la Fase B: onboarding mínimo con username y fecha de
nacimiento, en `login.html` junto a nombre/teléfono/dirección.

- `js/components/forms/validacion-nacimiento.js` (nuevo): valida edad entre
  16 y 120 años a partir de `dob`. La edad nunca se persiste calculada, solo
  la fecha — se recalcula cada vez que hace falta.
- `js/pages/profile/configuracion-inicial-perfil.mjs`: `getProfileCompletionPlan`
  agrega `needsUsername`/`needsDob` (sólo para `profileStatus === 'incomplete'`;
  cuentas `legacy` o sin `profileStatus` no los piden retroactivamente).
  `buildMissingProfilePatch` reserva el patch de `username`/`dob` y, si con
  ese patch el perfil queda completo (nombre + teléfono + username + dob),
  agrega `profileStatus: 'active'` — transición que antes no existía en
  ningún lugar del código (los perfiles `incomplete` quedaban así para
  siempre).
- `login.html`: campos de username (reservado vía `reserveUsername`, mismo
  patrón que el teléfono) y fecha de nacimiento en el alta; catch específico
  para cuando la reserva de teléfono o username ya está tomada por otra
  cuenta (antes ese caso —real, no hipotético— caía en el mensaje genérico
  porque `phone_already_registered` nunca se lanza en la práctica).
- `firestore.rules`: `userProfileFieldsValid()` valida `dob` como timestamp
  dentro de 16-120 años; nueva función `onboardingActivationUpdate()` permite
  la única transición `incomplete → active`, atada a los mismos campos del
  alta y sin abrir la puerta a tocar campos protegidos (rol, pedidos, etc.)
  en la misma escritura.
- Verificado: `test:accounts`, `test:rules-username` (13/13), `test:rules-phone`
  (12/12), `test:rules-critical` (56/56), `audit:account-contract`,
  `audit:security`, `audit:login-isolation`, `audit:login-profile` (29/29),
  `audit:final` completo en verde, `cache-versioning:write` + verify.

## Fase C — documentos/facturación (2026-08-22)

Alcance acordado con el negocio: RUC + razón social para quien pide
factura; CI para quien pide encomienda (la transportadora la exige); si pide
las dos cosas, van los tres datos. Nunca obligatorio salvo que corresponda.

Investigación previa relevante: el checkout NO crea el pedido con un
`addDoc`/`runTransaction` directo desde `checkout.html` como parecía a
primera vista — lo hace `js/orders/pedido-checkout-seguro.js` (cargado
dinámicamente desde `js/components/cart/sincronizacion-carrito.js`), que arma
un "draft" con `js/orders/politica-checkout.js` y lo manda a
`apps-script/CrearPedido.gs` (Apps Script con OAuth propio, sin el límite de
1000 expresiones de `firestore.rules`). Ese es el único lugar real donde se
valida y persiste un pedido — por eso el cambio tocó los tres, no sólo el
HTML.

- `js/components/forms/validacion-documentos-py.js` (nuevo): formato de CI
  (5-8 dígitos) y RUC (dígitos-guion-verificador, ej. `80012345-6`) —no
  recalcula el dígito verificador real, eso es de la DNIT—, y razón social
  (mínimo 3 caracteres reales).
- `checkout.html`: checkbox "Quiero factura" (revela razón social + RUC) y
  campo de CI que aparece sólo si el envío elegido es encomienda. Validado
  al avanzar del paso "Tus datos" y otra vez al confirmar (mismo patrón que
  nombre/teléfono).
- `js/orders/politica-checkout.js` / `pedido-checkout-seguro.js`: el draft
  lleva `wantsInvoice`/`razonSocial`/`ruc`/`ci`, saneados según corresponda
  (RUC/razón social sólo si `wantsInvoice`; CI sólo si `shippingMethod ===
  'encomienda'`) — así un valor tipeado y después descartado (ej. desmarcó
  factura) nunca llega al servidor.
- `apps-script/CrearPedido.gs`: valida los mismos formatos server-side y
  persiste `ci` e `invoice: {wanted, razonSocial, ruc}` en el pedido.
- `js/admin/admin-app.js`: el detalle del pedido en Super Admin muestra CI y
  el bloque de factura pedida, para que quien facture/despache tenga el dato
  a mano sin tener que preguntarlo de nuevo por WhatsApp.
- Verificado: `tests/checkout/documentos-py.test.mjs` (formato),
  `tests/checkout/order-contract.test.mjs` (draft + servidor, incluyendo
  rechazo de CI/RUC/razón social inválidos vía el mismo `CrearPedido.gs`
  cargado en una sandbox de Node), `audit:checkout-delivery`,
  `audit:secure-orders`, `audit:cart`, `audit:final` completo en verde.

⚠️ Paso manual pendiente (no lo puedo hacer yo): pegar el
`apps-script/CrearPedido.gs` actualizado en el proyecto real de Apps Script
que ya tiene `Código.gs`/`Seguridad.gs` — el repo no lo despliega solo.

## Pendiente

Fases D–I (checkout con snapshots inmutables, sincronización bidireccional
completa usuarios/pedidos/auditoría con Sheets, y el resto del encargo
original) — no se adelantó nada de eso todavía.

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
