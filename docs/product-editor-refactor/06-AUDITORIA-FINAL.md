# Fase 6 — Integración y auditoría final

Actualización verificada el 27/10/2026: CI, merge protegido y publicación ya
aprobados. La versión de aplicación consultada es `65ee34250b20738591ec65cc097ee4e8bd452486`
(PR #1262), que conserva la única versión de seis fases y sus continuaciones.
Recibos por SHA y separación entre publicación y aceptación autenticada:
[CIERRE-VERIFICADO-20261027.md](CIERRE-VERIFICADO-20261027.md). Los resultados anteriores que siguen abajo son evidencia
fechada de su ejecución, no nuevas aprobaciones del código actual.

26/10/2026 · Codex /root · base `5dc6f781a81e0ae0dd07d84b0c742ec3d567e133`.
Rama local `codex/editor-fase6-integracion-20261026`. Sin merge ni deploy.

## Procedencia y alcance

Se contrasta el adjunto con el código y los antecedentes disponibles. La carpeta
solicitada no existía; la búsqueda y correspondencia de fases se documentan en
CONTINUIDAD-FASES-0-5.md. Los resultados antiguos no se heredan. Se reconstruye
la simplificación y el ciclo editorial faltantes, adaptando el delta pertinente
de #1228 a la galería y workspace de main. PayPal y checkout se excluyen.

## Hallazgos y correcciones comprobados

| ID / nivel | Ubicación y evidencia | Impacto y corrección mínima |
| --- | --- | --- |
| F6-01 HIGH, corregido | `espacio-trabajo-producto.js`, publish: convertía draft→active antes del commit. | Guardar un nuevo borrador podía intentar publicarlo. Ahora draft permanece privado y admite incompletos; exige seleccionar Activo para publicar. Pruebas de seis anchos y recuperación. |
| F6-02 MEDIUM, corregido | leave comparaba sólo contra el último autoguardado y guardaba/salía sin confirmación. | Cancelar no expresaba la intención pedida. Se conserva un checkpoint de apertura y un diálogo de tres decisiones; fallos impiden afirmar guardado completo o cerrar silenciosamente. |
| F6-03 MEDIUM, corregido | Atajos de `shopify-commerce-admin.js`: Escape prevenía la cancelación del dialog nativo. Fallo en los seis anchos antes de corregir. | Los handlers ceden a dialog abierto; se verifica Escape, foco y táctil. Durante una escritura del diálogo se bloquean decisiones contradictorias y Escape hasta recibir resultado. |
| F6-04 MEDIUM, corregido | Constructor protegía la identidad guardada deshabilitando Quitar; #1228 tenía su implementación anterior. | Se concilia retiro/restauración con grupos actuales, matriz, galería y snapshots. `active:false` conserva referencias, cantidades y precios; el consumidor público omite retiradas y conserva selección parcial válida. |
| F6-05 HIGH, corregido antes de entrega | `admin-app.js`, productVariantStockConfiguration: al conciliar #1228 se filtraba una fila nueva V1 antes de comprobar sus unidades. `legacy-quantity-before` reproduce Oro2/Plata0: quitar Oro dejaba sólo Plata. | Podía perderse una cantidad pendiente en el formulario antes de guardar. Se rechaza quitar una fila con stock positivo antes de filtrarla, conservando opción y total. Una fila nueva con0 sí puede quitarse. No se afectaron datos reales. |
| F6-06 LOW, corregido | `galeria-unificada.js`, render usaba replaceChildren ante eventos idénticos. | Se compara portada/orden/grupos/asociaciones y se conservan tarjetas cuando no cambian. La medición reproducible se registra en RENDIMIENTO.md; no altera uploads ni almacenamiento. |
| F6-07 LOW, corregido | Guía duplicaba navegación; Guardar progreso duplicaba el ciclo editorial. | Se conserva selector de secciones y ayuda contextual, se pliega Formato avanzado y se retira la acción redundante. Listado identifica tipo de borrador y fecha. |
| QA-01 LOW, fixture corregida | La prueba de vista previa importaba una URL histórica diferente de la montada por la interfaz, creando dos WeakMap de estado. Cinco fallos en la tanda amplia. | Usa la versión del baseline canónico. Se conservan todas las aserciones de foto, stock, precio y foco, y se repiten sus10 tamaños. No se corrige el código productivo para acomodar esa fixture. |
| QA-02 LOW, medición corregida | La primera ruta de baseline quedaba tapada por el mock genérico y medía dos veces la galería final. | Se instala después del mock y se exige500 reemplazos en base/0 en final. Sólo la comparación repetida aislada se usa en el informe; primer intento invalidado conservado. |
| ENV-01 MEDIUM, corregido | npm ls detectó dependencias preinstaladas distintas del lockfile. | npm ci instala671 paquetes. Las pruebas finales usan versiones exactas; las anteriores quedan exploratorias y separadas. No se cambia package/lock. |

## Fotografías y recorrido comercial

Las suites ejecutan carga desde PNG, cola, fallo y reintento; reemplazo, asociación
por color/combinación, quitar asociación y foto, ampliación, teclado, orden,
cuarta portada, guardar/reabrir y compatibilidad del alias histórico. El archivo
compartido no se elimina al quitar una referencia. Los datos guardados alimentan
el resolvedor público; tarjetas, búsqueda, ficha, carrito y favoritos tienen
pruebas propias. No se presume que cambiar la portada global sustituya una foto
explícita de variante: esa precedencia se conserva.

El recorrido emulado enlaza escritor del editor, proyección/selección comercial,
contrato de checkout, precio canónico, identificador de variante, fotografía,
creación del pedido y reserva. Se verifica concurrencia, idempotencia,
cancelación y devolución a la misma identidad. Retirar después de una reserva no
reactiva una opción al cancelar; restaurar conserva sus datos. No se modifica el
motor de checkout/pagos ni se realizan pagos reales. El proveedor simulado de las
pruebas existentes no equivale a una transacción con PayPal.

## Persistencia, seguridad y responsive

Se verifican producto simple, colores, atributos combinados,0/null, total derivado,
precio por combinación, costo privado y permisos. Workspace conserva aislamiento
por cuenta, revisión CAS y rechazo de cambios concurrentes. Rules y pruebas
negativas se ejecutan en emulador loopback con proyecto demo. Abrir/cerrar cinco
veces no multiplica la escritura de un mismo borrador; eso no certifica ausencia
de toda fuga de memoria. Los recorridos que capturan pageerror exigen cero errores
inesperados; los rechazos intencionados de red/permisos permanecen como pruebas
negativas, sin silenciar validaciones.

La matriz incluye320,390,600,768,1024 y1440px, además de otros tamaños de las
suites. Comprueba geometría, visibilidad, solapamiento/hit testing, acciones44px,
orientación, foco/Tab/Escape, navegación táctil emulada y viewport reducido.
Reflujo equivalente200% usa720CSSpx/DPR2 para una superficie de1440px; no es zoom
nativo del navegador ni prueba de teclado/safe areas de iPhone físico.

## Evidencia y decisión

Conteos exactos, intentos fallidos/resoluciones y pruebas individuales están en
MATRIZ-PRUEBAS-FINAL.md y evidencias/. Versiones, caché, manifiestos y plan se
regeneran desde sus autoridades; no se relajan gates, Rules ni permisos.

La aceptación local por sí sola no aprueba producción. La CI y la publicación
ya están confirmadas en los recibos de cierre; faltan sesión/proveedores del
producto de QA y dispositivos/lector/safe areas reales. Las restricciones
y el siguiente paso de cada pendiente están en INCIDENCIAS-PENDIENTES.md. No se
afirma que el proyecto esté completamente terminado ni que #1228 se haya
fusionado: su delta de pagos sigue separado.
