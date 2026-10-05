# Auditoría final de recorrido, arquitectura, limpieza y deuda técnica

## 1. Resumen ejecutivo

Base auditada: `main` remoto en `aec051ab`, que contiene el PR #824 por squash. PR #824: mergeado, sin conflictos y con Repository audit, CodeQL y Cloudflare Pages aprobados.

El recorrido comercial está protegido por contratos reales: sesión coordinada, perfil persistido, carrito por identidad, checkout server-side, `requestId` idempotente, validación de precio/stock en servidor y reglas Firestore. Las pruebas específicas ejecutadas: **147 passed, 0 failed**; también pasaron las auditorías dedicadas de carrito, perfil/App Check, pedidos y comercio.

No hay candidatos demostrables para `DELETE_NOW`. La deuda principal no es código muerto confirmado, sino compatibilidad activa: bridge del carrito clásico, globals `window.*`, listeners Auth directos en superficies históricas y capas de navegación/diagnóstico que aún tienen consumidores.

## 2. Estado de base

- PR #824: `MERGED`; merge commit `aec051ab`.
- `main` remoto: `aec051ab`.
- El worktree separado de `main` conserva un commit local divergente (`10db0df9`); no fue tocado.
- Build y drift del PR: correctos.

## 3. Mapa de autoridades actuales

| Responsabilidad | Actual | Deseada | Duplicada | Migración |
|---|---|---|---|---|
| Sesión | `js/core/auth/coordinador-sesion.js` + lecturas Auth | Coordinador | Sí, consumidores directos | Sí |
| Perfil | `users/{uid}` y `perfil-usuario.js` | Firestore + contrato de perfil | No relevante | No |
| Roles | claims/rol validado por reglas y `permisos-roles.js` | Reglas server-side | No | No |
| Carrito | `sincronizacion-carrito.js`; bridge `tt_cart` | Runtime canónico + Firestore/local guest | Sí, por compatibilidad | Sí |
| Catálogo | documentos públicos sincronizados desde Sheets | Firestore/artefacto público | Sheets es upstream operativo | No |
| Precio | servidor/Apps Script + reglas | Servidor | Cliente mantiene copia visual | No |
| Stock | transacción server-side/Firebase | Servidor | Admin tiene operaciones separadas | No |
| Checkout | `pedido-checkout-seguro.js` + guards | Runtime seguro | Capas hardening/confiabilidad complementarias | No |
| Pedidos | Apps Script/Fase 4; Cloudflare bridge | Transacción server-side única | Admin CRUD es autoridad administrativa | No |
| Inventario | transacción del pedido + reglas | Servidor | Admin integridad para lifecycle administrativo | No |
| Lifecycle usuario | perfil y reglas | Firestore/servidor | aliases históricos | Sí, gradual |
| Configuración tienda | Firestore/settings + gate | Firestore | fallback de lectura | No |
| Imágenes | configuración/Cloudinary y caches | fuente configurada + CDN | caches locales | No |
| Favoritos | `sincronizacion-favoritos.js` por UID | Runtime + Firestore | No confirmada | No |
| Notificaciones | endpoints y colas por evento | eventos server-side | email/push/campana son canales distintos | No |

## 4. Flujo registro → compra → reingreso

1. Visitante: shell público, catálogo y carrito invitado (`tt_cart_guest`).
2. Registro/login: Firebase Auth; `login.html` fija persistencia local y deriva a perfil.
3. Incorporación: `configuracion-inicial-perfil.mjs` calcula únicamente campos faltantes; `profileStatus: active`/marcas persistidas evitan repetirla. Tests cubren email, Google, cuentas legacy, aliases, ubicación, username y DOB.
4. Cambio de identidad: el carrito captura el guest cart, cambia a `tt_cart_user_<uid>`, combina sin duplicar y sincroniza remoto.
5. Usuario autenticado: favoritos, pedidos y carrito se suscriben por UID; los guards esperan restauración de Auth.
6. Checkout: `checkout-hardening.js`, `estado-navegacion-checkout.js` y `pedido-checkout-seguro.js` preservan draft, pasos, entrega y `requestId`.
7. Compra: el navegador llama al bridge público; el servidor revalida identidad, perfil, tienda, productos, precio, stock y entrega; la transacción crea pedido y reserva/descuenta inventario. Email/push se disparan después del commit con deduplicación.
8. Confirmación: se limpian draft, carrito local y remoto sin convertir una limpieza fallida en error de pedido.
9. Logout/cierre/reingreso: Auth conserva persistencia; el coordinador evita interpretar `null` inicial como logout; el perfil activo entra directo a Principal. La restauración de carrito/favoritos depende del UID.

