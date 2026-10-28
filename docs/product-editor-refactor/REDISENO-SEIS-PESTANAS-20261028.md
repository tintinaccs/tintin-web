# Rediseño de Nuevo y Editar producto — 2026-10-28

Rama `codex/redesign-product-editor-20261028`, base `5a2ea0f63306583df04ed47cc745d52902669a2c` (main comprobada por fetch). Codex /root. Sólo implementación y revisión local: sin merge, deploy ni escrituras en producción. Esta instrucción del pedido prevalece sobre el merge automático indicado en AGENTS.md.

## Revisión y alcance

Nuevo y Editar comparten `admin.html#prod-form-card`, `prodNuevo`/`prodEditar`/`prodGuardar` y `serializeProductForm` de `js/admin/admin-app.js`. La presentación canónica es `interfaz-productos-adaptable.js`; no se agrega un editor alternativo. El escritor comercial, CAS, permisos e idempotencia permanecen en `product-editor-domain.mjs`; los borradores siguen en `espacio-trabajo-producto.js` y `product-editor-workspaces.mjs`.

Se inventariaron y conservaron: nombre, descripción, colección/categoría, SKU, etiqueta interna, tags, precio, precio anterior, badge, oferta, destacado, stock nullable, disponibilidad por combinación, atributos y combinaciones legacy/v2, identidad histórica, material, medidas, color/acabado, cuidados, resistencia al agua, garantía, ajuste/uso, contenido, portada, imágenes adicionales y por combinación, orden, biblioteca, carga múltiple, reemplazo y eliminación de asociaciones. También publicación, plantilla, SEO, estadísticas; costo, compras, umbral y notas internos sujetos a permiso. Se mantienen sugerencias por categoría, análisis local opcional, vista previa, reintento, recuperación y protección de salida.

El defecto de estructura era que el selector se limitaba a desplazar/desplegar secciones y todos los datos estaban anidados dentro de Fotos. Se reemplaza esa composición por seis paneles persistentes: Información; Fotos y colores; Variantes; Precio y stock; Detalles; Publicación. Sólo se muestra el panel seleccionado. Los campos y controladores originales se trasladan, nunca se clonan. El selector interno conserva aliases para consumidores canónicos; la navegación visible son pestañas con flechas, Home y End.

Fotos permite seleccionar color y editar sus asociaciones, carga y orden. El acceso contextual a precio/stock reutiliza el mismo inventario. En Variantes, «Combinaciones · Editar aquí» despliega esa matriz en la misma pestaña. El inventario regresa a Precio y stock al salir. No se duplican cantidades ni se crean escritores. Las opciones internas quedan plegadas y se respeta la visibilidad que determina el controlador.

Los errores canónicos conservan su texto, activan el panel relacionado y se asocian al campo. «Ir al campo» enfoca y muestra el control correspondiente sin borrar el mensaje. El estado de borrador y el resultado de publicación siguen esperando la operación real. No se modifican reglas comerciales, límites, herencia de precios, permisos ni almacenamiento productivo.

## Vista previa local

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/preview-product-editor.cjs
```

Abrir `http://localhost:4173`. Si Chromium está instalado por Playwright en lugar de `/usr/bin/chromium`, basta `node scripts/preview-product-editor.cjs` sin la variable de entorno. Reutiliza el fixture existente, el DOM/controlador reales y los escritores de dominio con proveedores en memoria. Permite Nuevo, Editar ejemplo, recuperar borradores y editar lo guardado. Las fotos elegidas se conservan sólo en memoria del servidor local; la pestaña mantiene los datos de QA mientras no se recargue. Los adaptadores de imagen locales conservan rutas relativas para que funcionen sin un hosting HTTPS. CSP de QA limita las conexiones al propio servidor. No se accede a Auth, Firestore, Sheets ni biblioteca productivos. La biblioteca sólo ofrece las fotos cargadas en este servidor local; las identidades son de prueba; no acredita una sesión administrativa real.

Las capturas por pestaña y tamaño están en `artifacts/product-editor-tabs/`: `390-1.png` a `390-6.png` y `1440-1.png` a `1440-6.png`, además de los tamaños 320/768/1024. Las capturas de la vista local con una foto cargada del repositorio son `preview-390-1.png` a `preview-390-6.png` y `preview-1440-1.png` a `preview-1440-6.png`. Representan datos de prueba. Ninguna imagen del catálogo real se sustituye en la aplicación.

## Referencias no disponibles

No se pudo abrir `C:/Users/USER/.codex/visualizations/2026/10/28/01a18248-ad3f-7661-8736-2c69f21bb7ba/tintin-studio.html` ni la carpeta `C:/Users/USER/Documents/Codex/2026-10-28/referenced-chatgpt-conversation-this-is-an/outputs/`.

Faltan las siete capturas `tintin-studio-{informacion,fotos,variantes,precios,detalles,publicacion,movil}.png`. Se buscó en el filesystem accesible sin encontrarlas. El diseño usa los tokens rosa/blanco y Montserrat reales del repositorio; su fidelidad a esas referencias queda NOT_VERIFIED.

## Verificación

Resultados locales y límites se registran en `docs/agent/CURRENT_STATE.md`. No se heredan resultados históricos. Los fixtures bloquean red externa y usan registros ficticios. No se afirma aceptación autenticada, CI ni comportamiento en dispositivos físicos a partir de estas pruebas.
