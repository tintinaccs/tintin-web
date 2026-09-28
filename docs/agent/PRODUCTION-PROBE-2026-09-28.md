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