Riesgo residual: hay consumidores con `onAuthStateChanged` directo además del coordinador. Los tests protegen las superficies críticas, pero la consolidación total aún requiere migración controlada.

## 5. Auth/sesión

Autoridad candidata correcta: `js/core/auth/coordinador-sesion.js`. Mantiene un solo listener propio, espera `authStateReady`, publica `undefined` solo internamente y entrega `null` únicamente después de resolver Auth.

Evidencia: `onAuthStateChanged` aparece en 61 coincidencias de `js/`; consumidores directos activos incluyen `mantenimiento-producto.js`, `resenas-producto.js`, componentes Admin, store gate y bienvenida. Muchos son guards o superficies aisladas, no necesariamente autoridades paralelas. `auth.currentUser` se usa también como snapshot para autorización/identidad.

- `KEEP`: coordinador, `authStateReady`, guards de handoff, persistencia de login.
- `INVESTIGATE`: migrar listeners de producto/Admin que solo consumen estado a `subscribeAuthState`.
- No se confirmó un redirect contradictorio ni una carrera reproducible en las pruebas ejecutadas.

## 6. Registro/login/perfil

`configuracion-inicial-perfil.mjs`, `perfil-usuario.js`, `control-acceso-perfil.js` y los tests de login forman la ruta de perfil. La decisión se basa en datos Firestore y campos faltantes, no en el proveedor de login ni solo en localStorage. `profileStatus: active` es la marca canónica; aliases históricos se leen para no romper cuentas existentes.

`KEEP`: transacción de completion, validación independiente de teléfono/username/DOB/ubicación, exclusión Super Admin y fallback de nombre de Google. `REMOVE_AFTER_MIGRATION`: aliases históricos solo cuando se haya demostrado que no quedan perfiles legacy.

## 7. Carrito

Autoridad efectiva: `js/components/cart/sincronizacion-carrito.js`.

- Invitado: `tt_cart_guest` + `tt_cart_guest_activity_v1` con expiración de 30 minutos.
- Cuenta: `tt_cart_user_<uid>`; Firestore `users/{uid}/cart` para multi-dispositivo.
- Migración/dirty: `tt_cart_v2_migrated_<uid>` y `tt_cart_v2_dirty_<uid>` protegen combinación y snapshots concurrentes.
- Legacy: `tt_cart` continúa siendo leído por `analitica.js`, `checkout-confiabilidad.js`, catálogo y código clásico.
- Bridge: patch defensivo de `Storage.prototype`, `interceptLegacyCartButtons`, globals `CartFirestoreSync`, `TintinCartRuntime` y evento `tt_cart_updated`.

Clasificación: bridge obligatorio hoy; `REMOVE_AFTER_MIGRATION` para `tt_cart`, patch de Storage y botones clásicos cuando todos los consumidores migren al runtime. No se demostró ninguna clave eliminable ahora. Tests y `auditar-carrito-fase-7.js` confirman no duplicación, variantes separadas, serialización remota, no-op de escrituras, merge guest y limpieza posterior a compra.

## 8. Firebase/App Check

Única inicialización encontrada: `js/core/firebase/firebase.js` (`getApps/getApp/initializeApp`, `getFirestore`, `getAuth`, `initializeAppCheck`). Los consumidores usan una misma versión Firebase y el mismo módulo versionado.

