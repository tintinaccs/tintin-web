# Sincronización canónica Google Sheets ↔ Firestore ↔ web

## Objetivo

Evitar que dos hojas o dos activadores compitan por el mismo dato. Cada entidad tiene una sola fuente maestra y las demás superficies son vistas o reportes.

## Fuentes canónicas

| Entidad | Fuente canónica operativa | Firestore | Superficie secundaria |
| --- | --- | --- | --- |
| Productos | `Productos` | `products/{productId}` + `productInventory/{productId}` | Catálogo/web/Admin |
| Usuarios | `Usuarios web` + Firestore | `users/{uid}` | `Clientas` queda solo como compatibilidad legado |
| Pedidos | Firestore | `orders/{orderId}` | `Pedidos web` es espejo de solo lectura |
| Auditoría | Firestore | `auditLog/{eventId}` | `Auditoría web` es espejo de solo lectura |
| Ventas históricas | Enero–Diciembre | hojas mensuales | `Clientes de ventas` es reporte derivado, no identidad web |
| Vocabularios | `Listas` | n/a | validaciones y ayudas de Sheets |
| Operación sync | `Historial sync` | n/a | estado y trazabilidad de cada cambio |

## Productos

`productId` es la identidad. El nombre puede cambiar y nunca debe usarse como clave técnica.

Campos públicos (`products`): nombre, categoría, precio, stock, activo, oferta, destacado, precio anterior, etiqueta, `imageUrl`, descripción, material, medidas, acabado, cuidados, resistencia al agua, garantía, talle/ajuste, contenido, imágenes extra, colección, tags y variantes.

Campos privados (`productInventory`): costo unitario, comprado/cargado, stock mínimo y observaciones internas.

En la hoja `Productos`:

- B: nombre editable.
- C: vista previa derivada de T; no es otra fuente de imagen.
- D: categoría.
- E: costo unitario.
- F: precio de venta.
- G/H: margen calculado; no se persiste como dato independiente.
- I/J/K/L: inventario y umbral.
- T: URL canónica de imagen.
- AF: colección interna.
- AG/AH: tags y variantes.

La sincronización de una edición de Sheets escribe `products` y `productInventory` en un solo commit atómico mediante `/api/sheets-products-webhook`.

## Problema de nombres que vuelven atrás

La hoja tenía historial con más de un resultado para una misma edición (`SYNCING`, `SYNCED` y después `ERROR` para la misma celda). Eso es compatible con activadores `onEdit` duplicados/legados: un escritor guarda el cambio y otro falla después y restaura `oldValue`.

La reparación canónica es ejecutar una sola vez `tintinRepararSistemaSheets()` en el proyecto Apps Script productivo. Esta función:

1. elimina activadores `onEdit` duplicados del spreadsheet;
2. instala un único handler `tintinDespacharEdicionConTrazabilidad`;
3. serializa ediciones con `LockService`;
4. instala un único mirror programado cada 10 minutos;
5. sincroniza inicialmente usuarios, pedidos y auditoría;
6. conserva trazabilidad de campo, valor anterior/nuevo, resultado e ID de cambio.

No ejecutar manualmente `doPost`.

## Usuarios

`Usuarios web` es la única hoja maestra visible para cuentas. `@Username`/alias, Customer ID, teléfono, CI, rol, bloqueo y estado de perfil se proyectan desde `users/{uid}`. Los contadores de pedidos y total gastado se calculan contra `orders` durante el mirror.

`Clientas` no debe volver a actuar como segunda base de usuarios. Se conserva oculta como compatibilidad para no romper referencias históricas.

`Clientes de ventas` es un reporte de compras de las hojas mensuales. No debe confundirse con una cuenta web ni usarse como fuente de identidad.

## Pedidos y auditoría

`/api/sheets-admin-export` es server-to-server y usa `SHEETS_ENGAGEMENT_SECRET`. Exporta:

- `users` → `Usuarios web`;
- `orders` → `Pedidos web`;
- `auditLog` → `Auditoría web`.

`Pedidos web` y `Auditoría web` son espejos; no se editan para cambiar Firestore.

## Seguridad

- El secreto nunca se escribe en el spreadsheet ni en el navegador.
- Cloudflare usa la cuenta de servicio configurada en `FIREBASE_SERVICE_ACCOUNT_KEY`.
- El endpoint limita entidades y cantidad de documentos.
- Los campos sensibles de inventario no se mezclan con `products` público.
- Los cambios de producto conservan el ID estable aunque cambie el nombre.

## Despliegue Apps Script

Los archivos de `apps-script/` del repositorio son la versión canónica, pero Google Apps Script no se despliega automáticamente desde GitHub. Para activar esta reparación en producción se debe actualizar el proyecto Apps Script existente, conservar el mismo deployment `/exec`, seleccionar **Nueva versión** y ejecutar una vez `tintinRepararSistemaSheets()`.
