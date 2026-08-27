# Autoridad canónica de sincronización

Este contrato evita que Firestore, Superadmin y Google Sheets compitan por el mismo dominio.

| Dominio | Autoridad operativa | Sheets | Escritura desde Sheets |
| --- | --- | --- | --- |
| Productos | Firestore `products` + `productInventory` | `Productos` | Sí, campos permitidos mediante webhook autenticado |
| Usuarios | Firebase Auth + Firestore `users` | `Usuarios web` | Sí, solo rol/bloqueo/notas y lifecycle no destructivo |
| Pedidos | Firestore `orders` + Superadmin | `Pedidos web` | No; espejo de solo lectura |
| Auditoría | Firestore `auditLog` | `Auditoría web` | No; espejo de solo lectura |
| Contenido/apariencia/configuración | Firestore | No | No aplica |

## Invariantes

- Una cuenta nunca se elimina físicamente desde Sheets. `ELIMINAR` crea el mismo tombstone histórico que Superadmin y deshabilita Firebase Auth.
- `username`, email y `customerId` históricos permanecen reservados; el teléfono puede liberarse al hacer soft-delete.
- Pedidos no se escriben desde Sheets porque un cambio de estado puede reservar o liberar inventario y debe pasar por el reconciliador de Superadmin.
- Los cambios administrativos de usuarios llevan `changeId`, `baseChangeId` y `syncOrigin`. Una fila con revisión vieja recibe conflicto 409 en vez de sobrescribir una edición más nueva.
- Los espejos de usuarios, pedidos y auditoría se reconstruyen desde Firestore; no son fuentes paralelas de verdad.
- Productos mantiene su guard contra el bucle Firestore → Sheets → Firestore y su webhook autenticado independiente.
