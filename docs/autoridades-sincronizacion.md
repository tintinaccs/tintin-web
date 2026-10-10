# Autoridad canónica de sincronización

Este contrato evita que Firestore, Superadmin y Google Sheets compitan por el mismo dominio. Firestore y los dominios server-side conservan la autoridad de negocio; Superadmin y Sheets son superficies administrativas que invocan esos mismos contratos.

Los códigos de acceso pertenecen exclusivamente al servidor en `emailOtpCodes`. Los límites de intentos de envío pertenecen a `emailOtpRateLimits`: clave histórica hash por IP y clave `email_` más hash por correo. Se reservan con precondición de versión antes de enviar, permanecen privados al SDK cliente y no se eliminan al consumir el OTP. Las cuotas cuentan también intentos cuyo proveedor falla; así un fallo no habilita reintentos ilimitados. Ningún espejo de Sheets participa de este dominio.

| Dominio | Autoridad operativa | Sheets | Escritura desde Sheets |
| --- | --- | --- | --- |
| Productos | Firestore `products` + `productInventory` | `Productos` | Sí, campos permitidos mediante webhook autenticado |
| Usuarios | Firebase Auth + Firestore `users` + lifecycle canónico | `Usuarios web` | Sí, rol/bloqueo/notas y lifecycle no destructivo |
| Pedidos | Firestore `orders` + dominio canónico de pedidos | `Pedidos web` + `Nuevo pedido web` | Sí, operaciones administrativas permitidas mediante el mismo dominio usado por Superadmin |
| Auditoría | Firestore `auditLog` | `Auditoría web` | No; espejo de solo lectura |
| Ventas locales históricas y nuevas | Firestore `localCommerceEntries` + proyección `orders` | Enero–Diciembre, casillas B:Q | Sí, `/api/local-commerce-webhook`; versión optimista y commit atómico sin inventario ni cuentas Auth |
| Gastos y compras a proveedores | Firestore `localCommerceEntries` | Enero–Diciembre, S:V y X:AA | Sí, mismo contrato local; no confundir fórmulas de totales con registros |
| Clientes que compraron | Firestore `salesCustomers` + agregación de `orders` | `Clientes de ventas` | Contacto local editable; cuentas web conservan su lifecycle y no se mezclan por coincidencia de nombre |
| Contenido/apariencia/configuración | Firestore | No | No aplica |

## Invariantes

- `ComercioLocal.gs` se instala una vez después de publicar el backend, con respaldo completo privado del libro. Conserva fechas, importes, líneas de continuación y borradores; un borrador no se publica como pedido. El código original se conserva y el identificador estable incluye mes/año, sin consumir la secuencia TINPED.
- Los activadores periódicos leen banderas y huellas locales de `ScriptProperties`, sin depender de `DocumentProperties`/Drive en cada reconciliación. La rutina de instalación migra sólo claves `TINTIN_LOCAL_*` y `LOCAL_BASE_*` que falten, preserva valores existentes y deja los metadatos ajenos intactos. Si la lectura inicial de propiedades del documento falla, la instalación se detiene y debe reintentarse antes de declarar el espejo verificado.
- `Ventas locales`, `Clientes que compraron` y `Espejos de Sheets` son casillas exclusivas del Superadmin. Cada campo comercial de las tres casillas mensuales tiene su campo de edición equivalente; fórmulas AC:AF, IDs, versiones, mes/año de origen y estadísticas derivadas son de solo lectura. J conserva venta de artículos por línea, Q conserva envío y R muestra el total del pedido (artículos + envío). Los pedidos web se reflejan también en su mes y se editan mediante `Pedidos web`, conservando el dominio de inventario; sus filas derivadas no reutilizan validaciones de enums históricos.
- Las versiones AG:AL siguen cada fila. `Clientes de ventas` conserva identidad y versión en L:M. La reconciliación envía únicamente cambios locales pendientes, consulta Firestore y verifica que no haya una edición intermedia antes de aplicar el resultado. Un conflicto 409 conserva el contenido de Sheets y se registra como ERROR; no se trata como sincronización exitosa.
- El editor general de pedidos rechaza pedidos con `localEntryId`. Editar o archivar historia no genera movimientos de stock, cobros, emails, cuentas Auth ni nuevos TINPED. Las ventas sin detalle/cantidad no inventan artículos y muestran "Detalle no registrado". La entrega histórica no se infiere como realizada.
- `Índice`, `Buscar` y `Resumen anual` son vistas calculadas de los mismos datos, no autoridades separadas ni registros a importar. `Clientas` permanece como vista legado. `Historial sync` conserva errores/acuse de la reconciliación; la auditoría comercial queda en `auditLog`.
- La reconciliación existente trabaja cada minuto; consulta la revisión local y la firma de `Pedidos web` antes de releer el historial completo. Metadatos sin cambios no se reescriben, y las huellas locales se guardan por lotes en ScriptProperties. El panel consulta una revisión cada 30 segundos mientras está visible, recibe el aviso del listener existente de pedidos y permite actualización manual. No se declara sincronización instantánea ni evidencia de producción antes de instalar y verificar el puente.

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
