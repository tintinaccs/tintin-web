# Mapa de código

Este documento indica qué archivo abrir según el problema. No hace falta recorrer todo el repositorio.

## Encabezado y navegación

| Necesidad | Archivo principal |
|---|---|
| Cambiar el encabezado de escritorio | `js/components/navigation/escritorio/encabezado-escritorio.js` |
| Cambiar estilos de escritorio | `css/components/navigation/escritorio/encabezado-escritorio.css` |
| Cambiar el indicador activo de escritorio | `js/components/navigation/escritorio/indicador-navegacion-escritorio.js` |
| Cambiar el encabezado o menú de tableta | `js/components/navigation/tableta/encabezado-tableta.js` |
| Cambiar estilos de tableta | `css/components/navigation/tableta/encabezado-tableta.css` |
| Cambiar la transición menú/colecciones de tableta | `js/components/navigation/tableta/control-menu-tableta.js` |
| Cambiar la barra móvil | `js/components/navigation/movil/encabezado-movil.js` |
| Cambiar estilos móviles | `css/components/navigation/movil/encabezado-movil.css` |
| Cambiar el halo o indicador móvil | `js/components/navigation/movil/indicador-navegacion-movil.js` |

## Buscar, Cuenta, Carrito y Colecciones

| Necesidad | Archivo principal |
|---|---|
| Estructura del buscador | `js/components/navigation/shared/search-panel.js` |
| Tamaño y diseño del buscador | `css/components/navigation/shared/surfaces.css` |
| Estructura de Mi Cuenta | `js/components/navigation/shared/account-drawer.js` |
| Diseño sólido de Mi Cuenta | `css/components/navigation/shared/surfaces.css` |
| Estructura del carrito | `js/components/navigation/shared/cart-drawer.js` |
| Contenido y operaciones del carrito | `script.js` y `js/components/cart/cart-sync.js` hasta completar su extracción modular |
| Estructura de colecciones móvil | `js/components/navigation/shared/collections-sheet.js` |
| Carga e imágenes de colecciones | `js/components/navigation/shared/collections-runtime.js` |
| Abrir o cerrar cualquier panel | `js/components/navigation/shared/surface-controller.js` |
| Fondo oscuro y capas | `js/components/navigation/shared/surface-layer.js` y `css/components/navigation/shared/surfaces.css` |

## Inicio y rutas

| Necesidad | Archivo principal |
|---|---|
| Montaje general de la navegación | `js/components/navigation/public-shell-entry.js` |
| Página activa | `js/components/navigation/shared/route-state.js` |
| Navegación entre páginas | `js/components/navigation/shared/router.js` |
| Carga de procesos | `js/components/navigation/shared/runtime.js` |
| Carga de CSS | `js/components/navigation/shared/assets.js` |
| Logo, versión y cortes por dispositivo | `js/components/navigation/shared/config.js` |
| Iconos y categorías base | `js/components/navigation/shared/icons.js` |

## Adaptadores que no deben editarse para cambios normales

Los siguientes archivos existen para no romper páginas antiguas, auditorías o importaciones existentes. No son la fuente principal:

```text
js/public-shell.js
js/ui-navigation-controller.js
js/components/navigation/legacy/navigation-desktop.js
js/components/navigation/legacy/navigation-tablet.js
js/components/navigation/legacy/navigation-mobile.js
js/components/navigation/legacy/navigation-shared.js
js/components/navigation/legacy/nav-collections.js
css/components/navigation/legacy/navigation-desktop.css
css/components/navigation/legacy/navigation-tablet.css
css/components/navigation/legacy/navigation-mobile.css
css/components/navigation/legacy/navigation-shared.css
css/components/navigation/shared/surface-controller.css
```

Cuando un problema esté en navegación, abrir el archivo equivalente dentro de `js/components/navigation/` o `css/components/navigation/`.

## Áreas todavía en migración

El archivo `script.js` conserva funciones históricas de catálogo, carrito, búsqueda y elementos de páginas. No debe crecer. Las correcciones nuevas se colocan en módulos específicos y, cuando una sección se extraiga, `script.js` queda como adaptador temporal.

El panel administrativo tiene sus propios archivos y no debe mezclarse con componentes públicos.
