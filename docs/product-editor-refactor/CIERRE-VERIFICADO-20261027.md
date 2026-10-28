# Cierre verificado y aceptación administrativa real

27/10/2026 · Codex /root · consulta directa a GitHub PR/Actions/Checks.
Base de aplicación: `65ee34250b20738591ec65cc097ee4e8bd452486` (#1262).
Esta revisión documental no introduce otra versión del editor ni cambia su código.

## Entrega y publicación: aprobadas

| Entrega | Candidato aprobado | Merge confirmado | CI del PR |
| --- | --- | --- | --- |
| #1248, única versión | `72a738987e08a7c942dfcc58936c15f2b72ed856` | `899a6851100b9560e6e3520e71ea3100babaa9fb` | [40385863831](https://github.com/tintinaccs/tintin-web/actions/runs/40385863831) SUCCESS |
| #1252, bloque contextual | `dcea45568c025ea1981c5c1267622801b947f82a` | `33af11a56a432d2f2d65878b5284d2265582e4de` | [40421504536](https://github.com/tintinaccs/tintin-web/actions/runs/40421504536) SUCCESS |
| #1262, guardado/CSP actual | `ce277ed05f59eb961c07a317ca6725818718f6e5` | `65ee34250b20738591ec65cc097ee4e8bd452486` | [40556025563](https://github.com/tintinaccs/tintin-web/actions/runs/40556025563) SUCCESS |

Las continuaciones #1254, #1256, #1258, #1257 y #1260 están MERGED, con
preflight, comercio, permisos, administración, calidad, interfaz, CodeQL, Pages,
auditoría y mantenimiento protegidos aprobados en sus candidatos exactos.
Todos sus SHA y checks se conservan en [evidencias-cierre-20261027.json](evidencias-cierre-20261027.json).
Un check `Protected flows` omitido en el workflow central no se cuenta como PASS:
los checks separados `Protected flow integrity` y `Protected flow maintenance`
sí terminaron en SUCCESS antes de cada merge.

| Verificación posterior | SHA comprobado | Resultado |
| --- | --- | --- |
| Monitor de la unificación [40389685713](https://github.com/tintinaccs/tintin-web/actions/runs/40389685713), intento1 | `899a6851100b9560e6e3520e71ea3100babaa9fb` | APROBADA / SUCCESS |
| CI de main tras #1252 [40424020632](https://github.com/tintinaccs/tintin-web/actions/runs/40424020632), intento1 | `33af11a56a432d2f2d65878b5284d2265582e4de` | APROBADA / SUCCESS |
| Producción tras #1252 [40424022740](https://github.com/tintinaccs/tintin-web/actions/runs/40424022740), intento1 | `33af11a56a432d2f2d65878b5284d2265582e4de` | APROBADA / SUCCESS |
| CI actual de main [40560324289](https://github.com/tintinaccs/tintin-web/actions/runs/40560324289), intento1 | `65ee34250b20738591ec65cc097ee4e8bd452486` | APROBADA / SUCCESS |
| Monitor actual de producción [40560326995](https://github.com/tintinaccs/tintin-web/actions/runs/40560326995), intento1 | `65ee34250b20738591ec65cc097ee4e8bd452486` | APROBADA / SUCCESS |
| Sincronización programada a Sheets [40568998469](https://github.com/tintinaccs/tintin-web/actions/runs/40568998469), intento1 | `65ee34250b20738591ec65cc097ee4e8bd452486` | APROBADA como operación global; no certifica un producto de QA |

Estos recibos cierran REL-01. No hay una autorización ni un merge de estas
entregas pendientes. No se confunden con los checks futuros de esta corrección
documental: esos se consultan en su propia PR antes de integrarla.

## Aceptación autenticada: bloqueada por sesión no confirmada

La propietaria solicita probar un producto de QA y sus fotografías reales.
Se verificó el inventario de perfiles disponibles: existe «Tintin Super Admin»,
pero no registra sesión de Tintin (`signed_in_sites` vacío). El perfil Default
sólo registra Google; eso no acredita acceso al administrador de Tintin.
No hay una herramienta conectada de la extensión Browser en esta sesión.
El entorno de ejecución tampoco declara identidad o credenciales administrativas.
Se pidió a la propietaria confirmar la sesión o iniciar sesión en el perfil.
No se solicitan contraseñas ni tokens por chat, ni se sustituye ese acceso con
una identidad administrativa inventada.

| Paso de aceptación | Estado actual | Evidencia necesaria para aprobar |
| --- | --- | --- |
| Acceso administrativo con sesión real | BLOQUEADA | Confirmar perfil, origen y acceso efectivo al panel; no guardar credenciales en recibos |
| Crear producto exclusivo de QA, oculto y con stock0 | NO EJECUTADA | ID único, estado inactivo y ausencia del catálogo comercial |
| Subir fotografía nueva a Cloudinary desde el editor | NO EJECUTADA | Confirmación del proveedor y referencia nueva; no basta pegar una URL existente |
| Guardar y reabrir el producto | NO EJECUTADA | Mismo ID, foto, categoría, descripción, precio, opciones y stock recuperados |
| Comprobar fila correspondiente en Sheets `Productos` | NO EJECUTADA | Mismo ID y valores, sin duplicados; lectura posterior a la sincronización |
| Comprobar edición posterior y recuperación | NO EJECUTADA | Nuevo valor confirmado en editor y en la misma fila de Sheets |

No se ha creado un producto, subido una imagen ni modificado una hoja durante
esta comprobación de acceso. Un job global de sincronización aprobado no cierra
EXT-01 ni sustituye la lectura de la fila del producto de prueba.

Cuando exista acceso confirmado, limitar la escritura al producto de QA autorizado,
con identificación inequívoca, inactivo y sin unidades comerciales. Conservar sus
referencias para trazar el resultado; no borrar archivos compartidos ni tocar
productos, pedidos, clientes o pagos reales. Si no hay entorno de pruebas,
no presentar una ejecución con proveedores ficticios como una prueba real.

## Pendientes que conservan su estado

- EXT-01: aceptación administrativa/proveedores por producto, bloqueada como arriba.
- DEV-01: hardware físico, Safari/iOS, teclado virtual, lector y zoom nativo, no ejecutados.
- PERF-01: medición con red real y sesión larga, no ejecutada; las mediciones sintéticas siguen fechadas.
- MEDIA-01: límite existente de13 fotos, conservado sin truncar productos históricos.

Los fallos de guardado y CSP de #1262 tienen pruebas y CI propias. Esta revisión
no los declara inexistentes por inspección ni certifica otra sesión productiva:
se mantiene la distinción entre corrección automatizada y aceptación real.
