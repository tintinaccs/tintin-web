# Editor guiado de productos — revisión del 28 de octubre de 2026

Implementación compartida por Nuevo y Editar producto. El formulario y sus controladores canónicos permanecen; la superficie ahora es una región integrada en Productos. No se autoriza merge ni despliegue de producción para esta entrega.

## Integración de cambios simultáneos

Mientras se verificaba esta rama, main recibió Studio en el PR #1268 (`9fcc8c57`). Se integra esa base: imagen grande, lienzo neutro derivado del tema, tarjeta continua, pestañas subrayadas e iconos. Sus funciones de navegación se conectan al flujo validado del asistente; el acceso a Vista previa abre Publicación explícitamente. Se conserva la separación comercial solicitada en esta tarea, sin volver a ubicar stock/precios dentro de la galería. La comprobación de la combinación renovada incluye 33 casos de pestañas/Studio/aceptación, 135 de regresión responsive/guardado/scroll y 114 contratos Node PASS; build/preflight y protección de flujos PASS; las baterías anteriores se documentan como evidencia previa a esta integración y no acreditan el SHA nuevo.

## Recorrido y datos conservados

| Paso | Contenido |
| --- | --- |
| Información | Colección/categoría, nombre y descripción; ayudas de categoría recogidas. |
| Fotos y opciones | Galería general, carga/biblioteca/reemplazo/orden/eliminación; atributos y valores genéricos. |
| Variantes | Asociaciones de imágenes por cualquier atributo o combinación; portada, contador exacto y visor inline. |
| Precio y stock | Precio general/anterior, descuentos y etiqueta recogidos; combinaciones, herencia, edición múltiple, cantidades, disponibilidad comercial e inventario privado. |
| Detalles | Material, medidas, acabado, cuidados, agua, garantía, ajuste y contenido; sugerencias de categoría consultables y texto propio. No se ocultan valores históricos poblados. |
| Publicación | Estado de publicación, disponibilidad general, organización/colección adicional, SKU, tags, destacado; vista previa y SEO automático con overrides históricos recogidos. |

`interfaz-productos-adaptable.js` organiza los mismos nodos del formulario. `admin-app.js`, `maestro-productos-controlador.js`, el escritor de dominio y `espacio-trabajo-producto.js` conservan guardado, borradores, CAS, recuperación, permisos y salida con cambios. El adaptador PYG mantiene los inputs numéricos canónicos; sólo su presentación lleva separadores. Las cantidades no se distribuyen copiando el total a cada opción.

Las opciones históricas conservan sus claves y asociaciones. Los productos con asignaciones compatibles usan el editor comercial automáticamente. El guard del backend que impide convertir stock agregado histórico a v2 sin revisar reservas se mantiene: esos productos conservan el contrato legado y exigen asignaciones explícitas cuando corresponda. Stock nulo, stock cero y disponibilidad comercial siguen siendo datos distintos; la publicación se configura aparte. Los registros antiguos de compras/mínimos se conservan como consulta privada, junto a las notas protegidas; costo sigue editable según permisos.

El catálogo prefiere una opción disponible con foto asociada sin reordenar ni modificar los datos originales. La selección explícita del cliente se conserva.

## Verificación

Se usa Chromium local, controladores reales y escritor de dominio con identidad QA y almacenamiento en memoria. No se crean productos, pedidos ni borradores de prueba en producción. Los mocks de imágenes se limitan a pruebas automatizadas.

