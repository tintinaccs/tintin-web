# Rediseño visual del editor de Productos

Fecha: 24/10/2026. Agente: Codex /root. Base: main1cdad406, editor funcional del PR1219 ya publicado.

## Corrección del alcance de cierre

El PR1219 completó el escritor y las funciones comerciales/editoriales sobre el formulario existente. La distribución visual completa de la propuesta Shopify seguía parcial. La titular lo señaló y la autorización vigente para completar las fases incluye este trabajo. Este documento cierra esa diferencia sin presentar la entrega funcional anterior como una validación visual completa.

## Interfaz resultante

- Escritorio y tablet ancha: columna principal de Producto, Fotos, Precio, Variantes, Detalles e Inventario interno; lateral de Publicación, Vista previa, Organización, Google y Estadísticas. El inventario interno conserva la visibilidad dictada por el controlador y el rol.
- El lateral tiene320px sólo con al menos1000px disponibles en el contenedor; el conjunto no supera1320px. Tablet vertical y móvil conservan una columna y navegación por secciones. No se fuerza desplazamiento horizontal.
- Nombre del producto y estado en cabecera; los botones originales Cancelar y Guardar permanecen visibles. No se crean otros escritores ni botones que simulen el guardado. El título largo se limita visualmente a dos líneas, conservando su texto accesible.
- Vista previa, SEO y estadísticas plegables. Los campos se mueven conservando IDs, valores, eventos, widgets, borradores y validaciones. El acceso a la vista previa abre el panel antes de mover el foco.
- Se conserva Montserrat y el tema único de Tintin. Shopify es referencia de organización, sin dependencias ni servicios externos nuevos.

## Integridad y compatibilidad

No cambian precios, inventario, contratos CAS, publicación, permisos, reglas de Firestore, rutas, sincronización ni esquemas. Las reglas ya publicadas por40056875443 siguen siendo las correspondientes a este editor. La casilla legacy active continúa sincronizada por el controlador; la interfaz usa el estado editorial existente. El filtro de secciones respeta campos ocultos por rol y no los descubre al cambiar de sección.

Se elimina el menú que ocultaba las acciones primarias. Escape vuelve al flujo nativo de cancelar, incluida la confirmación de cambios sin guardar. La prueba de teclado se actualiza a acciones visibles y al foco restaurado, sin eliminar las pruebas de borradores o de subida de fotos.

## Verificación y publicación

Ocho escenarios nuevos verifican columnas reales, organización, estado, SEO, nombres largos, acciones accesibles tras scroll, ausencia de IDs duplicados y un único llamado al guardado original, de320px a1920px. Las capturas de390px y1440px se inspeccionan visualmente. Las pruebas de matriz, controladores, medios, permisos y borradores se ejecutan junto a ellos.

Suite local:99 Chromium sin reintentos,121 pruebas administrativas,39 comandos de preflight, build Pages y auditoría de estilos aprobados. Preflight, build, CI y publicación del SHA final se registran en CURRENT_STATE y en el PR después de ejecutarse. Los resultados anteriores no se heredan a este rediseño. QA usa fixtures y no modifica productos, stock, pedidos, pagos ni cuentas reales.
