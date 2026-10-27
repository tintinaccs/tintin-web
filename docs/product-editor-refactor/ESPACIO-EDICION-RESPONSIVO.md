# Espacio de edición y vista previa al final

Base: main `95091da938af0bd05b4c2cf998aa447ef70473a6`, que incorpora el editor
contextual de #1252. Ajuste solicitado para todas las pantallas, sin variantes
de diseño ni formularios paralelos.

## Cambios

- Vista previa única al final de `.adm-card-body`, después de los campos y
  acciones secundarias. Comienza plegada en todos los tamaños y conserva su
  lectura en vivo y el botón de regreso. Se retira el acceso superior.
- Navegación de apartados estática: deja de tapar campos al desplazarse.
- Galería sin altura máxima ni scroll interno. Se desplaza con el formulario,
  junto al resto de la edición.
- Escritorio/laptop: columna de datos más ancha (proporción 65/35), ancho útil
  sin límite de 1480 px, navegación compacta y márgenes menores.
- Tablet/móvil: columna única a ancho disponible, selector superior completo y
  campos con letra de al menos 16 px. No se añade scroll lateral.
- Estilos acotados al editor de productos. Campos, permisos, IDs, serializer,
  asociaciones, variantes y persistencia permanecen en sus autoridades actuales.

## Evidencia local

Prueba nueva `product-editor-space.spec.js`: ocho tamaños 320/390/600/768/1024/
1366/1440/1920. Comprueba ubicación final estable de la vista previa, ausencia
de acceso superior, navegación/galería no flotantes, letra mínima, espacio de
la columna de datos, contención y conservación del formulario tras guardar.

Primera pasada de espacio y contexto: 19 aprobadas. Después del ajuste final de
navegación y márgenes: 24 aprobadas, incluyendo guardado/reapertura del contexto
y vista previa con selección de variante, precio y stock. Corridas solapadas:
no se presentan como 43 casos únicos. Capturas de laptop y móvil inspeccionadas.

Regresiones antiguas de vista previa se actualizan para abrirla desde su resumen
inferior en todos los tamaños; conservan las aserciones de datos, stock,
asociaciones, precios, foco y regreso a edición.

Regresión ampliada final:197/197 Chromium aprobadas sin reintentos (4,8min),
incluyendo editor comercial, espacios privados, contexto por fotografía y
formulario responsive completo. Stage oficial preflight y build Pages, rutas,
CSP, diagnóstico, caché y diff-check: aprobados. CI del SHA final pendiente.
Proveedores reales, sesión administrativa productiva y hardware físico no se
certifican con estas fixtures de navegador.
