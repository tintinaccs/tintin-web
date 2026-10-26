# Cambios y compatibilidad

Base `5dc6f781` · rama `codex/editor-fase6-integracion-20261026`.

| Fuente canónica | Cambio y consumidores |
| --- | --- |
| `espacio-trabajo-producto.js` | Confirmación de Cancelar independiente del autoguardado; Guardar cambios no activa draft implícitamente; mismo workspace privado/CAS y reintento. Reusa el guardado existente. |
| `shopify-commerce-admin.js` | Texto y fecha del listado privado, mismos cursores/permisos; cede Escape/Tab a diálogos nativos. |
| `interfaz-productos-adaptable.js`, `controles-editor-producto.js` | Se retira guía duplicada y se conserva navegación por secciones/ayuda contextual; formato técnico plegado. Opciones guardadas se retiran/restauran sin borrar referencias; nombres históricos siguen protegidos. |
| `editor-comercial-core.mjs`, `editor-comercial-interfaz.js` | Disponibilidad reversible por atributo, precios efectivos y aviso. El motor compartido valida compatibilidad y calcula totales; no se redistribuyen cantidades. |
| `admin-app.js` | Concilia retiro legacy con editor actual y baseline protegido, manteniendo galería única y workspace; atajos de overlays respetan diálogos. |
| `galeria-unificada.js` | Conserva tarjetas si portada, orden, grupos y asociaciones no cambiaron. Reemplazo, asociación y reordenación invalidan esa huella; no cambia almacenamiento ni límites. |
| `vista-previa-producto.js`, `tienda.js` | Ocultan opciones retiradas y conservan la selección parcial válida al completar atributos; usan precios canónicos. Stock cero sigue visible como agotado cuando corresponde. |
| Pruebas, configuración CI y documentación | Nuevos recorridos integrados en etapa admin existente; se conservan controles, umbrales y permisos. No se crea un workflow con privilegios. |

No se cambia el motor de pagos, fuentes de checkout, reglas, importaciones,
contratos de pedidos/reservas ni el esquema persistido. Los contratos de compra
existentes se ejecutan como consumidores de los datos del editor, con pedidos
sintéticos y Firestore emulado. Las etiquetas de recursos que puedan propagarse
a documentos públicos son metadatos generados de integridad, no cambios del motor.

Una opción persistida conserva su identidad, fotos, precio, existencias y reservas
anteriores: retirarla afecta su disponibilidad futura. Cancelar una reserva previa
devuelve cantidad a esa misma identidad y no la reactiva. Restaurar vuelve a
permitir su selección; no crea una combinación nueva. Las opciones nuevas sin
referencias siguen sujetas a las guardas de cantidades/precios antes de quitarlas.

Costo unitario/compras/mínimo/notas conservan la autoridad privada. No se derivan
del total público ni se copian a catálogo/checkout. Los permisos se revalidan en
servidor. Los snapshots no son una nueva versión comercial y no modifican pedidos
históricos. No se migra ningún producto real ni se elimina un archivo compartido.

Diferencia editorial deliberada: draft + Guardar cambios conserva trabajo privado,
incluso al editar un activo; publicar un nuevo producto exige seleccionar Activo.
Archivar sigue retirando el mismo producto por el writer existente. No se inventa
un estado adicional. La UI previa que convertía draft→active se reemplaza por la
intención explícita exigida en el adjunto.

Reversión: commit normal de este delta, regenerando referencias y derivados desde
sus autoridades. Conservar soporte V2, privacidad, CAS y espacios ya guardados.
No borrar datos ni revertir Rules a una versión que exponga borradores. Si se
publicaran productos con opciones retiradas, cualquier reversión visual debe
mantener lectores compatibles con `active:false` y sus referencias históricas.

#1228 no queda integrado por estos cambios: sus deltas de PayPal/checkout se
excluyen expresamente y requieren revisión separada. No se cierra ni retargetea.