`window.__TINTIN_APP_CHECK_STATE__` es necesario porque variantes de import dinámico pueden crear copias lógicas del módulo; evita doble `initializeAppCheck` y doble widget reCAPTCHA. `appCheckReady` espera token hasta 8 s y luego permite fallback no bloqueante. Tests confirman timeout, modo consulta, no escritura de presencia sin App Check y un único proveedor.

`KEEP`: singleton global, timeout, `isTokenAutoRefreshEnabled`, bootstrap único. `REMOVE_AFTER_MIGRATION` únicamente si se unifican físicamente todos los importadores y se prueba que el hosting no genera identidades URL distintas.

## 9. Storage/cache/globals

| Mecanismo | Estado | Productores/consumidores principales | Riesgo |
|---|---|---|---|
| `tt_cart_guest` | ACTIVE | cart sync, checkout seguro | mezcla de cuenta si falla el cambio de scope |
| `tt_cart_user_<uid>` | ACTIVE | cart sync, páginas públicas | fuga entre UID si se calcula mal |
| `tt_cart` | MIGRATION_ONLY/LEGACY | clásico, analytics, checkout legacy | autoridad paralela |
| `tt_cart_v2_*` | ACTIVE/MIGRATION | cart sync | no borrar antes de completar migración |
| `tt_checkout_*` en sessionStorage | ACTIVE | estado/hardening checkout | pérdida de draft o salto inválido |
| `tt_auth_handoff_uid` | ACTIVE | login/Admin handoff | sesión Admin mal restaurada |
| `tt_pending_*` | ACTIVE | login, checkout, notificaciones | intención caducada |
| consentimiento cookie + clave legacy | ACTIVE + MIGRATION | privacidad/analytics | preferencia inconsistente |
| caches `caches.default` | ACTIVE server-side | `public-catalog.js` | invalidación/versionado |
| IndexedDB/Auth | ACTIVE SDK | Firebase Auth | restauración asíncrona |
| Firestore offline cache | INTENCIONALMENTE no persistente | `firebase.js` | menor latencia, menor estado stale |
| `window.*` globals | ACTIVE/compatibilidad | loaders, Admin, runtime público | acoplamiento y colisión |

No se confirmó persistencia de datos de una cuenta después de logout: claves de cuenta incluyen UID y el coordinador/guards protegen el acceso. Debe mantenerse prueba multi-cuenta/multi-pestaña antes de retirar aislamiento.

## 10. Legacy/compatibilidad

Búsqueda de `legacy`, `compat`, `fallback`, `migration`, `shim`, `bridge`, `interceptor`, `TODO` y equivalentes encontró consumidores activos en cart, navegación, diagnóstico, perfil, correo, visual builder y Apps Script.

- `KEEP`: fallbacks de red/App Check, guards de sesión, idempotencia, reglas de compatibilidad de perfil, bridge de Storage y adaptadores de diagnóstico.
- `REMOVE_AFTER_MIGRATION`: cart classic bridge, aliases de perfil, navegación `compatibilidad/*`, shims de runtime solo cuando sus consumidores desaparezcan.
- `INVESTIGATE`: wrappers Admin que asignan globals para handlers inline; requieren escaneo de HTML, imports dinámicos y scripts antes de eliminar.
- `DELETE_NOW`: ninguno.

## 11. Eventos/listeners/observers

Conteos estáticos: 752 `addEventListener`, 58 `onSnapshot`, 57 `MutationObserver`, 4 `ResizeObserver`, 2 `IntersectionObserver`, 18 `setInterval`, 195 `setTimeout`. Estos números incluyen páginas, Admin, tests y módulos de calidad; no prueban fugas por sí solos.

Hay unsubscribe explícito en cart/favoritos/pedidos y guards de boot en muchos módulos. Los listeners globales de navegación, storage, cart y Auth son intencionales. Riesgo no verificado: observers/timers de módulos de calidad y paneles Admin montados varias veces dentro de una misma SPA. Requiere perfilado de ciclo mount/unmount; no autoriza eliminación.

## 12. Checkout/pedidos

