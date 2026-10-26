# Galería unificada — Fase 2

25/10/2026, Codex /root. Rama `codex/galeria-unificada-fase2-20261025`, base `0f57f327ad43671d22d0bd4d373d2f5b7bee8e40`. Incluye correcciones de Fase 1 del PR1237, todavía OPEN/no integrado al comenzar; main remoto `f9399a90c`. No se heredan sus resultados. La instrucción actual autoriza implementación/PR y prohíbe merge y despliegue. La entrega se apila sobre la rama de1237 para revisión independiente; no se integra ninguna rama ajena.

## Arquitectura antes y después

Antes: widget principal, cola de adicionales, miniaturas generales y editores de fotos repetidos por color/combinación. Diferentes controles parecían decidir la misma portada. `mountProductColorPhotos` montaba cada superficie.

Después: la misma función monta `attachProductGallery` (`galeria-unificada.js`), que concentra carga, biblioteca, miniaturas y acciones. Los inputs canónicos `prod-imageUrl` y `prod-images-extra` permanecen ocultos y alimentan `prodGuardar`; no hay otra colección ni otro escritor. Se retira el montaje de widgets redundantes, sin eliminar componentes compartidos. La cola múltiple y reemplazo individual reutilizan `carga-imagenes.js`, con validación/transporte/biblioteca existentes.

`fotos-por-color.js` sigue gestionando asociaciones/apariencias; admite montaje sin vista duplicada. `fotos-por-variante.js` expone edición de URLs para la selección, conserva metadata y serialización. La galería llama esas operaciones, no mantiene otro mapa de asociaciones. Los consumidores públicos y su precedencia no se reescriben.

## Esquema visual

Sección «Fotografías del producto»: un cargador múltiple con biblioteca, cola con estado por archivo, cuadrícula de tarjetas claras. Cada tarjeta muestra miniatura, número, indicador PORTADA, asociaciones y Ver / Elegir portada / Anterior / Siguiente / Reemplazar / Quitar / Asociar. Montserrat, rosa Tintin, ciruela y bordes suaves existentes. Todas las acciones son botones nativos; reordenación por Enter/Espacio y táctil, además de arrastrar/soltar.

Asociar abre controles contextuales de atributos sin otra galería. Sólo Color crea asociación de color; varios atributos crean combinación exacta. Se puede quitar la asociación sin quitar la imagen del producto y personalizar el círculo del color. No se alteran variantes comerciales ni su stock. «Ver» abre diálogo nativo, Escape/cerrar devuelve foco a la fotografía.

## Mapeo de datos y semántica

| Acción | Autoridad/persistencia |
| --- | --- |
| Primera foto/carga | `imageUrl`; cargas siguientes agregan `imagesExtra`. |
| Elegir cuarta como portada | La cuarta pasa a `imageUrl`; la anterior permanece entre adicionales. No borra archivo ni asociación. |
| Reordenar | Orden de portada+adicionales. Mover una foto al primer puesto la convierte en portada; controles y drag usan la misma operación. |
| Reemplazar | Conserva posición y cambia sólo referencias a esa URL en portada/adicionales/asociaciones; metadata de cada fila permanece. Rechaza reemplazo por otra imagen ya presente para evitar colapsar posiciones. |
| Quitar | Retira URL del producto y sus asociaciones; si era portada, usa la primera restante o vacío. No elimina el archivo de biblioteca. |
| Asociar | `variantMedia` por atributos. Fila específica prevalece sobre color. Su primera foto sigue siendo la imagen de la selección, independiente de la portada general. |
| Guardar/cerrar/reabrir | Flush de cola/reemplazo antes del `prodGuardar` existente, escritor administrativo real con CAS. Los blobs de previsualización no se persisten. |

Tarjetas, colecciones que muestran productos, búsqueda, ficha y vista previa conservan `imageUrl`/resolvedor compartido. Cuando existe selección de variante, su imagen explícita sigue prevaleciendo: cambiar portada general no reasigna fotos de Dorado/Plateado. La portada de una colección como entidad independiente no cambia al editar un producto.

## Límites, compatibilidad y limpieza

Se conserva backend:12 `imagesExtra`,100 filas `variantMedia`,24 imágenes por fila. UI unificada admite13 imágenes únicas (portada+12), constante `PRODUCT_PHOTO_LIMIT`; widget compartido admite `maxImages` para mensajes coherentes y `remaining` para capacidad. No se aumentan límites del servidor ni Firestore. Archivos:15MiB máximo según `procesamiento-imagenes.js`, formatos existentes JPEG/PNG/WebP/AVIF, decodificación/validación y procesamiento original. Cola sube secuencialmente: una subida activa, sin ráfagas paralelas nuevas. Estado por archivo expresa etapas reales, no porcentajes inventados.

Firestore permite1MiB por documento, no almacena binarios aquí; se mantienen URLs y filas existentes.13 fotos no garantizan que cualquier combinación de textos/filas arbitrarias quepa: validación del escritor y error de almacenamiento siguen vigentes. La capacidad contratada/disponible de la cuenta Cloudinary no puede acreditarse con las credenciales de este entorno (sólo Cloudflare configurado); no se afirma almacenamiento ilimitado ni se cambia plan/cupo. Conservar límite evita aumentar consumo sin esa evidencia.

URLs pasan por `sanitizeImageUrl` y escritor existente; error conserva formulario. No hay borrado físico al quitar/reemplazar. El widget usa `cleanupPrevious:false`; la biblioteca mantiene su control de referencias/permisos. Una carga que termina después de cerrar/cambiar producto no aplica la URL al nuevo producto; el transporte mantiene su limpieza previa de la carga recién creada cuando falla la aplicación. Cancelar pendientes libera sus blobs locales; el usuario puede reintentar un fallo sin volver a cargar fotos exitosas. Cancelación de petición de red activa no se promete: destruir invalida la aplicación del resultado.

