# Auditoría fase1 — hallazgos, evidencia y límites

Fecha2026-10-23; fuentes funcionales6ac1fdf2546fa859412399f88eccf207991880de. Sólo documentos modificados. No es una certificación global de seguridad o de producción. Prioridad de implementación propuesta según integridad comercial, no según apariencia.

## Hallazgos

| ID / severidad | Ubicación y evidencia | Impacto | Corrección mínima propuesta, NO aplicada |
| --- | --- | --- | --- |
| H1 HIGH | order-admin-domain.js:300–306 lee product.price; politica-visibilidad-catalogo.js:reconcileCatalogCart y sincronizacion-carrito.js:richerFromCatalog reponen product.price; shopify-import-core.mjs:560–561 advierte precios diferentes usando uno para todas. admin-app.prodGuardar no contiene precio por combinación. | Función24 aprobada no tiene autoridad comercial coherente. Un precio diferente importado no gobierna la compra. Esto no prueba cobro fraudulento ni incidente de producción. | Extender resolvedor compartido con precio de combinación/fallback general; usarlo en editor, catálogo, carrito, servidor y SEO. No habilitar precios nuevos hasta integración completa. |
| H2 HIGH | admin-app.js:5863–5885 productVariantStockConfiguration usa texto concatenado en retained/quantities. Fixture Color Plateado/Dorado + Talle M, stocks2/0; al reordenar Talle/Color lanza «Primero dejá en0 el stock de la opción que querés quitar». Con todos0 las filas reaparecen con cantidad vacía. | Un reordenamiento inocuo se interpreta como eliminación y obliga a reconfigurar. No se observó borrado de stock real: el guard falla antes de guardar. | Identidad por atributos/IDs independiente de orden; conservar cantidades y rechazar sólo eliminación real con reservas/stock. Nunca pedir vaciar stock para reordenar. |
| H3 HIGH | foto-variante.mjs:24–31 empareja opciones y galería por índice cuando no hay variantMedia y sus cantidades coinciden. Fixture Dorado/Plateado, portada gold.png/extra silver.png: Plateado devuelve silver; invertir orden de opciones devuelve gold. | Fotos legadas pueden asociarse a otra opción por reordenación. La asociación explícita funciona y debe preservarse. | Materializar asociación explícita en borrador antes de cambiar orden; persistir únicamente con aprobación/guardado, sin migración masiva. Advertir asociación ambigua y no adivinar. |
| H4 MEDIUM | sincronizacion-carrito.js:normalizeVariant/lineIdFor (130–148) limpia cadena sin resolver atributos; fixture mismo producto Plateado/M y M/Plateado produce ln_fixture_rwa7gb y ln_fixture_15iqr6b. resolveProductVariant sí devuelve misma combinación. | Posibilidad de líneas duplicadas por orden, aunque checkout normaliza y reserva con autoridad. No equivale a una doble venta demostrada. | Identidad compartida estable; migración local/remota no destructiva con manejo explícito de colisión/cantidad y cola pendiente; conservar claves históricas de pedidos. |
| H5 MEDIUM | admin-app.js:6327–6394 guarda products, luego productInventory, Sheets y auditoría por etapas distintas; retiene ID en alta para reintentar. | Éxito parcial recuperable; no prometer atomicidad global ni que el error significa que nada se guardó. | Guardado de producto+datos privados en una transacción cuando corresponda, validando permisos; sync/auditoría con estado y reintento canónicos, sin transacción distribuida ficticia. |
| H6 MEDIUM | admin-app.js:1595–1610 agrega ranking por item.name en lugar de ID. Contadores de participación por ID existen en participacion-clientes.js. | Nombres iguales se mezclan; cambio de nombre separa ranking. No usar ese agregado como ficha estadística confiable de función42. | Agregar por ID desde snapshots, manteniendo nombre histórico; definir ventas/unidades/ingresos/rango/cancelaciones con la titular. Reutilizar estadísticas existentes. |

