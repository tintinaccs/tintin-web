# Premium performance audit

Work branch: `premium-performance-ux-20260916`
Base: `04024241ea0b5dae48c8227c3c5585720d3b8cce` (merge de #825)
Fecha: 2026-09-16

## Método

Baseline tomado antes de cambios de aplicación con `npm run audit:performance`,
`npm run audit:performance-regressions`, `npm run audit:page-loading`,
`npm run audit:cache-versioning` y `npm run test:performance` contra
`https://tintinaccesorios.pages.dev`, Chromium, red real sin throttling. Los
valores de navegador son una muestra de laboratorio y no representan RUM.

## Baseline antes de cambios

| Ruta | Viewport | DCL | LCP | INP | CLS | transfer | requests | first-party | Firestore |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | desktop Chromium | 835 ms | 680 ms | 32 ms | 0.727 | 4,133 KB | 188 | 2,373 KB | 0 |
| `/catalogo` | desktop Chromium | 651 ms | 528 ms | 40 ms | 0.827 | 2,285 KB | 166 | 652 KB | 0 |
| `/collections` | desktop Chromium | 939 ms | 836 ms | 32 ms | 0.808 | 1,814 KB | 148 | 582 KB | 0 |
| `/login` | desktop Chromium | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | 1,003 KB | 151 | NOT_MEASURED | NOT_MEASURED |
| `/product` | — | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| `/perfil` | — | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| `/checkout` | — | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| `/contact` | — | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |

The generic public suite currently excludes `product.html`; it was recorded as
NOT_MEASURED rather than using a fake product. Mobile 390x844, tablet 768x1024,
warm load, internal navigation, TTFB, long tasks and business interaction
feedback were not exposed by the existing production harness and remain
NOT_MEASURED in this baseline.

## Findings

- Hero PNGs: desktop 1,537,376 B; mobile 1,530,960 B; tablet landscape
  1,681,702 B; tablet portrait 1,534,558 B.
- The home and catalog runs show large layout shifts (0.727 and 0.827), so
  visual stability is a first-class optimization target.
- `firebase.js` creates Auth, Firestore and App Check in one module. App Check
  enforcement and Firestore rules are security boundaries and are not changed
  by this work.
- `carga-navegacion.js` imports desktop, tablet and mobile behaviors together.
- Existing static audits were green before changes; the performance browser
  suite had the existing bootstrap gate failure and public-page failures where
  CLS exceeded the current 0.1 budget. These are preserved as baseline facts.

## Después de cambios

The local browser harness was rerun after the changes. These values are useful
for regression evidence, but are not declared as an ANTES/DESPUÉS improvement
against the production baseline above because the origin/network differs.

| Ruta | Viewport | DCL | LCP | INP | CLS | transfer | requests | first-party | Firestore |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | local desktop | 1,313 ms | 788 ms | 96 ms | 0 | 2,005 KB | 140 | 1,658 KB | 0 |
| `/catalogo` | local desktop | 677 ms | 524 ms | 56 ms | 0 | 1,651 KB | 129 | 1,304 KB | 0 |
| `/collections` | local desktop | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| `/product` | production product | 2,439 ms | 3,696 ms | NOT_MEASURED | 0.706 | 1,045 KB | 148 | NOT_MEASURED | 0 |
| `/login` | local desktop | 532 ms FCP | NOT_MEASURED | NOT_MEASURED | 0 | 1,883 KB | 153 | NOT_MEASURED | NOT_MEASURED |
| `/perfil` | — | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| `/checkout` | — | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED |
| `/contact` | local desktop | 351 ms | 160 ms | 48 ms | 0.808 | 1,475 KB | 110 | 1,129 KB | 0 |

Hero assets after optimization: desktop 108,734 B (PNG baseline 1,537,376 B),
mobile 114,490 B (1,530,960 B), tablet landscape 107,924 B (1,681,702 B),
tablet portrait 115,036 B (1,534,558 B). The same `<picture>` keeps the PNG
fallback and serves one WebP source per matching viewport.

Deterministic premium gate: 9/9 checks passed. Navigation/header: 9 passed,
1 skipped. Canonical viewports: 126/126 passed. Global responsive geometry:
187/187 passed. Product browser gate passed against the live product and the
local server fixture covers server-rendered product metadata. The existing
local public performance gate still reports CLS 0.808 on several institutional
routes and therefore is not claimed green; the cause remains documented for
follow-up rather than being hidden or excluded.

Firebase/App Check: no security-sensitive lazy split was made. The consumer map
shows Firestore/App Check are shared by public content, catalog, cart, product,
reviews, profile and checkout; the safe result for this branch is
`no seguro` to separate further without a dedicated contract test. Auth,
Firestore, App Check enforcement, rules, checkout, price, stock and order
idempotency were not weakened or changed.
