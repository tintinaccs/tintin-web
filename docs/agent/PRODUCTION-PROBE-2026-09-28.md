# Production readiness probe — 2026-09-28

Read-only snapshot taken at 2026-09-28 03:21 UTC while preparing the Shopify-independent storefront. DNS and public HTTP endpoints were queried directly; no production settings, customer data, catalog records, or DNS records were changed.

## Results

| Probe | Result | Interpretation |
| --- | --- | --- |
| `tintinaccs.com` A record | `23.227.38.65` | Shopify storefront edge, not Cloudflare Pages. |
| `www.tintinaccs.com` CNAME | `shops.myshopify.com` | `www` still routes to Shopify. |
| Authoritative nameservers | `gemma.ns.cloudflare.com`, `leo.ns.cloudflare.com` | DNS zone is hosted on Cloudflare; the website records have not been cut over. |
| `https://tintinaccs.com/` | HTTP 200; Shopify HTML includes `cdn.shopify.com` | The live custom domain is still served by Shopify. |
| `https://tintinaccs.com/api/health` | HTTP 404 | Pages Functions are not serving on the custom domain. |
| `https://tintinaccs.com/sitemap.xml` | HTTP 200; Shopify sitemap index | Current indexed-site sitemap belongs to Shopify. |
| `https://tintinaccesorios.pages.dev/api/health` | HTTP 200; runtime, Firebase and admin capabilities reported healthy | Pages deployment is operational on its preview hostname. This does not prove checkout, email delivery, or authenticated CRUD end to end. |
| `https://tintinaccesorios.pages.dev/api/public-catalog?resource=products` | HTTP 200; `count: 0` | No public products are available for end-to-end storefront or purchase validation. |
| `https://tintinaccesorios.pages.dev/sitemap-products.xml` | HTTP 200; empty URL set | No product URLs can be indexed from Pages yet. |

## Decision

**Not ready to cut over the domain.** The domain still routes to Shopify, and the Pages catalog and product sitemap are empty. Keep Shopify available while the owner imports the real catalog and verifies product records, collections, variants, inventory, and images. Then validate media independence, product and collection pages, cart, checkout, stock updates, order emails, account flows, and search indexing on Pages before changing DNS or closing Shopify.

This probe establishes routing and deployment availability only. It does not certify authenticated checkout, payment-provider credentials, email delivery, App Check, full customer lifecycle behavior, or Search Console indexing.

## Follow-up recheck — 2026-09-28 04:12 UTC

Read-only recheck after the latest local repository work. No DNS or production settings were changed.

| Probe | Result | Interpretation |
| --- | --- | --- |
| `tintinaccs.com` A record | `23.227.38.65` | Still resolves to Shopify's storefront edge. |
| `www.tintinaccs.com` CNAME | `shops.myshopify.com` | Still routes to Shopify. |
| `https://tintinaccs.com/` and `https://www.tintinaccs.com/` | HTTP 403 from this probe | The custom host did not serve the Pages site in this check; the response alone does not identify why it was denied. |
| `https://tintinaccs.com/api/health` | HTTP 403 from this probe | This does not prove Pages Functions are active on the custom domain. DNS still points to Shopify. |
| `https://tintinaccesorios.pages.dev/` | HTTP 200 | The Pages hostname serves the deployed site. |
| `https://tintinaccesorios.pages.dev/api/health` | HTTP 200; `ok: true`; runtime, configuration, Firebase, Admin runtime, Visual Builder, and listed data surfaces report healthy | Service health is green on the Pages hostname. It does not prove a complete customer purchase or real payment/email delivery. |
| `https://tintinaccesorios.pages.dev/api/public-catalog?resource=products` | HTTP 200; `count: 0` | There is still no product catalog to validate purchases against. |
| `https://tintinaccesorios.pages.dev/sitemap-products.xml` | HTTP 200; empty URL set | There are still no product URLs for search engines to index. |

The 04:12 UTC check supersedes the earlier HTTP status snapshots for the custom hostname. The DNS and catalog blockers remain unchanged, so the migration decision remains **not ready**.

## Follow-up recheck — 2026-09-28 04:59 UTC

Read-only recheck during the current continuation. DNS still routes the commercial host to Shopify; the HTTP status has recovered from the prior 403 response. No production settings or DNS records were changed.

