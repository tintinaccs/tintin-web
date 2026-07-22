# Contratos de calidad de Tintin Web

Este documento define la calidad observable y técnica de todas las páginas públicas y administrativas. Una corrección visual no está terminada si rompe datos, interacción, accesibilidad, rendimiento, SEO, seguridad o consistencia en otra pantalla.

## 1. Cobertura obligatoria

Cada cambio aplicable se comprueba en:

- 1920 × 1080
- 1440 × 900
- 1280 × 720
- 1024 × 768
- 768 × 1024
- 390 × 844
- 320 × 568

También se prueban puntos limítrofes de los breakpoints para detectar cambios bruscos, superposiciones y componentes duplicados.

Las superficies compartidas —header, menú, búsqueda, cuenta, carrito, colecciones, avisos, WhatsApp, footer, modales y tabbar— forman parte de todas las páginas donde aparecen. Corregir una de ellas obliga a validar todos sus consumidores.

## 2. Responsive coherente

- Desktop y tablet comparten el header previsto; mobile utiliza su navegación específica.
- Nunca aparecen simultáneamente dos navegaciones principales.
- No existe overflow horizontal de raíz.
- Menús, paneles, modales y drawers quedan dentro del viewport y son utilizables con contenido largo.
- El contenido no queda debajo de headers, barras fijas, avisos de privacidad ni botones flotantes.
- La tabbar móvil conserva separación segura respecto del footer y del contenido final.
- Las imágenes mantienen proporción y dimensiones reservadas para evitar saltos.
- Las tablas administrativas tienen estrategia explícita: columnas adaptadas, scroll controlado o transformación móvil; nunca recorte silencioso.
- La vista móvil no es simplemente la versión desktop reducida: prioriza orden, controles táctiles y lectura.

La auditoría responsive se repite automáticamente una vez cuando una ejecución aislada no es concluyente. Un segundo fallo se considera real; no se oculta ni entra en un bucle infinito.

## 3. Estados completos y recuperación

Toda vista que dependa de datos o de una acción debe contemplar:

```text
inicial
cargando
éxito
vacío
error recuperable
sin conexión
permiso denegado
sesión vencida
reintento
```

Reglas:

- Cargando no se representa como cero ni como una lista vacía falsa.
- Un error técnico no deja un botón aparentemente activo sin respuesta.
- Los formularios conservan lo escrito cuando el error es recuperable.
- Al recuperar conexión, las páginas relevantes vuelven a consultar o sincronizar automáticamente de forma acotada.
- Los reintentos no duplican pedidos, correos, eventos analíticos ni escrituras.
- Los mensajes para la clienta son comprensibles; la información técnica queda en diagnóstico.
- Los loaders tienen salida explícita y timeout de seguridad. No se usan para esconder consultas innecesarias.

## 4. Accesibilidad

El objetivo es una experiencia equivalente a WCAG 2.2 AA dentro del alcance del proyecto.

- Navegación completa con teclado.
- Foco visible, orden lógico y devolución del foco al cerrar superficies.
- Un solo H1 significativo por página pública.
- Inputs con label real, instrucciones y errores asociados.
- Botones e iconos con nombre accesible.
- Estados dinámicos comunicados mediante `aria-live`, `aria-busy` u otros mecanismos apropiados.
- Modales con semántica, foco contenido y cierre por Escape cuando corresponde.
- Contraste validado mediante los pares de color del sistema.
- Áreas táctiles de al menos 44 × 44 píxeles en controles esenciales.
- Texto alternativo útil en imágenes informativas y alternativa vacía en imágenes decorativas.
- No se comunica información únicamente mediante color.
- `prefers-reduced-motion` desactiva o reduce animaciones no esenciales.
- Zoom y reflow no deben ocultar controles esenciales.

## 5. Rendimiento

La velocidad se mide, no se supone. Los cambios deben conservar los presupuestos existentes y evitar regresiones.

Objetivos de experiencia:

- LCP ≤ 2,5 s en condiciones razonables de prueba.
- INP ≤ 200 ms.
- CLS ≤ 0,1.

