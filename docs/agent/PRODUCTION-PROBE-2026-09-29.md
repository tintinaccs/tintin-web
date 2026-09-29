# Production readiness probe — 2026-09-29 04:09 UTC

Read-only revalidation of the live storefront and Pages deployment. The probe made public GET requests and DNS lookups only; it did not change DNS, configuration, catalog data, accounts, orders, or payment settings.

## Observed results

| Check | Result | Meaning |
| --- | --- | --- |
| `https://tintinaccs.com/` | HTTP 200; canonical points to `https://tintinaccs.com/`; HTML contains Shopify theme/CDN markers | The commercial apex still serves Shopify. |
| `tintinaccs.com` DNS | A `23.227.38.65` | The apex still points at Shopify's storefront edge. |
| `www.tintinaccs.com` DNS and HTTP | CNAME `shops.myshopify.com`; HTTP 301 to the apex | `www` also routes through Shopify before redirecting. |
| `https://tintinaccs.com/api/health` | HTTP 404 | Pages Functions are not serving on the commercial apex. |
| `https://tintinaccesorios.pages.dev/` | HTTP 200; canonical points to `https://tintinaccesorios.pages.dev/` | Pages is deployed on its technical hostname; it is not yet the commercial canonical host. |
| Pages `GET /api/health` | HTTP 200, `ok: true`; runtime, configuration, Firebase, Admin runtime, and Visual Builder checks are true | Core Pages runtime is healthy. This is not a transaction or authenticated Admin acceptance test. |
| Pages `GET /api/public-catalog?resource=products` and `?resource=collections` | Both HTTP 200; `count: 0`, `items: []` | Catalog and public collections are empty from the storefront's API. |
| Pages `GET /sitemap-products.xml` | HTTP 200; zero `<url>` entries | There are no product URLs to index or use for a real product canary. |
| Pages `GET /api/paypal-config` | HTTP 200; enabled in `sandbox`, `rateSource: BCP`, rate date `2026-09-25`, updated `2026-09-28T19:26:01Z`, no unavailable reasons | The exchange rate is within the code's seven-day freshness window, but PayPal is sandbox-only; no real payment was tested. |
| Pages `GET /api/admin-runtime-health` | HTTP 401 without a session | Expected protected-endpoint behavior; authenticated Admin health remains unverified by this public probe. |

`npm run monitor:production` checked the public routes, health, payment configuration, catalog, sitemaps, and Visual Builder endpoints. It reported three readiness failures, all caused by the empty product catalog: empty product sitemap, no public product for the canary, and no product metadata sample. Other endpoint probes passed, including the expected unauthenticated `401`.

## Decision

**NO-GO for domain cutover and for closing Shopify.** Pages runtime health is green, but the commercial host still serves Shopify and Pages has no public product catalog. The Pages hostname's `200` responses do not establish that the domain, customer login, checkout, payment, email, or authenticated operations are ready.

## Remaining gates

1. Import the owner's real product and collection export into Firestore. Review handles, variants, prices, stock, collection mapping, and visibility. The importer must skip exact existing identities and stop on ambiguous matches; the pre-apply snapshot must be rechecked immediately before writes.
2. Run the authenticated Cloudinary media preflight and copy Shopify-hosted images. Verify product, variant, collection, and content URLs no longer depend on `cdn.shopify.com` before cancelling Shopify.
3. Prove the **Google Sheets → Firestore** sync direction using the protected Apps Script webhook and the dedicated inactive canary. Sheets synchronization is a Firestore integration; it is independent of the storefront domain and must not route to Shopify.
4. Complete purchase, stock update, account re-entry/blocking, App Check, order email, and any chosen live payment acceptance on Pages with the imported catalog.
5. Confirm Search Console ownership for `tintinaccs.com` and prepare its sitemap after Pages is attached to the commercial domain.
6. Only after the catalog is present, follow the same-session constraint recorded in PR #929: merge the domain cutover and attach the Pages Custom Domain together, then validate canonical, TLS, OAuth/App Check, redirects, sitemaps, and rollback on the live host.

Keep Shopify available until those gates pass. This recheck did not change the migration decision and does not certify real payment, authenticated CRUD, Apps Script deployment, or Google indexing.