| Probe | Result | Interpretation |
| --- | --- | --- |
| `tintinaccs.com` A record | `23.227.38.65` | Still resolves to Shopify's storefront edge. |
| `www.tintinaccs.com` CNAME | `shops.myshopify.com` | Still routes to Shopify. |
| `https://tintinaccs.com/` | HTTP 200; Shopify storefront HTML | Apex is operational on Shopify, not Pages. |
| `https://www.tintinaccs.com/` | HTTP 301 | Redirects to the apex; DNS still points `www` at Shopify. |
| `https://tintinaccesorios.pages.dev/` | HTTP 200 | Pages site responds on its current public hostname. |
| `https://tintinaccesorios.pages.dev/api/health` | HTTP 200; `ok: true` | Pages service reports healthy; this alone does not prove customer-facing transactions. |
| `https://tintinaccesorios.pages.dev/api/public-catalog?resource=products` | HTTP 200; `count: 0` | Product catalog is still empty. |
| `https://tintinaccesorios.pages.dev/sitemap-products.xml` | HTTP 200; no `<loc>` entries | Product sitemap is still empty. |

This recheck supersedes the 04:12 HTTP status for the custom host. Domain routing and empty catalog still prevent the cutover; decision remains **not ready**.

## Follow-up recheck — 2026-09-28 06:14 UTC

Read-only probe from the current continuation. No DNS records or production data were changed.

| Probe | Result | Interpretation |
| --- | --- | --- |
| `tintinaccs.com` A record | `23.227.38.65` | Apex still resolves to Shopify. |
| `www.tintinaccs.com` CNAME | `shops.myshopify.com` | `www` still routes to Shopify. |
| `https://tintinaccs.com/api/health` | HTTP 404 | Pages Functions are not active on the commercial domain. |
| `https://tintinaccesorios.pages.dev/` | HTTP 200 | Pages deployment is responding. |
| `https://tintinaccesorios.pages.dev/api/health` | HTTP 200; `ok: true`; `checkedAt: 2026-09-28T06:14:05.169Z` | The service health endpoint is green, but does not prove a full purchase, payment, mail or authenticated customer flow. |
| `https://tintinaccesorios.pages.dev/api/public-catalog?resource=products` | HTTP 200; `count: 0` | Real catalog import and validation are still prerequisites for transaction testing. |
| `https://tintinaccesorios.pages.dev/sitemap-products.xml` | HTTP 200; empty URL set | No product pages are available for indexing from Pages. |

The Pages health endpoint is operational, but the domain still routes to Shopify and the Pages catalog is empty. The migration decision remains **not ready**.

## Search Console recheck — 2026-09-28 06:45 UTC

Read-only GSC Wizard queries against the connected Google Search Console account; the URL Inspection quota was checked first and showed 2,000 remaining before these two inspections.

| Check | Result | Interpretation |
| --- | --- | --- |
| Connected Search Console properties | Only `https://tintinaccesorios.pages.dev/`; permission `siteOwner`, readable and active | No property for `tintinaccs.com` is connected yet. |
| Submitted sitemap | `https://tintinaccesorios.pages.dev/sitemap.xml`; last submitted 2026-09-28 01:58 UTC; pending, 0 warnings, 0 errors | Google accepted the sitemap submission, but crawling/processing is not complete. |
| Homepage URL Inspection | PASS; “Submitted and indexed”; fetch successful, robots allowed, mobile crawl on 2026-09-13 | Pages homepage is indexed on the preview hostname. This does not establish indexing on the custom domain. |
| `/catalogo` URL Inspection | PASS; “Submitted and indexed”; fetch successful, robots allowed, mobile crawl on 2026-09-21 | The catalog shell is indexed, but contains no real product URLs. |
| Pages product sitemap | HTTP 200, empty `<urlset>` | There are no product URLs available for Google to crawl/index yet. |
| Search performance | 1 impression, 0 clicks over 2026-08-29 through 2026-09-25 | Current GSC evidence is sparse and limited to the Pages property. |

No new Search Console property or sitemap was created or submitted in this check. Domain property verification and product URL indexing remain post-catalog/cutover requirements.

## Production smoke recheck — 2026-09-28 06:57 UTC

Ran `npm run monitor:production` against the configured Pages origin (`https://tintinaccesorios.pages.dev`). The script uses public GET requests only; it does not create orders, accounts, emails, or catalog records. Its JSON evidence was emitted at `artifacts/phase11-production-health.json` (ignored local artifact).