Controles del proyecto:

- CSS estructural y shell crítico disponibles temprano.
- Fuentes con estrategia que evita texto invisible.
- Imágenes con carga diferida cuando no son críticas, URL sanitizada, proporción estable y tamaño adecuado.
- Nada de descargar el catálogo completo cuando una página necesita un subconjunto.
- Consultas Firestore paginadas o compartidas cuando corresponde.
- Listeners reutilizados y cancelados al abandonar la vista.
- Sin listeners duplicados para settings, productos o sesión.
- Service worker y versiones de caché actualizados cuando cambia un recurso crítico.
- JavaScript no esencial no bloquea el primer render.
- El loader se libera por señal de página lista y por salida de seguridad.
- Las optimizaciones pasan una auditoría de regresión que verifica seguridad, contenido, comercio y experiencia.

## 6. SEO y compartición

Cada página pública indexable debe tener, según corresponda:

- título único y útil;
- meta description;
- canonical correcto;
- Open Graph y tarjeta social coherentes;
- un H1;
- URL estable;
- contenido legible sin depender de una interacción imposible para el buscador;
- datos estructurados válidos para organización, producto, oferta, breadcrumb u otros tipos pertinentes;
- imágenes con texto alternativo;
- estado indexable coherente con su función.

Además:

- `sitemap.xml` inventaría páginas públicas válidas.
- `robots.txt` permite lo público y evita superficies internas.
- Login, perfil, checkout y administración no se indexan.
- Una URL retirada tiene redirección o 404 útil, no una pantalla vacía.
- Precio y disponibilidad estructurados no contradicen el producto visible.
- Al compartir por WhatsApp o redes aparece título, descripción e imagen de Tintin, no datos genéricos de una plantilla.

## 7. Consistencia visual y lógica

- Colores, tipografías, espacios, radios, sombras, capas, breakpoints y estados provienen de tokens o componentes compartidos.
- Los textos de acciones equivalentes usan el mismo vocabulario.
- Precio, stock, estado, rol y promociones tienen una sola fuente lógica.
- No se agregan estilos de parche al final de un archivo sin revisar la regla original y todos los consumidores.
- No se duplican componentes para resolver una sola pantalla.
- Animaciones responden a una intención y respetan movimiento reducido.
- El diseño conserva identidad propia de Tintin; no mezcla iconos, estilos o patrones inconexos.
- Los estados hover, focus, disabled, loading, success y error están definidos, no improvisados por navegador.

## 8. Diagnóstico y observabilidad

- Errores inesperados se capturan con página, versión, contexto técnico y acción, sin datos sensibles.
- El panel distingue dato vacío de consulta fallida.
- Cada despliegue puede relacionarse con un commit o manifiesto.
- Los diagnósticos no declaran como activo un servicio externo que todavía necesita configuración.
- Los fallos transitorios pueden reintentarse de forma acotada; los errores reproducibles deben fallar la integración.
- Los reportes y capturas de las auditorías quedan como artefactos temporales de GitHub Actions.

## 9. Compatibilidad y regresión

Antes de integrar se comprueban:

- Chrome y Chromium automatizado.
- Geometría en las siete pantallas y límites de breakpoint.
- Invitado y estados autenticados aplicables.
- Navegación directa, recarga, volver/avanzar y restauración desde caché del navegador.
- Online, offline y recuperación.
- Contenido corto, largo, vacío y con imagen fallida.
- Página sin datos precargados.
- Todas las superficies compartidas abiertas.

## 10. Definición de terminado del Nivel 3

Un cambio de calidad está terminado solo cuando:

1. Las auditorías estáticas pasan.
2. La auditoría global de geometría pasa, incluido su reintento automático acotado.
3. El smoke test abre todas las páginas sin errores propios.
4. Las auditorías de rendimiento y regresión pasan.
5. SEO, accesibilidad y estados se verifican en todos los consumidores afectados.
6. No aparecen diferencias entre desktop, tablet y mobile que contradigan el contrato.
7. El Pull Request, el merge y el despliegue quedan verdes.