Productos históricos se leen sin migración: `imageUrl || image`, extras y fotos de filas se muestran juntas/deduplicadas. Filas/metadatos desconocidos se conservan por serialización existente. Un producto histórico con más de13 imágenes únicas sigue visible; el guardado de esta UI se bloquea explícitamente hasta revisar/reducir su conjunto, evitando el truncado silencioso de adicionales. No se convierte automáticamente ni se borra nada en producción. Esta restricción requiere atención al revisar el candidato si el catálogo usa muchas fotos exclusivas por variante.

## Pruebas y evidencia

Nuevos recorridos integrados en `product-save-responsive.spec.js` (suite ya conectada a CI), con helper `photos:true` que ejecuta montaje real de galería, controlador `prodGuardar` y escritor `saveProductEditor`; almacenamiento, SDK, identidad y proveedor de imágenes son sintéticos. No confundirlo con CRUD autenticado en producción.

Los recorridos verifican cinco fotos, cuarta portada, guardar/reabrir, sexta, teclado, reemplazo, quitar no principal/portada con fallback, asociaciones de color/combinación, metadata conservada y resolvedor público. Otro caso usa cinco archivos PNG desde dispositivo: fallo, cola conservada, reintento y cancelación de pendiente/reemplazo. Matriz1/2/3/4/5/10/13 fotos. Seis viewports:390×844,844×390,768×1024,1024×768,1366×768,1920×1080. Capturas regenerables en `artifacts/unified-gallery/{ancho}x{alto}.png`; móvil y laptop inspeccionados, con ajuste posterior de ancho de acciones para no cortar palabras.

Primera suite nueva:6/6 guardado/reapertura con asociaciones PASS. Galería ampliada+render público:56/56 PASS antes del último ajuste visual/círculos. Node dirigido inicial41 PASS. Un primer helper cargaba Firebase real sin export addDoc: se corrigió el stub del proveedor, manteniendo pruebas de carga y guardado. Una ejecución anterior de guardado tuvo fallos de error repetido de Fase1: se corrige capturando intento explícito de Guardar; editar precio con error persistente continúa sin reset. Los resultados finales se registran en CURRENT_STATE/PR después de ejecutarlos, sin atribuir los anteriores al SHA final.

Verificación del candidato:27/27 recorridos dirigidos (13 tamaños con error repetido,14 nuevos de galería/carga);6/6 repetidos tras ajuste final del layout.45/45 Node;42 comprobaciones de auditoría de imágenes, estilos y39 comandos de preflight PASS. La tanda amplia tuvo294 PASS/1 FAIL: el fixture antiguo inyectaba attachColorPhotos y buscaba el widget adicional retirado. Se actualiza a inyectar el montaje unificado y mantiene aserciones de portada, miniaturas, cero borrados y biblioteca tardía del producto anterior. Repetición de ese caso y seis integraciones en `/tmp/unified-corrected-regression.log`; no se presenta la tanda inicial como295 aprobadas. Datos sintéticos y resolvedor público ejecutado sobre el resultado guardado: portada general photo4, combinación Dorado/Redondo photo4 y color Plateado photo2.

Los primeros registros de caché detectaron tags reutilizados durante iteración local y falta de huella del widget compartido en el plan; se renuevan tags y se regenera el plan completo contra la base. No se relaja ningún gate. Derivados finales se reconstruyen después del recibo; CI remota de la rama apilada y producción no acreditadas. Los screenshots son fixtures y no fotografías de productos reales.

Repetición del fixture corregido y seis integraciones:7/7 PASS. Compatibilidad adicional: al guardar una portada nueva o quitarla, el escritor comercial deriva también el alias `image` sólo si el producto ya lo tenía; el camino v1 hace el mismo espejo. No se acepta un campo arbitrario nuevo del cliente ni se migra el catálogo. Prueba Node verifica cambio, vaciado y ausencia de alias en productos nuevos para evitar que una foto eliminada reaparezca por fallback legacy. `validateProductEditorPatch` conserva su límite de tamaño de700000 caracteres y validaciones del servidor. Esto complementa el límite Firestore, sin prometer capacidad binaria adicional.

Cierre local:57/57 Node en `unified-node-complete.log`; build Pages/caché y39 comandos preflight finales exit0 (`unified-build-receipt.log`, `unified-preflight-receipt.log`). El plan final abarca9 fuentes protegidas y24 registros. El código no se fusiona ni publica; consultar SHA del PR para la cabeza exacta. Esta nota final sólo cambia evidencia y manifiesto regenerado.

Entrega: [PR1238](https://github.com/tintinaccs/tintin-web/pull/1238), listo para revisión, base rama de PR1237. Commit funcional `c2afdac8a`; el commit posterior registra esta URL y derivados. Sin auto-merge ni autorización para retargetear y fusionar a main. Las ejecuciones completas de CI filtradas a main no se infieren de los controles locales.

## Reversión y Fase 3

Revertir el delta de Fase2 con commit normal conserva el esquema de datos; restaurar montaje/imports y regenerar versiones/caché/protección/diagnóstico desde generadores. No revertir Fase1 ni restaurar datos sobre producción. No se requieren migraciones de Firestore ni cambios de reglas.

Fase3: revisar productos históricos con más de13 imágenes y capacidad real de almacenamiento antes de ampliar límites; evaluar actualización incremental de tarjetas para reducir reconstrucciones; accesibilidad con lector/Safari/dispositivos físicos, cancelación efectiva del transporte y métricas de carga. La galería única conserva responsabilidades separadas de publicación/stock y no autoriza cambiar checkout/pagos.
