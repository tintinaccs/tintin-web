# Arquitectura actual inspeccionada

Fotografía estática de `6ac1fdf2546fa859412399f88eccf207991880de`, 2026-10-23. Los símbolos/campos se contrastaron leyendo el código; no se ejecutaron CRUD autenticados ni se auditó la configuración desplegada.

| Ref | Autoridad / archivo | Responsabilidad verificada |
| --- | --- | --- |
| E1 | [admin.html](../../admin.html), [admin-app.js](../../js/admin/admin-app.js) | Formulario prod-*; serializeProductForm, prodGuardar, edición, duplicado, permisos, suscripción de products/productInventory, auditoría y pushProductsToSheets. |
| E2 | [maestro-productos-core.mjs](../../js/admin/products/maestro-productos-core.mjs), [interfaz](../../js/admin/products/maestro-productos-interfaz.js) | productDuplicateData, productBulkPatch, productCardPatch, productFingerprint, applyProductBulkTransaction. No duplicar estas operaciones. |
| E3 | [gestión de imágenes](../../js/admin/products/gestion-imagenes-admin.js), [fotos por color](../../js/admin/products/fotos-por-color.js), [fotos por variante](../../js/admin/products/fotos-por-variante.js), [resolvedor de fotos](../../js/components/images/foto-variante.mjs) | Carga/galería y asociaciones de atributos; orden de fotos con controles y arrastre en fotos por variante. |
| E4 | [vista previa](../../js/admin/products/vista-previa-producto.js), [controles](../../js/admin/products/controles-editor-producto.js), [adaptación](../../js/admin/products/interfaz-productos-adaptable.js) | Vista previa sin escritura y controles del editor existente. |
| E5 | [inventario-variantes.mjs](../../js/core/store/inventario-variantes.mjs), [modelo de inventario](../../js/core/store/modelo-inventario.mjs) | Identidad de selecciones, grupos, matriz opcional y deltas de reservas. |
| E6 | [contratos comerciales](../contratos-comercio.md), [firestore.rules](../../firestore.rules), [publicación estructural](../../js/core/store/publicacion-producto.mjs) | Integridad de carrito/pedidos/precio/stock y permisos. HasPublicProductFields no sustituye autorización ni visibilidad de colección. |
| E7 | [functions/product.js](../../functions/product.js), [sitemap](../../functions/sitemap-products.xml.js) | Metadata del producto y JSON-LD; no equivale a editor SEO personalizado. |

## Flujos y dependencias

1. Admin lee products; inventario privado procede de productInventory, con suscripción administrativa restringida.
2. prodGuardar valida formulario y completa cargas pendientes antes de serializar URLs/variantMedia. Editar stock usa transacciones y compara el estado original; no reemplazarlo por escritura ciega.
3. Datos comerciales van a products; costo/compras/mínimo/notas a productInventory. **No son una sola escritura atómica universal**: el guardado privado aparece separado. Cualquier garantía futura de atomicidad requiere diseño y prueba específicos.
4. El flujo solicita espejo a Sheets y registra auditoría; fuente y limitaciones: [sincronización canónica](../sincronizacion-productos-canonica.md). No asumir que versiones Apps Script desplegadas coinciden con Git.
5. Catálogo/ficha/carrito usan selección e imágenes compartidas. Checkout vuelve a validar y reserva en servidor, según contrato comercial. Modificar el editor no habilita saltar estas validaciones.

## Límite de la inspección

La matriz de alcance distingue soporte visible, parcial y no acreditado. No se certifican precio por variante completo, estados editoriales completos, editor SEO, plantillas ni estadísticas por producto. Tampoco se declara su ausencia global basándose sólo en búsquedas. Las fases autorizadas después deberán inventariar cada consumidor antes de implementar.

Coordinación: al iniciar estaba abierto #1213, tema global, rama ajena. #1211 ya no aparecía abierto. No se modifican ramas ajenas ni se reaplican correcciones históricas. Comprobar de nuevo al retomar.
