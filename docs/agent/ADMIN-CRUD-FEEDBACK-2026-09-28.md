# Admin CRUD progress and result feedback — 2026-09-28

## Implemented on the local preparation branch

Individual admin mutations now use the existing operations panel and its real progress loader. The loader appears centered over a dimmed page before the write, advances through the mutation's actual stages, and opens the centered result dialog after completion or failure.

- Products: create, edit, delete, activate/deactivate, inventory updates, Sheets synchronization, and list refresh.
- Collections: create, edit, rename with product reassignment, delete with product reassignment, reorder, product membership changes, and default initialization.
- Customers: role changes, block, restore, and permanent account deletion.
- Orders: payment and fulfillment status changes, edit with optimistic-concurrency check, move to Borrados, inventory release, and list/audit updates.
- A product document ID is kept in the form immediately after creation, so failure in a later inventory/Sheets step can be retried as an update rather than creating a duplicate.
- Bulk operations use the same centered loader with per-item progress.

## Verification

- `node --check js/admin/admin-app.js`: pass.
- `npm run audit:products-media`: pass, 41 checks, including progress stages for product/collection CRUD and duplicate-safe retry.
- `npm run audit:admin-orders`: pass, 32 checks, including progress stages and the existing concurrency and recoverable-trash contracts.
- `npm run audit:users-roles`: pass, 25 checks, including progress stages for role, block, restore, and delete.
- `node --test tests/operations/nucleo-operaciones.test.mjs tests/operations/integration-router-security.test.mjs`: pass, 12 tests.
- `npm run test:admin-operations-browser`: pass, 2/2 Chromium tests. The tests assert geometric centering while a mutation is in progress, loader dismissal after completion, and the central result dialog for both success and failure. The command is included in the browser-gate step of `.github/workflows/auditar-tintin.yml`.
- `npm run build:pages`: pass; diagnostic manifest validates 19 pages, CSP/routes, and 286 versioned assets with 79 dynamic loads resolved.
- `npm run audit:final`: pass on the current local branch.
- `npm audit --audit-level=moderate`: pass, zero known vulnerabilities in the installed lockfile.

## Scope and release state

These changes are local to the preparation branch and have not been deployed or merged. The new browser test exercises the shared progress/result component in a local browser fixture; it does not write to Firestore, and an authenticated browser session has not exercised each mutation against production. See `PRODUCTION-PROBE-2026-09-28.md`: the custom domain still resolves to Shopify and the Pages catalog is empty, so import/cutover readiness is not established.
