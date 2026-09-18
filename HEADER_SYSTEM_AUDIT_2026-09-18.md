# Header System A→Z Audit — 2026-09-18

Este documento conserva la evidencia de auditoría de GitHub CI/Notifications asociada al trabajo de Header System. La auditoría visual y funcional completa del Header queda pendiente de ejecutarse con la instrumentación de performance requerida.

## GitHub CI / Notifications

### Criterio

Se consultaron las notificaciones autenticadas y los runs/checks de GitHub para `tintinaccs/tintin-web`. No se marcaron notificaciones como leídas, no se borró evidencia, no se cambiaron preferencias y no se desactivó ningún workflow.

Se encontraron 50 notificaciones del repositorio, de las cuales 34 eran actividad CI con fallo histórico. Se correlacionaron con 39 runs únicos `CI Tintin — contrato único` fallidos y 6 cancelados dentro del historial de las ramas notificadas. Las X no representan por sí solas el estado de `main`.

| RUN | WORKFLOW | BRANCH | SHA | PR | RESULT | CAUSE | CURRENT STATUS | ACTION REQUIRED |
|---|---|---|---|---:|---|---|---|---|
| 35352995483, 35343629614 | CI Tintin — contrato único | `feature/global-session-restore-20260918` | `0d0b3427`, `b90e61f7` | 838 | FAILURE | Drift detectado: `diagnostic-manifest.json` y artefactos derivados cambiaron durante el build | HISTORICAL_SUPERSEDED; 35353496094 pasó y #838 fue mergeada | Ninguna sobre `main` |
| 35344859567 | CI Tintin — contrato único, attempt #3 | `feature/global-session-restore-20260918` | `3eca7880` | 838 | FAILURE | Gate Header desktop esperaba 2 enlaces de login en `#account-panel` y recibió 0 | FIXED_BY_LATER_RUN; el SHA final de #838 pasó | Ninguna |
| 35344479373, 35343928953, 35342441937 | CI Tintin — contrato único | `feature/global-session-restore-20260918` | `17afc3e5`, `dfbb1e43`, `66188ec1` | 838 | FAILURE | Contrato Super Admin: `admin.html` no cargaba el módulo versionado de borrado global | FIXED_BY_LATER_RUN; el SHA final de #838 pasó | Ninguna |
| 35342417527 | CI Tintin — contrato único | `feature/global-session-restore-20260918` | `f7be056b` | 838 | CANCELLED | Run superseded mientras avanzaba la rama | HISTORICAL_SUPERSEDED | Ninguna |
| 35275700937 | CI Tintin — contrato único | `feature/comments-reports-notifications-20260917` | `e46ae494` | 834 | FAILURE | Drift detectado por `git diff --exit-code` | FIXED_BY_LATER_RUN; 35286329766 pasó y #834 fue mergeada | Ninguna |
| 35269424718, 35263114766 | CI Tintin — contrato único | `feature/flow-connections-production-green-20260917` | `1c52b86e`, `2430afd` | 833 | FAILURE | Drift detectado en artefactos derivados | FIXED_BY_LATER_RUN; 35269769592 pasó y #833 fue mergeada | Ninguna |
| 35262892618 | CI Tintin — contrato único | `feature/flow-connections-production-green-20260917` | `7943fcb9` | 833 | FAILURE | Playwright no tenía instalado `chrome-headless-shell` | ENVIRONMENTAL_FAILURE_RESOLVED; run posterior pasó | Ninguna |
| 35256995730 | CI Tintin — contrato único | `feature/super-admin-a2z-products-import-20260917` | `aedacbba` | 832 | FAILURE | Gate responsive recibió 54px donde esperaba 48px | FIXED_BY_LATER_RUN; 35259440008 pasó y #832 fue mergeada | Ninguna |
| 35231030892, 35230736963 | CI Tintin — contrato único | `feature/product-lcp-surgical-20260917` | `5f29a0cd`, `0b9ca4cb` | 831 | FAILURE | Drift detectado y contrato estático durante iteraciones de la rama | FIXED_BY_LATER_RUN; 35234778955 pasó y #831 fue mergeada | Ninguna |
| 35214585903 | CI Tintin — contrato único | `feature/final-production-closure-20260917` | `011d9863` | 830 | FAILURE | Playwright no tenía disponible el ejecutable Chromium | ENVIRONMENTAL_FAILURE_RESOLVED; 35214903184 pasó | Ninguna |
| 35214308533 | CI Tintin — contrato único | `feature/final-production-closure-20260917` | `465aaeb3` | 830 | FAILURE | Drift detectado | FIXED_BY_LATER_RUN; PR mergeada | Ninguna |
| 35137665037 | CI Tintin — contrato único | `main` | `25bb9e25` | — | FAILURE | Performance gate: CLS `0.808`, presupuesto `<= 0.1`, en `terminos.html` | HISTORICAL_SUPERSEDED; múltiples `main` posteriores y el HEAD actual pasan | Ninguna sobre el HEAD actual |
| 35124521549 | CI Tintin — contrato único | `feature/premium-performance-ux-20260916` | `4005f314` | 826 | FAILURE | Gate browser Header falló por contrato visual; el retry volvió a fallar | FIXED_BY_LATER_RUN; 35125062459 pasó y #826 fue mergeada | Ninguna |
| 35107567695, 35105165474, 35102586899, 35099754444, 35097204774, 35095625034 | CI Tintin — contrato único | `feature/full-journey-high-remediation-20260916` | varios | 825 | FAILURE | Iteraciones con fallos de build, contratos Super Admin, browser/performance y artefactos | FIXED_BY_LATER_RUN; 35111336769 pasó y #825 fue mergeada | Ninguna |
| 35088983980 | CI Tintin — contrato único | `feature/github-actions-operational-audit-20260916` | `c795dea1` | 824 | FAILURE | `diagnostic-manifest.json` quedó diferente después del build | FIXED_BY_LATER_RUN; 35089646674 pasó y #824 fue mergeada | Ninguna |
| 35144476202, 35143001697 | CI Tintin — contrato único | `branch/asi-sale-ahora-haqhxh` | varios | 829 | FAILURE | Iteraciones previas de la corrección de CLS/header | FIXED_BY_LATER_RUN; #829 fue mergeada | Ninguna |
| 35043046584, 35042711856 | CI Tintin — contrato único | `feature/admin-order-save-fix` | varios | 823 | FAILURE | Iteraciones previas: browser gate y drift detectado | FIXED_BY_LATER_RUN; 35046894087 pasó y #823 fue mergeada | Ninguna |
| 35047546976, 35047238310, 35044103424, 34842203706 | CI Tintin — contrato único | `dependabot/npm_and_yarn/browser-tests-3ec7d418d0` | varios | 792 | FAILURE | Browser/performance y drift durante la actualización de dependencias | FIXED_BY_LATER_RUN; #792 fue mergeada | Ninguna |
| 35047003021, 35044105383 | CI Tintin — contrato único | `dependabot/npm_and_yarn/firebase-tooling-d757f2458d` | varios | 791 | FAILURE | Drift generado durante la actualización de dependencias | FIXED_BY_LATER_RUN; #791 fue mergeada | Ninguna |
| 35046010342, 35045603655 | CI Tintin — contrato único | `fix/favorites-cart-badge-auth-flash` | varios | 799 | FAILURE | Browser gate y luego versionado de caché (`tienda.js` cambió sin bump) | FIXED_BY_LATER_RUN; #799 fue mergeada | Ninguna |
| 34219843065 | CI Tintin — contrato único | `branch/asi-sale-ahora-haqhxh` | `c9477758` | 729 | FAILURE | Drift detectado por cambios de contenido/versionado | HISTORICAL_SUPERSEDED; #729 fue mergeada | Ninguna |

