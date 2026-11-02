# Fase 03 — Administración y editor de productos

Fecha de trabajo: 2026-11-01, America/Buenos_Aires. Codex /root.
Base inicial: main `5b694fe4adaa9e356f3c2f8e74d2de5ca0f5adde`.
Rama: `codex/phase03-product-editor`. Estado provisional: IN_PROGRESS.

La titular pidió continuar la conversación de la fase visual y aplicar el nuevo
alcance administrativo. El texto adjunto se leyó completo. La PR #1309 contiene
la fase 02 visual; su seguimiento y conciliación se registran antes del cierre.
Esta fase no cierra por inferencia los hallazgos de seguridad o comercio de01.

## Diagnóstico y correcciones

| Clasificación | Fuente/evidencia | Efecto y corrección |
| --- | --- | --- |
| MEDIUM | `interfaz-productos-adaptable.js`, tabs y `showSection`; galería en Fotos y opciones e inventario en Precio y stock | Editar un producto exigía alternar superficies. Fotos y opciones ahora reúne fotografía/galería, opciones y cantidades. Se mueve la sección original; Precio y stock accede a ese mismo nodo al navegar. No se duplica matriz, estado ni escritor. |
| MEDIUM | `fitProductDescription`, reproducción con90líneas, Enter y escritura al final | Restaurar el scroll anterior tras medir height:auto escondía la línea nueva. Al escribir al final se revela esa línea; al redimensionar se conserva la lectura. Campo con crecimiento hasta el límite de altura y scroll interno explícito, sin cortar el contenido. |
| LOW | `galeria-unificada.js`, `side` general vacío; captura del editor | El lateral se reservaba aunque sólo contenía acciones redundantes. Se oculta cuando no hay contexto ni reemplazo; vuelve al reemplazar. La fotografía utiliza el ancho disponible. |
| MEDIUM | `viewPhoto`, región inline y ampliación sólo desde miniaturas | La imagen principal ahora tiene Ampliar. El visor usa dialog nativo, contiene el foco, admite flechas/Escape y devuelve el foco al disparador; se libera al destruir la galería. |
| LOW | Controles de opciones, prueba de quitar una opción nueva con una foto marcada | La protección inferior conservaba la opción, pero no explicaba el bloqueo en el control. Se detectan las asociaciones antes de solicitar su retiro y se muestra una explicación junto a las opciones. La fotografía y la opción permanecen intactas. |

En ancho suficiente se alinean tres áreas en una fila. En tablet la galería
ocupa una fila y opciones/inventario otra; en móvil se apilan. El límite depende
del ancho del editor, no del modelo del dispositivo. Se amplía sólo la superficie
de Fotos y opciones; los demás pasos mantienen su composición. La galería inline
de Variantes y el acceso a Precio y stock se conservan.

## Alcance revisado

| Pedido | Autoridad y resultado |
| --- | --- |
| Nombre, descripción, categoría, colecciones, etiquetas | Formulario/serializer existentes. Categoría y colección conservan su contrato actual; no se inventa una segunda taxonomía. Corrección de lectura/edición larga y regresiones de persistencia. |
| Fotos, subida, galería, orden y eliminación | Galería unificada, asociación por selección y biblioteca existentes. Hasta13fotos generales. Ampliación desde portada y protección explícita de asociaciones. Quitar una foto del producto no elimina el archivo compartido. |
| Precio, anterior, descuentos, costo | Formato entero PYG y motor compartido V1/V2. Precio anterior debe superar el efectivo; vacío hereda según contrato. Costo permanece privado y sujeto al permiso existente. |
| SKU, identificación, estados | SKU general y IDs existentes; borrador, activo y archivado con autoridades editoriales actuales. No se introduce SKU por variante ni se limpian metadatos históricos. |
| Color, talle, material y atributos propios | Constructor actual, grupos y combinaciones canónicas. Renombrar/eliminar referencias históricas sigue protegido; disponibilidad permite retirar/restaurar sin destruir cantidades. |
| Crear, editar, quitar opciones | Mantener las combinaciones por identidad; se añade explicación para fotos asociadas. Agregar/reordenar no reparte stock agregado entre variantes. |
| Generación y mantenimiento | Límite1000, referencias estables, rechazo de estructuras incompatibles. Regresión de límite y conservación al reordenar. |
| Precios, stock, imágenes, disponibilidad por variante | Mismos resolvedores, matriz y asociaciones; controles reunidos y prueba de que editar Dorado conserva Plateado. |
| Validación, guardar, duplicar, edición masiva | Escritor CAS, workspace privado y operaciones existentes. Pruebas de conflictos, idempotencia, permisos y atomicidad; duplicado inactivo y existencias de copia según contrato. |
| Vista previa/coherencia pública | Vista previa y lectores de producto/precio/imagen existentes. Regresiones del motor y de presentación; costo privado no se publica. |
| Carga, errores, éxito, cambios sin guardar | Workspace, confirmaciones y reintento originales; se conserva entrada ante fallos, publicación sólo tras confirmación, cancelación/recuperación de borradores. |
| Compatibilidad | Formatos V1/V2, claves de reservas, fotografías y campos desconocidos preservados. Ninguna migración ni escritura sobre datos reales. |

Se revisan además shell, navegación, márgenes, acciones y secciones del panel
mediante las pruebas administrativas existentes. No se implementan módulos ajenos.

## Validación y límites

Resultados definitivos y comandos: ver `evidence/phase03-20261102/validation.json`.
Las pruebas usan módulos/controladores reales con transporte, identidad y datos
ficticios; no equivalen a una sesión externa autenticada ni a persistencia real
en Firestore/Sheets. Las capturas usan imágenes de prueba identificadas como tales.

Sin migraciones, escrituras de catálogo de producción, Rules, cambios de esquema,
proveedores, autenticación, pedidos ni cobros reales. No se certifican hardware,
Safari/iOS, lector de pantalla ni un upload real a Cloudinary desde este entorno.
GitHub/merge/publicación se acreditan por SHA y sus recibos terminales; iniciar
un workflow o aprobar un test local no acredita producción.
