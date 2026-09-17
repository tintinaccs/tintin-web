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

Preview Pages del PR: `https://1d115cba.tintinaccesorios.pages.dev/product?id=Sy46ycLJOAOA5ZicgNRS`, commit runtime `77ff8eb5`.

### Desktop 1440x900

Muestras LCP / TTFB / delay / duration / render / transfer:

1. `620 / 282 / 94 / 147 / 98 / 72730`
2. `652 / 306 / 76 / 171 / 99 / 72730`
3. `1336 / 970 / 102 / 185 / 79 / 72730`

Medianas: LCP `652 ms`, TTFB `306 ms`, delay `94 ms`, duration `171 ms`, render `98 ms`, transfer `72730 bytes`.

Mejora observada total contra baseline: LCP `1980 -> 652 ms`, `-1328 ms` (`-67.1%`). Mejora directamente atribuible al cambio: element render delay `839 -> 98 ms`, `-741 ms` (`-88.3%`). TTFB `977 -> 306 ms` queda excluido de la atribución: su variación pertenece a red/servidor del entorno y no es efecto demostrado de este cambio.

### Mobile 390x844

Muestras LCP / TTFB / delay / duration / render / transfer:

1. `612 / 278 / 90 / 165 / 79 / 72730`
2. `740 / 302 / 106 / 190 / 142 / 72730`
3. `580 / 267 / 103 / 153 / 57 / 72730`

Medianas: LCP `612 ms`, TTFB `278 ms`, delay `103 ms`, duration `165 ms`, render `79 ms`, transfer `72730 bytes`.

Mejora observada total contra baseline: LCP `2624 -> 612 ms`, `-2012 ms` (`-76.7%`). Mejora directamente atribuible al cambio: element render delay `1152 -> 79 ms`, `-1073 ms` (`-93.1%`). TTFB `1195 -> 278 ms` queda excluido de la atribución: su variación pertenece a red/servidor del entorno y no es efecto demostrado de este cambio. El delay de recurso y la duración permanecen dentro de la variabilidad esperable; los bytes son idénticos.

El elemento LCP y la URL del recurso permanecieron iguales antes/después. La mejora comparable es, por tanto, la eliminación del bloqueo visual del render tardío.

## Funcional y seguridad

Smoke real del preview: Home, catálogo, producto, galería, Add to Cart, carrito, control de cantidad, checkout, búsqueda y cuenta pasaron en desktop, tablet y mobile. El producto medido tiene stock límite 1; el control de cantidad respetó ese límite. Login cargó su formulario real. Refresh/back/forward del producto y catálogo pasaron.

No hubo `pageerror` en el producto estable. El entorno headless produjo `requestStorageAccess: Permission denied` y un `403` en el intercambio de token reCAPTCHA Enterprise de App Check; son señales del navegador automatizado, no bloquean catálogo, producto, carrito ni checkout. No se observó un `permission-denied` de Firestore bloqueante.

## Validación browser específica

- Producto público consultado: `RELOJ ALLEGRA`, sin variantes públicas utilizables. Se usó un fixture determinista de navegador basado en el contrato existente: `Color = Dorado/Plateado`, `Talla = M`, precio base `Gs. 70.000`, stock `2`; no se alteraron datos comerciales.
- Preview server: antes de hidratar `data-tt-product-server-preview=1`, `data-tt-server-preview=1`, imagen visible y panel informativo oculto. Después: ambos atributos removidos, panel visible, imagen hidratada visible y una sola entrada Resource Timing/una sola respuesta efectiva para la imagen de reemplazo.
- Variantes: selección real por click `Plateado` + `M`; Add to Cart conservó `variant = Plateado / M`, precio `70000` y stock de fixture. El fixture comparte precio/stock entre opciones porque el contrato actual no modela overrides por variante; no se simuló una diferencia inexistente.
- Refresh y back/forward: PASS con la ruta real del producto y el fixture interceptado en navegador.
- Fallo controlado de hidratación: abortar únicamente la respuesta de catálogo dejó la preview server visible, un solo `data-tt-server-image`, panel oculto y sin precio/nombre parciales; degradación segura.
- CLS: `0` en la navegación limpia del fixture sin imágenes duplicadas; la muestra retardada usada para inspeccionar el borde de hidratación se excluyó del valor representativo por introducir una espera artificial.
- INP real mediante Event Timing y clicks Playwright: desktop `120 ms`, mobile `88 ms`; no hubo regresión observada. Se ejecutaron thumbnail, apertura/cierre de galería y Add to Cart.
- Auth browser: no ejecutado con sesión autenticada. `AUTH_BROWSER = NOT_EXECUTABLE_SAFELY`: no había una cuenta QA autorizada disponible y no se usarían credenciales personales. Los contratos Auth existentes permanecen verdes.

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

La atribución queda separada: la mejora total observada de LCP incluye variabilidad de TTFB, mientras que la evidencia directamente atribuible es la reducción del element render delay; TTFB no se presenta como mejora causada por este cambio.

Conclusión: la causa principal —imagen LCP correcta retenida detrás del render asíncrono del grid— fue eliminada con un cambio acotado y reversible. La mejora comparable quedó demostrada sin reducir controles de seguridad ni contratos de compra. El PR queda listo para revisión/merge cuando sus checks remotos estén completamente verdes; no se hace merge automático.