Ruta pública única verificada: cliente → `createOrderViaServer` → bridge Cloudflare/Apps Script → transacción server-side. El servidor deriva identidad desde token, vuelve a leer perfil/productos/configuración y valida precio, stock, entrega, tienda y permisos. `uid + requestId` identifica el pedido; `orderSequence`/TINPED se asigna en la transacción. Email usa claves idempotentes y reintentos acotados.

Admin tiene rutas separadas para CRUD/lifecycle, protegidas por rol y reglas; no se observó segunda ruta pública que cree pedidos. Firestore protege cantidades, precio, total, reserva y liberación de stock. Los tests cubren token vencido, doble submit, refresh/back, precio/stock cambiados, variantes, idempotencia, correo y limpieza.

## 13. Backend/seguridad

Firestore Rules separa cliente, Admin, pedidos, carrito e inventario; exige UID, rol/permisos, límites y transiciones válidas. Cloudflare valida origen/OIDC donde corresponde; Apps Script recibe identidad derivada del token. CSP/hash, headers, App Check, sanitización, CORS y endpoints administrativos tienen gates existentes.

Autoridades a vigilar: Sheets es upstream de catálogo/inventario operativo, pero no debe decidir precio final de un pedido ya en commit; el servidor vuelve a leerlo. Email, push y campana son efectos posteriores, no creadores de pedido. No se confirmó duplicación de descuento de stock.

## 14. Frontend estructural

No se repite la auditoría visual. Se observan capas de mantenimiento, compatibilidad, quality y loaders, además de headers/drawers públicos por dispositivo. Tienen imports o consumidores reales; no son `DELETE_NOW`.

`!important`, inline styles, `style.cssText`, globals y wrappers deben evaluarse por componente y contrato. La presencia de muchos overrides es deuda potencial, no evidencia de código muerto. La consolidación futura debe preservar los gates de navegación, responsive, accesibilidad y CSP.

## 15. Código muerto

No se identificó archivo o función con evidencia suficiente de cero consumidores. El manifiesto de diagnóstico, build, HTML, imports dinámicos, globals, tests y workflows son consumidores válidos aunque no aparezcan como imports estáticos.

## 16. Dependencias/build

`package.json` tiene 122 scripts, 0 dependencies de runtime y 6 `devDependencies`; `build:pages` genera/verifica rutas, flujos, CSP, manifiesto y versionado de cache. `diagnostic-manifest.json` es legítimamente generado y está protegido por drift.

`npm audit --omit=dev`: 0 vulnerabilidades. Auditoría completa: 2 moderadas, solo en dependencias de desarrollo según el árbol observado; no afectan runtime de producción. Hay warnings de Node por módulos ESM sin `type: module`; son deuda de tooling, no fallo funcional.

## 17. Escenarios de fallo

| Escenario | Degradación observada | Riesgo residual |
|---|---|---|
| red lenta/interrumpida | timeouts, fallbacks y reintentos acotados | estados parciales requieren UI clara |
| App Check lento/bloqueado | timeout 8 s y modo consulta | lecturas pueden quedar degradadas |
| token vencido | renovación única en clientes protegidos | repetir flujo debe conservar draft |
| usuario bloqueado | reglas/guards server-side | no confiar en flags locales |
| Firestore caído | error/fallback según módulo | no escribir datos críticos offline |
| precio/stock cambia | servidor rechaza y pide confirmar | correcto |
| doble click/submit | locks, cooldown y requestId | correcto en tests |
| refresh/back/forward checkout | draft y backup sessionStorage | estados antiguos requieren expiración |
| varias pestañas/dispositivos | sync remoto serializado por UID | carrera residual solo si módulo legacy escribe |
| dos cuentas navegador | claves por UID + guest scope | probar manualmente en browser real |
| logout/reapertura | Auth persistente y guards | evitar globals stale |
| móvil/tablet/desktop | gates responsive existentes | no repetir auditoría visual |

## 18. Autoridades duplicadas