No se identificó un hallazgo CRITICAL en esta inspección acotada. No significa ausencia de vulnerabilidades fuera del alcance.

## CORRECT y NOT APPLICABLE

- CORRECT: servidor relee documentos, ignora precios propuestos en líneas públicas, recalcula subtotal y contrasta expectedTotal; quote_changed devuelve422 antes de commit.
- CORRECT: resolvedor compartido reconoce selecciones reordenadas inequívocas, conserva multiplicidad y rechaza ambigüedad; stock busca clave guardada para reserva/devolución.
- CORRECT: null/sin matriz conserva stock agregado no controlado; matriz malformada falla cerrada. La suma del editor y productCardPatch existe para matriz finita. No asumir soporte mixto finito/no controlado por combinación.
- CORRECT: pedidos usan updateTime/CAS, requestId/changeId idempotentes, huella variantInventoryItems y auditoría en commit. Suites locales ejercitan reserva/cancelación y rechazo sin escrituras.
- CORRECT: webhook Sheets aplica changedFields y mergeFields, rechaza409 al alterar matriz mediante total/opciones; no afirmar que hoy sobrescribe todos los campos desconocidos. Campo nuevo de primer nivel queda intacto con máscara, salvo flujos de reemplazo que deben probarse.
- CORRECT: productInventory es privado superadmin según reglas inspeccionadas; la allowlist pública no incluye costo/compras/notas.
- NOT APPLICABLE: SKU por variante, sucursales, videos/3D y otras funciones NO no son brechas a implementar. No retirar soporte legado por esta exclusión.

## Historial de HTTP422 y LARTRA

- Historial Git leído del resolvedor: #1014 introdujo stock por variante, #1124 cambios de stock por color y #1214 corrección de identidad reordenada. No se reabren ni se duplican esos PR.
- [Informe original](../reviews/checkout-variantes-20261023.md): atributos fijos Material/Talle/Diseño leídos en distinto orden respecto del carrito; validación posicional rechazaba selección. Ese informe afirma NOT_VERIFIED para pruebas/publicación de su momento y snapshot222 activos, no inventario actual completo.
- Estado GitHub leído en fase1: #1214 MERGED como6ac1fdf25; sus fases preflight/comercio/admin/calidad/browser/reglas, Repository audit, CodeQL, Cloudflare y protecciones aprobaron. Run de main40015443643 SUCCESS; health40031674729 SUCCESS. Estos son controles del SHA funcional, no una compra real.
- Pruebas actuales public-checkout-policy.test.mjs:273–329 cubren color/talle reordenado, seis órdenes del reloj LARTRA y opciones eliminadas/agotadas sin escribir. Ejecutadas localmente dentro de ocho suites, exit0.
- HTTP422 también expresa precio/cotización cambiados, cupón inválido o stock insuficiente. No borrar la validación ni tratar todo422 como el mismo bug. Mantener códigos específicos invalid_variant, variant_required, quote_changed, insufficient_stock.
- **NOT_VERIFIED producción**: no se correlacionó aquí revisión/bytes del resolvedor publicado ni se hizo flujo autenticado de compra. Cloudflare check y health por sí solos no prueban la selección/reserva de producción. El cierre futuro exige evidencia de publicación del SHA y lectura no destructiva, y prueba transaccional aislada; cualquier pedido real exige autorización separada.

## Reproducciones locales ejecutadas

Node v24.19.0. Dos comandos por stdin, sin archivos funcionales ni red comercial: extracción literal de productVariantStockConfiguration a vm para fixture de reordenación; imports nativos resolveProductVariant/variantStockLimit/productVariantImage; extracción de cleanText/normalizeVariant/hashLine/lineIdFor del carrito para comparación. Las fixtures usan example.invalid y no consultan imágenes ni clientes.

Resultados: H2/H3/H4 reproducidos en funciones aisladas; no se afirma reproducción de toda la UI. El resolvedor devuelve Plateado/M y stock2 para M/Plateado, mientras el editor rechaza reordenarlo. No se relajaron reglas ni se cambió código para obtener resultados.
