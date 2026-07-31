# Fase 11 — SEO y publicación

La URL pública única es `https://tintinaccesorios.pages.dev`. Las páginas indexables tienen título, descripción, canonical, Open Graph, Twitter Card, iconos y manifest. Las superficies privadas o auxiliares usan `noindex`.

Los productos generan canonical con `id`, JSON-LD `Product`, moneda PYG y disponibilidad en tiempo real.

El workflow `phase11-seo-production.yml` ejecuta contratos SEO en cada PR relevante y monitorea la producción cada hora.

Comandos:

- `npm run audit:phase11`
- `npm run test:phase11-seo`
- `npm run monitor:production`
