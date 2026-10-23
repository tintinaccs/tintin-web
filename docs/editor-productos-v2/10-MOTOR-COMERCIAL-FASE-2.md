# Motor comercial — fase2

Estado: implementación local para revisión; **sin activar productos reales, sin publicar y sin iniciar fase3**. Rama codex/motor-comercial-variantes-v2. Base funcional6ac1fdf2546fa859412399f88eccf207991880de; documentación de fase1 heredada de a0f89051f/#1216.

## Formato aditivo

```json
{
  "price": 50000,
  "priceBefore": 60000,
  "variantCommerceVersion": 2,
  "variants": {"Color": ["Plateado", "Dorado"], "Talle": ["M"]},
  "variantInventory": [
    {"variant": "Plateado / M", "attributes": {"Color": "Plateado", "Talle": "M"}, "stock": 2, "price": 70000, "priceBefore": 80000},
    {"variant": "Dorado / M", "attributes": {"Color": "Dorado", "Talle": "M"}, "stock": null}
  ],
  "stock": null,
  "variantMedia": [{"Color": "Plateado", "Talle": "M", "imageUrl": "https://example.invalid/silver.png"}]
}
```

Ejemplo ficticio, no producto real. variant es la clave inmutable de la fila, no una cadena que deba regenerarse al ordenar. attributes define la combinación actual. variantKey en carrito/pedido/reserva apunta a esa clave; la etiqueta mostrada se reconstruye en el orden actual de atributos. No exige SKU por variante. Los productos sin marcador o con versión1 mantienen semántica anterior; formato desconocido se rechaza en servidor y se oculta en política pública.

Matriz v2 validada:1..1000 filas, atributos inequívocos de grupos admitidos, referencias únicas, cantidades finitas0..1e6 o null, total finito máximo1e6. Precio general y override enteros1..1e9 PYG. Las opciones inválidas, referencias desconocidas y stock insuficiente fallan antes del commit. No se aceptan precios de línea enviados por el navegador.

## Precio y presentación

- productVariantPrice resuelve override/fallback y descuento; productDefaultPrice elige la primera combinación disponible, o primera fila si todo está agotado, para superficies sin selección. No se reemplaza products.price por un derivado de presentación.
- Catálogo inline, tarjetas compartidas, búsqueda, favoritos, orden por precio y metadata usan el precio representativo; ficha y carrito el de selección. Cambiar selección actualiza precio y foto. Un descuento general no se aplica engañosamente sobre un override diferente.
- Servidor recalcula importes desde Firestore. quote_changed exige revisar la cotización actual antes de crear; invalid_variant/variant_required/insufficient_stock mantienen su rechazo real. No se suprimen todos los422.
- Pedidos/recibos/estadísticas usan precio histórico de línea. Editar producto no modifica pedidos; editar cantidades de una línea existente conserva su precio histórico. Una combinación añadida al pedido se cotiza desde producto persistido.

## Inventario e identidad

- Matriz finita: total derivado. Matriz con cualquier null: totalnull. No confundir ausencia/stock no controlado con agotado. Compras históricas/costo no son inventario disponible y permanecen privados.
- Reserva y liberación conservan campos price/attributes/active; usan la fila referida por variantKey, también después de reordenar atributos con valores superpuestos. Se permite liberar una variante desactivada; no se permite una reserva nueva sobre ella.
- Dominio de pedidos mantiene CAS/updateTime, requestId/changeId e idempotencia. El commit registra pedido/inventario/auditoría; sincronizar Sheets no forma parte de una supuesta transacción distribuida.
- El máximo99 se valida por combinación, también al acumular alias. Un producto puede sumar más de99 entre combinaciones diferentes; reserva/cancelación y revisión de reservas conservan ese agregado sin devolver dos veces.
- Referencias antiguas de matriz se conservan en fixtures de conversión. Las reservas antiguas sólo agregadas siguen requiriendo revisión para asignarlas a combinaciones: no se inventa una distribución.
- Reordenar el borrador de inventario v1 con correspondencia inequívoca conserva cantidades y referencias sin vaciar stock. Eliminar filas existentes queda protegido. Si valores superpuestos hacen ambigua una reordenación legacy, se bloquea y se exige editor compatible.

## Compatibilidad y exposición

No hay un toggle nuevo en la interfaz ni un backfill. El marcador sólo aparece en fixtures y en el constructor de importación al pasar explícitamente `{variantCommerce:true}`; el pipeline de la interfaz NO pasa esa opción. El nuevo formato está preparado para lectura/reserva pero **no está habilitado para crear o editar productos reales desde el editor antiguo**.

Las reglas bloquean altas/cambios/borrados SDK de productos comerciales v2, incluida degradación a v1; carrito schemaVersion2 acepta variantKey opcional con límites de tipo/tamaño. El backend confiable de pedidos conserva su camino transaccional, sin ampliar roles del navegador. Formularios, tarjetas, lote y duplicado antiguos rechazan v2 antes de perder sus atributos/precios. Borrado global y Sheets también protegen su eliminación.

Webhook Sheets mantiene máscaras y merge; editar price general parcialmente conserva overrides, fotos y marcador. Cambiar total/opciones v2 devuelve409 sin escrituras. Apps Script exporta las columnas existentes y no introduce otra autoridad; su creador antiguo rechaza formato nuevo antes de cotizar. Importaciones viejas no habilitan v2 ni reemplazan productos ya existentes.

## Límites y reversión

Editor/escritor compatible y habilitación real quedan pendientes de una fase expresamente autorizada. Este PR no publica reglas, código ni Apps Script. No certifica compras reales, proveedores, cuentas ni sesiones de la titular. Se conservan la identidad visual, fotografías y datos comerciales existentes.

No revertir a un servidor que ignore overrides después de activar v2. Antes de activarlo, exigir compatibilidad de lectores/escritores, aprobación y CI del SHA exacto. La desactivación segura debe conservar lectores/reservas y bloquear nuevas ediciones, no borrar campos ni restaurar productos/pedidos sobre producción. H5 guardado distribuido general y H6 ranking por nombre de fase1 no se declaran resueltos por esta fase.

## Evidencia

Comandos y resultados en05-MATRIZ-DE-PRUEBAS; logs privados en artifacts/variant-*.log del worktree. Artefactos de prueba sólo contienen fixtures/datos demo. Prueba real de Firestore significa emulador loopback con proyecto demo, no una venta ni una conexión a la base productiva.
