# Sistema de diseño vigente — Tintin

Base inspeccionada: `5a2ea0f63`, 28/10/2026 UTC. Documentación del diseño
existente; no autoriza un rediseño ni sustituye los tokens ejecutables.

## Autoridades y precedencia

1. Identidad aprobada en `docs/identidad-visual-tintin.md`.
2. Tokens semánticos en `css/core/tokens-color.css` y catálogo/controlador en
   `js/components/color/`; el esquema publicado puede cambiar sus valores.
3. Aliases en `css/core/tema-unificado-tintin.css`; administración deriva de
   los mismos colores mediante `css/admin/admin-color-tokens.css`.
4. Contratos de `docs/contratos-calidad.md` y componentes canónicos.

Este documento describe esas autoridades. Ante discrepancias, revisar la cascada
y el esquema publicado; no copiar valores antiguos de `tokens-tintin.css` como
una segunda paleta. Refero Styles y UI/UX Pro Max no están disponibles en esta
sesión; no son dependencias de la aplicación.

## Identidad y composición

Marca cercana, femenina, minimalista y elegante. Mantener el logo original plano,
sin reconstruirlo ni agregar 3D. Rosa principal inicial `#F8AACA`, rosa suave
`#FDECF2`, texto `#222222` y superficies blancas `#FFFFFF`. Son valores iniciales,
no una autorización para pisar el esquema configurado por la propietaria.

Los colores semánticos de errores, éxito, estados, botones, campos y badges se
consumen por `--color-*`; no comunicar un resultado sólo con color. El proyecto
usa una paleta de marca deliberadamente restringida: acompañar con texto e icono.
No introducir colores de otras marcas para «modernizar» la interfaz.

Montserrat local para títulos y cuerpo, con `font-display` que evita texto
invisible. Conservar la jerarquía semántica de encabezados; no usar tamaños como
sustituto de H1/H2. En tablet/móvil los formularios mantienen campos legibles
de 16px y controles esenciales de al menos 44px según el contrato actual.

No existe una escala única de espaciado completamente normalizada: se observan
valores de 8/12/16/24px, entre otros. Reutilizar el componente más próximo, no
atribuir al proyecto un sistema inexistente ni reemplazar todos los valores.
Los aliases generales incluyen radios 8/16/24px y pill; el tema público usa
20/14px, y formularios verificados utilizan campos14px y tarjetas16–20px.
Conservar los radios del componente concreto. Sombras suaves derivan de tokens
de tarjeta; no aumentar blur/sombras globales sin medir su coste.

## Componentes y fuentes

Para Nuevo/Editar producto, la captura Studio entregada por la titular el
28/10/2026 precisa la composición aprobada: lienzo neutro suave, tarjeta blanca
continua, pestañas con subrayado rosa y fotos junto a los controles del color.
Esta excepción de superficie se deriva de los tokens del tema y se limita al
editor; no sustituye el rosa de marca ni rediseña otras páginas. Montserrat,
semántica de permisos/estados y campos originales se conservan. Detalle y
evidencia en `docs/product-editor-refactor/STUDIO-REFERENCIA-20261028.md`.

| Familia | Fuente canónica | Regla |
| --- | --- | --- |
| Botones públicos | `styles.css`, `css/core/tema-unificado-tintin.css` | Una acción primaria; secundarias outline; destructivas explícitas |
| Campos | Tema unificado y CSS de cada formulario | Label real, ayuda/error asociados, conservar entrada al fallar |
| Tarjetas y tablas | Tema, CSS público y `css/admin/` | Proporciones reservadas; tablas con contenedor o adaptación, sin recorte silencioso |
| Navegación | `js/components/navigation/` | Un shell por dispositivo, paneles compartidos y foco restaurado |
| Modales y avisos | `js/quality/`, navegación compartida, operaciones admin | Nombre accesible, teclado, Escape cuando corresponde, retorno del foco |
| Carrito | `js/components/cart/sincronizacion-carrito.js` | Misma autoridad comercial; no duplicar cálculo de precio/stock |
| Editor y galería | `js/admin/products/`, `css/admin/shopify-commerce-admin.css` | Conservar nodos, foco, selección, scroll y asociaciones por opción |
| Producto público | `tienda.js`, `js/pages/product/`, galería compartida | Foto, variante, disponibilidad y precio sincronizados |

## Estados obligatorios

Default legible; hover como complemento; `:focus-visible` perceptible; active
identificable con más que color; disabled realmente inactivo y explicado cuando
corresponde. Loading mediante skeleton para estructura y estado del botón para
acciones breves. Success sólo tras respuesta confirmada. Error persistente con
reintento útil. Empty distingue lista vacía, filtro sin coincidencias, permiso
denegado y error de carga. `aria-live`/`aria-busy` comunican cambios relevantes.

El loader de entrada conserva su identidad y su salida de emergencia. No usarlo
para ocultar fallos o consultas redundantes. Respetar `prefers-reduced-motion`
desde `css/quality/movimiento.css` y `accesibilidad-global.css`.

## Responsive y accesibilidad

Breakpoints reales del shell: móvil≤767px, tablet768–1024px, escritorio≥1025px
(`js/components/navigation/compartido/configuracion.js`). Los componentes pueden
tener límites propios justificados por su contenido. Matriz solicitada:
360,390,768,1024,1280,1440,1920px; añadir320 y orientaciones horizontales existentes.

No forzar una columna en todos los casos. Comprobar foco, zoom/reflow, texto
largo, teclado móvil, tablas, paneles y barra inferior. Evitar remontar formularios
o desplazar arriba por una selección local. Las imágenes reservan proporción;
las de producto no se deforman para llenar una tarjeta.

Objetivo WCAG2.2AA, no certificación obtenida. Contraste debe comprobarse sobre
pares efectivos y todos los estados, incluyendo esquemas configurados. La suite
de componentes aislados no demuestra por sí sola accesibilidad de páginas completas.
Resultados y límites de esta revisión: `docs/QA_REPORT.md`.
