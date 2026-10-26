# Reorganización visual del editor — 26/10/2026

La petición posterior a Fase 6 exige un cambio visible de distribución. La mejora
funcional de #1244 ya fue integrada; no equivalía a este rediseño.

## Resultado implementado

- Escritorio desde1024px: navegación lateral con sección actual identificada;
  desde1280px, tres columnas con edición central y vista previa independiente.
- Móvil y tablet: selector nativo legible, acceso a vista previa y acciones propias
  del editor siempre fuera del área desplazable. Se conserva la navegación táctil,
  teclado, zoom y espacio seguro del dispositivo.
- Nuevo/Editar abre Producto, en vez de presentar todos los bloques apilados.
  Revisar todo sigue disponible y los errores nuevos muestran los campos.
- Publicación, organización, Google y estadísticas comparten la sección
  Organización. La vista previa ya no comparte columna con controles editoriales.
- Campos amplios, jerarquía tipográfica y tarjetas de fotos reorganizadas. La
  navegación mantiene una única selección canónica y conserva los nodos originales.
- Cambiar de tamaño desde móvil a escritorio vuelve a mostrar la vista previa.
  Navegación larga tiene desplazamiento propio en pantallas de poca altura.

## Compatibilidad

La autoridad continúa en admin-app y su serializer, workspace privado y contratos
comerciales existentes. No se cambian precios, inventario, IDs, reglas de acceso,
checkout, pagos, pedidos, reservas ni backend. En fotos-por-color y galeria-unificada
sólo cambia la referencia transitiva de caché a la vista previa; no su comportamiento.
El cambio del controlador es la sección inicial en Nuevo/Editar.

Los botones laterales envían el mismo evento change al selector canónico. La
sección privada y su entrada lateral se ocultan con el permiso existente. No hay
una segunda copia de los campos ni almacenamiento nuevo.

## Evidencia y validación

Capturas antes/después: `evidencias/rediseno-visual/`, 320,390,600,768,1024,1440px.
Datos ficticios, shell real y controlador original; identidad, almacenamiento y
proveedor de imágenes aislados. El antes usa la presentación de main ed574b1c5;
los campos y la foto se alimentan con el mismo fixture. Son capturas de QA y no
capturas de una sesión productiva autenticada.

La prueba nueva verifica navegación visible, conservación de campos, guardado
accesible, ausencia de desbordamiento, recuperación de vista previa al redimensionar
y errores de página. Las regresiones comprueban guardado/recuperación, fotos,
variantes históricas, stock, costos privados, cancelación y fallos de conexión.

Resultado final de la corrida: **PENDIENTE DE CIERRE**. Las44 pruebas Node de
workspace, editor comercial y editorial aprobaron. Build y versionado de caché
aprobaron. El preflight y CI se registran antes del cierre del PR.

Primer recorrido:312/333 aprobadas;21 fallos de fixtures por selectores ambiguos,
posiciones antiguas o navegación implícita. Se adaptan las interacciones a la nueva
UI conservando las comprobaciones comerciales. La repetición dirigida detectó
otras dos expectativas antiguas y aprobó las19 pruebas de su corrección.
Una corrida posterior perdió el servidor local4173 (imports reales fallaron);
se conserva como intento fallido de entorno y se reinicia el servidor, sin cambiar
la aplicación para ocultar ese fallo. No se suman intentos como una sola corrida.

No se declara una mejora de velocidad: se conserva la optimización medida de
la galería de Fase6 y su regresión. Este cambio de distribución carece de un
benchmark de rendimiento de campo. Dispositivos físicos, sesión real de staging
y proveedores siguen NO EJECUTADOS. No se hicieron pagos ni pedidos reales.

## Integración y publicación

Rama nueva desde main vigente; se conserva #1245. Referencias de caché, diagnóstico,
CSP y plan protegido se regeneran por sus autoridades. La titular autorizó terminar
y fusionar; se exigen CI, CodeQL, preview y mantenimiento protegido de este candidato.
El recibo definitivo del SHA/merge/monitor se incorpora al PR al terminar; este
informe no atribuye anticipadamente una validación de producción al rediseño.
