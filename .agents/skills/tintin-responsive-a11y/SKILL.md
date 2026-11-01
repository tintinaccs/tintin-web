---
name: tintin-responsive-a11y
description: "Use for mobile/tablet/desktop layouts, keyboard access, readable forms, safe areas and accessible interactions on Tintín."
---

# Responsive y accesibilidad
1. Verificar desktop, laptop, tablet horizontal/vertical y móvil; utilizar medidas fluidas y contenido real largo.
2. Probar headers, catálogo, imágenes, filtros, carrito, formularios, checkout y editor sin overflow ni huecos fijos.
3. No aplicar scroll-to-top a clics, cambios de variante o edición: solo al flujo de navegación previsto.
4. Controles táctiles con tamaño/espaciado adecuado; focus visible, navegación de teclado, etiquetas, errores legibles, reduced motion.
5. Respetar safe-area-insets, teclado virtual, orientación y gestos sin depender exclusivamente de hover.
6. Usar pruebas existentes como npm run audit:global-responsive-geometry, npm run audit:responsive-navigation y npm run test:phase10-a11y, cuando sean pertinentes.
7. Capturar evidencia antes/después cuando cambien composiciones sensibles.
