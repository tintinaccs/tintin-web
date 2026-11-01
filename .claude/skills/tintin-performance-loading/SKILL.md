---
name: tintin-performance-loading
description: "Use for page speed, caches, lazy loading, skeletons, blur placeholders, Core Web Vitals and regressions in Tintín."
---

# Rendimiento y estados de carga
1. Revisar docs/agent/PERFORMANCE_GLOBAL_20261029.md y los diagnósticos actuales, sin heredar PASS histórico.
2. Medir antes/después: LCP, INP, CLS, coste JS/CSS, imágenes, rutas y caché según el entorno disponible.
3. Skeletons reservan el tamaño final; no mostrar cargadores globales después de que el contenido esté listo.
4. Images: formatos, tamaños responsivos, lazy loading no crítico, placeholders ligeros solo donde aporten.
5. SWR/prerender solo para datos no sensibles y con invalidación correcta; catálogo, precio y stock requieren coherencia de backend.
6. Respetar CSS transitions/animations interrumpibles y prefers-reduced-motion. Evitar paquetes de animación innecesarios.
7. Ejecutar pruebas relevantes existentes: npm run audit:performance, npm run audit:performance-regressions, npm run test:performance.
8. No aumentar el bundle sin cuantificar el beneficio.
