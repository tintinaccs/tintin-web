# Auditoría global de restauración de sesión — 2026-09-18

## Alcance

- Rama: `global-session-restore-20260918` (rama de trabajo de esta entrega)
- Base efectivo tras rebase sobre `origin/main`: `e0f75432`
- Objetivo: eliminar falsos logout durante restauración en frío, refresh, handoff entre login y superficies protegidas, cambio de pestaña y routing por rol.
- Autoridad de Pages para QA público: `https://tintinaccesorios.pages.dev`.

## Decisión de arquitectura

`js/core/auth/coordinador-sesion.js` es la autoridad única de sesión. Expone `sessionReady`, `subscribeSession`, `getSessionSnapshot`, `waitForSession` y el handoff de autenticación. La máquina explícita usa `RESTORING`, `AUTHENTICATED`, `UNAUTHENTICATED` y `UNKNOWN`.

- El `null` inicial de Firebase se conserva como `UNKNOWN` hasta que finaliza `authStateReady()`; no redirige, no ejecuta logout y no borra carrito.
- Un `null` posterior a una restauración conocida se clasifica como ausencia confirmada, revocación o logout explícito.
- `UNKNOWN` muestra estado neutral/reintentable; los errores de App Check, Firestore, roles, token, revocación y offline no se traducen a logout.
- Ningún timer es autoridad de Auth.
- `USER_LOGIN` queda reservado a acciones interactivas de login.

## Superficies cubiertas

Header, navegación pública, login Google/email/OTP, handoff y persistencia, multi-tab, routing por rol, admin, catálogo, producto, favoritos, comentarios/likes, notificaciones, perfil, carrito, checkout y creación segura de órdenes. Se conservaron Auth, App Check, reglas, contratos de precio/stock/idempotencia, DNS y Shopify Phase 2 sin cambios.

## Validación local

- `npm run build`: PASS; rutas, decisiones, CSP, diagnóstico y versionado verificados.
- `npm run audit:final`: PASS en la ejecución final completa posterior a los cambios.
- `node --test tests/auth/global-session-restore.test.mjs tests/cache/auth-flow-contract.test.mjs`: 11/11 PASS.
- Carrito: 4/4 PASS.
- Checkout: 87/87 PASS.
- Engagement: 44/44 PASS.
- Arquitectura: PASS.
- Flow connections: PASS.
- Responsive flow: PASS.
- Cache versioning: PASS; 226 recursos versionados, sin URLs inmutables reutilizadas con bytes distintos.
- Performance regressions: 29/29 PASS.
- Admin foundation, emails y premium performance: PASS.
- Navegación/header: 9 PASS, 1 skip intencional.
- Performance browser contra Pages pública: las rutas públicas pasaron salvo el tripwire variable de Home, que observó 178–182 requests efectivos frente al presupuesto 177; no se atribuye a este cambio sin preview desplegado y no se relaja el gate.
- Performance browser local: las 29 rutas ejecutables pasaron; el caso de producto requiere el header server-side de Cloudflare Functions y queda validado en Preview/Pages.

## QA autenticado

No se ejecutó QA autenticado de producción de forma segura porque no hay credenciales, cookies ni tokens autorizados en el entorno. Requiere validación manual o un entorno de QA con credenciales controladas para cold restore, refresh, multi-tab, Google/email/OTP, routing de roles, checkout autenticado y App Check.

## Evidencia real del incidente de producción — 2026-09-18

- Autoridad verificada: `https://tintinaccesorios.pages.dev`.
- El SHA indicado por el reporte (`921666a101baba4bae96f3bb434ac00df2441d5e`) no coincide con `origin/main` consultado en GitHub (`e0f754325bc864daee984d6ca468332db68da451`). No se presenta el SHA indicado como desplegado sin evidencia adicional.
- El JavaScript servido en Pages durante la auditoría todavía contenía `waitForAdminUserAfterAuthRestore`, `RETRY_DELAY_MS`, `MAX_ATTEMPTS` y `scheduleAdminHandoffRecovery`, y el guard del panel no usaba `subscribeSession`. Eso demuestra que el incidente observado podía seguir ejecutando el guard histórico basado en reintentos antes de que la corrección de restauración estuviera desplegada.
- No hubo credenciales autorizadas para provocar un cold restore autenticado en producción. La reproducción ejecutable y segura queda cubierta por la máquina de estados: `RESTORING` → `UNKNOWN`/`AUTHENTICATED`, nunca `UNAUTHENTICATED` por timeout; logout explícito → `UNAUTHENTICATED` con razón `EXPLICIT_LOGOUT`.

### REAL PRODUCTION INCIDENT

- reproduced: sí, según evidencia manual del reporte; no reproducido autenticadamente por este entorno.
- redirect origin: guard histórico de `admin-app.js` servido por Pages, pendiente de distinguir en el navegador afectado con el nuevo diagnóstico.
- redirect reason: no determinable desde el reporte solo; el mecanismo histórico podía vencer su ventana de reintento y ejecutar el redirect.
- auth state at redirect: no capturado en la sesión afectada.
- session coordinator state: el guard histórico no consultaba el coordinador canónico.
- handoff state: el guard histórico dependía de `tt_auth_handoff_uid`; su presencia/expiración no quedó capturada en la sesión afectada.
- actual signOut executed: no hay evidencia; SiteActivity no llama `signOut`.
- cold restore confirmed: compatible con el síntoma, no confirmado instrumentalmente en producción aún.

### SITE ACTIVITY

- permission-denied reproduced: no contra Firestore de producción sin autorización operativa; la condición de Rules es determinista y quedó cubierta localmente.
- exact rule/condition: `sitePresence/{visitorId}` permite `update` solo si `presenceIsValid(visitorId)` y `request.time > resource.data.lastSeen + 20s`; también puede intervenir App Check, el store gate o un payload inválido.
- duplicate heartbeat: posible en el código histórico por escrituras inmediatas concurrentes de `startActivity()`/`visibilitychange` sin dedupe de inflight; el intervalo nominal era 60s.
- App Check involved: no demostrado; el módulo solo arranca cuando `appCheckReady` resuelve, pero una denegación posterior no prueba por sí sola la causa.
- Auth involved: no; el módulo no importa Auth, no escucha Auth, no ejecuta `signOut`, no redirige y no elimina identidad.
- fixed: sí, en esta rama: una escritura inflight y una ventana mínima de 20s bloquean heartbeats duplicados; se agregaron eventos diagnósticos seguros.
- regression test: sí; `npm run test:site-activity` cubre inflight, ventana de Rules y aislamiento de Auth/redirect.

### RELATIONSHIP

- SiteActivity caused logout: NO.
- evidence: `actividad-sitio.js` solo detiene analytics ante error permanente y actualiza su estado propio; no tiene llamadas a Auth, navegación ni borrado de identidad. La coincidencia temporal del warning no prueba causalidad. La hipótesis operativa queda separada: `FALSE LOGOUT ROOT CAUSE: guard histórico de restauración/redirect`; `SITE ACTIVITY PERMISSION DENIED ROOT CAUSE: ventana de throttling de Rules o condición de escritura aún no distinguida en producción`; `RELATIONSHIP: INDEPENDENT`.

## Cambios excluidos

No se modificaron Firestore Rules, Firebase Auth, App Check enforcement, DNS, Cloudflare configuration, Shopify Phase 2, migración de media, activación de catálogo ni el LCP de producto de #831.

## Estado

Implementación lista para revisión en PR independiente. No se hizo merge automático.
