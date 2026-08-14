# Fase 11 — SEO y publicación

La URL pública actual de la nueva Tintin es `https://tintinaccesorios.pages.dev`. La fuente versionada está en `config/origenes-tintin.json`; `https://tintinaccs.com` permanece como dominio futuro mientras la tienda Shopify siga activa.

Las páginas indexables tienen título, descripción, canonical, Open Graph, Twitter Card, iconos y manifest. Las superficies privadas o auxiliares usan `noindex`.

Los productos usan canonical limpio con `id`. Además de la actualización dinámica del navegador, `functions/product.js` inyecta desde Cloudflare Pages Functions el título, descripción, imagen, canonical y JSON-LD `Product` para crawlers y previews sociales que no ejecutan JavaScript.

Sitemaps:

- `sitemap.xml`: páginas públicas estructurales.
- `sitemap-products.xml`: productos reales activos, generado desde Firestore en el edge y cacheado.

`robots.txt` publica ambos sitemaps.

El workflow `seo-produccion-fase-11.yml` ejecuta contratos SEO en cada PR relevante y monitorea producción cada hora. El monitor también comprueba `/api/health`, el catálogo público, el sitemap de productos y una ficha real con metadatos edge.

Comandos:

- `npm run verify:public-origin`
- `npm run audit:public-routes`
- `npm run audit:phase11`
- `npm run test:phase11-seo`
- `npm run monitor:production`
