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
