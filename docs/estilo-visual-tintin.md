# Estilo visual de Tintin — 2026-10-11

La dirección común es una boutique romántica de inspiración vintage: rosa Tintin (#F8AACA), texto ciruela (#713C53), fondos blancos y marfil rosado, tipografía Montserrat, contornos finos, formas suaves y fotografías protagonistas. Las superficies son sólidas, sin vidrio. La función de cada página cambia su distribución, no su identidad.

| Páginas | Presentación que existe | Capa común y ajuste de esta revisión |
| --- | --- | --- |
| Inicio | Editorial: portada, colecciones y productos destacados | Tema compartido; tarjetas con foto cuadrada, colores sólidos y acciones alineadas |
| Catálogo y colecciones | Boutique comercial: filtros y grillas de productos | Misma tarjeta, paleta, tipografía y controles de compra |
| Producto | Ficha de boutique con galería, opciones y recomendaciones | Colores circulares; etiqueta Color; imagen responsive y miniatura sincronizadas; recomendaciones compactas y fila desplazable en móvil |
| Checkout | Formulario por etapas y resumen transaccional | Misma paleta; columnas legibles; confirmación independiente del vaciado del carrito; ticket descargable, compartible e imprimible |
| Nosotros, contacto, preguntas, términos y privacidad | Editorial informativa: lectura y bloques de información | Tema compartido y superficies blancas; mantienen jerarquía adecuada para texto |
| Login y cuenta/perfil | Formularios de acceso y panel personal | Paleta y superficies compartidas; conservan sus controles y validaciones |
| Panel administrativo | Interfaz operativa de tablas, formularios y gestión | Tokens administrativos de la misma marca; conserva su densidad de trabajo |
| Paneles del header | Catálogo, carrito, cuenta, búsqueda y notificaciones | Cabeceras continuas, superficies sólidas, cierre accesible; en móvil ocupan el viewport con reserva para la navegación inferior |

Fuentes: `styles.css`, `css/core/tema-unificado-tintin.css`, `css/theme/sistema-superficies-tintin.css`, las hojas de cada página y `css/components/navigation/compartido/coherencia-visual.css`. Estas capas comparten identidad; sus nombres históricos no significan que deban eliminarse: existen consumidores activos. No se borra un hash CSP utilizado ni se elimina una URL de caché histórica como si fuera código muerto. Los generadores verifican los recursos actuales y sus hashes.

Los hex personalizados del catálogo prevalecen sobre la paleta nominal. Un círculo de color indica el acabado declarado, no promete una medición fotométrica de una foto. El estado agotado conserva el aviso y las restricciones de compra; no atraviesa fotos ni colores con una raya.

Alcance de la evidencia: fixtures con renderizadores y CSS reales, viewports y navegadores automatizados. No equivale a una aprobación en dispositivos físicos ni a una compra real de producción.
