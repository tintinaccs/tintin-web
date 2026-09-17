# Product LCP surgical audit

Fecha: 2026-09-17  
PR: #831  
Producto real: `RELOJ ALLEGRA` (`Sy46ycLJOAOA5ZicgNRS`)  
Rutas comparadas: `/product?id=Sy46ycLJOAOA5ZicgNRS` en Pages producción antes y en el preview de PR después.

## Método

Se usó Playwright Chromium con un contexto nuevo por muestra, service workers bloqueados, CDP `Network.setCacheDisabled(true)`, `PerformanceObserver` de LCP instalado antes de navegar y tres muestras por viewport. Se esperaron 10 s después de `domcontentloaded`. Las fases se calcularon con Resource Timing:

- TTFB: `navigation.responseStart`.
- Resource load delay: `image.startTime - navigation.responseStart`.
- Resource load duration: `image.responseEnd - image.startTime`.
- Element render delay: `LCP.startTime - image.responseEnd`.

## Baseline real

Producción: `https://tintinaccesorios.pages.dev/product?id=Sy46ycLJOAOA5ZicgNRS`.

### Desktop 1440x900

Muestras LCP / TTFB / delay / duration / render / transfer:

1. `2260 / 977 / 102 / 186 / 996 / 72730`
2. `1432 / 328 / 90 / 174 / 839 / 72730`
3. `1980 / 996 / 69 / 159 / 756 / 72730`

Medianas: LCP `1980 ms`, TTFB `977 ms`, delay `90 ms`, duration `174 ms`, render `839 ms`, transfer `72730 bytes`.

### Mobile 390x844

Muestras LCP / TTFB / delay / duration / render / transfer:

1. `2364 / 1195 / 73 / 159 / 936 / 72730`
2. `2624 / 1115 / 117 / 240 / 1152 / 72730`
3. `2760 / 1294 / 78 / 164 / 1225 / 72730`

Medianas: LCP `2624 ms`, TTFB `1195 ms`, delay `78 ms`, duration `164 ms`, render `1152 ms`, transfer `72730 bytes`.

Elemento LCP: `IMG`. Recurso: la imagen principal Shopify del producto, servida como WebP por CDN aunque conserve la URL `.jpg`. El HTML ya tenía preload `fetchpriority=high`; CDP confirmó prioridad alta, HTTP/2, status 200 y ausencia de service worker/cache disk.

## Causa raíz

La imagen era descubierta temprano, pero `#product-grid` permanecía oculto y `#gallery-main` estaba vacío hasta que el runtime terminaba de resolver y renderizar el producto. Por eso la pérdida dominante era element render delay, no descubrimiento, prioridad ni bytes de imagen.

Evidencia: mediana de render delay de `839 ms` desktop y `1152 ms` mobile, frente a resource load delay de `90 ms` y `78 ms`; el HTML del producto ya incluía el preload antes del cambio.

## Cambio aplicado

- `functions/product.js`: emite una preview server-rendered de la imagen principal real cuando existe metadata autoritativa, con `loading=eager`, `fetchpriority=high` y `decoding=async`; conserva preload, JSON-LD y fallback.
- `css/pages/product/product-premium-overhaul.css`: muestra solo la imagen server-rendered y oculta provisionalmente el panel de información incompleto.
- `tienda.js`: reutiliza la imagen server-rendered si coincide con la selección real, evita una segunda descarga y retira la preview al completar la hidratación.
- Versionado de caché: `product.html`, `404.html`, shell público y generator actualizado con `tintin-20260917-product-lcp-server-preview-1`.
- Gates: `tests/seo/phase11-seo.spec.js` valida la preview estable.

No se modificaron Firestore Rules, App Check, Auth, checkout, stock, precio, seguridad ni idempotencia.

## AFTER comparable

Preview Pages del PR: `https://8d0db841.tintinaccesorios.pages.dev/product?id=Sy46ycLJOAOA5ZicgNRS`, commit runtime `77ff8eb5`.

### Desktop 1440x900

Muestras LCP / TTFB / delay / duration / render / transfer:

1. `620 / 282 / 94 / 147 / 98 / 72730`
2. `652 / 306 / 76 / 171 / 99 / 72730`
3. `1336 / 970 / 102 / 185 / 79 / 72730`

Medianas: LCP `652 ms`, TTFB `306 ms`, delay `94 ms`, duration `171 ms`, render `98 ms`, transfer `72730 bytes`.

Resultado contra baseline: `-1328 ms` (`-67.1%`) de LCP; render delay `-741 ms` (`-88.3%`). El cambio no atribuye la mejora de TTFB a la optimización: es una variación de red del entorno.

### Mobile 390x844

Muestras LCP / TTFB / delay / duration / render / transfer:

1. `612 / 278 / 90 / 165 / 79 / 72730`
2. `740 / 302 / 106 / 190 / 142 / 72730`
3. `580 / 267 / 103 / 153 / 57 / 72730`

Medianas: LCP `612 ms`, TTFB `278 ms`, delay `103 ms`, duration `165 ms`, render `79 ms`, transfer `72730 bytes`.

Resultado contra baseline: `-2012 ms` (`-76.7%`) de LCP; render delay `-1073 ms` (`-93.1%`). El delay de recurso y la duración permanecen dentro de la variabilidad esperable; los bytes son idénticos.

El elemento LCP y la URL del recurso permanecieron iguales antes/después. La mejora comparable es, por tanto, la eliminación del bloqueo visual del render tardío.

## Funcional y seguridad

Smoke real del preview: Home, catálogo, producto, galería, Add to Cart, carrito, control de cantidad, checkout, búsqueda y cuenta pasaron en desktop, tablet y mobile. El producto medido tiene stock límite 1; el control de cantidad respetó ese límite. Login cargó su formulario real. Refresh/back/forward del producto y catálogo pasaron.

No hubo `pageerror` en el producto estable. El entorno headless produjo `requestStorageAccess: Permission denied` y un `403` en el intercambio de token reCAPTCHA Enterprise de App Check; son señales del navegador automatizado, no bloquean catálogo, producto, carrito ni checkout. No se observó un `permission-denied` de Firestore bloqueante.

## Validaciones

- `npm run build:pages`: PASS.
- `npm run audit:cache-versioning`: PASS; 218 archivos versionados, sin URL inmutable reutilizada con bytes distintos.
- `npm run audit:premium-performance`: PASS, 9/9.
- `npm run test:cart-persistence`: PASS, 4/4.
- `npm run test:checkout-contract`: PASS, 87/87.
- `npm run test:navigation-header`: PASS, 9 passed, 1 skip institucional.
- `npm run test:phase11-seo` con servidor local: PASS, 5/5.
- `npm run audit:final`: PASS.
- `npm run test:performance` contra el preview: PASS, 30/30.
- Browser gates funcionales y responsive: PASS en 1440x900, 768x1024 y 390x844.
- Cloudflare Pages preview: PASS.
- CodeQL: PASS.

Conclusión: la causa principal —imagen LCP correcta retenida detrás del render asíncrono del grid— fue eliminada con un cambio acotado y reversible. La mejora comparable quedó demostrada sin reducir controles de seguridad ni contratos de compra. El PR queda listo para revisión/merge cuando sus checks remotos estén completamente verdes; no se hace merge automático.