1. Auth coordinado vs listeners directos: `REMOVE_AFTER_MIGRATION/INVESTIGATE`.
2. Carrito canónico vs `tt_cart`/Storage bridge: `REMOVE_AFTER_MIGRATION`.
3. Perfil actual vs aliases históricos: `REMOVE_AFTER_MIGRATION`.
4. Globals/handlers inline vs módulos ESM: `INVESTIGATE`.
5. Efectos de pedido email/push/campana: canales múltiples, no autoridad duplicada; `KEEP`.

## 19. Candidatos DELETE_NOW

Ninguno. La evidencia disponible no demuestra cero consumidores.

## 20. REMOVE_AFTER_MIGRATION

- `tt_cart` y bridge de Storage clásico.
- `interceptLegacyCartButtons` y aliases `CartFirestoreSync` cuando no haya HTML/consumidores clásicos.
- aliases históricos de perfil/onboarding después de backfill y observación de cuentas reales.
- módulos `js/components/navigation/compatibilidad/*` solo tras migrar referencias HTML/dinámicas.
- shims de diagnóstico solo si dejan de ser dependencias de tests y master diagnostics.

## 21. KEEP

Coordinador de sesión; `authStateReady`; guard App Check y timeout; carrito guest/account split; locks/requestId/idempotencia; transacción server-side de pedido/inventario; reglas Firestore; guards de perfil; retries de correo; fallback de producción; gates de build/drift; backups; health monitor; adaptadores que todavía tienen consumidores.

## 22. INVESTIGATE

- Migración gradual de 61 usos de `onAuthStateChanged`.
- Ciclo de vida de 57 MutationObservers y 195 timers.
- Inventario completo de 1.523 referencias `window.*` para detectar aliases sin consumidor.
- Archivos de navegación/quality que solo se carguen por páginas históricas.
- Scripts npm entre los 122 que no tengan referencia en HTML, tests, workflows o scripts.
- Dos vulnerabilidades moderadas de dev dependencies y warnings ESM.

## 23. NO TOCAR

No retirar todavía: `window.__TINTIN_APP_CHECK_STATE__`, `authStateReady`, bridge del carrito, claves migrated/dirty, `requestId`, locks de submit, fallback de App Check, retries idempotentes, guards de perfil, reglas de stock, backups, health checks, diagnostic shims y gates CI. Cada uno tiene consumidores o evita una falla documentada.

## 24. Plan de reparación por dependencias

**A — Seguridad/integridad:** mantener reglas, App Check, server-side order e idempotencia; completar pruebas multi-cuenta. Criterio: ningún pedido o stock decidido por navegador.

**B — Autoridades:** migrar listeners Auth directos y globals a APIs canónicas; medir mount/unmount. Criterio: un coordinador y contratos sin consumidores alternativos.

**C — Perfil:** backfill/telemetría de aliases; retirar onboarding legacy solo con cero cuentas dependientes. Criterio: cuenta activa completa nunca vuelve a incorporación.

**D — Carrito:** migrar lectores `tt_cart` y botones clásicos a runtime; validar pestañas/dispositivos. Criterio: Firestore/local guest como única autoridad.

**E — Firebase/App Check:** unificar importadores y confirmar que el guard global ya no sea necesario. Criterio: una identidad de módulo sin dobles inicializaciones.

**F — Storage/legacy:** borrar claves/bridges solo tras inventario y periodo de observación. Criterio: no hay productor ni consumidor.

**G — Checkout/pedidos:** conservar transacción y ampliar regresión de red/stock/precio. Criterio: reintento no duplica pedido ni inventario.

**H/I — muerto/frontend:** eliminar únicamente elementos probados sin referencias; mantener gates. Criterio: manifiesto, build, HTML, tests y runtime pasan.

**J/K — tooling/regresión:** resolver dev audit/ESM y correr suite completa. Criterio: build, reglas, browser, production smoke y drift verdes.

## 25. Pruebas/regresión necesarias

Mantener los 147 tests actuales y agregar, antes de cualquier migración: usuario nuevo → perfil → carrito → checkout → pedido; logout → login existente sin onboarding → restauración → nueva compra; guest cart → login → merge; dos pestañas; dos dispositivos; red inestable; App Check lento; precio/stock cambiado; doble submit; refresh/back.

