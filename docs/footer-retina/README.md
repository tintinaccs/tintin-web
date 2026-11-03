# Nitidez del símbolo original NOVAK en Retina

Continuación de PR1323 sobre main0da99f5f8ae06d8cec028f81cf00713addee1074. Se mantienen el pie único, mayúsculas, columnas, destino, año automático y biblioteca de Skills. Este ajuste corrige un problema de renderizado observado al inspeccionar capturas reales.

En WebKit27.2, el SVG del kit —que contiene un PNG original y un filtro de transparencia— se veía rasterizado a su tamaño CSS42×40 y después ampliado en una pantalla3×. Chromium mostraba los mismos píxeles correctamente. La resolución disponible era suficiente: PNG1536×1024, recorte310×290. `naturalWidth` del SVG describe su viewport y no esa resolución real.

| WebKit3× antes | WebKit3× después |
| --- | --- |
| ![Textura con bordes escalonados antes del ajuste](webkit-before-3x.png) | ![Símbolo original renderizado a la densidad correcta](webkit-after-3x.png) |

Ambas son capturas del mismo SVG original, sin redibujar, regenerar ni editar el logo. No se usan estos PNG como recursos del sitio. El SVG del producto conserva SHA256 `d031d3ee6ef4df3f62f3a5995d858d6a169ee2681f69de9cf8251720f1ff05f1`.

La integración CSS entrega al SVG un lienzo interno acorde a la densidad y usa zoom inverso para conservar su espacio visible42×40. Las consultas de resolución responden a cambios de pantalla y orientación sin JavaScript. Un feature query mantiene el comportamiento original donde no se soporte el ajuste. La compensación de desplazamiento conserva2px de desplazamiento en CSS y escala1.06; solo se aplica sin preferencia de movimiento reducido. El kit original de CSS/SVG no cambia.

La prueba de densidad se amplía a1×/2×/3×/4× en ocho tamaños, hasta1920×1080. Comprueba la cobertura de píxeles original del recorte SVG, ambas marcas cargadas, opacidad/ausencia de blur CSS, desplazamiento y escala perceptibles al pasar el cursor y enfocar con teclado, y ausencia de movimiento cuando se solicita reducirlo. Touch se comprueba a3×. La inspección visual de las capturas completa esas mediciones: los tamaños naturales por sí solos no detectaban la textura borrosa del navegador.

No se certifica hardware físico iOS. WebKit y Chromium son pruebas de motores en este entorno. No hay cambios comerciales ni de datos.

Validación local del árbol final:64pruebas Chromium y29WebKit aprobadas sin reintentos;17documentos×10tamaños, densidades1–4× y pruebas de hover/foco/reduced-motion/touch. Preflight y generadores aprobados, con el SVG y CSS del kit sin cambios. CI/fusión/publicación de esta continuación se registran en su PR por SHA/run.
