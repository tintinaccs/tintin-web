# Editor ágil: asociaciones y estados comprensibles

Base: `fb0bede6461cc736ddfe34be1a286993d23f31b9` (#1254). Se conserva la
implementación única; no se recuperan propuestas antiguas ni otros worktrees.

## Cambios

- Cuando el único atributo es Color, marcar/desmarcar aplica/quita las fotos
  seleccionadas de ese color en el borrador, sin un segundo botón de confirmación.
  Selecciones parciales se completan al marcar. No altera otras asociaciones ni
  la portada. No se infieren colores, materiales, cantidades, precios o categoría.
- Color+talla, otros atributos y múltiples atributos de color conservan la
  selección y confirmación explícita: no se automatizan combinaciones ambiguas.
- Etiquetas de color táctiles, estados seleccionados y foco visible, texto más
  breve y selectores contenidos. Vista previa continúa plegada al final en todos
  los tamaños. Campos e identificadores comerciales siguen siendo los originales.
- Cambiar sólo asociaciones actualiza etiquetas, sin reconstruir imágenes ni
  botones de galería ni casillas del panel simple. Las cargas y el foco se
  conservan; reemplazo y reordenación mantienen el render completo cuando los
  medios realmente cambian.
- Quitar un color a una imagen histórica presente sólo en variantMedia conserva
  su pertenencia a la galería usando imagesExtra existente, sin borrar archivos.
  No es una migración al abrir: ocurre tras una edición explícita de asociaciones.
  Sólo notifica los campos de medios si sus valores efectivamente cambiaron.
- Seleccionar fotos sin editar datos no dispara un falso estado de cambios
  pendientes ni una escritura adicional cuando el snapshot permanece igual.
- Estados pending/saving/saved/error distinguibles con texto y señal visual;
  fondo transparente en vez de la franja rosa heredada. Sólo una respuesta real
  confirma guardado en servidor. Asociar una foto no afirma que ya se persistió.
- Lectura de respuestas compartida exclusivamente por operaciones del editor:
  recuperación/guardado privado, publicación de producto y listado de borradores.
  Rechaza HTML, JSON inválido, HTTP fallido y confirmaciones sin resultado; no
  muestra contenido HTML del servidor. Conserva códigos de permiso/conflicto y
  mensajes de validación. El autoguardado tiene límite de solicitud de 30s;
  error/timeout no borra datos, mantiene la operación idempotente y permite retry.

## Autoridades y alcance

`galeria-unificada.js`, `espacio-trabajo-producto.js`, `admin-app.js`,
`shopify-commerce-admin.js`, `respuesta-editor-producto.mjs` y CSS administrativo.
No se cambia backend, inventario comercial, checkout, pedidos, pagos, Auth,
Rules, permisos, esquemas ni datos productivos. La ruta autenticada existente y
CAS siguen siendo la autoridad; el helper sólo valida transporte/respuesta.
Versiones de recursos, baseline, diagnóstico y mantenimiento se regeneran por
los mecanismos canónicos. Pruebas integradas en la etapa administrativa existente.

## Evidencia y límites

La captura de la titular muestra `Unexpected token '<'` durante guardado. El
cliente anterior hacía `response.json()` sin tratamiento para HTML. Se reproduce
esa condición con respuesta503 HTML en el controlador/DOM reales, con transporte
e identidad ficticios: conserva texto y backup, informa error, reintenta y sólo
marca saved después de una confirmación válida; no crea un producto público.

Lectura no autenticada y no destructiva de la ruta productiva el26/10/2026:
HTTP401 application/json. No reproduce la causa externa original de la respuesta
HTML ni certifica una sesión autenticada. No se afirma reparada la infraestructura
de un fallo intermitente no reproducido.

Primera batería:44/44 Chromium. Lógica ampliada:64/64 Node, incluida privacidad
del listado al cambiar rol/cuenta con el parser real inyectado en el harness.
Tras optimizar imágenes,12/12 de contexto; dos regresiones adicionales de
integridad de asociaciones/histórico aprobadas. Son corridas solapadas.
Preflight oficial aprobado. Regresión ampliada:354/354 Chromium (11,5min),
sin reintentos. Después se reconcilia el panel simple en lugar de reconstruirlo;
la comprobación específica final aprueba13/13 (54s), incluidos diez ciclos de
asociación en seis anchos, persistencia y el caso histórico. Capturas de móvil y
escritorio inspeccionadas. CI del candidato pendiente; no se hereda CI de#1254.
Repetición adicional de390px:3/3 sin reintentos, verificando también identidad
de las casillas. CI inicial69fe1e07 detectó que el harness Node del controlador
compatible no inyectaba readProductEditorResponse; se añade la función real al
harness, sin sustituir el escritor ni relajar aserciones. audit:admin-sync completo
repetido:78/78 Node más sus auditorías aprobados. CI del nuevo SHA pendiente.

Una corrida intermedia de contexto simultánea con la batería amplia agotó60s
en390px. Se canceló esa corrida y se limitaron notificaciones a cambios reales.
La repetición adicional detectó273px de desplazamiento en390px tras diez ciclos.
La causa de interfaz se elimina conservando las casillas del panel al actualizar
asociaciones. Spec completo final aprobado sin ampliar timeouts/reintentos.

Las pruebas cubren320/390/600/768/1024/1366/1440/1920, foco, diez ciclos de
asociación sin salto de scroll, identidad de nodos de imagen, guardado/reapertura,
preservación de portada y versión pública y combinaciones explícitas. Hardware
físico, proveedores reales y la escritura autenticada productiva no se certifican
con fixtures locales.

## Aceptación y reversión

Sin desbordamientos; controles táctiles de al menos44px; sin publicación implícita;
preview al final; ningún éxito ante HTML o error; relaciones/stock/IDs privados
conservados. No promete generación automática de información comercial.
Revertir mediante PR protegido al estado de#1254 y regenerar derivados; no hay
migración de datos que deshacer. No aplicar la rama obsoleta#1249.
