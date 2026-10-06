# Autoridad canónica de sincronización

Este contrato evita que Firestore, Superadmin y Google Sheets compitan por el mismo dominio. Firestore y los dominios server-side conservan la autoridad de negocio; Superadmin y Sheets son superficies administrativas que invocan esos mismos contratos.

| Dominio | Autoridad operativa | Sheets | Escritura desde Sheets |
| --- | --- | --- | --- |
| Productos | Firestore `products` + `productInventory` | `Productos` | Sí, campos permitidos mediante webhook autenticado |
| Usuarios | Firebase Auth + Firestore `users` + lifecycle canónico | `Usuarios web` | Sí, rol/bloqueo/notas y lifecycle no destructivo |
| Pedidos | Firestore `orders` + dominio canónico de pedidos | `Pedidos web` + `Nuevo pedido web` | Sí, operaciones administrativas permitidas mediante el mismo dominio usado por Superadmin |
| Auditoría | Firestore `auditLog` | `Auditoría web` | No; espejo de solo lectura |
| Contenido/apariencia/configuración | Firestore | No | No aplica |

## Invariantes

- Una cuenta nunca se elimina físicamente desde Sheets. `ELIMINAR` crea el mismo tombstone histórico que Superadmin y deshabilita Firebase Auth; `REACTIVAR` usa el mismo lifecycle canónico.
- `username`, email y `customerId` históricos permanecen reservados; el teléfono puede liberarse al hacer soft-delete.
- Sheets no escribe inventario ni calcula autoridad comercial por su cuenta. Crear o editar pedidos invoca `createOrderAdmin` / `applyOrderAdminMutation`, igual que Superadmin.
- Al crear un pedido, el servidor vuelve a leer producto/precio/stock desde Firestore, calcula subtotal + envío + total, asigna TINPED y confirma pedido + secuencia + stock + auditoría de forma atómica.
- Las ediciones administrativas llevan `changeId`, `baseChangeId` y `syncOrigin`; una revisión vieja recibe conflicto 409 en vez de sobrescribir datos más nuevos.
- Checkout, Superadmin y Sheets convergen en `orders`; el resultado confirmado se refleja en `Pedidos web`. Si el push inmediato a Sheets falla, el pedido sigue válido y el reconciliador periódico repara el espejo.
- `Auditoría web` e `Historial sync` no son superficies de edición.
- Productos mantiene su guard contra el bucle Firestore → Sheets → Firestore y su webhook autenticado independiente.
- `syncMeta/sheetsFlowEvidence` guarda sólo el resultado de la última sincronización real en cada sentido (`inbound`: edición de la hoja confirmada por Firestore; `mirror`: pedido, reseña o "me gusta" confirmado por Apps Script). Lo escribe el servidor en best-effort después de la operación, nunca participa del commit comercial, no es editable desde el navegador (queda bajo la negación general de las Rules) y sólo lo lee `/api/system-health` para el panel Flujo/Conexiones.
- El webhook de productos no permite que una escritura desde Sheets guarde URLs alojadas en Shopify dentro de los campos públicos del catálogo; las imágenes deben copiarse a Cloudinary durante la importación y los enlaces públicos deben migrarse a un destino independiente. La validación solo inspecciona los campos incluidos en `changedFields`, así que una URL antigua en otra celda no bloquea cambios de precio o inventario ni vuelve a escribirse por accidente.
