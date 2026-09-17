# Shopify → Tintin: arquitectura de migración controlada

## Principios

1. Preview antes de cualquier escritura de catálogo.
2. Un `Handle` Shopify representa un producto Tintin; las filas de imágenes no crean stock ni productos.
3. La identidad estable precede al nombre visible: `importFingerprint = source:handle` y un document ID determinista para la futura fase de aplicación.
4. La estrategia por defecto es `SKIP`; `UPDATE` y `REVIEW` necesitan decisión explícita y no sobrescriben en silencio.
5. Esta entrega no ejecuta migración real. La UI solo crea `PREVIEW` y permite pasar a `READY`.

## Flujo aprobado

```text
CSV/JSON
  → parser incremental
  → agrupación por Handle
  → normalización de precio/stock/tags/Body/status
  → mapping explícito de colecciones
  → preview con errores/advertencias
  → backup + dry-run externo
  → importJobs/{jobId}
  → autorización separada para aplicar
  → staging / verificación
  → cutover
  → archivo/rollback
```

## Import job

Colección futura/operativa: `importJobs/{jobId}`. El endpoint actual solo persiste la ficha dry-run y las transiciones de estado; no recibe productos ni escribe `products`.

```json
{
  "jobId": "imp_...",
  "source": "shopify-csv",
  "fileName": "products.csv",
  "fileBytes": 123456,
  "fileChecksum": "sample-sha256:...",
  "createdAt": "timestamp",
  "createdByUid": "...",
  "createdByEmail": "tintinaccs@gmail.com",
  "status": "PREVIEW",
  "products": 1000,
  "variants": 1200,
  "images": 2400,
  "errors": 0,
  "warnings": 12,
  "processed": 0,
  "total": 1000,
  "progress": 0,
  "lastCheckpoint": 0,
  "strategy": "SKIP",
  "dryRun": true,
  "catalogMigration": "not-executed"
}
```

Estados: `PREVIEW → READY → RUNNING → PAUSED → RUNNING → COMPLETED`, con `FAILED` recuperable a `READY` y `CANCELLED` terminal. Un job `COMPLETED` o `CANCELLED` no se reabre.

La copia local IndexedDB conserva records y checkpoint para que el cierre del navegador no destruya un preview. Al reabrir, el panel consulta nuevamente el status server-side antes de mostrar el job como recuperado.

## Parser y normalización

- Delimitadores: coma, punto y coma y tabulador.
- Comillas escapadas y saltos de línea dentro de Body: soportados.
- `Handle`: agrupación primaria.
- Precio y stock: `parseLocalizedNumber`/`parseOptionalStock`; vacío de stock = `null`, no `0`.
- Variantes: SKU, opciones, precio, stock e imagen; las filas de galería no suman stock.
- `Body (HTML)`: conserva únicamente `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`; elimina scripts, iframe, SVG, atributos, handlers y URLs ejecutables.
- Tags: trim, deduplicación y normalización de entrada.
- Status Shopify: `active` publica; `draft`/`archived` quedan inactivos.
- Colecciones: mapping exacto primero; sugerencia única después; múltiples coincidencias quedan en error de confirmación; no existe fallback silencioso a `otros`.

## Idempotencia

```text
fingerprint = normalize(source) + ':' + normalize(handle)
documentId = imp_<hash(fingerprint)><hash(fingerprint + ':tintin')>
```

En la fase de aplicación futura:

- `SKIP`: si la identidad existe, no escribe.
- `UPDATE`: requiere preview de diff, confirmación y precondición de versión.
- `REVIEW`: queda en reporte y no toca catálogo.
- Los reintentos usan el mismo `jobId`, `fingerprint` y checkpoint; nunca `addDoc` aleatorio.

## Media

El destino canónico sigue siendo la biblioteca Cloudinary existente (`media` + assets firmados). No se crea Firebase Storage ni otro proveedor.

Media job futuro:

```json
{
  "sourceUrl": "https://cdn.shopify.com/...",
  "destination": "cloudinary",
  "status": "PENDING",
  "attempts": 0,
  "checksum": "sha256:...",
  "error": null,
  "productId": "imp_..."
}
```

Estados: `PENDING`, `DOWNLOADING`, `VALIDATED`, `STORED`, `FAILED`, `SKIPPED`. 404, HTML, ORB, redirect inválido o MIME incorrecto = `BROKEN_SOURCE_ASSET`; se conserva el producto y se omite únicamente ese asset. No se persiste una URL inválida ni se inventa una imagen.

El incidente conocido de `Sy46ycLJOAOA5ZicgNRS` (E6BB06E0, 9418B78D, D9B7046F) sigue siendo un caso de auditoría; el contrato LCP #831 no se toca.

## Backup, rollback y cutover

La fase de preparación exige:

1. backup verificable con checksum;
2. dry-run y reporte exportable;
3. staging/safe mode;
4. verificación de catalog/collection/search/product/related/admin/stock/checkout;
5. activación explícita;
6. archivo y rollback documentado.

No hay borrado de catálogo en esta entrega. Una sustitución futura requiere backup, diff, confirmación, import, verificación y activación separadas.

## Límites y seguridad

- No existe el tope artificial anterior de 5 MB/1.000 productos.
- El límite de 250 MB es un fusible operativo de archivo, no un límite de filas; el parser no carga una copia de texto completa cuando `File.stream()` está disponible.
- El endpoint acepta solo metadata del job y está protegido por origen + Firebase ID token + Super Admin exacto.
- No se modifican Firebase Rules ni App Check.
- Las escrituras de productos y media están deliberadamente fuera de esta fase para exigir autorización independiente.