- **15 endpoint probes** returned expected statuses and content types. The six clean core routes, required security headers, canonical origin, robots restrictions, sitemap index/pages, manifest, `/api/health`, and the unauthenticated `/api/admin-runtime-health` guard passed.
- The monitor exited 1 on three readiness gates tied to missing catalog data: `/sitemap-products.xml` contains no product URLs; `/api/public-catalog?resource=products` returns `count: 0`; therefore no product URL exists for server-rendered product metadata/canonical/JSON-LD canary validation.
- This run confirms Pages and its public/admin-health surfaces are reachable; it does **not** certify authentication, payment, email delivery, an order, or product metadata for a real listing.

The business/catalog gates remain the reason the Pages deployment cannot replace the populated Shopify storefront yet.

## Pull request preview recheck — 2026-09-28 07:04 UTC

Read-only GET against the deployed branch preview `https://codex-shopify-independence-a.tintinaccesorios.pages.dev` (commit `1e0ff35e0e5672981223a180b4d56f78682b4f1c`).

| Probe | Result | Interpretation |
| --- | --- | --- |
| `/admin.html` | HTTP 200; HTML includes the CRUD feedback stylesheet and versioned operations/admin modules | The preview deployment contains the central CRUD loader and result dialog changes. This confirms deployment of static assets, not authenticated mutations against Firestore. |
| `/api/health` | HTTP 503; `runtime`, `firebase`, `adminRuntime`, and `visualBuilder` true; `configuration` false | The preview environment is missing one or more required runtime configuration values. `functions/api/health.js` reports a boolean only and intentionally does not disclose which secret is missing. |
| `/` | HTTP 200 | Public shell responds on the preview hostname. |

This is a preview-environment configuration finding, not evidence that the production Pages environment is unhealthy: the configured production Pages health endpoint returned HTTP 200 and `ok: true` in the 06:14 UTC probe above. The preview cannot be used for full authenticated acceptance until its required runtime configuration is supplied through the deployment environment; do not copy production secrets into preview casually. The commercial domain and empty catalog remain independent cutover blockers.

## Shopify media independence scan — 2026-09-28 07:31 UTC

Extended `npm run monitor:production` to inspect public product and collection records, all 12 public Visual Builder configurations, and the public Visual Studio global configuration for Shopify-hosted URLs. The scan uses the existing exact-host parser in `scripts/lib/referencias-shopify.mjs`; it rejects Shopify CDN and store-hosted URLs while ignoring misleading lookalike domains.

The live recheck returned HTTP 200 for all inspected data/configuration endpoints and found no Shopify-hosted URLs in the returned public records. Products and collections both currently return `count: 0`, so the absence of URLs is not evidence about the yet-to-be-imported catalog. The monitor still exits 1 on the three expected catalog canary gates (empty product sitemap, no sample product, and therefore no server-rendered product metadata canary). After import, rerun this scan against the actual products, collection images, descriptions, variants, and public page content before cutover.

## Checkout payment configuration — 2026-09-28 07:47 UTC

Read-only GET of `https://tintinaccesorios.pages.dev/api/paypal-config` returned `enabled: false`, `environment: sandbox`, `currency: USD`, and only `stale_exchange_rate` in `unavailableReasons`; the reported rate timestamp is `2026-09-10T18:59:53Z`. This endpoint intentionally blanks `clientId` while disabled, so it does not establish that the credential is absent. The PayPal guide records the owner decision on whether to refresh and use PayPal or launch with other configured methods. No payment or order was attempted.

## Direct recheck — 2026-09-28 08:16 UTC

Read-only GETs repeated after the latest repository commit:

| Probe | Result |
| --- | --- |
| Pages `/api/health` | HTTP 200, `ok: true`. |
| Pages `/api/public-catalog?resource=products` | HTTP 200, `count: 0`. |
| Pages `/api/public-catalog?resource=collections` | HTTP 200, `count: 0`. |
| Pages `/sitemap-products.xml` | HTTP 200, 0 `<loc>` entries. |
| Pages `/api/paypal-config` | HTTP 200, disabled; `stale_exchange_rate`. |
| `https://tintinaccs.com/` and `https://www.tintinaccs.com/` | HTTP 200; Shopify markup remains present. |