### Clasificación consolidada

- `ACTIVE_FAILURE`: ninguno en el HEAD actual de `main`.
- `HISTORICAL_FAILURE`: todos los fallos de las notificaciones revisadas pertenecen a SHAs anteriores.
- `HISTORICAL_SUPERSEDED`: runs de ramas mergeadas, runs de `main` reemplazados y cancelaciones por supersesión.
- `FIXED_BY_LATER_RUN`: sí; las ramas relevantes tienen un run posterior GREEN y sus PR fueron mergeadas.
- `RESOLVED_AFTER_RETRY`: no se encontró un mismo SHA cuyo attempt posterior pasara; el caso visible `Attempt #3` también falló y se resolvió con commits posteriores.
- `FLAKY`: no confirmado. Un run histórico reportó un retry/flaky de Playwright, pero no hay evidencia suficiente para declarar el test establemente flaky.
- `DUPLICATE_NOTIFICATION`: sí, conceptualmente; varias X corresponden a iteraciones de la misma rama/PR, no a incidentes independientes.
- `EXPECTED_FAILURE`: cancelaciones por supersesión se consideran esperadas; no se interpretan como bug.
- `UNKNOWN`: ninguno entre los runs revisados.

## Current main CI

HEAD real: `6844d753c3ffc1a015e990a7fc7725e5aedd8dcc`.

