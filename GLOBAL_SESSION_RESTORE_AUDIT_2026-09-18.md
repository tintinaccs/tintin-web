# Auditoría global de restauración de sesión — 2026-09-18

## Alcance

- Rama: `global-session-restore-20260918` (rama de trabajo de esta entrega)
- Base: `921666a101baba4bae96f3bb434ac00df2441d5e`
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
- `npm run audit:final`: PASS en la ejecución final previa a este documento; se repitió la cadena de validaciones antes de publicar.
- `node --test tests/auth/global-session-restore.test.mjs tests/cache/auth-flow-contract.test.mjs`: 11/11 PASS.
- Carrito: 4/4 PASS.
- Checkout: 87/87 PASS.
- Engagement: 44/44 PASS.
- Arquitectura: PASS.
- Flow connections: PASS.
- Responsive flow: PASS.
- Cache versioning: PASS; 221 recursos versionados, sin URLs inmutables reutilizadas con bytes distintos.
- Performance regressions: 29/29 PASS.
- Admin foundation, emails y premium performance: PASS.
- Navegación/header: 9 PASS, 1 skip intencional.
- Performance browser contra Pages pública: las rutas públicas pasaron salvo el tripwire variable de Home, que observó 178–182 requests efectivos frente al presupuesto 177; no se atribuye a este cambio sin preview desplegado y no se relaja el gate.
- Performance browser local: las 29 rutas ejecutables pasaron; el caso de producto requiere el header server-side de Cloudflare Functions y queda validado en Preview/Pages.

## QA autenticado

No se ejecutó QA autenticado de producción de forma segura porque no hay credenciales, cookies ni tokens autorizados en el entorno. Requiere validación manual o un entorno de QA con credenciales controladas para cold restore, refresh, multi-tab, Google/email/OTP, routing de roles, checkout autenticado y App Check.

## Cambios excluidos

No se modificaron Firestore Rules, Firebase Auth, App Check enforcement, DNS, Cloudflare configuration, Shopify Phase 2, migración de media, activación de catálogo ni el LCP de producto de #831.

## Estado

Implementación lista para revisión en PR independiente. No se hizo merge automático.
