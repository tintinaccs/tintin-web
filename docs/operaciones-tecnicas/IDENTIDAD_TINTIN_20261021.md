# Identidad visual Tintin — 21/10/2026

Base revisada: e96eea9300ec6c2be9aa7a1a73b4aba4618f8823. Codex /root. Pedido: sustituir el título de presentación del panel y revisar cada bloque de la web con una misma identidad.

## Criterio aplicado

Montserrat local; titulares semibold sin peso de cartel, tracking compartido y botones de la misma familia. Paleta rosa existente, tarjetas claras, bordes y espacios del sistema canónico. Las superficies siguen alternando y el fondo del header conserva la transparencia real publicada por1195. La tipografía se comparte mediante sistema-superficies-tintin.css, sin un nuevo tema ni un runtime paralelo. Los tamaños mantienen la jerarquía de cada contexto. Colores semánticos de alertas y preferencias guardadas de Apariencia conservados.

Panel: «Hoy en Tintin», «Tu espacio Tintin», accesos sin numeración y navegación visible «Inicio». Se mantienen los identificadores internos dashboard, los eventos nativos y permisos. Portada: «Un detalle muy vos», «Relojes Tintin» y una introducción de reseñas directa. Nosotros: valores expresados como cuidado del pedido y atención cercana, sin superlativos absolutos. La historia personal, textos legales, precios y datos del catálogo no se reescriben. Normalización sólo de tres frases antiguas exactas de la portada; un título personalizado conserva su valor.

## Inventario de páginas y bloques

Inventario desde HTML real con parse5; no cuenta scripts como contenido. Los bloques de Cuenta/Compra y los módulos del panel también contienen vistas dinámicas. Nosotros es un alias del About canónico. Google Search Console es un comprobante, no una página de interfaz.

| Página | Secciones HTML | Encabezados de referencia |
| --- | ---: | --- |
| 404.html | 0 | Esta página no existe |
| about.html | 4 | ¡Hola Tintina! · Conocé un poquito de Tintin ♡ · ¿Por qué Tintin se llama Tintin? 🎀 · NUESTROS VALORES |
| admin-images.html | 0 | Acceso denegado · Inicio / Hero |
| admin.html | 17 | Más opciones · En línea ahora · Ubicaciones de hoy · Centro estadístico general |
| cambios-devoluciones.html | 2 | Cambios y Devoluciones · ¿Cuándo puedo pedir un cambio? · ¿Cómo solicito un cambio? · Devoluciones |
| catalogo.html | 1 | Todo el catálogo |
| checkout.html | 1 | Finalizar compra en Tintin Accesorios |
| collections.html | 3 | NUESTRAS COLECCIONES · PRODUCTOS DESTACADOS |
| contact.html | 2 | ¿Dudas o consultas? · Envianos un mensaje · ¿Preferís escribirnos directo? |
| envios.html | 2 | Política de Envíos · Delivery — Zona Central · Encomienda — Interior del País · Retiro en San Lorenzo — Gratis |
| index.html | 7 | UN DETALLE MUY VOS · CATÁLOGO · MÁS VENDIDOS · RELOJES TINTIN |
| login.html | 1 | Qué lindo verte · Te falta poco |
| nosotros.html | 0 | Quiénes somos |
| perfil.html | 8 | Mi cuenta · Nueva dirección |
| preguntas-frecuentes.html | 2 | Preguntas Frecuentes · Compras · Métodos de pago · Envíos |
| privacidad.html | 2 | Política de Privacidad · 1. Qué datos recopilamos · 2. Para qué los usamos · 3. Dónde se guardan |
| product.html | 2 | Producto no encontrado · No pudimos cargar el producto · Tu selección · Tu selección Tintin |
| terminos.html | 2 | Términos y Condiciones · 1. Quiénes somos · 2. Cuenta y acceso · 3. Productos y precios |

## Evidencia

- PASS_LOCAL:141 pruebas Chromium sin reintentos, panel completo por12 dispositivos, transiciones de ancho, todos los módulos de .adm-section, navegación, permisos, foco, borradores, alternancia y borde transparente.
- PASS_LOCAL:3 casos adicionales recorren las18 páginas a390,1024,1440px y verifican la familia Montserrat y peso compartido en todos sus h1/h2/h3; el alias usa About. No se afirma que estos fixtures ejecuten integraciones reales.
- PASS_LOCAL:24 Node de contenido/paleta/hero; comprueban títulos personalizados, migración exacta y geometría del banner.
- PASS_LOCAL:tipografía37001 comprobaciones/18 páginas/10WOFF2;153 tokens globales/36 administrativos.
- Capturas de fixtures reales inspeccionadas: artifacts/identidad-panel-desktop.png y mobile.png. Navegador MCP extensión Chrome: About local inspeccionado; los avisos de conexión del servidor local no son hallazgos productivos.
- Smoke, generación final, CI y publicación: se registran en CURRENT_STATE conforme terminen.

Sin operaciones comerciales reales, cambios de cuentas, reglas, credenciales o permisos. El cierre sólo se declara publicado tras CI y despliegue del SHA final.
