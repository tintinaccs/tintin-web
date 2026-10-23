# Espaciado de Tintin — 23/10/2026

## Alcance y autoridad

Pedido: revisar los márgenes innecesarios de toda la tienda y el panel, en escritorio, laptop, tablet vertical/horizontal y móvil. Corrección visual; no es reparación integral ni modifica datos, Auth, Rules, pedidos, stock o integraciones.

La última autoridad visual existente es `css/theme/sistema-superficies-tintin.css`. Se reutiliza su escala de gutters y tarjetas y se añade un único token de separación de secciones, entre20 y32px. La regla específica del panel en `css/admin/dashboard-control.css` consume ese mismo token. No se crea otra hoja de tema ni se cambia la lógica de alternancia/fondos.

## Evidencia y cambio

MCP Playwright con extensión y Chrome existente midió17 documentos con contenido (Nosotros es alias de About) a390/1440px antes de modificar: reseñas con115,2px por lado en escritorio, Más vendidos96px, secciones de Colecciones/relacionados100px inferiores en móvil, Checkout80/104px más32px de margen, Perfil100/120px antes del footer y404 con mínimo de pantalla completa sumado a su pie. Las páginas secundarias restaban dos gutters al ancho y añadían otro padding en su contenedor.

Se compactan esas secciones a20–32px y sus encabezados a la escala compartida. Se elimina el doble gutter de las páginas secundarias y la reserva duplicada inferior en Perfil/Checkout.404 usa la altura real de contenido. Se conservan la reserva del header fijo, la barra móvil y safe areas, los campos/acciones táctiles, alturas y proporciones de fotografías/mapas, ancho de lectura legal, Login independiente y ajustes recientes de Catálogo. La cabecera conserva la máscara y el difuminado transparente.

La segunda medición MCP recorrió170 combinaciones sin desbordamiento horizontal de documento. No acredita Auth ni CRUD reales: se usaron documentos locales con fuentes de producción y sin ejecutar controladores de negocio. Los formularios y controles dinámicos se verifican por sus regresiones existentes con datos sintéticos.

## Verificación del candidato

- Primera matriz Chromium:10 casos aprobados,18 HTML y23 módulos administrativos por tamaño.
- Matriz ampliada:17 geometrías entre320 y2560px; incluye430,568 horizontal,767/768,820 vertical,1024 horizontal/1025,1180/1181,1280,1366,1440 y1920.17 WebKit y251 Chromium de regresiones aprobados sin reintentos; otros9 Chromium de formularios aprobados. Los17 casos nuevos de cada motor recorren306 distribuciones de páginas y391 estados de módulos.
- Fase8 UI/UX15 y Fase10 accesibilidad12 controles aprobados. Tipografía38.226 comprobaciones,18 páginas/10 WOFF2; integridad CSS y caché364 recursos/67 cargas dinámicas aprobadas.
- Capturas del panel móvil/escritorio generadas por pruebas locales e inspeccionadas. La captura MCP móvil posterior agotó su plazo; no se presenta como completada. La medición geométrica MCP sí concluyó.
- Plan protegido20 archivos/28 registros y build:pages completo aprobados localmente, con CSP de38 rutas, diagnóstico y caché verificados. CI/producción pendientes del SHA final. No se hereda PASS de otros commits.

La regresión nueva vive en `tests/ui-ux/section-flow-full-width.spec.js`, ya ejecutado por CI. Recorre las18 páginas (alias Nosotros verificado con About), activa localmente los23 módulos sólo para medir su presentación y comprueba overflow, gutters y reservas inferiores en17 tamaños. No cambia comandos, listas permitidas, auditores ni umbrales preexistentes.

Se conserva el trabajo concurrente #1211 de headers/dropup; sus fuentes JS/CSS no se editan en este cambio. Los derivados compartidos se regeneran desde las autoridades tras cualquier conciliación necesaria.
