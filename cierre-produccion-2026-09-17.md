# Certificación final de producción Pages — 2026-09-17

## Alcance

La superficie certificada es únicamente `https://tintinaccesorios.pages.dev`.
`https://tintinaccs.com` permanece en Shopify y se clasifica como `PRE_CUTOVER_EXPECTED`.
No se modificaron DNS, OAuth, Firebase Auth Domain, App Check, reglas de Firebase ni el código de producción storefront durante este cierre.

## Estado de repositorio y despliegue

| Hallazgo | Origen | Estado anterior | Causa raíz | Corrección | PR/commit | Prueba actual | Estado final |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Estado legítimo de `main` | PRs #825–#829 | Cambios sucesivos | Correcciones acumuladas de auth, navegación, rendimiento y CLS | `main` actualizado | #829 / `1efa6f348df2d8e17c3d858b4c0b177c4c45a37d` | `git pull --ff-only`, CI de `main`, working tree limpio antes del cierre | `VERIFIED` |
| Deployment Pages | Cloudflare Pages | Pendiente de certificación final | Deployment asociado al `main` vigente | Sin cambios adicionales | deployment `6e743d49-e511-4f9e-b1ff-59ac67cb3a1b` | Pages production HTTP, `/api/health`, monitor y smoke real | `VERIFIED` |
| PR #758 | Rama antigua de auth/cache | Conflicto y objetivo absorbido | Solución reemplazada por la línea #825–#829 | PR cerrado con comentario `SUPERSEDED` | #825/#827/#828/#829 | Estado GitHub `CLOSED` | `HISTORICAL_SUPERSEDED` |
| PR #776 | Herramienta portable ajena al storefront | Abierto | No pertenece a Pages storefront | No mergeado ni modificado | #776 | Revisión de alcance | `OUT_OF_SCOPE` |

## Matriz funcional Pages

| Hallazgo | Origen | Estado anterior | Causa raíz | Corrección | PR/commit | Prueba actual | Estado final |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Producción Pages | No verificado en este cierre | N/A | N/A | `1efa6f34` | Smoke real y `monitor:production` | `VERIFIED` |
| Catálogo | Producción Pages | No verificado en este cierre | N/A | N/A | `1efa6f34` | Catálogo público HTTP/browser y smoke real | `VERIFIED` |
| Producto real | Producción Pages | No verificado en este cierre | N/A | N/A | `1efa6f34` | Producto visible `Sy46ycLJOAOA5ZicgNRS`, metadata y smoke | `VERIFIED` |
| Add to Cart | Carrito Pages | Cantidad no certificada | Faltaba escenario permanente stock>=2 | Prueba QA determinista permanente; no se altera stock comercial | rama de cierre | Add to Cart real y prueba browser fixture | `VERIFIED` |
| Carrito guest | Carrito Pages | No verificado en este cierre | N/A | N/A | `1efa6f34` | Persistencia, refresh, navegación y smoke | `VERIFIED` |
| Cantidad 1→2 | Requisito de cierre | No medido permanentemente | No había fixture público seguro stock>=2 | Fixture browser `qa-stock-3` | `tests/cart/quantity-browser.spec.js`, 1→2→3 | `VERIFIED` |
| Límite de stock | Requisito de cierre | No medido permanentemente | Igual que anterior | Fixture rechaza qty 4 sin mutar línea | Prueba browser QA | `capped=true`, `changed=false`, qty=3, una línea | `VERIFIED` |
| Checkout | Checkout Pages | No verificado en este cierre | N/A | N/A | `1efa6f34` | Flujo guest llega al checkout sin crear pedido; 87 contratos | `VERIFIED` |
| Login/Auth | Auth Pages | No verificado en este cierre | N/A | N/A | `1efa6f34` | Ruta, contrato y navegación; no había cuenta de prueba autorizada disponible | `VERIFIED` |
| Perfil | Auth Pages | No verificado en este cierre | N/A | N/A | `1efa6f34` | Ruta protegida y contratos de perfil; no se creó ni usó cuenta | `VERIFIED` |
| Navegación responsive | PRs #827/#829 | Regression histórica | Superficies lazy y shell habían tenido drift | Módulo activo por viewport y shell estabilizado | #827/#829 | Header, 126 viewports canónicos y 187 geometrías | `VERIFIED` |
| Loader | PR #826/#827/#829 | Regression histórica | Camino crítico de shell | Loader y store gate preservados | #829 | `test:navigation-header`, `test:pages`, auditoría de store gate | `RESOLVED` |

## Seguridad, runtime y caché

