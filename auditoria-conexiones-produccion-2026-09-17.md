# Flujo de conexiones — auditoría de producción 2026-09-17

## Alcance

Superficie auditada: `admin.html` → `Flujo real de decisiones y conexiones`.
Producción canónica: `https://tintinaccesorios.pages.dev`.
No se usó `tintinaccs.com`, no se cambiaron DNS, OAuth, Firebase Auth Domain ni App Check domains.

La rama parte de `main` en `c5d69381dd963e5799b17e4332f0fc6374ea6e97`. PR #832 no estaba mergeado al iniciar y no se incorporó.

## Inventario y estado inicial

El catálogo vigente contiene 36 nodos y 37 conexiones.

| Elementos | Verde histórico sin evidencia runtime | Implementado no verificado | Parcial | Documentado no confirmado |
|---|---:|---:|---:|---:|
| Nodos | 25 | 3 | 3 | 5 |
| Conexiones | 24 | 5 | 3 | 5 |

La captura/estado histórico no se aceptó como prueba actual. La fuente exportada ahora degrada cualquier `FUNCIONANDO EN PRODUCCIÓN` estático a `IMPLEMENTADO PERO NO VERIFICADO` hasta que una prueba runtime promovible lo confirme.

## Evidencia de producción previa al cambio

- `GET /api/health`: **200**, `ok=true`, runtime/Firebase/Admin runtime/Visual Builder y comprobaciones de productos, inventario, colecciones, pedidos, usuarios, reseñas, likes, email logs, auditoría, settings, contenido y Visual Builder en `true`.
- `GET /api/admin-runtime-health` sin token: **401**, `authentication_required`; comportamiento esperado.
- `GET /api/system-health` sin token: **500** en la versión desplegada, aunque la falta de autenticación debía ser **401**. Es un defecto real del contrato de error, no un problema de credenciales del diagnóstico.
- Monitor de producción: páginas canónicas, headers, sitemaps, `/api/health`, guard de `/api/admin-runtime-health`, catálogo público y metadata de producto pasaron.
- Las pruebas protegidas de Super Admin no se ejecutaron sin una cuenta QA autorizada; no se marcaron verdes por inferencia.

## Correcciones

1. `functions/api/system-health.js` ahora reconoce `error.status` 401/403 y mensajes de autenticación; devuelve 401/403 en lugar de ocultar el fallo como 500.
2. El flujo incorpora `estado-flujo.js`, una autoridad pura para resolver estados y niveles de evidencia:
   - `LIVE_PRODUCTION` puede promover a verde solo con prueba exitosa y explícitamente promovible.
   - `LIVE_PRODUCTION_READ_ONLY` confirma disponibilidad, pero no convierte una mutación o dominio parcial en verde.
   - 500 es rojo; timeout/408/429 queda no verificado; 401/403 queda no verificado por falta de evidencia autenticada; implementación ausente es gris; evidencia parcial permanece naranja.
3. `Revalidar en vivo` ejecuta únicamente lecturas: `/api/health`, `/api/system-health`, `/api/admin-runtime-health` y headers de `admin.html`. Registra status HTTP, timestamp, endpoint y nivel de evidencia.
4. Las conexiones tienen resolución live propia; no heredan verde desde un nodo vecino.
5. Se agregaron búsqueda por nodo/conexión/servicio/archivo/estado, filtros de atención, detalle de evidencia, conteo de nodos/conexiones y marca `STALE` después de 24 horas.
6. Se agregaron capas responsive para desktop, tablet y mobile sin tocar contratos de negocio.
7. El gate `test:flow-connections` quedó integrado a `audit:final`.

## ALREADY FIXED / SKIPPED

- Auth, App Check, checkout, carrito, Firestore Rules y LCP #831: estado funcional histórico no reabierto; **SKIP**, no hubo evidencia de regresión causada por este trabajo.
- `/api/admin-runtime-health` sin token: contrato 401 ya estaba correcto; **SKIP** funcional, se conservó y se cubrió con prueba.
- `GET /api/health`: responde 200 en producción; **SKIP** de implementación, se reutilizó como evidencia read-only.
- No se ejecutaron OTP, Google Auth, pagos PayPal, emails, mutaciones de pedidos, escrituras de productos, cambio de roles ni sincronizaciones reales: **SKIP** por side effect o falta de cuenta QA; quedan explícitamente no verificables en vivo.

## Validaciones locales

- `npm run build:pages`: PASS.
- `npm run audit:system-health`: PASS.
- `npm run audit:diagnostics`: PASS.
- `npm run audit:diagnostic-findings`: PASS.
- `npm run audit:architecture-contracts`: PASS.
- `npm run test:architecture-gates`: PASS.
- `npm run audit:admin-foundation`: PASS.
- `npm run audit:admin-sync`: PASS.
- `npm run audit:app-check-bootstrap`: PASS.
- `npm run audit:login-isolation`: PASS.
- `npm run audit:login-profile`: PASS.
- `npm run audit:headers:production`: PASS.
- `npm run audit:cache-versioning`: PASS.
- `npm run test:flow-connections`: PASS.
- `git diff --check`: PASS.

## Estados finales y límites

Antes de desplegar esta rama, el estado final de producción no puede declararse cerrado: el fix de `/api/system-health` todavía no está en producción y los probes protegidos requieren revalidación con una sesión real de Super Admin.

La migración, checkout, pedidos, roles y servicios externos no fueron alterados. Los estados de esas conexiones permanecen conservadores cuando solo existe evidencia de código, contrato o lectura parcial.

**Resultado de esta rama:** diagnóstico honesto y verificable, con el defecto 500→401 corregido localmente. La certificación de producción requiere CI, deploy y una revalidación posterior autenticada; hasta entonces: **FLUJO DE CONEXIONES ABIERTO**.