Controles terminados: `audit:admin-sync` (78), contratos de inventario/comercio/borradores/fotos (45), categorías (14), editor comercial (15), catálogo/fotos tras el último ajuste (22); todos PASS. La prueba adicional de formato/cursor y rechazo de texto inválido pasó tras corregir la navegación y el foco del error. Los cinco controles nuevos de geometría comercial pasaron en 320, 390, 768, 1024 y 1440 px. Las pruebas de reducción de movimiento, permisos internos, nodos persistentes, fotos 3/2, portada y reapertura también pasaron en las ejecuciones locales. Baterías ampliadas terminadas: 120 casos Chromium de editor comercial/pestañas/fotos/borradores, 108 de edición responsive y 81 de galería pública/espacio de edición; todos PASS sin reintentos. Catálogo Node completo: 87 PASS. Aceptación guiada final: 16/16 PASS sin reintentos. Se cubrieron los 190 casos distintos de guardado mediante ejecuciones dirigidas tras corregir aserciones antiguas: 151 PASS en la batería inicial; 28 de cabecera/galería, 10 de matriz/contexto/inventario y 1 retiro/restauración PASS en las repeticiones. Build, preflight y protección de flujos PASS. Los resultados terminales de CI del SHA candidato se registran en el PR y el cierre local, sin heredar éxitos de otro commit.

Se adaptaron recorridos que dependían del modal y de activadores técnicos retirados; se preservan las aserciones sobre cantidades, identidades, escritura real, errores y recuperación. La revisión visual detectó y corrigió la grilla heredada que estrechaba los campos comerciales; quedó cubierta por controles de ancho de inputs y disponibilidad.

## Vista funcional y capturas

Ejecutar `node scripts/preview-product-editor.cjs` abre una vista QA de los seis pasos en `http://localhost:4173`. Se puede elegir otro puerto con `PRODUCT_EDITOR_PREVIEW_PORT`. La vista usa el mismo formulario, módulos y escritor de dominio con almacenamiento exclusivamente en memoria. Permite crear, editar, cargar fotos locales y recuperar borradores durante la sesión. Se comprobó el clic real en Guardar del ejemplo ALISSEA: nombre modificado en memoria y cantidades dorado 1/plateado 0 conservadas. Reiniciar el servidor borra su almacenamiento de prueba.

Opcional: `PRODUCT_EDITOR_PREVIEW_SAMPLE=/ruta/producto-publico.json` carga una copia local de un producto para revisar; no consulta ni modifica el producto remoto. La muestra usada fue ANILLO ALISSEA, obtenida del catálogo público en modo lectura. Conserva sus URL reales, dorado 1/plateado 0 y datos editoriales; Cloudinary responde 403 en este entorno, por lo que no se afirma haber verificado visualmente la descarga de esas fotografías ni se las sustituye por imágenes genéricas.

Capturas locales: `artifacts/product-guided-editor/real-{390,1440}-{1..6}.png`, además de las capturas QA automatizadas. El servidor de la sesión de revisión se inicia en el puerto 4175. Los artefactos son locales y están excluidos del repositorio.

## Corrección del primer resultado de CI

CI40784162914/1 (`3c6b4eb2`) aprobó preflight y falló en la prueba auxiliar de cantidades por un fixture sin los campos canónicos de precio/ID. Se completó ese DOM mínimo y el caso afectado pasó localmente, sin cambiar la lógica ni retirar aserciones. Dos casos locales de carrito que importan SDK desde www.gstatic.com no se acreditan por bloqueo de red del entorno; sus pruebas se conservan para la repetición en GitHub. No se heredan los resultados del candidato anterior.

## Correcciones de validación y altura reducida

Un stock fraccional bloquea el guardado, abre Precio y stock y permite enfocar/corregir la cantidad sin modificar existencias hasta confirmar un valor válido. Regresión afectada: 42/42 PASS. La CI40785296600/1 detectó que la barra global tapaba Guardar a844x300; se reprodujo y se agregó espacio de desplazamiento según la altura real del panel. La nueva CI debe comprobar el SHA completo; los éxitos anteriores no se heredan.

## Límites

Las capturas adjuntas del editor real se examinaron. Las referencias originales `C:/Users/USER/.codex/visualizations/.../tintin-studio.html` y sus siete PNG de Windows no existen en este entorno Linux; no se declara haberlas abierto. No se verificó una sesión administrativa externa autenticada ni dispositivos físicos. No se relajaron reglas, permisos ni protecciones. El PR debe quedar draft porque el mantenimiento canónico puede fusionar PR no draft automáticamente; esta medida cumple la prohibición explícita de merge sin aprobación.
