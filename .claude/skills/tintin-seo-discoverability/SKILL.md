---
name: tintin-seo-discoverability
description: "Use for search engine indexing, metadata, structured data, product URLs, sitemaps and discoverability of public Tintín pages."
---

# SEO público e indexación
1. Revisar routes/metadata actuales y sus generadores canónicos; no escribir archivos generados manualmente.
2. Verificar que páginas públicas sean rastreables cuando corresponda y que login/admin/checkout no se indexen inapropiadamente.
3. Títulos, canonicals, descriptions, structured data y enlaces de productos deben representar contenido real.
4. Sitemaps/robots y variantes de URL deben concordar con el router y el despliegue.
5. Mantener accesibilidad y rendimiento: no insertar JS ni JSON-LD incorrecto por parecer completo.
6. Usar npm run test:phase11-seo, npm run verify:routes y los tests pertinentes del área.
7. Diferenciar indexación de motores de búsqueda de indexación de catálogo interno.