This confirms the current cutover blockers, not checkout acceptance: no catalog records exist to exercise an order, stock change, product metadata, or migration redirect. No payment, order, DNS, or production data was changed.

## Recheck — 2026-09-28 10:33 UTC

Read-only checks from the current continuation. No catalog writes, account/order activity, DNS edits, or production configuration changes were made.

| Probe | Result | Interpretation |
| --- | --- | --- |
| `https://tintinaccesorios.pages.dev/api/health` | HTTP 200 | Pages runtime is healthy. |
| Public product catalog | HTTP 200, `count: 0` | No imported listing exists for launch acceptance. |
| Public collection catalog | HTTP 200, `count: 0` | No imported collection exists for launch acceptance. |
| `https://tintinaccesorios.pages.dev/sitemap-products.xml` | HTTP 200, empty URL set | Product indexing cannot be validated yet. |
| `https://tintinaccs.com/api/health` | HTTP 404 | Commercial host still does not serve Pages Functions. |
| `https://tintinaccesorios.pages.dev/api/paypal-config` | `enabled: false`, `stale_exchange_rate`; timestamp `2026-09-10T18:59:53Z` | PayPal is unavailable until an authorized current exchange rate is configured; do not invent or reuse a stale rate. |
| Deployed import module | `js/admin/importacion-admin.js` imports `aplicar-importacion-admin.js?v=tintin-20260927-shopify-apply-1`; the published module has no media-preflight call | Do not apply Shopify catalog CSV through the current deployment; it can preserve Shopify CDN image dependencies. The safe preflight/import path is in PR #937 and is not yet deployed. |

`npm run monitor:production` completed its public GET-only checks at `2026-09-28T10:33:22Z`. Route, header/CSP, robots/sitemap, health, authentication-guard, public-catalog endpoint, Visual Builder, and global-configuration probes passed. It exits 1 only for the three catalog canaries: empty product sitemap, no product in the public API, and no product page to check server metadata/canonical/JSON-LD. This is an expected not-ready result, not a failure of the responding Pages endpoints.

`npm run audit:final` completed locally with exit 0 on branch HEAD `4462d541`. The focused browser test for the central CRUD loader/result panel passed 2/2 in this continuation. GitHub Actions run #3453 for PR #937 was observed in progress; CI is not recorded as green for HEAD until that run completes successfully.

The migration remains **not ready**. Keep Shopify and the commercial DNS intact until the importer with media preflight is deployed, a real catalog is imported and inspected (including every media URL), authenticated account/order/payment/email acceptance is completed, Search Console is validated on the custom domain, and the cutover runbook is carried out. PR #929 is explicitly titled “NO MERGEAR hasta cargar el catálogo y hacer la sección D en la misma sesión”; keep it separate while these prerequisites are open.

## CI and updated branch preview — 2026-09-28 10:58 UTC

Commit `a1d85cfcdd8345b201e83f8377f009dc297173fe` has successful `Repository audit`, `Cloudflare Pages`, `CodeQL`, and JavaScript/TypeScript and Actions analyses. Its branch preview is `https://codex-shopify-independence-a.tintinaccesorios.pages.dev`.

The branch preview serves `admin.html` with `tintin-20260928-shopify-media-preflight-1`; its import module calls `/api/admin-import-media`. This confirms the safe static importer is deployed to the preview. However, preview `/api/health` returns HTTP 503 with `configuration: false` at `2026-09-28T10:58:33.596Z`. The health endpoint does not disclose which runtime setting is absent. Preview `/api/paypal-config` returns disabled with `client_id`, `client_secret`, `webhook_id`, `exchange_rate`, `stale_exchange_rate`, and `feature_disabled`; no credentials were exposed.

In the same recheck, production Pages `/api/health` returned HTTP 200 with all reported checks true at `2026-09-28T10:58:36.173Z`. Production catalog APIs still return zero products and zero collections; its product sitemap is empty, and its deployed importer remains on `shopify-apply-1`. Production health being green does not verify Cloudinary preflight authorization or success for a Super Admin session. Do not copy Production secrets into the preview just to make its health endpoint green; verify preflight in the correct protected Production workflow when authorized and ready to import.

At this check, PR #937 was open and mergeable with all checks green on `a1d85cfc`; PR #929 remained open and `dirty` (not mergeable), with its explicit catalog/Section D hold. The domain migration remains **NO-GO**.
