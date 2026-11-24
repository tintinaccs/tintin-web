# Monitor de producción y contratos SEO — 16/11/2026

herramienta de desarrollo anterior `/root`; base `6a71d3536364b684bbea6986fca86ca1b8967387`, entrega #1405 ya integrada. El #1406 se cerró como duplicado después de comprobar que package/lock y el árbol completo coinciden con el candidato combinado `29e83592`. CI fuente `43883840349` e integrador `43888405720`, intento 1, SUCCESS; ambos controles de flujos protegidos SUCCESS.

## Fallo observado y causa

El monitor `43888598454`, intento 1, falló tras publicar: trataba el JSON-LD dinámico como JavaScript inline y esperaba 200 en `/product` sin ID, que debe responder 404/noindex. Una lectura posterior del sitemap descubrió otra expectativa anterior: el monitor aceptaba únicamente categorías `?cat=`, mientras el generador canónico incluye el catálogo general y sus páginas.

Los recorridos públicos de catálogo pasaron con la revisión desplegada `0939ee6cfbb23480f3e5840310dfedeadefe050f37f7bb907c3c0e64d6a0940d`: 390/820/1440 px con inicialización JavaScript completa y 390 px sin JavaScript; HTTP 200, canónica de categoría, productos reales y cero desborde. Son lecturas públicas; no se crearon pedidos, cuentas ni datos comerciales.

## Corrección mínima

- Se analiza HTML con parse5, dependencia ya existente, para distinguir el atributo `type` real de `data-type`. JSON-LD requiere JSON válido. Los scripts clásicos, módulos y demás bloques siguen necesitando su hash; se consulta la directiva efectiva `script-src-elem`, `script-src` o `default-src`, sin admitir hashes de estilos.
- `/product` sin ID se comprueba separadamente: 404, URL limpia, CSP fuerte, scripts autorizados y `X-Robots-Tag: noindex`. La ficha real conserva la sonda de metadata y ahora comprueba también hashes inline.
- Los enlaces XML decodifican las entidades emitidas por el generador. Las URLs de colecciones se contrastan con `catalogMetadata`: catálogo general, categorías y paginación canónica; se rechazan filtros, páginas inválidas, otro dominio o ruta.

No se cambian CSP, `_headers`, aplicación pública, fuentes, imágenes, diseño, precios ni stock. No se añade dependencia ni servicio.

## Evidencia

- Reproducción inicial: 6 fallos en 15 pruebas del monitor anterior con los contratos nuevos.
- Suite específica final: 22/22, incluidos módulos autorizados/no autorizados, JSON-LD inválido, falso `data-type`, hash de estilo, precedencia de `script-src-elem`, 404/noindex y sitemap.
- Regresión: 162/162 de operaciones, publicación solo de verificación y SEO.
- `NODE_USE_ENV_PROXY=1 node scripts/auditar-produccion-salud.mjs`: PASS contra producción con el monitor corregido localmente; páginas, headers, sitemaps, Functions y backend verificados. Esto valida la sonda nueva contra el sitio publicado, no acredita todavía su integración remota.
- Artefactos en `artifacts/continuacion-1405-20261116/` (ignorados): logs originales, pruebas antes/después, sonda real, capturas y recibos.
- Build, preflight, nueva CI y merge se siguen en el PR de esta corrección. La CI posterior de #1405 `43888593358` sigue en seguimiento; CodeQL de main `43888594678` terminó SUCCESS.

recursos de desarrollo leídas y aplicadas manualmente: gh-fix-ci, systematic-debugging y verification-before-completion. Se reutilizan gh, Node, Playwright, parse5 y los generadores del repositorio; no se ejecutan scripts de terceros de recursos de desarrollo.