| Check | Resultado | Evidencia |
|---|---|---|
| Repository audit | GREEN | Run `35354667481` |
| Analyze Actions | GREEN | Run `35354667391` |
| Analyze JS | GREEN | Run `35354667391` |
| CodeQL required check | GREEN | Run `35354667391` |
| Cloudflare Pages | GREEN | Check del commit actual; deployment `945789c0-824f-4b88-8499-6ebcee4cc922` |
| Producción real | GREEN | Run `35359543065` |
| Drenar cola vía Cloudflare con OIDC | GREEN | Run `35360516922` |

El endpoint público de producción sigue siendo `https://tintinaccesorios.pages.dev`; no se usó `tintinaccs.com` como autoridad de Pages.

## Header PR CI

No existe una PR abierta para Header System A→Z. La PR de Header más reciente, #829, está MERGED. Por lo tanto, los checks de Preview de una PR Header actual son `N/A`, no GREEN pendiente de merge.

## CodeQL advisories

El check requerido está GREEN, pero la API de Code Scanning reporta 55 alertas abiertas preexistentes: 54 `high` y 1 `medium`, creadas entre `2026-08-21` y `2026-09-10`. Principales reglas: `js/incomplete-multi-character-sanitization` (24), `js/bad-tag-filter` (16), `js/incomplete-url-substring-sanitization` (5) y `js/xss-through-dom` (4). Son deuda de seguridad separada; no se modificaron ni se ocultaron en esta auditoría y deben tratarse en un trabajo explícito de seguridad.

## Estado final

- `CI HEALTH`: CLEAN para `main`; PARTIAL a nivel repositorio por las 55 alertas CodeQL abiertas.
- `ACTIVE BLOCKERS`: ninguno para el HEAD actual de `main`; no hay PR Header abierta que pueda declararse lista para merge.
- `HISTORICAL ONLY`: las X de CI enumeradas arriba.
- Notificaciones: permanecen sin marcar como leídas para conservar la evidencia y permitir decisión manual del usuario.

## Implementación Header System A→Z — continuación

### Baseline funcional

- `npm run audit:unified-navigation`: baseline identificó dos gaps reproducibles: la superficie de Alertas no tenía un z-index literal en el contrato estático y el ciclo de carga diferida de colecciones informativas no inicializaba el módulo después de importarlo.
- `npm run test:navigation-header`: baseline `9 passed`, `1 skipped`; el caso omitido corresponde a una ruta institucional no aplicable.
- No se modificaron Auth, persistencia de sesión, App Check, Firestore Rules, checkout, stock, precio, idempotencia, DNS ni Shopify.

### Cambios implementados

- Se conservó una única arquitectura de superficies y se reforzó `#notifications-drawer` con capa global explícita `z-index: 1460`, fondo blanco sólido, sin imagen ni backdrop blend.
- Se hizo explícito el versionado de caché del Header System para `configuracion.js`, `carga-navegacion.js`, `recursos-navegacion.js`, entry/header desktop/tablet y hojas HTML sincronizadas.
- `loadCollectionsRuntime()` ahora inicializa `initNavCollections()` tras la importación idle; esto evita que el primer acceso a Tienda en páginas informativas dependa de una segunda interacción.
- Se agregó prueba browser determinista de Alertas: apertura, foco, capa sólida y cierre con Escape.

### Validación posterior

- `npm run audit:unified-navigation`: GREEN; 12 anchos, 13 rutas y ciclos desktop/tablet/mobile correctos.
- `npm run audit:cache-versioning`: GREEN; URLs inmutables sin reutilización con bytes distintos.
- `npm run test:navigation-header`: GREEN en ejecución final, `10 passed`, `1 skipped`; la primera ejecución tuvo una única falla de compactación mobile bajo paralelismo que no se reprodujo en repetición aislada ni en la ejecución posterior.
- Chrome DevTools MCP: `NOT_AVAILABLE`; la validación browser se realizó con Playwright y gates existentes.
- `npm run audit:final`: GREEN; todas las fases del audit final terminaron sin fallos.
- `npm run build`: GREEN; sincronización pública, contratos, CSP, rutas y manifest regenerado sin drift posterior.
- Contratos de producto y regresión: accounts `14 passed`, engagement `44 passed`, site activity `4 passed`, checkout `87 passed`, cart persistence `4 passed`, flow connections `14 passed`.
- Admin y accesibilidad: admin sync `27 passed`, admin foundation GREEN, admin responsive `10/10`, accessibility `5 passed`.
- Performance browser: PARTIAL por variación ambiental del presupuesto de requests/INP en `index.html`; la ejecución aislada pasó en una repetición y otra excedió el presupuesto sin regresión determinista del Header.
- SEO browser: PARTIAL por el header `x-tintin-product-meta` ausente en el servidor local/proxy de la prueba; no corresponde a una modificación del Header System.