Los contratos actuales ya protegen gran parte de estas rutas; los escenarios de browser real y multi-dispositivo requieren pruebas de integración, no solo regex/unit tests.

## 26. Totales por severidad

| Severidad | Confirmed | Risk | Not verified | Total |
|---|---:|---:|---:|---:|
| CRITICAL | 0 | 0 | 0 | 0 |
| HIGH | 0 | 2 | 0 | 2 |
| MEDIUM | 3 | 3 | 2 | 8 |
| LOW | 2 | 2 | 2 | 6 |

### Hallazgos agrupados

- **H-01 — HIGH / RISK / INVESTIGATE:** autoridades Auth directas además del coordinador; archivos: `coordinador-sesion.js`, `mantenimiento-producto.js`, `resenas-producto.js`, superficies Admin. Impacto: carreras o estado stale al cambiar identidad. Protección: `tests/cache/auth-flow-contract.test.mjs`, tests de login y browser.
- **H-02 — HIGH / RISK / KEEP:** estados críticos dependen de múltiples capas browser/Firestore/Apps Script; la ruta está protegida por server-side transaction e idempotencia, pero escenarios reales de red multi-dispositivo requieren integración. Protección: tests checkout, reglas, auditoría segura.
### Estado de remediación de HIGH

- **H-01 — [RESUELTO]:** los consumidores de aplicación ya delegan la observación de Auth en `subscribeAuthState`; el listener de Firebase queda centralizado en `coordinador-sesion.js`. Resolución: commit `85b764ad`. Validación: `tests/cache/auth-flow-contract.test.mjs`, incluyendo la regresión que bloquea listeners/imports directos fuera del coordinador, más los tests de login/perfil y checkout. Dependencias: ninguna adicional identificada.
- **H-02 — [PARCIAL]:** no se confirmó una falla funcional adicional ni se justificó modificar la ruta protegida; se conservaron la transacción server-side, la idempotencia y las validaciones existentes. Validación: tests de checkout y auditoría segura de pedidos. Pendiente: integración real de navegador/red multi-dispositivo, no ejecutable con la cobertura local disponible; por eso no se declara resuelto.

- **M-01 — MEDIUM / CONFIRMED / REMOVE_AFTER_MIGRATION:** bridge de carrito clásico activo; `sincronizacion-carrito.js`, `tienda.js`, analytics, catálogo, checkout legacy.
- **M-02 — MEDIUM / CONFIRMED / KEEP:** `__TINTIN_APP_CHECK_STATE__` y fallback de timeout; causa raíz: importadores dinámicos/identidades URL.
- **M-03 — MEDIUM / CONFIRMED / KEEP:** guards/idempotencia/retries de checkout; consumidores server-side y tests activos.
- **M-04 — MEDIUM / RISK / INVESTIGATE:** globals y handlers inline; 1.523 referencias `window.*`, consumidor exacto no siempre estático.
- **M-05 — MEDIUM / RISK / INVESTIGATE:** observers/timers potencialmente montados repetidamente; conteo estático no prueba fuga.
- **M-06 — MEDIUM / CONFIRMED / REMOVE_AFTER_MIGRATION:** aliases históricos de perfil/onboarding; tests los requieren para cuentas legacy.
- **L-01 — LOW / CONFIRMED / INVESTIGATE:** 2 vulnerabilidades moderadas exclusivamente dev; producción: 0.
- **L-02 — LOW / CONFIRMED / INVESTIGATE:** warnings ESM de tooling por módulos sin `type: module`.
- **L-03 — LOW / RISK / KEEP:** capas de compatibilidad/navegación/diagnóstico con consumidores de build, HTML o tests.

## Conclusión

La arquitectura operativa actual es coherente en las rutas críticas. La limpieza segura depende de migraciones de consumidores, no de antigüedad aparente. No se recomienda eliminar código ahora; el siguiente trabajo debe ser instrumentar consumidores y migrar una autoridad por vez, con regresión de identidad, carrito y pedido antes de cada retiro.