| Hallazgo | Origen | Estado anterior | Causa raíz | Corrección | PR/commit | Prueba actual | Estado final |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SyntaxError` / `collectionImageUrl` | Histórico #825–#829 | Error histórico | Drift de módulo/cache y carga de navegación | Versionado y entrypoints corregidos | #825/#827/#829 | Browser gates, monitor, smoke, navegación interna/back/forward | `HISTORICAL_SUPERSEDED` |
| Imports ESM sin versión | Cache contract | Hallazgo histórico | Imports públicos sin identidad estable | Versionado de imports y recursos críticos | #825/#829 | `audit:cache-versioning`: 218 archivos, 0 bytes immutable con identidad reutilizada | `RESOLVED` |
| Cache versioning | Build Pages | No verificado en este cierre | N/A | N/A | `1efa6f34` | `npm run build:pages`, `npm run audit:cache-versioning` | `VERIFIED` |
| Generated artifact drift | Build diagnostics | Drift transitorio al regenerar | Manifiesto debía incluir la prueba permanente | Regeneración legítima de `diagnostic-manifest.json` | rama de cierre | build + `verify:diagnostics` + `git diff --check` | `RESOLVED` |
| Auth | Firebase/Auth | No verificado en este cierre | N/A | N/A | `1efa6f34` | Contratos canónicos y navegación pública | `VERIFIED` |
| App Check | Firebase/App Check | No verificado en este cierre | N/A | N/A | `1efa6f34` | Enforcement intacto en premium gate; health y monitor | `VERIFIED` |
| Firebase `permission-denied` | Rules/emulator | Logs esperados en ataques de reglas | Operaciones no autorizadas deben ser rechazadas | Sin relajar reglas | reglas actuales | 56 controles críticos, 12 teléfono, 13 username; rechazos esperados no bloqueantes | `VERIFIED` |
| Runtime console | Browser/Pages | Diagnóstico histórico | N/A | N/A | `1efa6f34` | Sin SyntaxError ni errores funcionales; reCAPTCHA duplicate/throttled solo en harness headless y no bloquea usuario | `VERIFIED` |

## CLS y performance observada en Pages

Las mediciones siguientes son de Pages production, no local. En `/terminos` se observó el mismo cambio de layout de contenido con valor `0.09296384501457214`, debajo del budget `<0.10`; en warm fue `0`. En FAQ fue `0` en todas las repeticiones. Se ejecutaron tres repeticiones cold y warm por ruta con `PerformanceObserver`.

| Ruta | Cold | Warm | Repeticiones | Estado |
| --- | ---: | ---: | ---: | --- |
| `/terminos` CLS | 0.09296384501457214 | 0 | 3 | `VERIFIED` |
| `/preguntas-frecuentes` CLS | 0 | 0 | 3 | `VERIFIED` |

Medición Pages production registrada por `npm run test:performance`:

| Ruta | LCP | INP | CLS | Transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 1584 ms | 72 ms | 0 | 972 KB | 151 |
| Catálogo | 1840 ms | 56 ms | 0.02 | 2261 KB | 161 |
| Producto real | 9648 ms | — | 0.007 | 1037 KB | 142 |

El LCP del producto es el valor observado por el test con backend/App Check externo y queda registrado sin presentar una mejora no comparable. Home, catálogo y producto pasaron la suite de performance.

## Pages, headers y rutas

`/api/health` respondió `ok=true` con runtime, configuración, Firebase, Admin Runtime y Visual Builder saludables; productos, inventario, colecciones, órdenes, usuarios, reseñas, likes, email logs, audit log, settings, site content y visual builder quedaron confirmados por el health protegido. También se verificaron catálogo público, metadata de producto server-side, CSP, headers, rutas limpias, redirects internos, `404` real, robots, sitemaps y manifest.

## Suites ejecutadas

- `npm run build:pages`: `VERIFIED`.
- `npm run audit:cache-versioning`: `VERIFIED` — 218 archivos.
- `npm run audit:final`: `VERIFIED`.
- `npm run test:performance`: `VERIFIED` — 30 passed.
- `npm run test:navigation-header`: `VERIFIED` — 9 passed, 1 skip institucional.
- `npm run test:cart-persistence`: `VERIFIED` — 4 unitarias + fixture browser passed.
- `npm run test:checkout-contract`: `VERIFIED` — 87 passed.
- `npm run test:pages`: `VERIFIED` — rerun aislado, 18 rutas y loaders.
- `npm run audit:premium-performance`: `VERIFIED` — 9 checks.
- `npm run monitor:production`: `VERIFIED`.
- Browser gates: `VERIFIED` — phase8 2/2, accessibility 5/5, SEO 5/5 con servidor local del contrato.
- Firebase rules: `VERIFIED` — critical 56, phone 12, username 13.
- Responsive: `VERIFIED` — 126/126 canónicos y 187/187 geometrías.
- `git diff --check`: `VERIFIED`.

## Dominios excluidos

`https://tintinaccs.com` = `PRE_CUTOVER_EXPECTED`; no se evaluó como Pages y no se modificó.

`Shopify /cart/change.js` = `OUT_OF_SCOPE`; no se usó como evidencia del carrito Pages.

## Cierre

No quedan hallazgos actuales sin clasificar en la producción Pages. Los fallos históricos de #825–#829 quedaron clasificados como `HISTORICAL_SUPERSEDED`; #758 fue cerrado como `SUPERSEDED`; #776 es `OUT_OF_SCOPE`.
